/* Generated from the production build. Only public static assets are cached. */
const CACHE = 'cookie-zookie-8149f724704db931';
const ASSETS = ["assets/Audit-CWlU1z9t.js","assets/CustomersBilling-BBJK9rnL.js","assets/Dashboard-CAVIvTQx.js","assets/Financeiro-BQAbi7le.js","assets/Ingredients-BBdLL6I_.js","assets/Ingredients-Bi_CjL4U.css","assets/MaskedPII-Dyr5fbbx.js","assets/Payments-DXYC42v1.js","assets/Payments-DeS-gXip.css","assets/Payments-_A3V7QcY.js","assets/ProductsStock-jXmzISW5.js","assets/Profit-CcDfaLtr.js","assets/Reports-D7QnN9f1.js","assets/Sales-s5n6kTHH.js","assets/cookies/kinder.png","assets/cookies/meio-amargo.png","assets/cookies/nutella.png","assets/cookies/tradicional.png","assets/index-Bo42NeKP.js","assets/index-BuhEwSV0.js","assets/index-DYFcuYjy.css","assets/index.esm-C5S1CRD1.js","assets/index.esm-rKg1ZgD6.js","assets/logo-CO3eNKz-.png","assets/pendencias-avancado-BiGClaaO.js","assets/purchase-cloud-m8MtVFgy.js","assets/vendor-firebase-Dpl0fhbZ.js","assets/vendor-icons-BF5pHoy6.js","assets/vendor-react-Dn085ts3.js","icon-180.png","icon-192.png","icon-512.png","index.html","logo.png","manifest.webmanifest"].map(path => new URL(path, self.registration.scope).href);
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
