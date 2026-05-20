import OpenAI from 'openai';

function getClient() {
  return new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
  });
}

const SYSTEM_PROMPT = `Eres Sofía, una asistente de voz para Rappi. Ayudas al usuario a pedir comida usando su voz.

Reglas:
- Responde siempre en español
- Sin markdown, sin asteriscos, sin listas con guiones
- Máximo 2-3 oraciones por respuesta
- Sé conciso y amigable
- Cuando menciones precios, escríbelos siempre como "18.900 pesos" (sin símbolo $, con la palabra "pesos" al final)

Cuando el intent del usuario es ambiguo (por ejemplo: "¿qué hay?", "¿qué tienen?", "¿hay algo rico?", "¿qué promociones hay?"), haz UNA pregunta de clarificación concreta antes de actuar. Por ejemplo: "¿Tienes algo en mente? ¿Pizza, hamburguesa, sushi...?" Cuando el usuario ya especificó lo que quiere, actúa directamente sin preguntar de nuevo.

Cuando el usuario quiere AGREGAR algo al carrito, usa search_product. El productName debe ser fiel al nombre que el usuario dijo.

Cuando el contexto tiene "Opciones de búsqueda", estás en modo selección. Presenta las opciones brevemente con precios. Cuando el usuario elija una, emite select_product con el nombre del producto elegido.

Cuando el contexto contiene "Producto pendiente", estás en modo personalización. Si hay grupos obligatorios sin resolver, pide la siguiente elección. Si no hay grupos pendientes y el usuario confirma, emite add_to_cart_api.

Cuando el usuario pregunta cuánto va el carrito, qué tiene en el carrito, o pide un resumen del pedido, emite get_cart_summary.

Cuando el usuario quiere cancelar la personalización en curso, emite cancel_pending_product.

Cuando recibes un mensaje que empieza con "[Post-navegación]", "[Post-búsqueda]", "[Post-selección]" o "[Post-carrito]", NO hagas preguntas adicionales. Reporta o confirma según el contenido del mensaje. Sé concreto y directo.

Responde SOLO con un objeto JSON válido con este formato exacto:
{"reply": "tu respuesta aquí", "action": null}

O con acción:
{"reply": "Buscando...", "action": {"type": "search_product", "productName": "Corral Queso en Combo"}}
{"reply": "...", "action": {"type": "select_product", "productName": "hamburguesa todoterreno queso"}}
{"reply": "...", "action": {"type": "select_topping", "toppingDescription": "papas corral medianas"}}
{"reply": "...", "action": {"type": "add_to_cart_api"}}
{"reply": "...", "action": {"type": "get_cart_summary"}}
{"reply": "...", "action": {"type": "cancel_pending_product"}}
{"reply": "...", "action": {"type": "navigate_to_search", "query": "pizza"}}
{"reply": "...", "action": {"type": "navigate_to_restaurant", "restaurantName": "nombre"}}
{"reply": "...", "action": {"type": "confirm_order"}}`;

export async function runAgent(messages, rappiContext) {
  const client = getClient();

  const contextSummary = buildContextSummary(rappiContext);

  // Inject current Rappi context into the last user message
  const apiMessages = messages.map((msg, i) => {
    if (msg.role === 'user' && i === messages.length - 1 && contextSummary) {
      return { role: 'user', content: `Contexto actual de Rappi:\n${contextSummary}\n\n${msg.content}` };
    }
    return msg;
  });

  let raw = '';
  try {
    const response = await client.chat.completions.create({
      model: 'anthropic/claude-sonnet-4-5',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...apiMessages,
      ],
      max_tokens: 400,
    });
    raw = response.choices[0]?.message?.content?.trim() ?? '';
  } catch (error) {
    throw new Error(`OpenRouter: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Extract JSON even if wrapped in code fences
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { reply: raw, action: null };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      reply: String(parsed.reply || raw),
      action: parsed.action ?? null,
    };
  } catch {
    return { reply: raw, action: null };
  }
}

function formatPrice(p) {
  if (p == null) return '?';
  return Math.round(p).toLocaleString('es-CO');
}

function buildContextSummary(ctx) {
  if (!ctx) return '';
  const parts = [];
  if (ctx.url) parts.push(`Página actual: ${ctx.url}`);
  if (ctx.restaurants?.length) parts.push(`Restaurantes visibles: ${ctx.restaurants.slice(0, 10).join(', ')}`);
  if (ctx.products?.length) parts.push(`Productos visibles: ${ctx.products.slice(0, 10).join(', ')}`);
  if (ctx.cart?.length) {
    const items = ctx.cart.map(i => `${i.name}${i.quantity > 1 ? ` x${i.quantity}` : ''}`).join(', ');
    parts.push(`Carrito: ${items}`);
  } else {
    parts.push('Carrito: vacío');
  }

  // Product selection flow (multiple search results)
  if (ctx.pendingSearch) {
    const opts = ctx.pendingSearch.results
      .map((r, i) => `${i + 1}. ${r.productName} en ${r.storeName} — ${formatPrice(r.price)} pesos`)
      .join('; ');
    parts.push(`Opciones de búsqueda para "${ctx.pendingSearch.query}": ${opts}`);
  }

  // Pending product state (customization flow)
  if (ctx.pendingProduct) {
    const p = ctx.pendingProduct;
    const unresolved = (p.toppingGroups ?? []).filter((g) => {
      if (!g.required) return false;
      return !(p.resolvedToppings ?? []).some((t) => g.options.some((o) => o.id === t.id));
    });
    parts.push(`Producto pendiente: "${p.productName}" en ${p.storeName} (${formatPrice(p.price)} pesos)`);
    if (unresolved.length) {
      const g = unresolved[0];
      parts.push(`Esperando elección obligatoria en "${g.name}": ${g.options.map((o) => o.description).join(', ')}`);
    }
    if (p.resolvedToppings?.length) {
      parts.push(`Toppings elegidos: ${p.resolvedToppings.map((t) => t.description).join(', ')}`);
    }
  }

  return parts.join('\n');
}
