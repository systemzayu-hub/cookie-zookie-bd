import type { Sale } from './types'
import type { StoreData } from './validation'
import { salePaidAmount } from './types'

export type CustomerReceiptAllocation = { saleId: string; amount: number }
export type CustomerReceipt = {
  id: string
  customerId: string
  amount: number
  payment?: Sale['payment']
  date?: string
  recordedAt: number
  actor: string
  actorUid: string
  allocations: CustomerReceiptAllocation[]
  kind: 'receipt' | 'adjustment'
  auditId: string
  adjustmentOf?: string
  origin?: 'local'
  requestHash?: string
}
export type CustomerReceiptRequest = {
  customerId: string
  amount: number
  sales: Sale[]
  payment: Sale['payment']
  date: string
  saleId?: string
  receiptId: string
}

const money = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 1_000_000 && Math.abs(value * 100 - Math.round(value * 100)) < 0.000001
const date = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value
const payments: Sale['payment'][] = ['dinheiro', 'cartão', 'pix']

export function validCustomerReceiptRequest(value: unknown): value is CustomerReceiptRequest {
  if (!value || typeof value !== 'object') return false
  const row = value as CustomerReceiptRequest
  return typeof row.customerId === 'string' && row.customerId.length > 0 && row.customerId.length <= 100
    && money(row.amount) && payments.includes(row.payment) && date(row.date)
    && typeof row.receiptId === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(row.receiptId)
    && (row.saleId === undefined || typeof row.saleId === 'string' && row.saleId.length > 0 && row.saleId.length <= 100)
    && Array.isArray(row.sales) && row.sales.every(sale => sale && typeof sale.id === 'string')
}

export function validCustomerReceipt(value: unknown): value is CustomerReceipt {
  if (!value || typeof value !== 'object') return false
  const row = value as CustomerReceipt
  const isAdjustment = row.kind === 'adjustment'
  return typeof row.id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(row.id)
    && typeof row.customerId === 'string' && row.customerId.length > 0 && row.customerId.length <= 100
    && (isAdjustment ? typeof row.amount === 'number' && Number.isFinite(row.amount) && Math.abs(row.amount) <= 1_000_000 : money(row.amount))
    && (isAdjustment ? row.payment === undefined : payments.includes(row.payment as Sale['payment']))
    && (isAdjustment ? row.date === undefined : date(row.date))
    && Number.isFinite(row.recordedAt) && row.recordedAt > 0
    && typeof row.actor === 'string' && row.actor.length > 0 && row.actor.length <= 120
    && typeof row.actorUid === 'string' && row.actorUid.length > 0 && row.actorUid.length <= 128
    && Array.isArray(row.allocations) && row.allocations.length > 0 && row.allocations.length <= 1000
    && row.allocations.every(item => item && typeof item.saleId === 'string' && item.saleId.length > 0 && item.saleId.length <= 100
      && typeof item.amount === 'number' && Number.isFinite(item.amount) && Math.abs(item.amount) <= 1_000_000)
    && (row.kind === 'receipt' || row.kind === 'adjustment')
    && typeof row.auditId === 'string' && /^v2-[a-f0-9-]{36}$/.test(row.auditId)
    && (row.adjustmentOf === undefined || typeof row.adjustmentOf === 'string' && row.adjustmentOf.length <= 100)
    && (row.origin === undefined || row.origin === 'local')
    && (row.requestHash === undefined || typeof row.requestHash === 'string' && /^[a-z0-9]{1,20}$/.test(row.requestHash))
}

export function customerReceiptRequestHash(request: CustomerReceiptRequest) {
  const canonical = JSON.stringify({ customerId: request.customerId, amount: request.amount, payment: request.payment, date: request.date, saleId: request.saleId || '', sales: [...request.sales].sort((a, b) => a.id.localeCompare(b.id)) })
  let hash = 1469598103934665603n
  for (let i = 0; i < canonical.length; i++) hash = BigInt.asUintN(64, (hash ^ BigInt(canonical.charCodeAt(i))) * 1099511628211n)
  return hash.toString(36)
}

export function adjustmentReceiptId(auditId: string, saleId: string) {
  let hash = 1469598103934665603n
  for (let i = 0; i < saleId.length; i++) hash = BigInt.asUintN(64, (hash ^ BigInt(saleId.charCodeAt(i))) * 1099511628211n)
  return `adj-${auditId.slice(-36)}-${hash.toString(36)}`
}

export function receiptAllocations(before: StoreData, after: StoreData): CustomerReceiptAllocation[] {
  const old = new Map(before.sales.map(sale => [sale.id, sale]))
  const next = new Map(after.sales.map(sale => [sale.id, sale]))
  return [...new Set([...old.keys(), ...next.keys()])].flatMap(saleId => {
    const previous = old.get(saleId), updated = next.get(saleId)
    const amount = Math.round(((updated ? salePaidAmount(updated) : 0) - (previous ? salePaidAmount(previous) : 0)) * 100) / 100
    return amount ? [{ saleId, amount }] : []
  })
}

export function receiptAdjustmentRows(before: StoreData, after: StoreData) {
  const old = new Map(before.sales.map(sale => [sale.id, sale]))
  const next = new Map(after.sales.map(sale => [sale.id, sale]))
  return [...new Set([...old.keys(), ...next.keys()])].flatMap(saleId => {
    const previous = old.get(saleId), updated = next.get(saleId)
    const amount = Math.round(((updated ? salePaidAmount(updated) : 0) - (previous ? salePaidAmount(previous) : 0)) * 100) / 100
    if (!amount) return []
    const customerId = updated?.customerId || previous?.customerId
    return customerId ? [{ customerId, saleId, amount }] : []
  })
}

export function receiptAdjustmentDetail(customerName: string, rows: { saleId: string; amount: number }[]) {
  const delta = rows.reduce((sum, row) => sum + row.amount, 0)
  return `Ajuste de recebimento para ${customerName}: ${delta < 0 ? 'redução' : 'acréscimo'} de ${Math.abs(delta).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
}
