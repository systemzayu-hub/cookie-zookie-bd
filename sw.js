/* Generated from the production build. Only public static assets are cached. */
const CACHE = 'cookie-zookie-23185f8f83db48ca';
const ASSETS = ["assets/Audit-CR1-E_Us.js","assets/CustomersBilling-CsOkE5X5.js","assets/Dashboard-dPdDaKVE.js","assets/Financeiro-jVEUfcTm.js","assets/ProductsStock-CqL2wFlu.js","assets/Reports-NJV88BJC.js","assets/Sales-DTDZXYJw.js","assets/cookies/kinder.png","assets/cookies/meio-amargo.png","assets/cookies/nutella.png","assets/cookies/tradicional.png","assets/index-B1Iz_9q-.js","assets/index-DK9ZT_gU.css","assets/index.esm-Bi4eVYsj.js","assets/logo-CO3eNKz-.png","assets/pendencias-avancado-BiGClaaO.js","assets/vendor-firebase-DrLW04f7.js","assets/vendor-icons-BmwSyiP1.js","assets/vendor-react-C4LoDZJM.js","index.html","logo.png","manifest.webmanifest"].map(path => new URL(path, self.registration.scope).href);
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
