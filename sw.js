/* Generated from the production build. Only public static assets are cached. */
const CACHE = 'cookie-zookie-1b7cad195e015441';
const ASSETS = ["assets/Audit-mKWzHE90.js","assets/ConfirmDialog-DW7Hmc0m.js","assets/CustomersBilling-vpw2_Nlu.js","assets/Dashboard-DDwA872D.js","assets/Financeiro-BwiURkWP.js","assets/Ingredients-Btm4K2PE.js","assets/Ingredients-DAMZAqXx.css","assets/MaskedPII-CzAReTz8.js","assets/Payments-B0FNEtTq.js","assets/Payments-BL0gfaor.js","assets/Payments-DeS-gXip.css","assets/ProductsStock-Cxs9RC8D.js","assets/Profit-T0MqBewj.js","assets/Reports-Bn24ThF2.js","assets/Sales-BcDKNhFL.js","assets/cookies/kinder.png","assets/cookies/meio-amargo.png","assets/cookies/nutella.png","assets/cookies/tradicional.png","assets/index-BuhEwSV0.js","assets/index-Cpy2H3hb.css","assets/index-D9qBvhL0.js","assets/index.esm-C5S1CRD1.js","assets/index.esm-rKg1ZgD6.js","assets/logo-Bw1djsMk.png","assets/pendencias-avancado-BiGClaaO.js","assets/purchase-cloud-B14jBkGz.js","assets/vendor-firebase-Dpl0fhbZ.js","assets/vendor-icons-BP4_7ZJU.js","assets/vendor-react-BCXTeCyR.js","icon-180.png","icon-192.png","icon-512.png","index.html","logo.png","manifest.webmanifest"].map(path => new URL(path, self.registration.scope).href);
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
