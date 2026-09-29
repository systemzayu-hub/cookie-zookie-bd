/* Generated from the production build. Only public static assets are cached. */
const CACHE = 'cookie-zookie-b23b62b34fb4ad4f';
const ASSETS = ["assets/Audit-BRElYBk0.js","assets/ConfirmDialog-Bn56JZoc.js","assets/CustomersBilling-CrYauy7N.js","assets/Dashboard-CFPTUa1a.js","assets/Financeiro-CM8izC_j.js","assets/Ingredients-Cfa1Z-9p.js","assets/Ingredients-DAMZAqXx.css","assets/MaskedPII-DN5zdOJs.js","assets/Payments-BEFQlDpA.js","assets/Payments-CEp-hsO2.js","assets/Payments-DeS-gXip.css","assets/ProductsStock-DZmJktC3.js","assets/Profit-B7jdE1qt.js","assets/Reports-Cdq8xi4B.js","assets/Sales-DlwrzVCk.js","assets/cookies/kinder.png","assets/cookies/meio-amargo.png","assets/cookies/nutella.png","assets/cookies/tradicional.png","assets/index-1vAQAIG3.css","assets/index-BuhEwSV0.js","assets/index-V3SBSPcw.js","assets/index.esm-CqN7BhNJ.js","assets/index.esm-DVnNS6o_.js","assets/logo-Bw1djsMk.png","assets/pendencias-avancado-BiGClaaO.js","assets/purchase-cloud-D3aDFKXN.js","assets/vendor-firebase-BfrlHxoi.js","assets/vendor-icons-DhqNQKGi.js","assets/vendor-react-DyPHdIWs.js","icon-180.png","icon-192.png","icon-512.png","index.html","logo.png","manifest.webmanifest"].map(path => new URL(path, self.registration.scope).href);
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
