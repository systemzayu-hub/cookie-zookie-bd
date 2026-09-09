import type { Customer } from './types'
import type { StoreData } from './validation'
import { sameData } from './store-merge'

export interface CustomerMerge { source: Customer; target: Customer; contact: string }
export function combineCustomers(store: StoreData, request: CustomerMerge): StoreData {
  const { source, target, contact } = request
  if (source.id === target.id) throw new Error('Escolha dois clientes diferentes.')
  if (!sameData(store.customers.find(c => c.id === source.id), source) || !sameData(store.customers.find(c => c.id === target.id), target)) throw new Error('Um dos clientes mudou. Reabra a edição e confira os cadastros antes de combinar.')
  if (contact.length > 120) throw new Error('Confira o telefone que será mantido.')
  return {
    ...store,
    customers: store.customers.filter(c => c.id !== source.id).map(c => c.id === target.id ? { ...c, contact } : c),
    sales: store.sales.map(s => s.customerId === source.id ? { ...s, customerId: target.id } : s),
  }
}
