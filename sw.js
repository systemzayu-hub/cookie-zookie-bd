/* Generated from the production build. Only public static assets are cached. */
const CACHE = 'cookie-zookie-cb74cccfed68c3bb';
const ASSETS = ["assets/Audit-D3TiglRc.css","assets/Audit-DpF4dxjW.js","assets/CustomersBilling-Mu7OahoE.js","assets/Dashboard-kpwm-AP1.js","assets/DeleteConfirmation-HYg4Pn5Y.js","assets/Financeiro-ArvRW9ch.js","assets/Ingredients-CcZenmYT.js","assets/Ingredients-DAMZAqXx.css","assets/MaskedPII-hVMYhznW.js","assets/Payments-BuhEsfZT.js","assets/Payments-CHRtOcou.js","assets/Payments-DeS-gXip.css","assets/ProductsStock-MQlFcnID.js","assets/Profit-txeKPf6y.js","assets/Reports-gBkVOY1z.js","assets/Sales-CVtGLD48.js","assets/cookies/kinder.png","assets/cookies/meio-amargo.png","assets/cookies/nutella.png","assets/cookies/tradicional.png","assets/index-BuhEwSV0.js","assets/index-DegRBrSB.js","assets/index-I2nocCKb.css","assets/index.esm-DblcbH-e.js","assets/index.esm-bE1-DS-7.js","assets/logo-Bw1djsMk.png","assets/pendencias-avancado-BiGClaaO.js","assets/purchase-cloud-BmRhd6sl.js","assets/vendor-firebase-DGaWZ0Z3.js","assets/vendor-icons-DhqNQKGi.js","assets/vendor-react-DyPHdIWs.js","icon-180.png","icon-192.png","icon-512.png","index.html","logo.png","manifest.webmanifest"].map(path => new URL(path, self.registration.scope).href);
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
