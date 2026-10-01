/* Generated from the production build. Only public static assets are cached. */
const CACHE = 'cookie-zookie-d6d9c6480483edf3';
const ASSETS = ["assets/Audit-DKdzKwYw.js","assets/CustomersBilling-BRxArZWV.js","assets/Dashboard-B8k0fjtM.js","assets/DeleteConfirmation-C9dyp2d1.js","assets/Financeiro-DQiGNUIi.js","assets/Ingredients-B41-S78u.js","assets/Ingredients-DAMZAqXx.css","assets/MaskedPII-CzcihQFn.js","assets/Payments-C8NVGy4h.js","assets/Payments-DeS-gXip.css","assets/Payments-DspBPaqB.js","assets/ProductsStock-DyWhzTn1.js","assets/Profit-5oWCvR90.js","assets/Reports-BkXWFte0.js","assets/Sales-BOGAn08P.js","assets/cookies/kinder.png","assets/cookies/meio-amargo.png","assets/cookies/nutella.png","assets/cookies/tradicional.png","assets/index-B73-YzQ-.js","assets/index-BuhEwSV0.js","assets/index-D-AHO6y9.css","assets/index.esm-CqN7BhNJ.js","assets/index.esm-DVnNS6o_.js","assets/logo-Bw1djsMk.png","assets/pendencias-avancado-BiGClaaO.js","assets/purchase-cloud-DscM4Rht.js","assets/vendor-firebase-BfrlHxoi.js","assets/vendor-icons-DhqNQKGi.js","assets/vendor-react-DyPHdIWs.js","icon-180.png","icon-192.png","icon-512.png","index.html","logo.png","manifest.webmanifest"].map(path => new URL(path, self.registration.scope).href);
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
