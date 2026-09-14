/* Generated from the production build. Only public static assets are cached. */
const CACHE = 'cookie-zookie-881572bf00b15ebe';
const ASSETS = ["assets/Audit-CxxGYN0W.js","assets/CustomersBilling-Bi3AIVTM.js","assets/Dashboard-CyzLc4QZ.js","assets/Financeiro-O1adQEnU.js","assets/Ingredients-Bi_CjL4U.css","assets/Ingredients-Cu0LOnmm.js","assets/MaskedPII-D1EW-o2A.js","assets/Payments-BY28Bb-c.js","assets/Payments-DHRFwPSX.js","assets/Payments-DeS-gXip.css","assets/ProductsStock-BXNu_G37.js","assets/Profit-Uiz0vyXM.js","assets/Reports-DJtxTfIc.js","assets/Sales-Bed9ji_3.js","assets/cookies/kinder.png","assets/cookies/meio-amargo.png","assets/cookies/nutella.png","assets/cookies/tradicional.png","assets/index-BuhEwSV0.js","assets/index-BvJSS5Rt.js","assets/index-C2gM7ilT.css","assets/index.esm-C5S1CRD1.js","assets/index.esm-rKg1ZgD6.js","assets/logo-CO3eNKz-.png","assets/pendencias-avancado-BiGClaaO.js","assets/purchase-cloud-BtZEy4qZ.js","assets/vendor-firebase-Dpl0fhbZ.js","assets/vendor-icons-BF5pHoy6.js","assets/vendor-react-Dn085ts3.js","index.html","logo.png","manifest.webmanifest"].map(path => new URL(path, self.registration.scope).href);
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
