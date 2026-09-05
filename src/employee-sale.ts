import type { Sale } from './types'
import type { StoreData } from './validation'
import { validateSales } from './validation'
export function employeeSale(input: unknown, store: StoreData, now = new Date().toISOString()): Sale {
  const raw = input as Partial<Sale> | null
  if (!raw || !['Pago', 'Pendente'].includes(raw.status || '')) throw new Error('Funcionários podem registrar apenas vendas pagas ou pendentes.')
  const sale = validateSales([raw])?.[0]
  if (!sale || !/^[a-zA-Z0-9_-]{1,100}$/.test(sale.id)) throw new Error('Venda inválida.')
  if (sale.status === 'Pendente' && !sale.customerId) throw new Error('Venda pendente precisa de cliente.')
  const items = sale.items.map(item => {
    const product = store.products.find(p => p.id === item.productId)
    if (!product || product.price !== item.unitPrice) throw new Error('O preço mudou. Confira os valores atuais.')
    return { productId: product.id, name: product.name, unitPrice: product.price, qty: item.qty }
  })
  return { ...sale, items, date: now, paidAmount: sale.status === 'Pago' ? sale.total : 0 }
}
