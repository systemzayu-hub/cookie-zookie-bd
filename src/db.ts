import { Product, Sale, Customer } from './types'
import { load, save } from './data'
import { firebaseReady, syncPush } from './sync'
import { validateStoreData } from './validation'

/**
 * Camada de persistência da Cookie Zookie.
 *
 * HOJE: usa localStorage (offline, 1 dispositivo, sem nuvem).
 * FUNCIONA 100% já — todos os dados ficam no navegador.
 *
 * AGORA: também sincroniza com Firebase Firestore quando disponível.
 * O localStorage continua sendo o fallback garantido.
 */

export type BackupData = {
  version: number
  exportedAt: string
  products: Product[]
  sales: Sale[]
  customers: Customer[]
  extras?: {
    custos: unknown[]
    perdas: unknown[]
  }
}

export function exportarDados(products: Product[], sales: Sale[], customers: Customer[]): string {
  const payload: BackupData = {
    version: 2,
    exportedAt: new Date().toISOString(),
    products, sales, customers,
    extras: {
      custos: load<unknown[]>('cc_custos', []),
      perdas: load<unknown[]>('cc_perdas', []),
    },
  }
  return JSON.stringify(payload, null, 2)
}

export function baixarBackup(products: Product[], sales: Sale[], customers: Customer[]) {
  const json = exportarDados(products, sales, customers)
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

export function aplicarBackup(file: File, cb: (data: BackupData) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error('O backup excede o limite de 5 MB.'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const raw = JSON.parse(reader.result as string) as Record<string, unknown>
        const store = validateStoreData(raw)
        if (!store || (raw.version !== 1 && raw.version !== 2)) {
          reject(new Error('Arquivo de backup inválido.'))
          return
        }
        const rawExtras = raw.extras && typeof raw.extras === 'object' ? raw.extras as Record<string, unknown> : null
        const extras = rawExtras && Array.isArray(rawExtras.custos) && rawExtras.custos.length <= 100 && Array.isArray(rawExtras.perdas) && rawExtras.perdas.length <= 5_000
          ? { custos: rawExtras.custos, perdas: rawExtras.perdas }
          : undefined
        const data: BackupData = {
          version: 2,
          exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : new Date().toISOString(),
          ...store,
          ...(extras ? { extras } : {}),
        }
        if (extras) {
          save('cc_custos', extras.custos)
          save('cc_perdas', extras.perdas)
        }
        cb(data)
        resolve()
      } catch {
        reject(new Error('Não foi possível ler o backup.'))
      }
    }
    reader.onerror = () => reject(new Error('Erro na leitura do arquivo.'))
    reader.readAsText(file)
  })
}

let firebaseChecked = false
let firebaseOk = false

/** Persiste no localStorage E tenta sincronizar com Firebase (se disponível). */
export async function persistir(products: Product[], sales: Sale[], customers: Customer[]) {
  // 1) Sempre salva no localStorage (fallback garantido)
  save('cc_products', products)
  save('cc_sales', sales)
  save('cc_customers', customers)

  // 2) Tenta sincronizar com Firebase (não bloqueia, não quebra se falhar)
  if (!firebaseChecked) {
    firebaseChecked = true
    firebaseOk = await firebaseReady()
  }
  if (firebaseOk) {
    try {
      await syncPush(products, sales, customers)
    } catch {
      /* ignore - localStorage já salvou */
    }
  }
}

/** Verifica se Firebase está disponível (para UI mostrar status). */
export async function isFirebaseReady(): Promise<boolean> {
  if (!firebaseChecked) {
    firebaseChecked = true
    firebaseOk = await firebaseReady()
  }
  return firebaseOk
}
