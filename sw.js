/* Generated from the production build. Only public static assets are cached. */
const CACHE = 'cookie-zookie-f8050187a82d6a93';
const ASSETS = ["assets/Audit-CetMGBKz.js","assets/CookieArt-BDoJZuk2.js","assets/CustomersBilling-hmOiNvIG.js","assets/Dashboard-SvPxhQPs.js","assets/Financeiro-B4MMyILj.js","assets/ProductsStock-D1ZWzWiv.js","assets/Reports-CoX_au8R.js","assets/Sales-D55EIoOM.js","assets/cookies/kinder.png","assets/cookies/meio-amargo.png","assets/cookies/nutella.png","assets/cookies/tradicional.png","assets/index-BVK0LeSa.css","assets/index-vjJ28prT.js","assets/index.esm-DUvuJFoA.js","assets/logo-CO3eNKz-.png","assets/pendencias-avancado-BiGClaaO.js","assets/vendor-firebase-FXjrSQW3.js","assets/vendor-icons-AHMFBFKn.js","assets/vendor-react-BZE1MWpS.js","index.html","logo.png","manifest.webmanifest"].map(path => new URL(path, self.registration.scope).href);
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
