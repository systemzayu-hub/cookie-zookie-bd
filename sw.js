/* Generated from the production build. Only public static assets are cached. */
const CACHE = 'cookie-zookie-361f987f616be6ad';
const ASSETS = ["assets/Audit-Bxotbw-G.js","assets/ConfirmDialog-lWgzRgLt.js","assets/CustomersBilling-JjZNAZXe.js","assets/Dashboard-DIyMNdzi.js","assets/Financeiro-C3IOAjMr.js","assets/Ingredients-C90h8Uy1.js","assets/Ingredients-DAMZAqXx.css","assets/MaskedPII-Ch2hxRy_.js","assets/Payments-CyqL0Dtw.js","assets/Payments-DeS-gXip.css","assets/Payments-RFiXIKo-.js","assets/ProductsStock-CiqgVpEl.js","assets/Profit-CAAWg9eZ.js","assets/Reports-C-IEAjJ6.js","assets/Sales-BB7dvLvq.js","assets/cookies/kinder.png","assets/cookies/meio-amargo.png","assets/cookies/nutella.png","assets/cookies/tradicional.png","assets/index-BVjiyP_Z.js","assets/index-BuhEwSV0.js","assets/index-v0x8s-rn.css","assets/index.esm-C5S1CRD1.js","assets/index.esm-rKg1ZgD6.js","assets/logo-Bw1djsMk.png","assets/pendencias-avancado-BiGClaaO.js","assets/purchase-cloud-4Li6EfQ-.js","assets/vendor-firebase-Dpl0fhbZ.js","assets/vendor-icons-BLJT9Ei8.js","assets/vendor-react-DPpAqbJ7.js","icon-180.png","icon-192.png","icon-512.png","index.html","logo.png","manifest.webmanifest"].map(path => new URL(path, self.registration.scope).href);
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
