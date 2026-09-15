import assert from 'node:assert/strict'
import test from 'node:test'
import { editSale, saleEditOperationId, type SaleEditFields } from '../src/edit-sale'
import type { Sale } from '../src/types'

const sale: Sale = { id: 's1', date: '2026-09-15T12:00:00.000Z', items: [{ productId: 'p1', name: 'Nutella', qty: 2, unitPrice: 6 }], payment: 'pix', channel: 'loja', total: 12, customerId: 'c1', status: 'Pendente', paidAmount: 6 }
const store = { products: [{ id: 'p1', name: 'Nutella', price: 7, category: 'tradicional', stock: 8 }], customers: [{ id: 'c1', name: 'Ana', contact: '', createdAt: '2026-09-01T12:00:00.000Z' }, { id: 'c2', name: 'Bia', contact: '', createdAt: '2026-09-01T12:00:00.000Z' }], sales: [sale] }
const fields = (patch: Partial<SaleEditFields> = {}): SaleEditFields => ({ customerId: 'c1', date: sale.date, payment: 'pix', channel: 'loja', status: 'Pendente', items: [{ productId: 'p1', qty: 2 }], ...patch })

test('edição de venda ajusta estoque pelo delta e recalcula preços no servidor', () => {
  const result = editSale(store, sale, fields({ items: [{ productId: 'p1', qty: 3 }] }))
  assert.equal(result.products[0].stock, 7)
  assert.equal(result.sales[0].total, 21)
  assert.equal(result.sales[0].paidAmount, 6)
})

test('edição apenas de metadados preserva preço histórico e estoque', () => {
  const result = editSale(store, sale, fields({ customerId: 'c2', channel: 'delivery' }))
  assert.equal(result.products[0].stock, 8)
  assert.equal(result.sales[0].total, 12)
  assert.equal(result.sales[0].customerId, 'c2')
})

test('edição recusa venda desatualizada, duplicação e estoque insuficiente', () => {
  assert.throws(() => editSale(store, { ...sale, total: 13 }, fields()), /mudou ou foi removida/)
  assert.throws(() => editSale(store, sale, fields({ items: [{ productId: 'p1', qty: 1 }, { productId: 'p1', qty: 1 }] })), /sem duplicação/)
  assert.throws(() => editSale(store, sale, fields({ items: [{ productId: 'p1', qty: 11 }] })), /Estoque insuficiente/)
})

test('correção de classificação redefine recebimento sem afetar outras vendas', () => {
  const paid: Sale = { ...sale, status: 'Pago', paidAmount: 12 }
  const base = { ...store, sales: [paid] }
  const result = editSale(base, paid, fields({ status: 'Debitado' }))
  assert.equal(result.sales[0].paidAmount, 0)
  assert.equal(result.sales[0].status, 'Debitado')
  assert.match(saleEditOperationId(), /^v2-[a-f0-9-]{36}$/)
})
