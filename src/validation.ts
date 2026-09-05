import type { Customer, Product, Sale, SaleItemFull } from './types'

const MAX_PRODUCTS = 500
const MAX_CUSTOMERS = 2_000
const MAX_SALES = 5_000
const MAX_ITEMS = 100
const MAX_TEXT = 160

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const text = (value: unknown, max = MAX_TEXT) =>
  typeof value === 'string' ? value.trim().slice(0, max) : ''

const finite = (value: unknown, min = 0, max = 1_000_000) => {
  const number = typeof value === 'number' ? value : Number.NaN
  return Number.isFinite(number) && number >= min && number <= max ? number : null
}

function parseProduct(value: unknown): Product | null {
  if (!isObject(value)) return null
  const id = text(value.id, 100)
  const name = text(value.name, 100)
  const price = finite(value.price)
  const stock = finite(value.stock, 0, 1_000_000)
  if (!id || !name || price === null || stock === null) return null
  return {
    id,
    name,
    price,
    stock,
    category: text(value.category, 50) || 'tradicional',
    ...(text(value.emoji, 8) ? { emoji: text(value.emoji, 8) } : {}),
  }
}

function parseCustomer(value: unknown): Customer | null {
  if (!isObject(value)) return null
  const id = text(value.id, 100)
  const name = text(value.name, 120)
  if (!id || !name) return null
  return {
    id,
    name,
    contact: text(value.contact, 120),
    createdAt: validDate(value.createdAt) || new Date(0).toISOString(),
  }
}

function parseItem(value: unknown): SaleItemFull | null {
  if (!isObject(value)) return null
  const productId = text(value.productId, 100)
  const name = text(value.name, 100)
  const qty = finite(value.qty, 0.001, 100_000)
  const unitPrice = finite(value.unitPrice)
  if (!productId || !name || qty === null || unitPrice === null) return null
  return { productId, name, qty, unitPrice, ...(typeof value.paid === 'boolean' ? { paid: value.paid } : {}) }
}

function validDate(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 40) return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null
}

function parseSale(value: unknown): Sale | null {
  if (!isObject(value) || !Array.isArray(value.items) || value.items.length === 0 || value.items.length > MAX_ITEMS) return null
  const id = text(value.id, 100)
  const date = validDate(value.date)
  const items = value.items.map(parseItem)
  const total = finite(value.total)
  if (!id || !date || total === null || items.some(item => item === null)) return null
  const payment = ['dinheiro', 'cartão', 'pix'].includes(String(value.payment)) ? value.payment as Sale['payment'] : 'pix'
  const channel = ['loja', 'delivery', 'encomenda'].includes(String(value.channel)) ? value.channel as Sale['channel'] : 'loja'
  const statuses: Sale['status'][] = ['Pago', 'Pendente', 'Debitado', 'Presente']
  const status = statuses.includes(value.status as Sale['status']) ? value.status as Sale['status'] : 'Pago'
  const paidAmount = finite(value.paidAmount)
  const customerId = text(value.customerId, 100)
  return {
    id,
    date,
    items: items as SaleItemFull[],
    payment,
    channel,
    total,
    status,
    ...(customerId ? { customerId } : {}),
    ...(paidAmount !== null ? { paidAmount: Math.min(total, paidAmount) } : {}),
  }
}

function parseList<T extends { id: string }>(value: unknown, max: number, parser: (entry: unknown) => T | null): T[] | null {
  if (!Array.isArray(value) || value.length > max) return null
  const parsed = value.map(parser)
  if (parsed.some(entry => entry === null)) return null
  const rows = parsed as T[]
  return new Set(rows.map(row => row.id)).size === rows.length ? rows : null
}

export type StoreData = { products: Product[]; sales: Sale[]; customers: Customer[] }

export function validateStoreData(value: unknown): StoreData | null {
  if (!isObject(value)) return null
  const products = parseList(value.products, MAX_PRODUCTS, parseProduct)
  const sales = parseList(value.sales, MAX_SALES, parseSale)
  const customers = parseList(value.customers, MAX_CUSTOMERS, parseCustomer)
  return products && sales && customers ? { products, sales, customers } : null
}

export function validateProducts(value: unknown): Product[] | null {
  return parseList(value, MAX_PRODUCTS, parseProduct)
}

export function validateSales(value: unknown): Sale[] | null {
  return parseList(value, MAX_SALES, parseSale)
}

export function validateCustomers(value: unknown): Customer[] | null {
  return parseList(value, MAX_CUSTOMERS, parseCustomer)
}
