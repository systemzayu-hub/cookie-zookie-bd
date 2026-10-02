import type { Product, Sale, SaleItemFull } from './types'
import { saleOutstanding, salePaidAmount } from './types'
import type { StoreData } from './validation'
import { ROLE_LABEL, type Role } from './roles'
import { sameData } from './store-merge'

const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const text = (value: unknown) => String(value ?? '').replace(/[\r\n]+/g, ' ').trim()
const truncationNotice = '... (demais alterações omitidas; consulte os detalhes)'
const limit = (value: string) => value.length <= 1000 ? value : value.slice(0, 1000 - truncationNotice.length) + truncationNotice
const idPattern = '(?:v2-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const paymentLabel: Record<string, string> = { dinheiro: 'Dinheiro', 'cartão': 'Cartão', pix: 'Pix' }
const channelLabel: Record<string, string> = { loja: 'Loja', delivery: 'Delivery', encomenda: 'Encomenda' }
const enumLabel = (value: string, labels: Record<string, string>) => labels[value] || text(value)
const productName = (products: Product[], id: string) => products.find(product => product.id === id)?.name || 'produto sem nome no registro'
const customerName = (store: StoreData, id?: string) => id ? store.customers.find(customer => customer.id === id)?.name || 'cliente sem nome no registro' : 'sem cliente'
const saleCustomerName = (sale: Sale, store: StoreData) => customerName(store, sale.customerId)
const itemName = (item: SaleItemFull, store: StoreData) => text(item.name || productName(store.products, item.productId))
const saleItems = (sale: Sale, store: StoreData) => sale.items.map(item => `${item.qty}x ${itemName(item, store)}`).join(', ') || 'itens não informados'
const saleIdentity = (sale: Sale, store: StoreData, includeItems = true, includeTotal = true) => {
  const facts = [saleCustomerName(sale, store), includeItems ? saleItems(sale, store) : '', includeTotal ? `total ${money(sale.total)}` : ''].filter(Boolean)
  return facts.join('; ')
}
const salePaymentState = (sale: Sale) => `recebido ${money(salePaidAmount(sale))}; a receber ${money(saleOutstanding(sale))}`
const status = (sale: Sale) => text(sale.status || 'Pago')
const dateLabel = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? text(value) : date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}
const itemList = (items: SaleItemFull[], store: StoreData) => items.map(item => `${item.qty}x ${itemName(item, store)} (${money(item.unitPrice)} cada)`).join(', ') || 'itens não informados'

export function summarizeSale(sale: Sale, store: StoreData, verb = 'registrada') {
  return limit(`Venda ${verb}: ${saleItems(sale, store)}; cliente ${saleCustomerName(sale, store)}; total ${money(sale.total)}; ${salePaymentState(sale)}; situação ${status(sale)}; pagamento ${enumLabel(sale.payment, paymentLabel)}; canal ${enumLabel(sale.channel, channelLabel)}.`)
}

function cleanContext(context: string) {
  let clean = text(context)
  clean = clean.replace(new RegExp(`^(Pagamento de débito: venda\\s+)${idPattern}(?=\\s)`, 'i'), '$1')
  clean = clean.replace(new RegExp(`^(Venda\\s+)${idPattern}(\\s+(?:editada|excluída))`, 'i'), '$1$2')
  clean = clean.replace(new RegExp(`^(Reversão do registro\\s+)${idPattern}$`, 'i'), 'Reversão do registro')
  return clean.replace(/\s{2,}/g, ' ').trim()
}

