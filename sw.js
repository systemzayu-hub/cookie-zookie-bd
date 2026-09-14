/* Generated from the production build. Only public static assets are cached. */
const CACHE = 'cookie-zookie-3e46f4351a08e128';
const ASSETS = ["assets/Audit-NzCmm3hA.js","assets/CustomersBilling-OeuwGrPw.js","assets/Dashboard-DhG1T_R3.js","assets/Financeiro-BtxA8MpS.js","assets/Ingredients-18DGlg23.js","assets/Ingredients-Bi_CjL4U.css","assets/MaskedPII-B_I4x1ov.js","assets/Payments-D4zxty8H.js","assets/Payments-DEIsaC5I.js","assets/Payments-DeS-gXip.css","assets/ProductsStock-DTEjYoT3.js","assets/Profit-B38awJGX.js","assets/Reports-RVX7X-JG.js","assets/Sales-BjFQt77R.js","assets/cookies/kinder.png","assets/cookies/meio-amargo.png","assets/cookies/nutella.png","assets/cookies/tradicional.png","assets/index-BuhEwSV0.js","assets/index-C2gM7ilT.css","assets/index-CJAw9g9N.js","assets/index.esm-C5S1CRD1.js","assets/index.esm-rKg1ZgD6.js","assets/logo-CO3eNKz-.png","assets/pendencias-avancado-BiGClaaO.js","assets/purchase-cloud-DIQLInDG.js","assets/vendor-firebase-Dpl0fhbZ.js","assets/vendor-icons-BF5pHoy6.js","assets/vendor-react-Dn085ts3.js","index.html","logo.png","manifest.webmanifest"].map(path => new URL(path, self.registration.scope).href);
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
