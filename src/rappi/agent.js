import OpenAI from 'openai';

function getClient() {
  return new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
  });
}

const SYSTEM_PROMPT = `Eres Mushu, un asistente de voz para Rappi. Ayudas al usuario a pedir comida usando su voz.

Reglas:
- Responde siempre en español
- Sin markdown, sin asteriscos, sin listas con guiones
- Máximo 2-3 oraciones por respuesta
- Sé conciso y amigable

Si el usuario quiere hacer una acción (buscar restaurantes, agregar al carrito, confirmar pedido), incluye una acción en tu respuesta JSON.

Responde SOLO con un objeto JSON válido con este formato exacto:
{"reply": "tu respuesta aquí", "action": null}

O con acción:
{"reply": "tu respuesta aquí", "action": {"type": "navigate_to_search", "query": "pizza"}}
{"reply": "tu respuesta aquí", "action": {"type": "navigate_to_restaurant", "restaurantName": "nombre"}}
{"reply": "tu respuesta aquí", "action": {"type": "add_to_cart", "productName": "nombre del producto"}}
{"reply": "tu respuesta aquí", "action": {"type": "confirm_order"}}`;

export async function runAgent(userText, rappiContext) {
  const client = getClient();

  const contextSummary = buildContextSummary(rappiContext);

  const userMessage = contextSummary
    ? `Contexto actual de Rappi:\n${contextSummary}\n\nEl usuario dice: ${userText}`
    : `El usuario dice: ${userText}`;

  let raw = '';
  try {
    const response = await client.chat.completions.create({
      model: 'anthropic/claude-sonnet-4-5',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 300,
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
  return parts.join('\n');
}