export function summarizeStoreChange(before: StoreData, after: StoreData, context = 'Dados da loja atualizados') {
  const parts: string[] = []
  const beforeProducts = new Map(before.products.map(product => [product.id, product]))
  const afterProducts = new Map(after.products.map(product => [product.id, product]))
  for (const product of after.products) {
    const old = beforeProducts.get(product.id)
    if (!old) { parts.push(`Produto ${text(product.name)} cadastrado`); continue }
    const changes: string[] = []
    if (old.name !== product.name) changes.push(`nome de ${text(old.name)} para ${text(product.name)}`)
    if (old.price !== product.price) changes.push(`preço de ${money(old.price)} para ${money(product.price)}`)
    if (old.stock !== product.stock) changes.push(`estoque de ${old.stock} para ${product.stock}`)
    if (old.category !== product.category) changes.push(`categoria de ${text(old.category)} para ${text(product.category)}`)
    if (changes.length) parts.push(`Produto ${text(old.name)} atualizado: ${changes.join('; ')}`)
  }
  for (const product of before.products) if (!afterProducts.has(product.id)) parts.push(`Produto ${text(product.name)} removido`)

  const beforeSales = new Map(before.sales.map(sale => [sale.id, sale]))
  const afterSales = new Map(after.sales.map(sale => [sale.id, sale]))
  for (const sale of after.sales) {
    const old = beforeSales.get(sale.id)
    if (!old) { parts.push(summarizeSale(sale, after)); continue }
    const changes: string[] = []
    if (status(old) !== status(sale)) changes.push(`situação ${status(old)} → ${status(sale)}`)
    if (salePaidAmount(old) !== salePaidAmount(sale)) changes.push(`recebido de ${money(salePaidAmount(old))} para ${money(salePaidAmount(sale))} (${money(saleOutstanding(old))} a receber → ${money(saleOutstanding(sale))} a receber)`)
    if (old.total !== sale.total) changes.push(`total de ${money(old.total)} para ${money(sale.total)}`)
    if (old.payment !== sale.payment) changes.push(`pagamento de ${enumLabel(old.payment, paymentLabel)} para ${enumLabel(sale.payment, paymentLabel)}`)
    if (old.channel !== sale.channel) changes.push(`canal de ${enumLabel(old.channel, channelLabel)} para ${enumLabel(sale.channel, channelLabel)}`)
    if (old.date !== sale.date) changes.push(`data de ${dateLabel(old.date)} para ${dateLabel(sale.date)}`)
    if (!sameData(old.items, sale.items)) changes.push(`itens de [${itemList(old.items, before)}] para [${itemList(sale.items, after)}]`)
    if (old.customerId !== sale.customerId) changes.push(`cliente de ${saleCustomerName(old, before)} para ${saleCustomerName(sale, after)}`)
    if (changes.length) parts.push(`Venda (${saleIdentity(sale, after, sameData(old.items, sale.items), old.total === sale.total)}) atualizada: ${changes.join('; ')}`)
  }
  for (const sale of before.sales) if (!afterSales.has(sale.id)) parts.push(`Venda excluída: ${saleIdentity(sale, before)}; situação ${status(sale)}; ${salePaymentState(sale)}`)

  const beforeCustomers = new Map(before.customers.map(customer => [customer.id, customer]))
  const afterCustomers = new Map(after.customers.map(customer => [customer.id, customer]))
  for (const customer of after.customers) {
    const old = beforeCustomers.get(customer.id)
    if (!old) { parts.push(`Cliente ${text(customer.name)} cadastrado`); continue }
    const changes: string[] = []
    if (old.name !== customer.name) changes.push(`nome de ${text(old.name)} para ${text(customer.name)}`)
    if (old.contact !== customer.contact) changes.push(`contato de ${text(old.contact) || 'vazio'} para ${text(customer.contact) || 'vazio'}`)
    if (changes.length) parts.push(`Cliente ${text(customer.name)} atualizado: ${changes.join('; ')}`)
  }
  for (const customer of before.customers) if (!afterCustomers.has(customer.id)) parts.push(`Cliente ${text(customer.name)} removido`)

  const prefix = cleanContext(context)
  const debitPrefix = prefix.startsWith('Pagamento de débito: venda ')
  const usefulContext = prefix && prefix !== 'Dados da loja atualizados' ? prefix : ''
  const description = parts.length ? parts.join(' · ') : sameData(before, after) ? 'Nenhuma alteração identificada.' : 'Outros campos foram atualizados; consulte os detalhes para ver a comparação.'
  if (debitPrefix) return limit(`${prefix}: ${description}`)
  return limit(`${usefulContext ? `${usefulContext}: ` : ''}${description}`)
}

export function summarizeTeam(email: string, before: Role, after: Role) {
  return limit(`Acesso da conta ${text(email)} alterado: ${ROLE_LABEL[before]} → ${ROLE_LABEL[after]}.`)
}
