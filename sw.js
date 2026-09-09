/* Generated from the production build. Only public static assets are cached. */
const CACHE = 'cookie-zookie-d9547caa1d661ac5';
const ASSETS = ["assets/Audit-9MMWV2O_.js","assets/CustomersBilling-CF0hxmY6.js","assets/Dashboard-CGpyECQR.js","assets/Financeiro-Lh2GNBAQ.js","assets/Ingredients-Bi_CjL4U.css","assets/Ingredients-BtTD--fO.js","assets/MaskedPII-CZS8etq1.js","assets/ProductsStock-CpGukkCx.js","assets/Reports-C2jKAYRY.js","assets/Sales-Db7y7yut.js","assets/cookies/kinder.png","assets/cookies/meio-amargo.png","assets/cookies/nutella.png","assets/cookies/tradicional.png","assets/index-BK8opwjn.js","assets/index-BOPql_CZ.css","assets/index-DVSlZ3wx.js","assets/index.esm-CqxKWIZ5.js","assets/logo-CO3eNKz-.png","assets/pendencias-avancado-BiGClaaO.js","assets/vendor-firebase-C5zgLpLg.js","assets/vendor-icons-DUBWZkRu.js","assets/vendor-react-C4G_JXuT.js","index.html","logo.png","manifest.webmanifest"].map(path => new URL(path, self.registration.scope).href);
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
