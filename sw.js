/* Generated from the production build. Only public static assets are cached. */
const CACHE = 'cookie-zookie-9fce3ebf4d207fd2';
const ASSETS = ["assets/Audit-gJSf7Bh8.js","assets/ConfirmDialog-6hHsHmbg.js","assets/CustomersBilling-DfF9oJZw.js","assets/Dashboard-p6sJmeQj.js","assets/Financeiro-CZ-pg_3n.js","assets/Ingredients-DAMZAqXx.css","assets/Ingredients-DhhrRNgS.js","assets/MaskedPII-dgOodJDx.js","assets/Payments-CfAKw3Lk.js","assets/Payments-DeS-gXip.css","assets/Payments-YkPPQY-2.js","assets/ProductsStock-oOV47yLn.js","assets/Profit-DcKXL1vq.js","assets/Reports-zKWGds56.js","assets/Sales-CQBFzlZw.js","assets/cookies/kinder.png","assets/cookies/meio-amargo.png","assets/cookies/nutella.png","assets/cookies/tradicional.png","assets/index-1vAQAIG3.css","assets/index-BuhEwSV0.js","assets/index-DBxECZKZ.js","assets/index.esm-CqN7BhNJ.js","assets/index.esm-DVnNS6o_.js","assets/logo-Bw1djsMk.png","assets/pendencias-avancado-BiGClaaO.js","assets/purchase-cloud-C_0ZU8wZ.js","assets/vendor-firebase-BfrlHxoi.js","assets/vendor-icons-DhqNQKGi.js","assets/vendor-react-DyPHdIWs.js","icon-180.png","icon-192.png","icon-512.png","index.html","logo.png","manifest.webmanifest"].map(path => new URL(path, self.registration.scope).href);
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
