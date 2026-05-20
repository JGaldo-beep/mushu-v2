import { isAlreadyAuthenticated, openLoginWindow } from './login-window.js';
import { createBackgroundWindow } from './browser-view.js';
import { attachScanner, getLastContext, forceSnapshot, getCredentials } from './scanner.js';
import { runAgent } from './agent.js';
import { synthesizeSpeech } from './tts.js';
import * as rappiApi from './api.js';

const state = {
  connected: false,
  connecting: false,
  rappiWindow: null,
  cleanupScanner: null,
  conversationHistory: [],
  conversationTimeout: null,
  pendingProduct: null,
  pendingSearch: null,
  // pendingSearch: { results: [{storeId, storeName, storeType, productId, productName, price, ...}], query: string }
};

const CONVERSATION_RESET_MS = 2 * 60 * 1000;

function resetConversation() {
  state.conversationHistory = [];
  state.pendingProduct = null;
  state.pendingSearch = null;
  if (state.conversationTimeout) {
    clearTimeout(state.conversationTimeout);
    state.conversationTimeout = null;
  }
}

function scheduleConversationReset() {
  if (state.conversationTimeout) clearTimeout(state.conversationTimeout);
  state.conversationTimeout = setTimeout(resetConversation, CONVERSATION_RESET_MS);
}

function formatPrice(p) {
  if (p == null) return '?';
  return Math.round(p).toLocaleString('es-CO');
}

export function initRappiMode() {
  // No setup needed at init time — resources are created on demand.
}

export async function connectRappi(broadcast) {
  if (state.connecting || state.connected) return;

  state.connecting = true;
  broadcast('frontend_state_changed', {});

  try {
    const alreadyAuthed = await isAlreadyAuthenticated();
    if (!alreadyAuthed) {
      await openLoginWindow();
    }
  } catch (error) {
    state.connecting = false;
    broadcast('frontend_state_changed', {});
    const msg = error instanceof Error ? error.message : String(error);
    broadcast('transcription_error', msg);
    return;
  }

  try {
    const win = createBackgroundWindow();
    state.rappiWindow = win;

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Rappi tardó demasiado en cargar.')), 30000);
      win.webContents.once('did-finish-load', () => {
        clearTimeout(timeout);
        win.show();
        // Welcome message
        synthesizeSpeech('Hola, soy Sofía y estoy aquí para realizar tus pedidos de Rappi. Tú dime y yo lo busco.')
          .then((buf) => broadcast('rappi_speak', { audio: buf.toString('base64') }))
          .catch(() => {});
        resolve();
      });
      win.once('closed', () => {
        clearTimeout(timeout);
        reject(new Error('Ventana de Rappi cerrada inesperadamente.'));
      });
    });

    state.cleanupScanner = attachScanner(win.webContents);

    win.once('closed', () => {
      _handleWindowClosed(broadcast);
    });

    state.connected = true;
    state.connecting = false;
    broadcast('frontend_state_changed', {});
    console.info('[rappi] conectado y scanner adjunto');
  } catch (error) {
    state.connecting = false;
    if (state.rappiWindow && !state.rappiWindow.isDestroyed()) {
      state.rappiWindow.destroy();
    }
    state.rappiWindow = null;
    broadcast('frontend_state_changed', {});
    const msg = error instanceof Error ? error.message : String(error);
    broadcast('transcription_error', `Rappi: ${msg}`);
  }
}

export async function disconnectRappi() {
  resetConversation();
  state.cleanupScanner?.();
  state.cleanupScanner = null;

  if (state.rappiWindow && !state.rappiWindow.isDestroyed()) {
    state.rappiWindow.destroy();
  }
  state.rappiWindow = null;
  state.connected = false;
  state.connecting = false;
}

// ── API action handlers ────────────────────────────────────────────────────────

async function agentRound(messages, context, broadcast) {
  broadcast('rappi_thinking', { active: true });
  try {
    const result = await runAgent(messages, context);
    messages.push({ role: 'assistant', content: JSON.stringify({ reply: result.reply, action: result.action }) });
    broadcast('rappi_thinking', { active: false });
    return result;
  } catch (err) {
    broadcast('rappi_thinking', { active: false });
    throw err;
  }
}

