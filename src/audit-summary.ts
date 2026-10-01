import type { Product, Sale } from './types'
import { salePaidAmount } from './types'
import type { StoreData } from './validation'
import { ROLE_LABEL, type Role } from './roles'
import { sameData } from './store-merge'

const money = (value: unknown) => typeof value === 'number' ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : String(value)
const text = (value: unknown) => String(value ?? '').replace(/[\r\n]+/g, ' ').trim()
const truncationNotice = '... (demais alterações omitidas; consulte os detalhes)'
const limit = (value: string) => value.length <= 1000 ? value : value.slice(0, 1000 - truncationNotice.length) + truncationNotice

const productName = (products: Product[], id: string) => products.find(product => product.id === id)?.name || id
const customerName = (store: StoreData, id?: string) => id ? store.customers.find(customer => customer.id === id)?.name || id : 'sem cliente'
const saleLabel = (sale: Sale, store: StoreData) => {
  const items = sale.items.map(item => `${item.qty}x ${text(item.name || productName(store.products, item.productId))}`).join(', ')
  return `venda ${text(sale.id)} (${items}; ${money(sale.total)}; ${customerName(store, sale.customerId)})`
}

export function summarizeSale(sale: Sale, store: StoreData, verb = 'registrada') {
  return limit(`Venda ${text(sale.id)} ${verb}: ${sale.items.map(item => `${item.qty}x ${text(item.name || productName(store.products, item.productId))}`).join(', ')}; total ${money(sale.total)}; recebido ${money(salePaidAmount(sale))}; pagamento ${text(sale.payment)}; situação ${text(sale.status || 'Pago')}; cliente ${customerName(store, sale.customerId)}.`)
}

export function summarizeStoreChange(before: StoreData, after: StoreData, context = 'Dados da loja atualizados') {
  const parts: string[] = []
  const beforeProducts = new Map(before.products.map(product => [product.id, product]))
  const afterProducts = new Map(after.products.map(product => [product.id, product]))
  for (const product of after.products) {
    const old = beforeProducts.get(product.id)
    if (!old) parts.push(`produto ${text(product.name)} cadastrado`)
    else {
      if (old.price !== product.price) parts.push(`${text(product.name)}: preço ${money(old.price)}→${money(product.price)}`)
      if (old.stock !== product.stock) parts.push(`${text(product.name)}: estoque ${old.stock}→${product.stock}`)
      if (old.category !== product.category) parts.push(`${text(product.name)}: categoria ${text(old.category)}→${text(product.category)}`)
      if (old.name !== product.name) parts.push(`produto ${text(old.name)} renomeado para ${text(product.name)}`)
    }
  }
  for (const product of before.products) if (!afterProducts.has(product.id)) parts.push(`produto ${text(product.name)} removido`)
  const beforeSales = new Map(before.sales.map(sale => [sale.id, sale]))
  const afterSales = new Map(after.sales.map(sale => [sale.id, sale]))
  for (const sale of after.sales) {
    const old = beforeSales.get(sale.id)
    if (!old) parts.push(summarizeSale(sale, after))
    else {
      if (old.status !== sale.status) parts.push(`${saleLabel(sale, after)}: situação ${text(old.status)}→${text(sale.status)}`)
      if (salePaidAmount(old) !== salePaidAmount(sale)) parts.push(`${saleLabel(sale, after)}: valor recebido ${money(salePaidAmount(old))}→${money(salePaidAmount(sale))}`)
      if (old.total !== sale.total) parts.push(`${saleLabel(sale, after)}: total ${money(old.total)}→${money(sale.total)}`)
      if (old.payment !== sale.payment) parts.push(`${saleLabel(sale, after)}: pagamento ${text(old.payment)}→${text(sale.payment)}`)
      if (old.channel !== sale.channel) parts.push(`${saleLabel(sale, after)}: canal ${text(old.channel)}→${text(sale.channel)}`)
      if (old.date !== sale.date) parts.push(`${saleLabel(sale, after)}: data alterada`)
      if (JSON.stringify(old.items) !== JSON.stringify(sale.items)) parts.push(`${saleLabel(sale, after)}: itens atualizados`)
      if (old.customerId !== sale.customerId) parts.push(`${saleLabel(sale, after)}: cliente ${customerName(before, old.customerId)}→${customerName(after, sale.customerId)}`)
    }
  }
  for (const sale of before.sales) if (!afterSales.has(sale.id)) parts.push(saleLabel(sale, before) + ' excluída')
  const beforeCustomers = new Map(before.customers.map(customer => [customer.id, customer]))
  const afterCustomers = new Map(after.customers.map(customer => [customer.id, customer]))
  for (const customer of after.customers) {
    const old = beforeCustomers.get(customer.id)
    if (!old) parts.push(`cliente ${text(customer.name)} cadastrado`)
    else {
      if (old.name !== customer.name) parts.push(`cliente ${text(old.name)} renomeado para ${text(customer.name)}`)
      if (old.contact !== customer.contact) parts.push(`cliente ${text(customer.name)}: contato atualizado`)
    }
  }
  for (const customer of before.customers) if (!afterCustomers.has(customer.id)) parts.push(`cliente ${text(customer.name)} removido`)
  return limit(`${context}: ${parts.length ? parts.join(' · ') : sameData(before, after) ? 'nenhuma alteração identificada' : 'outros campos atualizados; consulte a comparação nos detalhes'}.`)
}

export function summarizeTeam(email: string, before: Role, after: Role) {
  return limit(`Acesso da conta ${text(email)} alterado: ${ROLE_LABEL[before]}→${ROLE_LABEL[after]}.`)
}
