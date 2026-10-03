const PAGE_SIZE = 50

export type SiteOrder = {
  id: number
  number: string
  createdAt: string
  status: string
  subtotalCents: number
  discountCents: number
  deliveryCents: number
  totalCents: number
  couponCode: string | null
  items: { name: string; quantity: number; unitPriceCents: number; note?: string | null }[]
  paymentMethod: string
  paymentUnconfirmed: true
  fulfillment: string
  customerName?: string | null
  testMode: boolean | null
}
export type FeedPage = { orders: SiteOrder[]; fetchedAt: string; offset: number; limit: number; total: number; hasMore: boolean }

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
function safeText(value: unknown, max = 180): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}
export function parseFeed(value: unknown, expectedOffset: number): FeedPage {
  if (!isRecord(value) || !Array.isArray(value.orders)) throw new Error('Resposta do feed inválida.')
  const orders: SiteOrder[] = value.orders.slice(0, PAGE_SIZE).flatMap(row => {
    if (!isRecord(row) || !Array.isArray(row.items)) return []
    const integer = (key: string) => Number.isSafeInteger(row[key]) && Number(row[key]) >= 0 ? Number(row[key]) : 0
    const items = row.items.slice(0, 100).flatMap(item => {
      if (!isRecord(item)) return []
      const quantity = Number(item.quantity)
      if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999) return []
      return [{ name: safeText(item.name, 100) || 'Item', quantity, unitPriceCents: Number.isSafeInteger(item.unitPriceCents) && Number(item.unitPriceCents) >= 0 ? Number(item.unitPriceCents) : 0, note: safeText(item.note, 240) || null }]
    })
    const createdAt = safeText(row.createdAt, 40)
    if (!createdAt || !Number.isFinite(Date.parse(createdAt))) return []
    const id = integer('id')
    const orderNumber = typeof row.number === 'string' || typeof row.number === 'number' ? String(row.number).slice(0, 32) : ''
    return [{
      id, number: orderNumber || String(id), createdAt,
      status: safeText(row.status, 80) || 'Status não informado', subtotalCents: integer('subtotalCents'),
      discountCents: integer('discountCents'), deliveryCents: integer('deliveryCents'), totalCents: integer('totalCents'),
      couponCode: safeText(row.couponCode, 60) || null, items, paymentMethod: safeText(row.paymentMethod, 60) || 'Não informado',
      paymentUnconfirmed: true, fulfillment: safeText(row.fulfillment, 40) || 'Não informado',
      customerName: safeText(row.customerName, 100) || null, testMode: typeof row.testMode === 'boolean' ? row.testMode : null,
    }]
  })
  const total = Number.isSafeInteger(value.total) && Number(value.total) >= 0 ? Number(value.total) : orders.length
  const offset = Number.isSafeInteger(value.offset) && Number(value.offset) >= 0 ? Number(value.offset) : expectedOffset
  const limit = Number.isSafeInteger(value.limit) && Number(value.limit) > 0 ? Math.min(Number(value.limit), PAGE_SIZE) : PAGE_SIZE
  const fetchedAt = safeText(value.fetchedAt, 40)
  return { orders, fetchedAt: Number.isFinite(Date.parse(fetchedAt)) ? fetchedAt : new Date().toISOString(), offset, limit, total, hasMore: value.hasMore === true }
}

export function matchesOrderMode(order: Pick<SiteOrder, 'testMode'>, mode: 'all' | 'test' | 'real' | 'unknown'): boolean {
  return mode === 'all' || (mode === 'test' ? order.testMode === true : mode === 'real' ? order.testMode === false : order.testMode === null)
}
