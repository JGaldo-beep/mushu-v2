let lastContext = { url: null, restaurants: [], cart: [], products: [] };

// Extracts visible page state via Runtime.evaluate snapshot
const SNAPSHOT_EXPR = `
(() => {
  try {
    const url = window.location.href;

    const restaurantEls = document.querySelectorAll('[class*="restaurant-name"], [class*="restaurantName"], [data-testid*="store-name"], h3[class*="name"]');
    const restaurants = Array.from(restaurantEls).slice(0, 20).map(el => el.textContent?.trim()).filter(Boolean);

    const cartCountEl = document.querySelector('[class*="cart-count"], [class*="cartCount"], [data-testid*="cart-count"], [class*="badge"]');
    const cartCount = cartCountEl ? parseInt(cartCountEl.textContent || '0', 10) : 0;

    const productEls = document.querySelectorAll('[class*="product-name"], [class*="productName"], [data-testid*="product-name"]');
    const products = Array.from(productEls).slice(0, 30).map(el => el.textContent?.trim()).filter(Boolean);

    return JSON.stringify({ url, restaurants, cartCount, products });
  } catch (e) {
    return JSON.stringify({ url: window.location.href, restaurants: [], cartCount: 0, products: [], error: e.message });
  }
})()
`;

export function attachScanner(webContents) {
  let snapshotTimer = null;
  const pendingBodyRequests = new Map();

  try {
    webContents.debugger.attach('1.3');
  } catch {
    // Already attached
  }

  webContents.debugger.sendCommand('Network.enable').catch(() => {});
  webContents.debugger.sendCommand('Runtime.enable').catch(() => {});

  const onMessage = (_event, method, params) => {
    if (method === 'Network.responseReceived') {
      const { requestId, response } = params;
      const isRappiApi =
        response.url.includes('rappi.com') &&
        (response.mimeType?.includes('json') || response.headers?.['content-type']?.includes('json'));

      if (isRappiApi) {
        pendingBodyRequests.set(requestId, response.url);
        webContents.debugger
          .sendCommand('Network.getResponseBody', { requestId })
          .then(({ body }) => {
            pendingBodyRequests.delete(requestId);
            try {
              const data = JSON.parse(body);
              parseRappiApiResponse(response.url, data);
            } catch {
              // not parseable JSON
            }
          })
          .catch(() => pendingBodyRequests.delete(requestId));
      }
    }
  };

  webContents.debugger.on('message', onMessage);

  snapshotTimer = setInterval(async () => {
    if (webContents.isDestroyed()) return;
    try {
      const result = await webContents.debugger.sendCommand('Runtime.evaluate', {
        expression: SNAPSHOT_EXPR,
        returnByValue: true,
      });
      if (result?.result?.value) {
        const snap = JSON.parse(result.result.value);
        lastContext.url = snap.url ?? lastContext.url;
        if (snap.restaurants?.length) lastContext.restaurants = snap.restaurants;
        if (snap.products?.length) lastContext.products = snap.products;
        if (typeof snap.cartCount === 'number') {
          lastContext.cart = lastContext.cart.slice(0, snap.cartCount);
        }
      }
    } catch {
      // page not ready or debugger detached
    }
  }, 5000);

  return function cleanup() {
    clearInterval(snapshotTimer);
    try {
      webContents.debugger.removeListener('message', onMessage);
      if (!webContents.isDestroyed()) {
        webContents.debugger.detach();
      }
    } catch {
      // already detached
    }
    pendingBodyRequests.clear();
  };
}

export function getLastContext() {
  return { ...lastContext };
}

function parseRappiApiResponse(url, data) {
  // Restaurant list endpoints
  if (url.includes('/api/restaurants') || url.includes('/store') || url.includes('/stores')) {
    const stores = data?.data?.stores || data?.stores || data?.data || [];
    if (Array.isArray(stores)) {
      const names = stores.slice(0, 20).map(s => s?.name || s?.storeName).filter(Boolean);
      if (names.length) lastContext.restaurants = names;
    }
  }

  // Cart endpoints
  if (url.includes('/cart') || url.includes('/order')) {
    const items = data?.data?.cart?.items || data?.cart?.items || data?.items || [];
    if (Array.isArray(items)) {
      lastContext.cart = items.slice(0, 30).map(i => ({
        name: i?.name || i?.product?.name,
        quantity: i?.quantity || 1,
        price: i?.price || i?.totalPrice,
      })).filter(i => i.name);
    }
  }

  // Product search endpoints
  if (url.includes('/products') || url.includes('/search') || url.includes('/catalog')) {
    const products = data?.data?.products || data?.products || data?.data || [];
    if (Array.isArray(products)) {
      const names = products.slice(0, 30).map(p => p?.name || p?.productName).filter(Boolean);
      if (names.length) lastContext.products = names;
    }
  }
}
