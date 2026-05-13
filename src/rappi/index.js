import { isAlreadyAuthenticated, openLoginWindow } from './login-window.js';
import { createBackgroundWindow } from './browser-view.js';
import { attachScanner, getLastContext } from './scanner.js';
import { runAgent } from './agent.js';
import { synthesizeSpeech } from './tts.js';

const state = {
  connected: false,
  connecting: false,
  rappiWindow: null,
  cleanupScanner: null,
};

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
  state.cleanupScanner?.();
  state.cleanupScanner = null;

  if (state.rappiWindow && !state.rappiWindow.isDestroyed()) {
    state.rappiWindow.destroy();
  }
  state.rappiWindow = null;
  state.connected = false;
  state.connecting = false;
}

export async function handleVoiceInput(text, broadcast) {
  if (!state.connected) {
    broadcast('transcription_error', 'Rappi no está conectado. Ve a Modos y conéctate primero.');
    return { reply: '' };
  }

  broadcast('rappi_thinking', { active: true });

  const context = getLastContext();
  let reply = '';
  let action = null;

  try {
    const result = await runAgent(text, context);
    reply = result.reply;
    action = result.action;
  } catch (error) {
    broadcast('rappi_thinking', { active: false });
    const msg = error instanceof Error ? error.message : String(error);
    broadcast('transcription_error', `Mushu Rappi: ${msg}`);
    return { reply: '' };
  }

  broadcast('rappi_thinking', { active: false });

  // TTS — non-blocking on failure
  try {
    const audioBuffer = await synthesizeSpeech(reply);
    broadcast('rappi_speak', { audio: audioBuffer.toString('base64') });
  } catch (ttsError) {
    console.warn('[rappi:tts] falló:', ttsError instanceof Error ? ttsError.message : String(ttsError));
  }

  // Execute action if present
  if (action && state.rappiWindow && !state.rappiWindow.isDestroyed()) {
    await executeAction(action).catch((err) => {
      console.warn('[rappi:action] falló:', err instanceof Error ? err.message : String(err));
    });
  }

  return { reply };
}

export function getRappiStatus() {
  return { connected: state.connected, connecting: state.connecting };
}

function _handleWindowClosed(broadcast) {
  if (!state.connected) return;
  state.cleanupScanner?.();
  state.cleanupScanner = null;
  state.rappiWindow = null;
  state.connected = false;
  state.connecting = false;
  broadcast('frontend_state_changed', {});
  console.info('[rappi] ventana cerrada — desconectado');
}

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
    case 'add_to_cart': {
      const product = String(action.productName || '').toLowerCase().replace(/'/g, "\\'");
      expression = `
        (() => {
          const productEls = Array.from(document.querySelectorAll('[class*="product"], [class*="item"], [data-testid*="product"]'));
          const target = productEls.find(el => el.textContent?.toLowerCase().includes('${product}'));
          if (target) {
            const addBtn = target.querySelector('button[class*="add"], button[class*="cart"], [data-testid*="add"]') || target.querySelector('button');
            addBtn?.click();
          }
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
