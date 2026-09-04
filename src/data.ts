import { Product, Customer, Sale } from './types'

/**
 * Apenas dados de catalogo nao pessoais podem fazer parte do bundle publico.
 * Clientes e vendas existentes continuam preservados no localStorage/Firestore;
 * estes arrays sao usados somente em uma instalacao realmente vazia.
 */
export const seedProducts: Product[] = [
  { id: 'p-nutella', name: 'Nutella', price: 8.5, category: 'especial', stock: 0, emoji: 'N' },
  { id: 'p-kinder', name: 'Kinder', price: 8.5, category: 'especial', stock: 0, emoji: 'K' },
  { id: 'p-tradicional', name: 'Tradicional', price: 6, category: 'tradicional', stock: 0, emoji: 'T' },
  { id: 'p-meioamargo', name: 'Meio Amargo', price: 7, category: 'tradicional', stock: 0, emoji: 'M' },
]

export const seedCustomers: Customer[] = []
export const seedSales: Sale[] = []

export const STORAGE_ERROR_EVENT = 'cookie-zookie:storage-error'

function reportStorageError(key: string, operation: 'read' | 'write', error: unknown) {
  console.error(`[storage] falha ao ${operation === 'read' ? 'ler' : 'salvar'} ${key}`, error)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(STORAGE_ERROR_EVENT, { detail: { key, operation } }))
  }
}

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch (error) {
    reportStorageError(key, 'read', error)
    return fallback
  }
}

export function save(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (error) {
    reportStorageError(key, 'write', error)
    return false
  }
}
