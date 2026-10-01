import { sameData } from './store-merge'
import { validCashPayment, type CashPayment } from './payments'
import type { StoreData } from './validation'
import type { Sale } from './types'

export type DebitChange = { sale: Sale; payment: CashPayment; reopen: boolean; operationId: string }
export const isDebitAudit = (detail: string) => detail.startsWith('Pagamento de débito:')

/** Compute both sides of a reclassification before either is written. */
export function changeDebit(store: StoreData, request: DebitChange): { store: StoreData; payment: CashPayment } {
  const sale = store.sales.find(row => row.id === request.sale?.id)
  if (!sale || !sameData(sale, request.sale)) throw Error('A venda mudou ou foi removida. Atualize os dados antes de confirmar.')
  if (sale.status !== (request.reopen ? 'Pago' : 'Debitado')) throw Error('A situação da venda mudou. Confira o histórico.')
  const p = request.payment
  const quantity = sale.items.reduce((total, item) => total + item.qty, 0)
  if (!validCashPayment(p) || p.kind !== 'cookie' || p.status !== 'paid' || p.archived || p.sourceSaleId !== sale.id || p.amount !== sale.total || p.quantity !== quantity) throw Error('O pagamento não corresponde ao débito desta venda.')
  const next: Sale = {...sale, status: request.reopen ? 'Debitado' : 'Pago', paidAmount: request.reopen ? 0 : sale.total, items: sale.items.map(item => ({...item, paid: !request.reopen}))}
  const payment = request.reopen ? {...p, archived: true} : {...p, description: sale.items.map(item => `${item.qty}x ${item.name}`).join(' + '), person: store.customers.find(customer => customer.id === sale.customerId)?.name || 'Pessoa não informada'}
  return {store: {...store, sales: store.sales.map(row => row.id === sale.id ? next : row)}, payment}
}
