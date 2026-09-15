/* Generated from the production build. Only public static assets are cached. */
const CACHE = 'cookie-zookie-ffcd78e1f4036720';
const ASSETS = ["assets/Audit-BEq-0emd.js","assets/ConfirmDialog-l9ovmoos.js","assets/CustomersBilling-CDYXTjEv.js","assets/Dashboard-CVTkkuoW.js","assets/Financeiro-COd2XtQu.js","assets/Ingredients-BnHEh6Fe.js","assets/Ingredients-DAMZAqXx.css","assets/MaskedPII-DhfPvfXe.js","assets/Payments-C3KYr_n5.js","assets/Payments-D8YvvMu2.js","assets/Payments-DeS-gXip.css","assets/ProductsStock-CE35A-02.js","assets/Profit-CjO5B03g.js","assets/Reports-BxzWeDqn.js","assets/Sales-BglF5d7l.js","assets/cookies/kinder.png","assets/cookies/meio-amargo.png","assets/cookies/nutella.png","assets/cookies/tradicional.png","assets/index-Bn7izt76.css","assets/index-BuhEwSV0.js","assets/index-CmxjnsHg.js","assets/index.esm-C5S1CRD1.js","assets/index.esm-rKg1ZgD6.js","assets/logo-Bw1djsMk.png","assets/pendencias-avancado-BiGClaaO.js","assets/purchase-cloud-DI-S9uBB.js","assets/vendor-firebase-Dpl0fhbZ.js","assets/vendor-icons-BP4_7ZJU.js","assets/vendor-react-BCXTeCyR.js","icon-180.png","icon-192.png","icon-512.png","index.html","logo.png","manifest.webmanifest"].map(path => new URL(path, self.registration.scope).href);
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