async function handleSearchProduct(action, broadcast) {
  const creds = getCredentials();
  state.pendingSearch = null;

  if (!creds.token) {
    await speakReply('Navega un momento en la ventana de Rappi para que pueda conectarme. Luego vuelve a pedirlo.', broadcast);
    await executeAction({ type: 'navigate_to_search', query: action.productName }).catch(() => {});
    return;
  }

  await speakReply('Buscando...', broadcast);

  let results;
  try {
    results = await rappiApi.searchProducts(action.productName, creds);
  } catch (err) {
    console.warn('[rappi:search_product] API falló, usando DOM:', err.message);
    await executeAction({ type: 'navigate_to_search', query: action.productName }).catch(() => {});
    return;
  }

  if (!results.length) {
    await speakReply(`No encontré "${action.productName}" en Rappi. ¿Quieres buscar otra cosa?`, broadcast);
    return;
  }

  // Deduplicate by storeName + productName, keep top results
  const seen = new Set();
  const deduped = results.filter((r) => {
    const key = `${r.storeName}::${r.productName}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const top = deduped.slice(0, 4);

  if (top.length === 1) {
    await proceedWithProduct(top[0], broadcast);
    return;
  }

  // Multiple options — present them and let user pick
  state.pendingSearch = { results: top, query: action.productName };

  const optionsList = top
    .map((r, i) => `${i + 1}. ${r.productName} en ${r.storeName} — ${formatPrice(r.price)} pesos`)
    .join('; ');

  const prompt = `[Post-búsqueda] Encontraste ${top.length} opciones para "${action.productName}": ${optionsList}. Preséntale las opciones brevemente (máx 2 oraciones) y pregúntale cuál quiere. No menciones toppings todavía.`;
  state.conversationHistory.push({ role: 'user', content: prompt });
  const context = { ...getLastContext(), pendingProduct: null, pendingSearch: state.pendingSearch };

  const result = await agentRound(state.conversationHistory, context, broadcast).catch(() => null);
  if (result) await speakReply(result.reply, broadcast);
}

async function handleSelectProduct(action, broadcast) {
  if (!state.pendingSearch) return;

  const userChoice = String(action.productName || '').toLowerCase().trim();
  const results = state.pendingSearch.results;

  const scored = results.map((r) => {
    const name = r.productName.toLowerCase();
    const store = r.storeName.toLowerCase();
    let score = 0;
    if (name === userChoice) score = 100;
    else if (name.includes(userChoice) || userChoice.includes(name)) score = 80;
    else {
      const words = userChoice.split(/\s+/).filter((w) => w.length > 2);
      score = words.filter((w) => name.includes(w) || store.includes(w)).length * 20;
    }
    return { ...r, score };
  }).sort((a, b) => b.score - a.score);

  const matched = scored[0]?.score > 0 ? scored[0] : null;

  if (!matched) {
    const opts = results
      .map((r, i) => `${i + 1}. ${r.productName} en ${r.storeName} a ${formatPrice(r.price)} pesos`)
      .join('; ');
    const retryPrompt = `[Post-selección] El usuario dijo "${action.productName}" pero no coincide claramente con ninguna opción: ${opts}. Pide que aclare cuál quiere.`;
    state.conversationHistory.push({ role: 'user', content: retryPrompt });
    const context = { ...getLastContext(), pendingSearch: state.pendingSearch, pendingProduct: null };
    const result = await agentRound(state.conversationHistory, context, broadcast).catch(() => null);
    if (result) await speakReply(result.reply, broadcast);
    return;
  }

  state.pendingSearch = null;
  await proceedWithProduct(matched, broadcast);
}

async function proceedWithProduct(product, broadcast) {
  const creds = getCredentials();
  let toppingGroups = [];
  if (product.has_toppings) {
    try {
      toppingGroups = await rappiApi.getProductToppings(product.storeId, product.productId, creds);
    } catch (err) {
      console.warn('[rappi:toppings] no se pudieron obtener:', err.message);
    }
  }

  state.pendingProduct = {
    storeId: product.storeId,
    productId: product.productId,
    storeType: product.storeType ?? 'restaurant',
    productName: product.productName,
    storeName: product.storeName,
    price: product.price,
    real_price: product.real_price,
    markup_price: product.markup_price,
    toppingGroups,
    resolvedToppings: [],
  };

  const requiredGroups = toppingGroups.filter((g) => g.required);
  let prompt = `[Post-selección] Producto elegido: "${product.productName}" en ${product.storeName} a ${formatPrice(product.price)} pesos.`;

  if (requiredGroups.length) {
    const g = requiredGroups[0];
    const opts = g.options
      .map((o) => `${o.description}${o.price > 0 ? ` (+${formatPrice(o.price)} pesos)` : ' (incluido)'}`)
      .join(', ');
    prompt += ` Confirma el producto con precio y pregunta qué quiere en el acompañamiento obligatorio "${g.name}": ${opts}. Solo esa pregunta.`;
  } else {
    prompt += ` No tiene personalización obligatoria. Confirma el producto con precio y pregunta al usuario si lo agregamos.`;
  }

  state.conversationHistory.push({ role: 'user', content: prompt });
  const context = { ...getLastContext(), pendingProduct: state.pendingProduct };

  const result = await agentRound(state.conversationHistory, context, broadcast).catch(() => null);
  if (result) {
    await speakReply(result.reply, broadcast);
    if (result.action?.type === 'add_to_cart_api') {
      await handleAddToCartApi(broadcast);
    }
  }
}

async function handleSelectTopping(action, broadcast) {
  if (!state.pendingProduct) {
    await speakReply('No hay ningún producto pendiente de personalización.', broadcast);
    return;
  }

  const { toppingGroups, resolvedToppings } = state.pendingProduct;
  const userChoice = String(action.toppingDescription || '').toLowerCase();

  const unresolvedRequired = toppingGroups.filter((g) => {
    if (!g.required) return false;
    return !resolvedToppings.some((t) => g.options.some((o) => o.id === t.id));
  });

  if (!unresolvedRequired.length) {
    await handleAddToCartApi(broadcast);
    return;
  }

  const targetGroup = unresolvedRequired[0];
  const matched = targetGroup.options.find((o) => {
    const desc = o.description.toLowerCase();
    return desc.includes(userChoice) || userChoice.includes(desc);
  });

  if (!matched) {
    const opts = targetGroup.options.map((o) => o.description).join(', ');
    const retryPrompt = `[Post-selección] El usuario dijo "${action.toppingDescription}" pero no coincide con las opciones de "${targetGroup.name}": ${opts}. Pide aclaración indicando las opciones válidas.`;
    state.conversationHistory.push({ role: 'user', content: retryPrompt });
    const context = { ...getLastContext(), pendingProduct: state.pendingProduct };
    const result = await agentRound(state.conversationHistory, context, broadcast).catch(() => null);
    if (result) await speakReply(result.reply, broadcast);
    return;
  }

  state.pendingProduct.resolvedToppings.push({
    id: matched.id,
    topping_category_id: targetGroup.id,
    description: matched.description,
    units: 1,
    price: matched.price,
    real_price: matched.real_price,
    markup_price: matched.markup_price,
  });

  const remainingRequired = unresolvedRequired.slice(1);
  if (remainingRequired.length) {
    const nextGroup = remainingRequired[0];
    const opts = nextGroup.options.map((o) =>
      `${o.description}${o.price > 0 ? ` (+${formatPrice(o.price)} pesos)` : ' (incluido)'}`
    ).join(', ');
    const continuePrompt = `[Post-selección] El usuario eligió "${matched.description}" para "${targetGroup.name}". Ahora pide que elija en "${nextGroup.name}": ${opts}.`;
    state.conversationHistory.push({ role: 'user', content: continuePrompt });
    const context = { ...getLastContext(), pendingProduct: state.pendingProduct };
    const result = await agentRound(state.conversationHistory, context, broadcast).catch(() => null);
    if (result) await speakReply(result.reply, broadcast);
  } else {
    await handleAddToCartApi(broadcast);
  }
}

async function handleAddToCartApi(broadcast) {
  const p = state.pendingProduct;
  if (!p) return;

  const creds = getCredentials();
  console.log('[rappi:addToCart] pendingProduct:', JSON.stringify({ storeId: p.storeId, productId: p.productId, storeType: p.storeType, price: p.price, toppings: p.resolvedToppings.length }));
  console.log('[rappi:addToCart] creds present:', { token: !!creds.token, deviceId: !!creds.deviceId });

  try {
    await rappiApi.addToCart(p.storeId, p.storeType, p.productId,
      { name: p.productName, price: p.price, real_price: p.real_price, markup_price: p.markup_price },
      p.resolvedToppings, creds);
  } catch (err) {
    console.warn('[rappi:addToCart] API falló:', err.message);
    await speakReply('Hubo un error al agregar el producto. Inténtalo de nuevo.', broadcast);
    return;
  }

  let cartTotal = null;
  try {
    const cart = await rappiApi.getCart(creds);
    cartTotal = cart.total;
  } catch {}

  const toppingNames = p.resolvedToppings.map((t) => t.description).join(', ');
  const cartSuffix = cartTotal ? ` Tu carrito va en ${formatPrice(cartTotal)} pesos.` : '';

  const confirmPrompt = `[Post-carrito] Producto "${p.productName}"${toppingNames ? ` con ${toppingNames}` : ''} agregado correctamente a ${formatPrice(p.price)} pesos.${cartSuffix} Confirma al usuario de forma natural y amigable.`;

  state.pendingProduct = null;
  state.conversationHistory.push({ role: 'user', content: confirmPrompt });
  const context = { ...getLastContext(), pendingProduct: null };

  const result = await agentRound(state.conversationHistory, context, broadcast).catch(() => ({
    reply: `Listo, te agregué ${p.productName}${toppingNames ? ` con ${toppingNames}` : ''}.${cartSuffix}`,
    action: null,
  }));
  await speakReply(result.reply, broadcast);
}

async function handleGetCartSummary(broadcast) {
  const creds = getCredentials();

  if (!creds.token) {
    await speakReply('No tengo acceso a la API de Rappi todavía. Navega un momento en la ventana.', broadcast);
    return;
  }

  let checkoutData;
  try {
    checkoutData = await rappiApi.getCheckoutDetail('restaurant', creds);
  } catch (err) {
    console.warn('[rappi:checkout] API falló:', err.message);
    await speakReply('No pude obtener el resumen del carrito en este momento.', broadcast);
    return;
  }

  const itemsSummary = checkoutData.items.map((i) =>
    `${i.quantity > 1 ? `${i.quantity}x ` : ''}${i.name} a ${formatPrice(i.price)} pesos`
  ).join(', ');

  const summaryPrompt = `[Post-carrito] Resumen del carrito: ${itemsSummary || 'sin productos'}. Subtotal: ${formatPrice(checkoutData.subtotal)} pesos. Envío: ${formatPrice(checkoutData.delivery_fee)} pesos. Total: ${formatPrice(checkoutData.total)} pesos. Léelo al usuario de forma fluida y natural, en 1-2 oraciones.`;
  state.conversationHistory.push({ role: 'user', content: summaryPrompt });
  const context = { ...getLastContext(), pendingProduct: state.pendingProduct };

  const result = await agentRound(state.conversationHistory, context, broadcast).catch(() => ({
    reply: `Tu pedido va en ${formatPrice(checkoutData.total)} pesos incluyendo envío de ${formatPrice(checkoutData.delivery_fee)} pesos.`,
    action: null,
  }));
  await speakReply(result.reply, broadcast);
}

// ── Navigation phase 2 ─────────────────────────────────────────────────────────

const NAVIGATION_ACTIONS = new Set(['navigate_to_search', 'navigate_to_restaurant']);

function waitForPageSettle(win, timeoutMs) {
  return new Promise((resolve) => {
    if (win.isDestroyed() || !win.webContents.isLoading()) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, timeoutMs);
    win.webContents.once('did-finish-load', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function runNavigationPhase2(broadcast) {
  try {
    await waitForPageSettle(state.rappiWindow, 7000);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    if (!state.connected || state.rappiWindow?.isDestroyed()) return;

    const freshContext = await forceSnapshot(state.rappiWindow.webContents);
    const reportPrompt =
      '[Post-navegación] Reporta al usuario exactamente qué encontraste en la página: nombres de restaurantes, productos, precios si aparecen. Sé concreto y útil. No hagas preguntas.';
    state.conversationHistory.push({ role: 'user', content: reportPrompt });

    const ctx = { ...freshContext, pendingProduct: state.pendingProduct };
    const result = await agentRound(state.conversationHistory, ctx, broadcast).catch(() => null);
    if (result?.reply) await speakReply(result.reply, broadcast);
  } catch (err) {
    broadcast('rappi_thinking', { active: false });
    console.warn('[rappi:phase2]', err instanceof Error ? err.message : String(err));
  }
}

// ── TTS helper ─────────────────────────────────────────────────────────────────

async function speakReply(reply, broadcast) {
  try {
    const audioBuffer = await synthesizeSpeech(reply);
    broadcast('rappi_speak', { audio: audioBuffer.toString('base64') });
  } catch (err) {
    console.warn('[rappi:tts] falló:', err instanceof Error ? err.message : String(err));
  }
}

// ── Main voice input handler ───────────────────────────────────────────────────

export async function handleVoiceInput(text, broadcast) {
  if (!state.connected) {
    broadcast('transcription_error', 'Rappi no está conectado. Ve a Modos y conéctate primero.');
    return { reply: '' };
  }

  state.conversationHistory.push({ role: 'user', content: `El usuario dice: ${text}` });
  if (state.conversationHistory.length > 20) {
    state.conversationHistory = state.conversationHistory.slice(-20);
  }
  scheduleConversationReset();

  broadcast('rappi_thinking', { active: true });

  const context = { ...getLastContext(), pendingProduct: state.pendingProduct, pendingSearch: state.pendingSearch };
  let reply = '';
  let action = null;

  try {
    const result = await runAgent(state.conversationHistory, context);
    reply = result.reply;
    action = result.action;
    state.conversationHistory.push({
      role: 'assistant',
      content: JSON.stringify({ reply, action }),
    });
  } catch (error) {
    broadcast('rappi_thinking', { active: false });
    state.conversationHistory.pop();
    const msg = error instanceof Error ? error.message : String(error);
    broadcast('transcription_error', `Mushu Rappi: ${msg}`);
    return { reply: '' };
  }

  broadcast('rappi_thinking', { active: false });
  await speakReply(reply, broadcast);

  if (action && state.rappiWindow && !state.rappiWindow.isDestroyed()) {
    switch (action.type) {
      case 'search_product':
        await handleSearchProduct(action, broadcast);
        break;
      case 'select_product':
        await handleSelectProduct(action, broadcast);
        break;
      case 'select_topping':
        await handleSelectTopping(action, broadcast);
        break;
      case 'add_to_cart_api':
        if (state.pendingProduct) await handleAddToCartApi(broadcast);
        break;
      case 'get_cart_summary':
        await handleGetCartSummary(broadcast);
        break;
      case 'cancel_pending_product':
        state.pendingProduct = null;
        break;
      default:
        await executeAction(action).catch((err) => {
          console.warn('[rappi:action] falló:', err instanceof Error ? err.message : String(err));
        });
        if (NAVIGATION_ACTIONS.has(action.type)) {
          await runNavigationPhase2(broadcast);
        }
    }
  }

  return { reply };
}

export function getRappiStatus() {
  return { connected: state.connected, connecting: state.connecting };
}

function _handleWindowClosed(broadcast) {
  if (!state.connected) return;
  resetConversation();
  state.cleanupScanner?.();
  state.cleanupScanner = null;
  state.rappiWindow = null;
  state.connected = false;
  state.connecting = false;
  broadcast('frontend_state_changed', {});
  console.info('[rappi] ventana cerrada — desconectado');
}

// ── DOM-based actions (navigation, legacy) ─────────────────────────────────────

async function executeAction(action) {
  const wc = state.rappiWindow?.webContents;
  if (!wc || wc.isDestroyed()) return;

  let expression = '';

  switch (action.type) {
    case 'navigate_to_search': {
      const query = String(action.query || '').replace(/'/g, "\\'");
      expression = `
        (() => {
          const searchInput = document.querySelector('input[type="search"], input[placeholder*="Buscar"], input[placeholder*="buscar"], [data-testid*="search"] input');
          if (searchInput) {
            searchInput.focus();
            const nativeInputSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            nativeInputSetter.call(searchInput, '${query}');
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
          }
        })()
      `;
      break;
    }
    case 'navigate_to_restaurant': {
      const name = String(action.restaurantName || '').toLowerCase().replace(/'/g, "\\'");
      expression = `
        (() => {
          const links = Array.from(document.querySelectorAll('a, button, [role="button"]'));
          const match = links.find(el => el.textContent?.toLowerCase().includes('${name}'));
          match?.click();
        })()
      `;
      break;
    }
    case 'confirm_order': {
      expression = `
        (() => {
          const confirmBtn = document.querySelector('[data-testid*="confirm"], button[class*="confirm"], button[class*="place-order"]')
            || Array.from(document.querySelectorAll('button')).find(b => /confirmar|ordenar|pedir/i.test(b.textContent));
          confirmBtn?.click();
        })()
      `;
      break;
    }
    default:
      return;
  }

  await wc.debugger.sendCommand('Runtime.evaluate', {
    expression,
    returnByValue: false,
  });
}
