/* Generated from the production build. Only public static assets are cached. */
const CACHE = 'cookie-zookie-92fdcfd040874d79';
const ASSETS = ["assets/Audit-BdLrcpne.js","assets/CustomersBilling-BvGhLVKj.js","assets/Dashboard-qMev1Gg3.js","assets/Financeiro-ZrywHFox.js","assets/Ingredients-Bi_CjL4U.css","assets/Ingredients-C1xIRfD9.js","assets/MaskedPII--3z9MZYF.js","assets/Payments-Bf_g1FxA.css","assets/Payments-KPK8X7wj.js","assets/Payments-nf1JXVOB.js","assets/ProductsStock-TjZZ83P9.js","assets/Profit-B4mYamRg.js","assets/Reports-GCzQLWMG.js","assets/Sales-D-mxFD7w.js","assets/cookies/kinder.png","assets/cookies/meio-amargo.png","assets/cookies/nutella.png","assets/cookies/tradicional.png","assets/index-6y5PqCOZ.css","assets/index-BuhEwSV0.js","assets/index-DrT3QO5Q.js","assets/index.esm-C5S1CRD1.js","assets/index.esm-rKg1ZgD6.js","assets/logo-CO3eNKz-.png","assets/pendencias-avancado-BiGClaaO.js","assets/purchase-cloud-B7eK70dd.js","assets/vendor-firebase-Dpl0fhbZ.js","assets/vendor-icons-BF5pHoy6.js","assets/vendor-react-Dn085ts3.js","index.html","logo.png","manifest.webmanifest"].map(path => new URL(path, self.registration.scope).href);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('cookie-zookie-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const home = new URL('index.html', self.registration.scope).href;
  if (request.mode === 'navigate' && (url.pathname === new URL(self.registration.scope).pathname || url.pathname === new URL(home).pathname)) {
    event.respondWith(fetch(request).catch(async () => (await caches.open(CACHE)).match(home)));
    return;
  }
  if (!ASSETS.includes(url.href)) return;
  event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(request)) || fetch(request)));
});
