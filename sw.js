/* Generated from the production build. Only public static assets are cached. */
const CACHE = 'cookie-zookie-f525601f680b8758';
const ASSETS = ["assets/Audit-D6G2jAAZ.js","assets/CustomersBilling-BF9HVIr2.js","assets/Dashboard-DRBZP06Q.js","assets/Financeiro-Cl8W1LJW.js","assets/Ingredients-Bi_CjL4U.css","assets/Ingredients-CkB_nyZj.js","assets/MaskedPII-C9VKdow7.js","assets/Payments-DNQfnsr3.js","assets/Payments-DeS-gXip.css","assets/Payments-lbR_nzMk.js","assets/ProductsStock-DEMYcgLv.js","assets/Profit-C71bc-7G.js","assets/Reports-DELW3GLs.js","assets/Sales-BbnLdExe.js","assets/cookies/kinder.png","assets/cookies/meio-amargo.png","assets/cookies/nutella.png","assets/cookies/tradicional.png","assets/index-BuhEwSV0.js","assets/index-C-Vt0FAd.css","assets/index-PyV9R4RS.js","assets/index.esm-C5S1CRD1.js","assets/index.esm-rKg1ZgD6.js","assets/logo-Bw1djsMk.png","assets/pendencias-avancado-BiGClaaO.js","assets/purchase-cloud-Cz7aOIwk.js","assets/vendor-firebase-Dpl0fhbZ.js","assets/vendor-icons-nsN3uSCJ.js","assets/vendor-react-TOoC18Z8.js","icon-180.png","icon-192.png","icon-512.png","index.html","logo.png","manifest.webmanifest"].map(path => new URL(path, self.registration.scope).href);
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
