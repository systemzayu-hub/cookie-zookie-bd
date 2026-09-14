import { saleOutstanding, type Customer, type Sale } from './types'
import type { StoreData } from './validation'
import { sameData } from './store-merge'

export type CustomerPayment = { customerId: string; amount: number; sales: Sale[] }
export type SaleTransfer = { sale: Sale; target: Customer }

const cents = (value: number) => Math.round(value * 100)
const oldestFirst = (a: Sale, b: Sale) => Date.parse(a.date) - Date.parse(b.date) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

export function payCustomer(store: StoreData, request: CustomerPayment): StoreData {
  const pending = store.sales.filter(s => s.customerId === request.customerId && s.status === 'Pendente').sort(oldestFirst)
  if (!store.customers.some(c => c.id === request.customerId) || !sameData(pending, [...request.sales].sort(oldestFirst))) {
    throw new Error('As pendências mudaram. Confira o saldo e tente novamente.')
  }
  let remaining = cents(request.amount)
  if (!Number.isFinite(request.amount) || remaining <= 0 || Math.abs(request.amount * 100 - remaining) > 0.000001) {
    throw new Error('Informe um valor positivo com até duas casas decimais.')
  }
  if (remaining > pending.reduce((sum, sale) => sum + cents(saleOutstanding(sale)), 0)) {
    throw new Error('O valor supera o saldo pendente do cliente.')
  }
  const updates = new Map<string, Sale>()
  for (const sale of pending) {
    const outstanding = cents(saleOutstanding(sale))
    const applied = Math.min(remaining, outstanding)
    if (!applied) continue
    const paidAmount = (cents(sale.total) - outstanding + applied) / 100
    const allPaid = applied === outstanding
    updates.set(sale.id, { ...sale, paidAmount, status: allPaid ? 'Pago' : 'Pendente',
      items: allPaid ? sale.items.map(item => ({ ...item, paid: true })) : sale.items })
    remaining -= applied
    if (!remaining) break
  }
  return { ...store, sales: store.sales.map(sale => updates.get(sale.id) || sale) }
}

export function transferSale(store: StoreData, { sale, target }: SaleTransfer): StoreData {
  if (!sameData(store.sales.find(s => s.id === sale.id), sale) || !sameData(store.customers.find(c => c.id === target.id), target)) {
    throw new Error('A venda ou o cliente mudou. Reabra a transferência e confira os dados.')
  }
  if (sale.customerId === target.id) throw new Error('Escolha outro cliente.')
  return { ...store, sales: store.sales.map(s => s.id === sale.id ? { ...s, customerId: target.id } : s) }
}
