/* Generated from the production build. Only public static assets are cached. */
const CACHE = 'cookie-zookie-7bbfdf773c8c1255';
const ASSETS = ["assets/Audit-Bum1vbUj.js","assets/CustomersBilling-CAYT8sLg.js","assets/Dashboard-BSmMVAn_.js","assets/DeleteConfirmation-CR7l4Kkx.js","assets/Financeiro-DYrTaNdS.js","assets/Ingredients-DAMZAqXx.css","assets/Ingredients-Dvf0EZmd.js","assets/MaskedPII-CEaKz2Ot.js","assets/Payments-CF9bqwRb.js","assets/Payments-DeS-gXip.css","assets/Payments-XfHrQERs.js","assets/ProductsStock-C6rul2iN.js","assets/Profit-CrfFf30g.js","assets/Reports-DZosTgRO.js","assets/Sales-BAmGlojJ.js","assets/cookies/kinder.png","assets/cookies/meio-amargo.png","assets/cookies/nutella.png","assets/cookies/tradicional.png","assets/index-1W4qM0sO.js","assets/index-BuhEwSV0.js","assets/index-I2nocCKb.css","assets/index.esm-DblcbH-e.js","assets/index.esm-bE1-DS-7.js","assets/logo-Bw1djsMk.png","assets/pendencias-avancado-BiGClaaO.js","assets/purchase-cloud-CNFt0H2F.js","assets/vendor-firebase-DGaWZ0Z3.js","assets/vendor-icons-DhqNQKGi.js","assets/vendor-react-DyPHdIWs.js","icon-180.png","icon-192.png","icon-512.png","index.html","logo.png","manifest.webmanifest"].map(path => new URL(path, self.registration.scope).href);
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
