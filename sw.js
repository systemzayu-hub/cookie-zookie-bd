/* Generated from the production build. Only public static assets are cached. */
const CACHE = 'cookie-zookie-ef07607d204418be';
const ASSETS = ["assets/Audit-DAt0ClD9.js","assets/ConfirmDialog-DgBsT4bb.js","assets/CustomersBilling-BlQyszJu.js","assets/Dashboard-BPFzQpid.js","assets/Financeiro-BF1QJn--.js","assets/Ingredients-CLgW0yV2.js","assets/Ingredients-DAMZAqXx.css","assets/MaskedPII-CbfSYewR.js","assets/Payments-CWz4wZYp.js","assets/Payments-DcvnzRmC.js","assets/Payments-DeS-gXip.css","assets/ProductsStock-Bu9ptp9i.js","assets/Profit-Ci-LrKlI.js","assets/Reports-CFxzmQ2f.js","assets/Sales-vcWlUfa7.js","assets/cookies/kinder.png","assets/cookies/meio-amargo.png","assets/cookies/nutella.png","assets/cookies/tradicional.png","assets/index--XiZRhuk.js","assets/index-BuhEwSV0.js","assets/index-DUUQgnRe.css","assets/index.esm-CqN7BhNJ.js","assets/index.esm-DVnNS6o_.js","assets/logo-Bw1djsMk.png","assets/pendencias-avancado-BiGClaaO.js","assets/purchase-cloud-ihMS90K3.js","assets/vendor-firebase-BfrlHxoi.js","assets/vendor-icons-BP2cAfD4.js","assets/vendor-react-4etXnMby.js","icon-180.png","icon-192.png","icon-512.png","index.html","logo.png","manifest.webmanifest"].map(path => new URL(path, self.registration.scope).href);
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
