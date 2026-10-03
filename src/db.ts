import { Product, Sale, Customer } from './types'
import { load, save } from './data'
import { validateStoreData } from './validation'
import type { CustomerReceipt } from './customer-receipts'

export type BackupExtras = { custos: unknown[]; perdas: unknown[] }
export type BackupExportOptions = { customerReceipts: Record<string, CustomerReceipt[]> }
export type RestoreBackupExtras = (extras: BackupExtras) => void | boolean | Promise<void | boolean>

const hasText = (value: unknown, max: number) => typeof value === 'string' && value.trim().length > 0 && value.length <= max
const validAmount = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0
const validNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value)
const validId = (value: unknown) => hasText(value, 200) && !(value as string).includes('/')
const validCivilDate = (value: unknown) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function validCost(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return validId(row.id) && hasText(row.name, 200)
    && validAmount(row.precoVenda) && validAmount(row.custoUnitario)
    && validNumber(row.lucroUnitario)
    && validNumber(row.margem)
}

function validLoss(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return validId(row.id) && validCivilDate(row.date) && hasText(row.produto, 200) && hasText(row.motivo, 500)
    && typeof row.qtd === 'number' && Number.isSafeInteger(row.qtd) && row.qtd > 0
    && validAmount(row.custoUnit) && validAmount(row.custoTotal)
}

function readBackupExtras(value: unknown): BackupExtras {
  if (!value || typeof value !== 'object') throw new Error('Os extras do backup são inválidos.')
  const raw = value as Record<string, unknown>
  if (!Array.isArray(raw.custos) || raw.custos.length > 100 || !Array.isArray(raw.perdas) || raw.perdas.length > 5_000) {
    throw new Error('Os extras do backup excedem os limites ou têm formato inválido.')
  }
  const ids = new Set<string>()
  for (const row of raw.custos) {
    if (!validCost(row) || ids.has(row.id as string)) throw new Error('Há custos inválidos ou IDs de custos repetidos no backup.')
    ids.add(row.id as string)
  }
  ids.clear()
  for (const row of raw.perdas) {
    if (!validLoss(row) || ids.has(row.id as string)) throw new Error('Há perdas inválidas ou IDs de perdas repetidos no backup.')
    ids.add(row.id as string)
  }
  return { custos: raw.custos, perdas: raw.perdas }
}

export type BackupData = {
  version: number
  exportedAt: string
  products: Product[]
  sales: Sale[]
  customers: Customer[]
  extras?: BackupExtras
  /** Histórico imutável exportado apenas para consulta; nunca é restaurado. */
  receiptHistory?: Record<string, CustomerReceipt[]>
}

export function exportarDados(products: Product[], sales: Sale[], customers: Customer[], options?: BackupExportOptions): string {
  const payload: BackupData = {
    version: 2,
    exportedAt: new Date().toISOString(),
    products, sales, customers,
    extras: {
      custos: load<unknown[]>('cc_custos', []),
      perdas: load<unknown[]>('cc_perdas', []),
    },
    ...(options ? { receiptHistory: options.customerReceipts } : {}),
  }
  return JSON.stringify(payload, null, 2)
}

export function baixarBackup(products: Product[], sales: Sale[], customers: Customer[], options?: BackupExportOptions) {
  const json = exportarDados(products, sales, customers, options)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `cookie-zookie-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

export function aplicarBackup(file: File, cb: (data: BackupData) => void | boolean | Promise<void | boolean>, restoreExtras?: RestoreBackupExtras): Promise<void> {
  return new Promise((resolve, reject) => {
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error('O backup excede o limite de 5 MB.'))
      return
    }
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const raw = JSON.parse(reader.result as string) as Record<string, unknown>
        const store = validateStoreData(raw)
        if (!store || (raw.version !== 1 && raw.version !== 2)) {
          reject(new Error('Arquivo de backup inválido.'))
          return
        }
        const extras = raw.extras === undefined ? undefined : readBackupExtras(raw.extras)
        const data: BackupData = {
          version: 2,
          exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : new Date().toISOString(),
          ...store,
          ...(extras ? { extras } : {}),
        }
        if (await cb(data) === false) { resolve(); return }
        if (extras) {
          if (restoreExtras && await restoreExtras(extras) === false) {
            reject(new Error('A restauração dos custos e perdas não foi confirmada.'))
            return
          }
          if (!save('cc_custos', extras.custos)) throw new Error('Não foi possível restaurar os custos neste aparelho.')
          if (!save('cc_perdas', extras.perdas)) throw new Error('Não foi possível restaurar as perdas neste aparelho.')
        }
        resolve()
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Não foi possível ler o backup.'))
      }
    }
    reader.onerror = () => reject(new Error('Erro na leitura do arquivo.'))
    reader.readAsText(file)
  })
}
