import test from 'node:test'
import assert from 'node:assert/strict'
import { payCustomer, transferSale } from '../src/sale-adjustments'
import { saleOutstanding, type Customer, type Product, type Sale } from '../src/types'

const products: Product[] = [{ id: 'p1', name: 'Cookie', price: 8.5, category: 'tradicional', stock: 12 }]
const davi: Customer = { id: 'davi', name: 'Davi', contact: '', createdAt: '2026-09-01' }
const oitavo: Customer = { id: 'davi-8', name: 'Davi 8°', contact: '', createdAt: '2026-09-02' }
const first: Sale = { id: 's17', date: '2026-09-08T12:00:00.000Z', items: [{ productId: 'p1', name: 'Kinder', qty: 2, unitPrice: 8.5 }], payment: 'pix', total: 17, channel: 'loja', customerId: davi.id, status: 'Pendente' }
const second: Sale = { id: 's5', date: '2026-09-14T12:00:00.000Z', items: [{ productId: 'p1', name: 'Cookie', qty: 1, unitPrice: 5 }], payment: 'pix', total: 5, channel: 'loja', customerId: davi.id, status: 'Pendente' }
const store = { products, customers: [davi, oitavo], sales: [second, first] }

test('customer partial payment spans multiple sales oldest first up to the total balance', () => {
  const result = payCustomer(store, { customerId: davi.id, amount: 20, sales: [second, first] })
  const paidFirst = result.sales.find(sale => sale.id === first.id)!
  const partialSecond = result.sales.find(sale => sale.id === second.id)!
  assert.equal(paidFirst.status, 'Pago')
  assert.equal(saleOutstanding(paidFirst), 0)
  assert.equal(partialSecond.status, 'Pendente')
  assert.equal(partialSecond.paidAmount, 3)
  assert.equal(saleOutstanding(partialSecond), 2)
  assert.deepEqual(result.products, products)
  assert.equal(store.sales[0].paidAmount, undefined)
  assert.throws(() => payCustomer(store, { customerId: davi.id, amount: 22.01, sales: [second, first] }), /supera o saldo/)
})

test('sale transfer changes only its customer and preserves sale, payment and stock data', () => {
  const result = transferSale(store, { sale: first, target: oitavo })
  const moved = result.sales.find(sale => sale.id === first.id)!
  assert.deepEqual(moved, { ...first, customerId: oitavo.id })
  assert.deepEqual(result.sales.find(sale => sale.id === second.id), second)
  assert.deepEqual(result.products, products)
  assert.deepEqual(result.customers, [davi, oitavo])
  assert.throws(() => transferSale(store, { sale: first, target: davi }), /outro cliente/)
})
