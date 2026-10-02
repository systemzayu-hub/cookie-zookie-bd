/* Generated from the production build. Only public static assets are cached. */
const CACHE = 'cookie-zookie-fd041009ae30c367';
const ASSETS = ["assets/Audit-4BWmHSnP.js","assets/Audit-BmA0MftW.css","assets/CustomersBilling-Cq18dfYK.js","assets/Dashboard-BYmK2xPn.js","assets/DeleteConfirmation-DYttfBZB.js","assets/Financeiro-Ders7dgF.js","assets/Ingredients-DAMZAqXx.css","assets/Ingredients-Dr8Lu4qM.js","assets/MaskedPII-DnEzgx9n.js","assets/Payments-BgEi1Jtu.js","assets/Payments-C3Ww1w7W.js","assets/Payments-DeS-gXip.css","assets/ProductsStock-DMM41SmK.js","assets/Profit-oOP3Z8gI.js","assets/Reports-TeYWPSX4.js","assets/Sales-COKeORCl.js","assets/cookies/kinder.png","assets/cookies/meio-amargo.png","assets/cookies/nutella.png","assets/cookies/tradicional.png","assets/index-BuhEwSV0.js","assets/index-I2nocCKb.css","assets/index-QmN0G85_.js","assets/index.esm-DblcbH-e.js","assets/index.esm-bE1-DS-7.js","assets/logo-Bw1djsMk.png","assets/pendencias-avancado-BiGClaaO.js","assets/purchase-cloud-CB4mPcd9.js","assets/vendor-firebase-DGaWZ0Z3.js","assets/vendor-icons-DhqNQKGi.js","assets/vendor-react-DyPHdIWs.js","icon-180.png","icon-192.png","icon-512.png","index.html","logo.png","manifest.webmanifest"].map(path => new URL(path, self.registration.scope).href);
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
