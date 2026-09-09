/* Generated from the production build. Only public static assets are cached. */
const CACHE = 'cookie-zookie-2e8f3adbbdefdcb5';
const ASSETS = ["assets/Audit-F3D4a-_J.js","assets/CustomersBilling-CBTkAaF1.js","assets/Dashboard-jEQrEv6q.js","assets/Financeiro-Cc4plzbQ.js","assets/Ingredients-Bi_CjL4U.css","assets/Ingredients-C2EF6ud7.js","assets/MaskedPII-D72GZVCr.js","assets/ProductsStock-fBfpdPWl.js","assets/Reports-DXkyzBVb.js","assets/Sales-CCDyLbwT.js","assets/cookies/kinder.png","assets/cookies/meio-amargo.png","assets/cookies/nutella.png","assets/cookies/tradicional.png","assets/index-BOPql_CZ.css","assets/index-CBe0IGnf.js","assets/index.esm-CqxKWIZ5.js","assets/logo-CO3eNKz-.png","assets/pendencias-avancado-BiGClaaO.js","assets/vendor-firebase-C5zgLpLg.js","assets/vendor-icons-BmwSyiP1.js","assets/vendor-react-C4LoDZJM.js","index.html","logo.png","manifest.webmanifest"].map(path => new URL(path, self.registration.scope).href);
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
