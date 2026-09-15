import { CHANNELS, PAYMENTS, salePaidAmount, type Sale, type SaleItem } from './types'
import { sameData } from './store-merge'
import { validateStoreData, type StoreData } from './validation'

export type SaleEditFields = {
  customerId: string; date: string; payment: Sale['payment']; channel: Sale['channel']
  status: NonNullable<Sale['status']>; items: SaleItem[]
}
export type SaleEdit = { sale: Sale; changes: SaleEditFields; reviewed: Sale; operationId: string }
export const saleEditOperationId = () => {
  if (crypto.randomUUID) return `v2-${crypto.randomUUID()}`
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40; bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('')
  return `v2-${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
const money = (n: number) => Number.isFinite(n) && n >= 0 && n <= 1_000_000 && Math.abs(n * 100 - Math.round(n * 100)) < 0.000001
const quantities = (items: SaleItem[]) => {
  const result = new Map<string, number>()
  for (const item of items) {
    if (!item || !item.productId || !Number.isSafeInteger(item.qty) || item.qty <= 0 || item.qty > 100_000 || result.has(item.productId)) {
      throw new Error('Confira os itens: use quantidades inteiras positivas e produtos sem duplicação.')
    }
    result.set(item.productId, item.qty)
  }
  return result
}

/** Rebuild from trusted current data. The request never supplies prices or totals. */
export function editSale(store: StoreData, expected: Sale, fields: SaleEditFields): StoreData {
  if (!validateStoreData(store)) throw new Error('Os dados da loja são inválidos ou possuem IDs duplicados.')
  const current = store.sales.find(s => s.id === expected?.id)
  if (!current || !sameData(current, expected)) throw new Error('A venda mudou ou foi removida. Reabra a edição para conferir os dados atuais.')
  if (!fields || !PAYMENTS.includes(fields.payment) || !CHANNELS.includes(fields.channel) || !['Pago', 'Pendente', 'Debitado', 'Presente'].includes(fields.status)) throw new Error('Confira pagamento, canal e status.')
  if (typeof fields.date !== 'string' || fields.date.length > 40 || !Number.isFinite(Date.parse(fields.date))) throw new Error('Informe uma data válida.')
  if (typeof fields.customerId !== 'string' || (fields.customerId && !store.customers.some(c => c.id === fields.customerId) && fields.customerId !== current.customerId)) throw new Error('Selecione um cliente cadastrado.')
  if (fields.status === 'Pendente' && !fields.customerId) throw new Error('Selecione um cliente para uma venda pendente.')
  if (!Array.isArray(fields.items) || !fields.items.length || fields.items.length > 100) throw new Error('A venda deve ter entre 1 e 100 itens.')
  const oldQty = quantities(current.items), nextQty = quantities(fields.items)
  const changedItems = oldQty.size !== nextQty.size || [...oldQty].some(([id, qty]) => nextQty.get(id) !== qty)
  const products = store.products.map(product => {
    const delta = (oldQty.get(product.id) || 0) - (nextQty.get(product.id) || 0)
    const stock = product.stock + delta
    if (delta && (!Number.isSafeInteger(stock) || stock < 0 || stock > 1_000_000)) throw new Error(`Estoque insuficiente ou inválido para ${product.name}.`)
    return delta ? { ...product, stock } : product
  })
  if (changedItems && [...oldQty.keys(), ...nextQty.keys()].some(id => !store.products.some(p => p.id === id))) throw new Error('Um produto não está mais cadastrado. Apenas os demais dados desta venda podem ser corrigidos.')
  let items = changedItems ? fields.items.map(item => {
    const product = store.products.find(p => p.id === item.productId)!
    if (!money(product.price)) throw new Error(`Preço inválido para ${product.name}. Corrija o cadastro do produto.`)
    return { productId: product.id, name: product.name, qty: item.qty, unitPrice: product.price }
  }) : current.items.map(item => ({ ...item }))
  if (items.some(item => !money(item.unitPrice))) throw new Error('A venda possui um preço inválido.')
  const total = items.reduce((sum, item) => sum + Math.round(item.unitPrice * 100) * item.qty, 0) / 100
  if (!money(total)) throw new Error('O total excede os limites da venda.')
  // Metadata-only edits keep legacy payment flags and omitted fields intact.
  const changedPayment = changedItems || fields.status !== (current.status || 'Pago') || total !== current.total
  let paymentFields: Pick<Sale, 'paidAmount'> = {}
  if (changedPayment) {
    const previousStatus = current.status || 'Pago'
    const received = previousStatus === 'Pendente' ? salePaidAmount(current) : 0
    if (!money(received)) throw new Error('O valor já recebido é inválido.')
    if (fields.status === 'Pendente' && received > total) throw new Error('O novo total é menor que o valor já recebido. Regularize o pagamento antes de editar.')
    paymentFields = { paidAmount: fields.status === 'Pago' ? total : fields.status === 'Pendente' ? received : 0 }
    items = items.map(item => ({ ...item, paid: fields.status === 'Pago' }))
  }
  const updated: Sale = { ...current, date: new Date(fields.date).toISOString(), payment: fields.payment, channel: fields.channel,
    status: fields.status, items, total, ...paymentFields }
  if (fields.customerId) updated.customerId = fields.customerId
  else delete updated.customerId
  const next = { ...store, products, sales: store.sales.map(s => s.id === current.id ? updated : s) }
  if (!validateStoreData(next)) throw new Error('A alteração produziria dados inválidos.')
  return next
}
