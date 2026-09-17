/* Generated from the production build. Only public static assets are cached. */
const CACHE = 'cookie-zookie-5c4788b8e9389e9d';
const ASSETS = ["assets/Audit-B2Ao9-eV.js","assets/ConfirmDialog-B9mRHU-n.js","assets/CustomersBilling-Bns7HS6e.js","assets/Dashboard-DpSs_-X_.js","assets/Financeiro-DvK2bro9.js","assets/Ingredients-DA9aYoAC.js","assets/Ingredients-DAMZAqXx.css","assets/MaskedPII-Xg0OByr_.js","assets/Payments-BCyUIg1g.js","assets/Payments-BJEZDWic.js","assets/Payments-DeS-gXip.css","assets/ProductsStock-0CohI55v.js","assets/Profit-CSUENFMH.js","assets/Reports-jgwALBPh.js","assets/Sales-BcStDqBm.js","assets/cookies/kinder.png","assets/cookies/meio-amargo.png","assets/cookies/nutella.png","assets/cookies/tradicional.png","assets/index-BuhEwSV0.js","assets/index-D5lFPOLH.js","assets/index-DUUQgnRe.css","assets/index.esm-C5S1CRD1.js","assets/index.esm-rKg1ZgD6.js","assets/logo-Bw1djsMk.png","assets/pendencias-avancado-BiGClaaO.js","assets/purchase-cloud-CnmoaUMY.js","assets/vendor-firebase-Dpl0fhbZ.js","assets/vendor-icons-BP2cAfD4.js","assets/vendor-react-4etXnMby.js","icon-180.png","icon-192.png","icon-512.png","index.html","logo.png","manifest.webmanifest"].map(path => new URL(path, self.registration.scope).href);
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
