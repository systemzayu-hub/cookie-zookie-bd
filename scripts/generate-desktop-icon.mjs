import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const source = resolve('public/icon-512.png')
const output = resolve('build/icon.ico')
const png = await readFile(source)
const header = Buffer.alloc(22)
header.writeUInt16LE(0, 0)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(1, 4)
header[6] = 0
header[7] = 0
header.writeUInt16LE(1, 8)
header.writeUInt16LE(32, 10)
header.writeUInt32LE(png.length, 14)
header.writeUInt32LE(22, 18)
await mkdir(dirname(output), { recursive: true })
await writeFile(output, Buffer.concat([header, png]))
console.log(`Ícone do desktop criado em ${output}`)
