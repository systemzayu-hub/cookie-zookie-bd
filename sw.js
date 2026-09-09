/* Generated from the production build. Only public static assets are cached. */
const CACHE = 'cookie-zookie-15132478ec37b7b2';
const ASSETS = ["assets/Audit-BZ6eUkFq.js","assets/CustomersBilling-DRgQL3At.js","assets/Dashboard-DoJ8TGh8.js","assets/Financeiro-4vWBxbS0.js","assets/Ingredients-Bi_CjL4U.css","assets/Ingredients-DdXjwUWp.js","assets/MaskedPII-BM02riSU.js","assets/ProductsStock-B1qIgGQz.js","assets/Reports-BxA_oSIp.js","assets/Sales-C1rkBBp8.js","assets/cookies/kinder.png","assets/cookies/meio-amargo.png","assets/cookies/nutella.png","assets/cookies/tradicional.png","assets/index-BOPql_CZ.css","assets/index-DFOy2J1H.js","assets/index.esm-CqxKWIZ5.js","assets/logo-CO3eNKz-.png","assets/pendencias-avancado-BiGClaaO.js","assets/vendor-firebase-C5zgLpLg.js","assets/vendor-icons-BmwSyiP1.js","assets/vendor-react-C4LoDZJM.js","index.html","logo.png","manifest.webmanifest"].map(path => new URL(path, self.registration.scope).href);
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
