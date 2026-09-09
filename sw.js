/* Generated from the production build. Only public static assets are cached. */
const CACHE = 'cookie-zookie-c5f244297058c5bb';
const ASSETS = ["assets/Audit-fMFevaGk.js","assets/CustomersBilling-CTRqSLTs.js","assets/Dashboard-CW5dF5qU.js","assets/Financeiro-CQcvSoMT.js","assets/Ingredients-CHdou27X.css","assets/Ingredients-DNGP2juN.js","assets/MaskedPII-DsGZkUL1.js","assets/ProductsStock-C28z_MF4.js","assets/Reports-Cp2q05Mn.js","assets/Sales-Clr53Mg6.js","assets/cookies/kinder.png","assets/cookies/meio-amargo.png","assets/cookies/nutella.png","assets/cookies/tradicional.png","assets/index-BGMe26JQ.js","assets/index-BK8opwjn.js","assets/index-BOPql_CZ.css","assets/index.esm-CqxKWIZ5.js","assets/logo-CO3eNKz-.png","assets/pendencias-avancado-BiGClaaO.js","assets/vendor-firebase-C5zgLpLg.js","assets/vendor-icons-DUBWZkRu.js","assets/vendor-react-C4G_JXuT.js","index.html","logo.png","manifest.webmanifest"].map(path => new URL(path, self.registration.scope).href);
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
