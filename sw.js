/* Generated from the production build. Only public static assets are cached. */
const CACHE = 'cookie-zookie-a35864f09ed9c12b';
const ASSETS = ["assets/Audit-WmdmDAyw.js","assets/ConfirmDialog-1cZD9FKc.js","assets/CustomersBilling-Ca5O5jwp.js","assets/Dashboard-hrRFOzU0.js","assets/Financeiro-CMmuwuo6.js","assets/Ingredients-BpRazQ1r.js","assets/Ingredients-DAMZAqXx.css","assets/MaskedPII-JFALoVlB.js","assets/Payments-Cz6glYew.js","assets/Payments-D04z6Ns4.js","assets/Payments-DeS-gXip.css","assets/ProductsStock-B8OkkISB.js","assets/Profit-BmrirBpa.js","assets/Reports-0p-ft2Y5.js","assets/Sales-EsOEpILE.js","assets/cookies/kinder.png","assets/cookies/meio-amargo.png","assets/cookies/nutella.png","assets/cookies/tradicional.png","assets/index-BuhEwSV0.js","assets/index-Bv7lAIRp.js","assets/index-DOYaX4ku.css","assets/index.esm-CqN7BhNJ.js","assets/index.esm-DVnNS6o_.js","assets/logo-Bw1djsMk.png","assets/pendencias-avancado-BiGClaaO.js","assets/purchase-cloud-D6jPUCSi.js","assets/vendor-firebase-BfrlHxoi.js","assets/vendor-icons-DhqNQKGi.js","assets/vendor-react-DyPHdIWs.js","icon-180.png","icon-192.png","icon-512.png","index.html","logo.png","manifest.webmanifest"].map(path => new URL(path, self.registration.scope).href);
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
