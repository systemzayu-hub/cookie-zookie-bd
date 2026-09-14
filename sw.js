/* Generated from the production build. Only public static assets are cached. */
const CACHE = 'cookie-zookie-4abf6df620b2d8f3';
const ASSETS = ["assets/Audit-Dru2fd10.js","assets/CustomersBilling-BbQXt6fV.js","assets/Dashboard-Dch1Bs-y.js","assets/Financeiro-BQ9uyK3S.js","assets/Ingredients-Bi_CjL4U.css","assets/Ingredients-C792aOhG.js","assets/MaskedPII-CLYNm4nH.js","assets/Payments-7djEGBg7.js","assets/Payments-BYlVToHh.js","assets/Payments-DeS-gXip.css","assets/ProductsStock-CQOfz7XG.js","assets/Profit-RM1MV56t.js","assets/Reports-Cd2l7Zkb.js","assets/Sales-CEhT1kAG.js","assets/cookies/kinder.png","assets/cookies/meio-amargo.png","assets/cookies/nutella.png","assets/cookies/tradicional.png","assets/index--XpTRzeD.css","assets/index-BuhEwSV0.js","assets/index-CXn9ndsx.js","assets/index.esm-C5S1CRD1.js","assets/index.esm-rKg1ZgD6.js","assets/logo-CO3eNKz-.png","assets/pendencias-avancado-BiGClaaO.js","assets/purchase-cloud-CuWoF2zU.js","assets/vendor-firebase-Dpl0fhbZ.js","assets/vendor-icons-BF5pHoy6.js","assets/vendor-react-Dn085ts3.js","icon-180.png","icon-192.png","icon-512.png","index.html","logo.png","manifest.webmanifest"].map(path => new URL(path, self.registration.scope).href);
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
