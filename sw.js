/* Generated from the production build. Only public static assets are cached. */
const CACHE = 'cookie-zookie-c84365cc04ffe75d';
const ASSETS = ["assets/Audit-BmA0MftW.css","assets/Audit-y8voG7UW.js","assets/CustomersBilling-BE9BTzLi.js","assets/CustomersBilling-C-c7klkI.css","assets/Dashboard-Cku5KcSg.js","assets/DeleteConfirmation-CX1WE7E4.js","assets/Financeiro-Bw5XQhih.js","assets/Ingredients-BrrXM6CH.js","assets/Ingredients-DAMZAqXx.css","assets/MaskedPII-Bk3UxRbR.js","assets/Payments-Br2_AbEj.js","assets/Payments-DL_jDieD.js","assets/Payments-DeS-gXip.css","assets/ProductsStock-DJtyvDbx.js","assets/Profit-6pqVHxlP.js","assets/Reports-Bu1TQduI.js","assets/Sales-BxCCjIbG.js","assets/cookies/kinder.png","assets/cookies/meio-amargo.png","assets/cookies/nutella.png","assets/cookies/tradicional.png","assets/index-BR4hHK52.js","assets/index-n0oiW6R0.css","assets/index-sJfMwFma.js","assets/index.esm-DAE7oaOs.js","assets/index.esm-DNgz4Cs1.js","assets/logo-Bw1djsMk.png","assets/purchase-cloud-DZFNYgZB.js","assets/vendor-firebase-B5dPu1aM.js","assets/vendor-icons-BJBCbu0l.js","assets/vendor-react-DZEZr1Pk.js","icon-180.png","icon-192.png","icon-512.png","index.html","logo.png","manifest.webmanifest"].map(path => new URL(path, self.registration.scope).href);
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
