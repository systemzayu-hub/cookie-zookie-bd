import type { Customer, Sale } from './types'
import { validateStoreData, type StoreData } from './validation'
import { sameData } from './store-merge'

export function recordSale(store: StoreData, sale: Sale): StoreData {
  if (store.sales.some(existing => existing.id === sale.id)) throw new Error('Esta venda já foi registrada.')
  if (!Number.isFinite(Date.parse(sale.date)) || !Number.isFinite(sale.total) || sale.total < 0) throw new Error('Confira a data e o total da venda.')
  if (!sale.items.length || sale.items.some(item => !Number.isSafeInteger(item.qty) || item.qty <= 0 || !Number.isFinite(item.unitPrice) || item.unitPrice < 0)) throw new Error('Confira os itens e as quantidades da venda.')
  if (sale.customerId && !store.customers.some(customer => customer.id === sale.customerId)) throw new Error('O cliente não está mais cadastrado. Selecione novamente.')
  const expectedTotal = sale.items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0)
  if (Math.abs(expectedTotal - sale.total) > 0.01) throw new Error('O total não corresponde aos itens da venda.')
  const quantities = new Map<string, number>()
  sale.items.forEach(item => quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.qty))
  for (const [id, quantity] of quantities) {
    const product = store.products.find(item => item.id === id)
    if (!product || quantity > product.stock) throw new Error(`Estoque insuficiente para ${product?.name || 'o produto'}. Confira a quantidade atual.`)
  }
  return { ...store, sales: [sale, ...store.sales], products: store.products.map(product => ({ ...product, stock: product.stock - (quantities.get(product.id) || 0) })) }
}

/**
 * Removes exactly the sale the operator reviewed and returns its quantities to
 * the current stock.  Comparing the complete snapshot makes a stale row (for
 * example, one changed in another device) fail closed instead of deleting a
 * newer record.
 */
export function removeSale(store: StoreData, expected: Sale): StoreData {
  const current = store.sales.find(sale => sale.id === expected.id)
  if (!current) throw new Error('Esta venda já foi removida ou não está mais disponível.')
  if (!sameData(current, expected)) throw new Error('A venda foi alterada em outro dispositivo. Atualize o histórico antes de excluir.')
  const quantities = new Map<string, number>()
  current.items.forEach(item => {
    if (!Number.isSafeInteger(item.qty) || item.qty <= 0) throw new Error('A venda possui itens inválidos e não pode ser excluída com segurança.')
    quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.qty)
  })
  for (const productId of quantities.keys()) {
    if (!store.products.some(product => product.id === productId)) throw new Error('Um produto desta venda não existe mais. A exclusão foi cancelada para preservar o estoque.')
  }
  return {
    ...store,
    sales: store.sales.filter(sale => sale.id !== current.id),
    products: store.products.map(product => ({ ...product, stock: product.stock + (quantities.get(product.id) || 0) })),
  }
}

// Validate on a temporary snapshot; publish only after the entire batch succeeds.
export function recordSalesBatch(store: StoreData, sales: Sale[], customers: Customer[]): StoreData {
  if (!sales.length) throw new Error('Nenhuma venda para importar.')
  const ids = new Set(store.customers.map(customer => customer.id))
  for (const customer of customers) {
    if (!customer.id || ids.has(customer.id) || !customer.name.trim() || customer.name.length > 120 || customer.contact.length > 120) throw new Error('Confira os novos clientes antes de importar.')
    ids.add(customer.id)
  }
  if (ids.size > 2000 || store.sales.length + sales.length > 5000) throw new Error('O lote excede o limite de clientes ou vendas do sistema.')
  const next = sales.reduce(recordSale, { ...store, customers: [...store.customers, ...customers] })
  if (!validateStoreData(next)) throw new Error('O lote excede os limites de itens ou valores do sistema. Divida a importação.')
  return next
}
