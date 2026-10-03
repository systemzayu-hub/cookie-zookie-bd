/* Generated from the production build. Only public static assets are cached. */
const CACHE = 'cookie-zookie-188bdcbc56cb1853';
const ASSETS = ["assets/Audit-BmA0MftW.css","assets/Audit-C0CDP4uX.js","assets/CustomersBilling-CvzpJK-r.js","assets/CustomersBilling-LahfZ5fv.css","assets/Dashboard-Cppm82tA.js","assets/DeleteConfirmation-BSHKX6KQ.js","assets/Financeiro-CxiEGupf.js","assets/Ingredients-2JqIpS9n.js","assets/Ingredients-DAMZAqXx.css","assets/MaskedPII-4D40YmQb.js","assets/Payments-DdY5-HPl.js","assets/Payments-DeS-gXip.css","assets/Payments-h9k_KvqE.js","assets/ProductsStock-KzdV_X1E.js","assets/Profit-5lzWDdeA.js","assets/Reports-LEjWsoua.js","assets/Sales-3vA_Zbaw.js","assets/cookies/kinder.png","assets/cookies/meio-amargo.png","assets/cookies/nutella.png","assets/cookies/tradicional.png","assets/index-Mz-dlmqC.js","assets/index-m21oSFcb.js","assets/index-n0oiW6R0.css","assets/index.esm-DAE7oaOs.js","assets/index.esm-DNgz4Cs1.js","assets/logo-Bw1djsMk.png","assets/purchase-cloud-BGgdvFlP.js","assets/vendor-firebase-B5dPu1aM.js","assets/vendor-icons-BJBCbu0l.js","assets/vendor-react-DZEZr1Pk.js","icon-180.png","icon-192.png","icon-512.png","index.html","logo.png","manifest.webmanifest"].map(path => new URL(path, self.registration.scope).href);
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
