/* Generated from the production build. Only public static assets are cached. */
const CACHE = 'cookie-zookie-1a524775981fb89c';
const ASSETS = ["assets/Audit-DbwJw3dQ.js","assets/CustomersBilling-8weOdmzv.js","assets/Dashboard-BqXGyfPR.js","assets/Financeiro-SdHHXT7J.js","assets/Ingredients-B4zwi6Ld.js","assets/Ingredients-Bi_CjL4U.css","assets/MaskedPII-CzFsUiCa.js","assets/ProductsStock-_f_yJEOf.js","assets/Reports-DwqMiqNm.js","assets/Sales-BXp-54pU.js","assets/cookies/kinder.png","assets/cookies/meio-amargo.png","assets/cookies/nutella.png","assets/cookies/tradicional.png","assets/index-Cnju-g9n.css","assets/index-wDl4BA0h.js","assets/index.esm-C5S1CRD1.js","assets/index.esm-rKg1ZgD6.js","assets/logo-CO3eNKz-.png","assets/pendencias-avancado-BiGClaaO.js","assets/vendor-firebase-Dpl0fhbZ.js","assets/vendor-icons-BmwSyiP1.js","assets/vendor-react-C4LoDZJM.js","index.html","logo.png","manifest.webmanifest"].map(path => new URL(path, self.registration.scope).href);
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
