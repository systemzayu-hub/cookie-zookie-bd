/* Generated from the production build. Only public static assets are cached. */
const CACHE = 'cookie-zookie-d90e521a8e92f5d9';
const ASSETS = ["assets/Audit-CEoeECnm.js","assets/ConfirmDialog-CNs9WeB8.js","assets/CustomersBilling-DaljhRnD.js","assets/Dashboard-BdkkDcTC.js","assets/Financeiro-C6fZzyjx.js","assets/Ingredients-ChUdt6a6.js","assets/Ingredients-DAMZAqXx.css","assets/MaskedPII-CdFy0DaW.js","assets/Payments-Bd_KqFsY.js","assets/Payments-CC4n6Yjv.js","assets/Payments-DeS-gXip.css","assets/ProductsStock-CCU9Ggy9.js","assets/Profit-DR57frKD.js","assets/Reports-DAil6hiU.js","assets/Sales-DsP6RMQz.js","assets/cookies/kinder.png","assets/cookies/meio-amargo.png","assets/cookies/nutella.png","assets/cookies/tradicional.png","assets/index-1vAQAIG3.css","assets/index-BuhEwSV0.js","assets/index-w6Dqbg6H.js","assets/index.esm-CqN7BhNJ.js","assets/index.esm-DVnNS6o_.js","assets/logo-Bw1djsMk.png","assets/pendencias-avancado-BiGClaaO.js","assets/purchase-cloud-BGDOtUzk.js","assets/vendor-firebase-BfrlHxoi.js","assets/vendor-icons-DhqNQKGi.js","assets/vendor-react-DyPHdIWs.js","icon-180.png","icon-192.png","icon-512.png","index.html","logo.png","manifest.webmanifest"].map(path => new URL(path, self.registration.scope).href);
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
