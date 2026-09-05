import { build } from 'esbuild'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const directory = await mkdtemp(join(tmpdir(), 'cookie-zookie-tests-'))
try {
  const outfile = join(directory, 'suite.cjs')
  await build({
    entryPoints: ['tests/core.test.tsx'], outfile, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic',
    define: { 'import.meta.env.BASE_URL': '"./"' },
    external: ['react', 'react/*', 'react-dom/*', 'react-test-renderer'],
    plugins: [{ name: 'mock-firestore-for-hook-tests', setup(builder) {
      builder.onResolve({ filter: /^(firebase-admin\/|firebase-functions\/)/ }, args => args.importer.endsWith('functions/src/index.ts') || args.importer.endsWith('functions\\src\\index.ts') ? { path: resolve('tests/backend-mock.ts') } : undefined)
      builder.onResolve({ filter: /^\.\/sync$/ }, args => args.importer.endsWith('useStoreSync.ts') ? { path: resolve('tests/sync-mock.ts') } : undefined)
    } }],
  })
  const result = spawnSync(process.execPath, ['--test', outfile], { stdio: 'inherit', env: { ...process.env, NODE_PATH: resolve('node_modules') }, timeout: 60_000 })
  process.exitCode = result.status ?? 1
} finally {
  if (dirname(resolve(directory)) !== resolve(tmpdir()) || !directory.includes('cookie-zookie-tests-')) throw new Error('Unexpected temporary directory')
  await rm(directory, { recursive: true, force: true })
}
