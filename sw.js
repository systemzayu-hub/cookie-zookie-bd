/* Generated from the production build. Only public static assets are cached. */
const CACHE = 'cookie-zookie-65c3d07762948fe6';
const ASSETS = ["assets/Audit-ouShUAoC.js","assets/CookieArt-BU6gh_sS.js","assets/CustomersBilling-7l62RuoN.js","assets/Dashboard-WjTROR_9.js","assets/Financeiro-BLhSO5OC.js","assets/ProductsStock-C5vyr37e.js","assets/Reports-TNCFJ9gn.js","assets/Sales-OpJ2YKmj.js","assets/cookies/kinder.png","assets/cookies/meio-amargo.png","assets/cookies/nutella.png","assets/cookies/tradicional.png","assets/index-CTani0Dx.js","assets/index-DK9ZT_gU.css","assets/index.esm-DUvuJFoA.js","assets/logo-CO3eNKz-.png","assets/pendencias-avancado-BiGClaaO.js","assets/vendor-firebase-FXjrSQW3.js","assets/vendor-icons-CRShpWGx.js","assets/vendor-react-CD80rVHJ.js","index.html","logo.png","manifest.webmanifest"].map(path => new URL(path, self.registration.scope).href);
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
