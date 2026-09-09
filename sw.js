/* Generated from the production build. Only public static assets are cached. */
const CACHE = 'cookie-zookie-a9c955b6ad529e3a';
const ASSETS = ["assets/Audit-3_aQjZp_.js","assets/CustomersBilling-DmWsYKuN.js","assets/Dashboard-U2kkpYuW.js","assets/Financeiro-oJU7WLox.js","assets/Ingredients-Bi_CjL4U.css","assets/Ingredients-CGzofLsA.js","assets/MaskedPII-BBAL54ie.js","assets/ProductsStock-DDRhzLOu.js","assets/Reports-CbVl1QN8.js","assets/Sales-B4TAO78c.js","assets/cookies/kinder.png","assets/cookies/meio-amargo.png","assets/cookies/nutella.png","assets/cookies/tradicional.png","assets/index-BOPql_CZ.css","assets/index-CEdH4rjC.js","assets/index.esm-CiT8PAig.js","assets/index.esm-D58F0vBa.js","assets/logo-CO3eNKz-.png","assets/pendencias-avancado-BiGClaaO.js","assets/vendor-firebase-CRkYreAA.js","assets/vendor-icons-BmwSyiP1.js","assets/vendor-react-C4LoDZJM.js","index.html","logo.png","manifest.webmanifest"].map(path => new URL(path, self.registration.scope).href);
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
