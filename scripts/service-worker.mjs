import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { Script } from 'node:vm'

async function files(directory, prefix = '') {
  const result = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = prefix + entry.name
    if (entry.isDirectory()) result.push(...await files(join(directory, entry.name), name + '/'))
    else if (name !== 'sw.js' && !name.endsWith('.map')) result.push(name)
  }
  return result
}
const assets = (await files('dist')).sort()
const hash = createHash('sha256')
for (const file of assets) hash.update(file).update(await readFile(join('dist', file)))
const version = hash.digest('hex').slice(0, 16)
const source = `/* Generated from the production build. Only public static assets are cached. */
const CACHE = 'cookie-zookie-${version}';
const ASSETS = ${JSON.stringify(assets)}.map(path => new URL(path, self.registration.scope).href);
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
`
new Script(source)
await writeFile('dist/sw.js', source)
console.log(`Offline shell: ${assets.length} static assets, version ${version}`)
