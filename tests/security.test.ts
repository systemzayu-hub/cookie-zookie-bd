import test from 'node:test'
import assert from 'node:assert/strict'
import { can, canChangeRole, type Role, type Permission } from '../src/roles'
import { diffRows, reversePatches } from '../src/undo-model'
import { employeeSale } from '../src/employee-sale'
import { createSale, commitStore, changeTeamAccess, getMyAccess, getOperations, undoAction } from '../functions/src/index'
import { fixture } from './backend-mock'
const product = { id: 'p', name: 'Cookie', price: 6, stock: 10, category: 'tradicional' }
const customer = { id: 'c', name: 'Cliente', contact: 'private-contact', createdAt: '2026-09-01T12:00:00Z' }
const base = { products: [product], sales: [], customers: [customer] }
const sale = { id: 'sale1', date: '2026-09-04T12:00:00Z', items: [{ productId: 'p', name: 'Cookie', qty: 2, unitPrice: 6 }], total: 12, payment: 'pix', channel: 'loja', status: 'Pago' }
const state = { ...base, custos: [], perdas: [] }
const request = (uid: string, data = {}) => ({ auth: { uid, token: { email: uid + '@example.test', email_verified: true } }, data }) as any
function setup() {
  fixture.reset(); fixture.set('loja/dados', base)
  for (const role of ['owner', 'admin', 'employee', 'blocked']) fixture.set('team/' + role, { uid: role, email: role + '@example.test', role })
}
test('permission matrix denies unknown roles and limits team management to owner', () => {
  const perms: Permission[] = ['operate', 'manage', 'audit', 'team', 'backup']
  for (const role of [null, 'blocked', 'forged'] as (Role | null)[]) assert.deepEqual(perms.map(p => can(role, p)), [false,false,false,false,false])
  assert.deepEqual(perms.map(p => can('employee', p)), [true,false,false,false,false])
  assert.deepEqual(perms.map(p => can('admin', p)), [true,true,false,false,true])
  assert.ok(perms.every(p => can('owner', p)))
  assert.equal(canChangeRole('owner', 'employee', 'admin', false), true)
  assert.equal(canChangeRole('admin', 'employee', 'admin', false), false)
  assert.equal(canChangeRole('owner', 'owner', 'blocked', false), false)
  assert.equal(canChangeRole('owner', 'employee', 'owner', false), true)
  assert.equal(canChangeRole('owner', 'admin', 'blocked', true), false)
})
test('reversal compensates stock without erasing later sales and rejects used registrations', () => {
  const after = { ...base, products: [{ ...product, stock: 8 }], sales: [sale] }
  const patches = [...diffRows('products', base.products, after.products), ...diffRows('sales', [], after.sales)]
  const later = { ...state, products: [{ ...product, stock: 6 }], sales: [sale, { ...sale, id: 'later' }] }
  const result = reversePatches(later, patches)
  assert.equal((result.products[0] as any).stock, 8)
  assert.deepEqual(result.sales.map(s => s.id), ['later'])
  assert.equal(later.products[0].stock, 6)
  assert.throws(() => reversePatches(later, diffRows('products', [], [product])))
  assert.throws(() => reversePatches({ ...state, products: [{ ...product, stock: 1 }] }, diffRows('products', [{ ...product, stock: 0 }], [product])))
})
test('reversal preserves unrelated fields and refuses conflicting edits atomically', () => {
  const changed = { ...customer, name: 'Novo' }
  const patches = diffRows('customers', [customer], [changed])
  const result = reversePatches({ ...state, customers: [{ ...changed, contact: 'later-contact' }] }, patches)
  assert.deepEqual(result.customers, [{ ...customer, contact: 'later-contact' }])
  assert.throws(() => reversePatches({ ...state, customers: [{ ...customer, name: 'Outro' }] }, patches))
})
test('employee sale rejects price and status tampering and strips forged item payment/name/date', () => {
  assert.throws(() => employeeSale({ ...sale, status: 'Presente' }, base))
  assert.throws(() => employeeSale({ ...sale, status: 'bad' }, base))
  assert.throws(() => employeeSale({ ...sale, items: [{ ...sale.items[0], unitPrice: 1 }], total: 2 }, base))
  const safe = employeeSale({ ...sale, status: 'Pendente', customerId: 'c', paidAmount: 12, items: [{ ...sale.items[0], name: 'Forged', paid: true }] }, base, '2026-09-04T20:00:00Z')
  assert.equal(safe.paidAmount, 0); assert.equal(safe.items[0].paid, undefined); assert.equal(safe.items[0].name, 'Cookie'); assert.equal(safe.date, '2026-09-04T20:00:00Z')
})
test('server denies anonymous, unverified, blocked, and missing memberships', async () => {
  setup()
  for (const req of [{ data: {} }, request('missing'), request('blocked'), { ...request('employee'), auth: { ...request('employee').auth, token: { email_verified: false } } }]) {
    await assert.rejects(() => (getOperations as any)(req))
  }
  assert.deepEqual(await (getMyAccess as any)(request('missing')), { role: 'blocked' })
  assert.equal(fixture.get('team/missing'), undefined)
})
test('employee receives only operational data and cannot mutate store or team', async () => {
  setup()
  const data = await (getOperations as any)(request('employee'))
  assert.equal(data.sales, undefined); assert.equal(data.customers[0].contact, undefined)
  await assert.rejects(() => (commitStore as any)(request('employee', { base, local: { ...base, products: [] } })))
  await assert.rejects(() => (changeTeamAccess as any)(request('admin', { email: 'employee@example.test', role: 'admin' })))
  assert.deepEqual(fixture.get('loja/dados'), base)
})
test('owner can block employee but nobody can alter owner or promote themselves', async () => {
  setup()
  await assert.rejects(() => (changeTeamAccess as any)(request('owner', { email: 'owner@example.test', role: 'blocked' })))
  await assert.rejects(() => (changeTeamAccess as any)(request('owner', { email: 'employee@example.test', role: 'owner' })))
  await (changeTeamAccess as any)(request('owner', { email: 'employee@example.test', role: 'blocked' }))
  assert.equal(fixture.get('team/employee').role, 'blocked')
  await assert.rejects(() => (createSale as any)(request('employee', { sale })))
  assert.equal(fixture.list('audit/').length, 1)
})
test('sale and audit commit together; reversal is atomic and cannot be replayed', async () => {
  setup()
  await (createSale as any)(request('employee', { sale }))
  assert.equal(fixture.get('loja/dados').products[0].stock, 8)
  const entry = fixture.list('audit/')[0]
  assert.equal(entry.actorUid, 'employee')
  await assert.rejects(() => (undoAction as any)(request('employee', { id: entry.id })))
  await (undoAction as any)(request('owner', { id: entry.id }))
  assert.equal(fixture.get('loja/dados').products[0].stock, 10)
  assert.equal(fixture.get('loja/dados').sales.length, 0)
  await assert.rejects(() => (undoAction as any)(request('owner', { id: entry.id })))
  assert.equal(fixture.get('loja/dados').products[0].stock, 10)
})
test('failed sale leaves no stock mutation or audit and competing sales cannot oversell', async () => {
  setup()
  await assert.rejects(() => (createSale as any)(request('employee', { sale: { ...sale, total: 120, items: [{ ...sale.items[0], qty: 20 }] } })))
  assert.equal(fixture.list('audit/').length, 0)
  const sells = [1,2].map(n => (createSale as any)(request('employee', { sale: { ...sale, id: 'bulk' + n, total: 36, items: [{ ...sale.items[0], qty: 6 }] } })))
  const results = await Promise.allSettled(sells)
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  assert.equal(fixture.get('loja/dados').products[0].stock, 4)
})

test('retry after an undo does not recreate a sale or consume stock again', async () => {
  setup()
  await (createSale as any)(request('employee', { sale }))
  const entry = fixture.list('audit/')[0]
  await (undoAction as any)(request('owner', { id: entry.id }))
  const result = await (createSale as any)(request('employee', { sale }))
  assert.equal(result.repeated, true)
  assert.equal(fixture.get('loja/dados').sales.length, 0)
  assert.equal(fixture.get('loja/dados').products[0].stock, 10)
  await assert.rejects(() => (createSale as any)(request('employee', { sale: { ...sale, total: 6, items: [{ ...sale.items[0], qty: 1 }] } })))
})
