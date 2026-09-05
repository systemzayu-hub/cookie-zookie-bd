import { build } from 'esbuild'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
const directory = await mkdtemp(join(tmpdir(), 'cookie-rules-tests-'))
try {
  const outfile = join(directory, 'suite.cjs')
  await build({ entryPoints: ['tests/free-rules.test.ts'], outfile, bundle: true, platform: 'node', format: 'cjs', banner: { js: 'require = require(' + JSON.stringify('node:module') + ').createRequire(' + JSON.stringify(resolve('package.json')) + ');' }, external: ['firebase/*', '@firebase/rules-unit-testing'] })
  const result = spawnSync(process.execPath, ['--test', outfile], { stdio: 'inherit', env: { ...process.env, NODE_PATH: resolve('node_modules') }, timeout: 120000 })
  process.exitCode = result.status ?? 1
} finally {
  if (dirname(resolve(directory)) !== resolve(tmpdir()) || !directory.includes('cookie-rules-tests-')) throw new Error('Unexpected test directory')
  await rm(directory, { recursive: true, force: true })
}
