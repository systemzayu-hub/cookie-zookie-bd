/* Generated from the production build. Only public static assets are cached. */
const CACHE = 'cookie-zookie-16049d16bb243127';
const ASSETS = ["assets/Audit-D5L47UmF.js","assets/CustomersBilling-BaaxhXyy.js","assets/Dashboard-CfwC1K1g.js","assets/Financeiro-sbVsJhfq.js","assets/Ingredients-Bi_CjL4U.css","assets/Ingredients-CepGv-e9.js","assets/MaskedPII-1o7F641p.js","assets/Payments-8YgrBSDG.js","assets/Payments-DeS-gXip.css","assets/Payments-RzxrCvej.js","assets/ProductsStock-CShx88YM.js","assets/Profit-DMduI6oP.js","assets/Reports-Bd6OYe0o.js","assets/Sales-Bxo1V550.js","assets/cookies/kinder.png","assets/cookies/meio-amargo.png","assets/cookies/nutella.png","assets/cookies/tradicional.png","assets/index-BuhEwSV0.js","assets/index-C2gM7ilT.css","assets/index-aLpS7VLz.js","assets/index.esm-C5S1CRD1.js","assets/index.esm-rKg1ZgD6.js","assets/logo-CO3eNKz-.png","assets/pendencias-avancado-BiGClaaO.js","assets/purchase-cloud-mDIuRFvP.js","assets/vendor-firebase-Dpl0fhbZ.js","assets/vendor-icons-BF5pHoy6.js","assets/vendor-react-Dn085ts3.js","index.html","logo.png","manifest.webmanifest"].map(path => new URL(path, self.registration.scope).href);
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
