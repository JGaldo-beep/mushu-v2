const BASE = 'https://services.grability.rappi.com';

function makeHeaders(creds) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${creds.token}`,
    'deviceid': creds.deviceId ?? '',
    'app-version': creds.appVersion ?? 'web',
    'accept': 'application/json',
    'accept-language': 'es-CO',
    'origin': 'https://www.rappi.com.co',
    'referer': 'https://www.rappi.com.co/',
    'vendor': 'rappi',
  };
}

async function call(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : undefined;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: makeHeaders(creds),
    body: bodyStr,
  });
  if (!res.ok) {
    // Read body once as text so we don't consume the stream twice
    const t = await res.text().catch(() => '');
    console.error(`[rappi:api] ${res.status} ${path} body:`, t.slice(0, 600));

    // Rappi returns 400 with a valid JSON payload for "no results" — handle gracefully
    if (res.status === 400 && t) {
      try {
        const json = JSON.parse(t);
        if (json && typeof json === 'object' && ('stores' in json || 'products' in json || 'data' in json)) {
          return json;
        }
      } catch {}
    }
    throw new Error(`Rappi API ${res.status} ${path}: ${t.slice(0, 300)}`);
  }
  return res.json();
}

/**
 * Unified search — returns array of { storeId, storeName, storeType, productId, productName,
 *   price, real_price, markup_price, has_toppings }
 */
export async function searchProducts(query, creds) {
  const data = await call('POST', '/api/pns-global-search-api/v1/unified-search', {
    query,
    lat: creds.lat,
    lng: creds.lng,
  }, creds);

  const results = [];
  const stores = data?.data?.stores ?? data?.stores ?? [];
  for (const store of stores) {
    const storeId = Number(store.store_id ?? store.id);
    const storeName = store.store_name ?? store.name ?? '';
    const storeType = store.store_type ?? 'restaurant';
    const products = store.products ?? [];
    for (const p of products) {
      results.push({
        storeId,
        storeName,
        storeType,
        productId: Number(p.product_id ?? p.id),
        productName: p.name ?? '',
        price: p.price ?? 0,
        real_price: p.real_price ?? p.price ?? 0,
        markup_price: p.markup_price ?? p.price ?? 0,
        has_toppings: p.has_toppings ?? false,
      });
    }
  }
  return results;
}

/**
 * Get product toppings — returns array of groups:
 *   { id, name, required, min_quantity, max_quantity, options: [{id, description, price, real_price, markup_price}] }
 */
export async function getProductToppings(storeId, productId, creds) {
  const data = await call('GET',
    `/api/web-gateway/web/restaurants-bus/products/toppings/${storeId}/${productId}/`,
    null, creds);

  const rawGroups = data?.data?.toppings ?? data?.toppings ?? [];
  return rawGroups.map((g) => ({
    id: g.id,
    name: g.description ?? g.name ?? '',
    required: (g.min_toppings_for_categories ?? g.min_quantity ?? 0) > 0,
    min_quantity: g.min_toppings_for_categories ?? g.min_quantity ?? 0,
    max_quantity: g.max_toppings_for_categories ?? g.max_quantity ?? 1,
    options: (g.toppings ?? g.options ?? []).map((o) => ({
      id: o.id,
      description: o.description ?? o.name ?? '',
      price: o.price ?? 0,
      real_price: o.real_price ?? o.price ?? 0,
      markup_price: o.markup_price ?? o.price ?? 0,
    })),
  }));
}

/**
 * Add a product to the cart.
 * productData: { name, price, real_price, markup_price }
 * toppings: [{ id, description, units, price, real_price, markup_price }]
 */
export async function addToCart(storeId, storeType, productId, _productData, toppings, creds) {
  const sid = Number(storeId);
  const pid = Number(productId);
  const stype = storeType === 'turbo' ? 'restaurant' : (storeType || 'restaurant');

  // Exact format captured from browser network traffic
  const body = [{
    id: sid,
    products: [{
      id: `${sid}_${pid}`,
      units: 1,
      sale_type: 'Unit',
      nodeId: String(pid),
      toppings: toppings.map((t) => ({
        id: Number(t.id),
        node_id: `${pid}-${t.topping_category_id}-${t.id}`,
        topping_category_id: Number(t.topping_category_id),
        topping_parent_id: pid,
        description: t.description,
        price: t.price ?? 0,
        units: 1,
      })),
    }],
    vendor: {
      id: `anonymous_${Date.now()}`,
      type: 'rappi',
      flow_type: 'rappi-web',
      sideBarSections: ['profile', 'login', 'promotions', 'orders', 'sections', 'credits', 'others'],
      showLogin: true,
      landingPageUrl: '/',
      loginPageUrl: '/login',
    },
  }];

  console.log('[rappi:addToCart] body:', JSON.stringify(body).slice(0, 600));
  return call('PUT', `/api/ms/shopping-cart/v2/${stype}/store`, body, creds);
}

/**
 * Get all current carts.
 * Returns { items: [{name, quantity, price}], total }
 */
export async function getCart(creds) {
  const data = await call('POST', '/api/ms/shopping-cart/v1/all/get', {}, creds);
  const carts = data?.data ?? [];
  let total = 0;
  const items = [];
  for (const cart of carts) {
    total += cart.total ?? 0;
    for (const store of cart.stores ?? []) {
      for (const p of store.products ?? []) {
        items.push({ name: p.name, quantity: p.units ?? p.quantity ?? 1, price: p.price ?? 0 });
      }
    }
  }
  return { items, total };
}

/**
 * Recalculate cart and get checkout detail.
 * Returns { subtotal, delivery_fee, total, items }
 */
export async function getCheckoutDetail(storeType, creds) {
  // Recalculate first
  await call('POST', `/api/ms/shopping-cart/v1/${storeType}/recalculate`, {}, creds).catch(() => {});

  const data = await call('GET', `/api/ms/shopping-cart/v1/${storeType}/checkout/detail`, null, creds);
  const detail = data?.data ?? data ?? {};

  const subtotal = detail.sub_total ?? detail.product_total ?? 0;
  const delivery_fee = detail.shipping_total ?? detail.delivery_fee ?? 0;
  const total = detail.total ?? (subtotal + delivery_fee);

  const items = [];
  for (const store of detail.stores ?? []) {
    for (const p of store.products ?? []) {
      items.push({ name: p.name, quantity: p.units ?? p.quantity ?? 1, price: p.price ?? 0 });
    }
  }

  return { subtotal, delivery_fee, total, items };
}
