/* Generated from the production build. Only public static assets are cached. */
const CACHE = 'cookie-zookie-4ba20afe37b95f35';
const ASSETS = ["assets/Audit-KJNAiWfb.js","assets/CustomersBilling-DjiDoqLu.js","assets/Dashboard-DqP8fpHD.js","assets/Financeiro-BCStqdTx.js","assets/Ingredients-B3VN6mq7.js","assets/Ingredients-DAMZAqXx.css","assets/MaskedPII-CTRo0plJ.js","assets/Payments-2B718PTu.js","assets/Payments-BMm6aVgH.js","assets/Payments-DeS-gXip.css","assets/ProductsStock-C_UYpaRG.js","assets/Profit-Dd4VIfZi.js","assets/Reports-BeANxadC.js","assets/Sales-DQl5050g.js","assets/cookies/kinder.png","assets/cookies/meio-amargo.png","assets/cookies/nutella.png","assets/cookies/tradicional.png","assets/index-BuhEwSV0.js","assets/index-CLVGSUwd.js","assets/index-Pv9ZeS-S.css","assets/index.esm-C5S1CRD1.js","assets/index.esm-rKg1ZgD6.js","assets/logo-Bw1djsMk.png","assets/pendencias-avancado-BiGClaaO.js","assets/purchase-cloud-Dm2anJfA.js","assets/vendor-firebase-Dpl0fhbZ.js","assets/vendor-icons-nsN3uSCJ.js","assets/vendor-react-TOoC18Z8.js","icon-180.png","icon-192.png","icon-512.png","index.html","logo.png","manifest.webmanifest"].map(path => new URL(path, self.registration.scope).href);
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
