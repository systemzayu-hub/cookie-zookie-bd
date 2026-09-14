/* Generated from the production build. Only public static assets are cached. */
const CACHE = 'cookie-zookie-a6673d76d906bdb6';
const ASSETS = ["assets/Audit-6lXAp8lt.js","assets/CustomersBilling-BVp7MnN6.js","assets/Dashboard-B4BudKpo.js","assets/Financeiro-CxE822cv.js","assets/Ingredients-Bi_CjL4U.css","assets/Ingredients-DzvYdHU4.js","assets/MaskedPII-DO4rGGDH.js","assets/Payments-B-c8chw_.js","assets/Payments-DYQ5vXQe.js","assets/Payments-DeS-gXip.css","assets/ProductsStock-Cq3iWwj1.js","assets/Profit-CxVsFAam.js","assets/Reports-CiO5NPDZ.js","assets/Sales-hMKU1oFf.js","assets/cookies/kinder.png","assets/cookies/meio-amargo.png","assets/cookies/nutella.png","assets/cookies/tradicional.png","assets/index-3NvPp9YQ.js","assets/index-BuhEwSV0.js","assets/index-CHmJY3F_.css","assets/index.esm-C5S1CRD1.js","assets/index.esm-rKg1ZgD6.js","assets/logo-CO3eNKz-.png","assets/pendencias-avancado-BiGClaaO.js","assets/purchase-cloud-Bk6-NeKV.js","assets/vendor-firebase-Dpl0fhbZ.js","assets/vendor-icons-nsN3uSCJ.js","assets/vendor-react-TOoC18Z8.js","icon-180.png","icon-192.png","icon-512.png","index.html","logo.png","manifest.webmanifest"].map(path => new URL(path, self.registration.scope).href);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
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
