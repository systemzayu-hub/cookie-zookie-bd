import { mkdir, copyFile, readdir } from 'node:fs/promises'
await mkdir('public/ocr', { recursive: true })
await copyFile('node_modules/tesseract.js/dist/worker.min.js', 'public/ocr/worker.min.js')
for (const name of await readdir('node_modules/tesseract.js-core')) if (name.endsWith('.wasm.js')) await copyFile(`node_modules/tesseract.js-core/${name}`, `public/ocr/${name}`)
await copyFile('node_modules/@tesseract.js-data/por/4.0.0_best_int/por.traineddata.gz', 'public/ocr/por.traineddata.gz')
await copyFile('node_modules/tesseract.js/LICENSE.md', 'public/ocr/LICENSE-tesseract.txt')
await copyFile('node_modules/tesseract.js-core/LICENSE', 'public/ocr/LICENSE-core.txt')
await copyFile('node_modules/tesseract.js/dist/worker.min.js.LICENSE.txt', 'public/ocr/worker.min.js.LICENSE.txt')
