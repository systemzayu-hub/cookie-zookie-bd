/* Generated from the production build. Only public static assets are cached. */
const CACHE = 'cookie-zookie-b56b03155645a47e';
const ASSETS = ["assets/Audit-C7CHvYLQ.js","assets/CustomersBilling-hxtsYu64.js","assets/Dashboard-CZEOI-4d.js","assets/Financeiro-DbW8-0Dd.js","assets/Ingredients-C5cujGs4.js","assets/Ingredients-v0my9F0p.css","assets/MaskedPII-BDFtCHGF.js","assets/ProductsStock-e0Pq7B4R.js","assets/Reports-CA2fyj7o.js","assets/Sales-D7KePV5f.js","assets/cookies/kinder.png","assets/cookies/meio-amargo.png","assets/cookies/nutella.png","assets/cookies/tradicional.png","assets/index-B9XXBXED.js","assets/index-BK8opwjn.js","assets/index-BOPql_CZ.css","assets/index.esm-CqxKWIZ5.js","assets/logo-CO3eNKz-.png","assets/pendencias-avancado-BiGClaaO.js","assets/vendor-firebase-C5zgLpLg.js","assets/vendor-icons-DUBWZkRu.js","assets/vendor-react-C4G_JXuT.js","index.html","logo.png","manifest.webmanifest"].map(path => new URL(path, self.registration.scope).href);
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
