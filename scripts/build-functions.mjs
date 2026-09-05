import { build } from 'esbuild'
await build({ entryPoints: ['functions/src/index.ts'], outfile: 'functions/lib/index.js', bundle: true, platform: 'node', target: 'node22', format: 'cjs', packages: 'external' })
