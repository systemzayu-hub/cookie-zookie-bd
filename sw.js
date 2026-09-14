/* Generated from the production build. Only public static assets are cached. */
const CACHE = 'cookie-zookie-083461174a94b5ac';
const ASSETS = ["assets/Audit-BS5tqczQ.js","assets/CustomersBilling-DzRIPOFd.js","assets/Dashboard-CgFe5JRx.js","assets/Financeiro-BbVh-umr.js","assets/Ingredients-Bi_CjL4U.css","assets/Ingredients-DMhFnchs.js","assets/MaskedPII-Cfr5Pglq.js","assets/Payments-BsNC9y7E.js","assets/Payments-CPXF4weK.js","assets/Payments-DeS-gXip.css","assets/ProductsStock-DmR4KSdB.js","assets/Profit-CkmJswQ7.js","assets/Reports-BiMO_DrK.js","assets/Sales-3l6ncSEs.js","assets/cookies/kinder.png","assets/cookies/meio-amargo.png","assets/cookies/nutella.png","assets/cookies/tradicional.png","assets/index-BuhEwSV0.js","assets/index-NZpB08YU.css","assets/index-QaIVf6u4.js","assets/index.esm-C5S1CRD1.js","assets/index.esm-rKg1ZgD6.js","assets/logo-CO3eNKz-.png","assets/pendencias-avancado-BiGClaaO.js","assets/purchase-cloud-DOZg5YXJ.js","assets/vendor-firebase-Dpl0fhbZ.js","assets/vendor-icons-BF5pHoy6.js","assets/vendor-react-Dn085ts3.js","icon-180.png","icon-192.png","icon-512.png","index.html","logo.png","manifest.webmanifest"].map(path => new URL(path, self.registration.scope).href);
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
