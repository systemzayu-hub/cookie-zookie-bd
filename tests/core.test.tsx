import test from 'node:test'
import assert from 'node:assert/strict'
import { useState } from 'react'
import { act, create } from 'react-test-renderer'
import { renderToStaticMarkup } from 'react-dom/server'
import { mergeStore, sameData, SyncConflict } from '../src/store-merge'
import { dayKey, periodSales, productionPlan, salesSummary } from '../src/analytics'
import { validateStoreData } from '../src/validation'
import { useStoreSync } from '../src/useStoreSync'
import { MetricBars } from '../src/components/MetricBars'
import { Operations } from '../src/components/Operations'
import * as server from './sync-mock'
import { recordSale } from '../src/record-sale'

const empty = { products: [], sales: [], customers: [] }
const product = { id: 'p1', name: 'Tradicional', stock: 10, price: 6, category: 'tradicional' }
const customer = { id: 'c1', name: 'Cliente teste', contact: '', createdAt: '2026-09-01T12:00:00Z' }
const sale = { id: 's1', date: '2026-09-04T12:00:00Z', items: [{ productId: 'p1', name: 'Tradicional', qty: 2, unitPrice: 6 }], total: 12, payment: 'pix' as const, channel: 'loja' as const, status: 'Pago' as const }
const base = { products: [product], sales: [], customers: [customer] }

test('recording a sale updates stock and sale history together without mutating the source', () => {
  const result = recordSale(base, sale)
  assert.equal(result.products[0].stock, 8)
  assert.equal(result.sales.length, 1)
  assert.equal(base.products[0].stock, 10)
})
test('sale validation rejects duplicate IDs, invalid quantities and insufficient aggregate stock', () => {
  assert.throws(() => recordSale({ ...base, sales: [sale] }, sale))
  assert.throws(() => recordSale(base, { ...sale, items: [{ ...sale.items[0], qty: NaN }] }))
  assert.throws(() => recordSale(base, { ...sale, items: [{ ...sale.items[0], qty: 6 }, { ...sale.items[0], qty: 6 }] }))
  assert.throws(() => recordSale(base, { ...sale, customerId: 'deleted-customer' }))
})

test('independent records from two devices are preserved', () => {
  const local = { ...base, sales: [sale], products: [{ ...product, stock: 8 }] }
  const remote = { ...base, customers: [{ ...customer, contact: 'test-contact' }] }
  assert.deepEqual(mergeStore(base, local, remote), { ...local, customers: remote.customers })
})
test('two simultaneous sales of the same stock are a conflict, even with equal resulting quantity', () => {
  const local = { ...base, sales: [sale], products: [{ ...product, stock: 8 }] }
  const remote = { ...base, sales: [{ ...sale, id: 's2' }], products: [{ ...product, stock: 8 }] }
  assert.throws(() => mergeStore(base, local, remote), SyncConflict)
})
test('independent fields of a customer merge without losing imported contact', () => {
  const local = { ...base, customers: [{ ...customer, name: 'Nome atualizado' }] }
  const remote = { ...base, customers: [{ ...customer, contact: 'test-contact' }] }
  assert.equal(mergeStore(base, local, remote).customers[0].contact, 'test-contact')
  assert.equal(mergeStore(base, local, remote).customers[0].name, 'Nome atualizado')
})
test('delete-versus-update and competing customer edits never silently overwrite', () => {
  const remote = { ...base, customers: [{ ...customer, name: 'Outro nome' }] }
  assert.throws(() => mergeStore(base, { ...base, customers: [] }, remote), SyncConflict)
  assert.throws(() => mergeStore(base, { ...base, customers: [{ ...customer, name: 'Nome local' }] }, remote), SyncConflict)
})
test('unchanged remote records allow local deletion', () => {
  assert.deepEqual(mergeStore(base, { ...base, customers: [] }, base).customers, [])
})
test('field order and omitted undefined fields do not cause false conflicts', () => {
  assert.ok(sameData({ a: 1, b: undefined }, { a: 1 }))
  assert.ok(sameData({ a: 1, b: 2 }, { b: 2, a: 1 }))
})
test('invalid and incomplete backups and duplicate IDs are rejected', () => {
  assert.equal(validateStoreData({ version: 2 }), null)
  assert.equal(validateStoreData({ ...base, products: [product, product] }), null)
  assert.equal(validateStoreData({ ...base, products: [{ ...product, stock: Infinity }] }), null)
  assert.deepEqual(validateStoreData(empty), empty)
})
test('reports use Sao Paulo calendar dates and exclude future dates', () => {
  const now = Date.parse('2026-09-04T15:00:00Z')
  assert.equal(dayKey('2026-09-04T01:00:00Z'), '2026-09-03')
  assert.equal(periodSales([{ ...sale, date: '2026-09-04T01:00:00Z' }], 1, now).length, 0)
  assert.equal(periodSales([{ ...sale, date: '2026-09-04T03:01:00Z' }], 1, now).length, 1)
  assert.equal(periodSales([{ ...sale, date: '2026-09-05T12:00:00Z' }], 'all', now).length, 0)
})
test('gifts do not inflate revenue and partial payments contribute only what was received', () => {
  const result = salesSummary([sale, { ...sale, id: 's2', status: 'Pendente', paidAmount: 5 }, { ...sale, id: 's3', status: 'Presente' }])
  assert.equal(result.revenue, 24); assert.equal(result.received, 17)
  assert.equal(result.pending, 7); assert.equal(result.average, 12); assert.equal(result.gifts, 2)
})
test('production plan uses seven days of demand and never recommends negative stock', () => {
  const now = Date.parse('2026-09-04T15:00:00Z')
  const plan = productionPlan([{ ...product, stock: 1 }], [{ ...sale, items: [{ ...sale.items[0], qty: 14 }] }], now)
  assert.equal(plan[0].suggested, 5)
  assert.equal(productionPlan([product], [], now)[0].suggested, 0)
})
test('zero bars render zero width and operations render empty and populated states', () => {
  assert.match(renderToStaticMarkup(<MetricBars items={[{ label: 'Zero', value: 0 }]} />), /width:0%/)
  assert.match(renderToStaticMarkup(<Operations products={[]} sales={[]} navigate={() => {}} />), /Cadastre seus sabores/)
  assert.match(renderToStaticMarkup(<Operations products={[{ ...product, stock: 0 }]} sales={[sale]} navigate={() => {}} />), /1 sabores sem estoque/)
})

const storage = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) }, configurable: true })
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true })
const events = new EventTarget()
Object.defineProperty(globalThis, 'window', { value: Object.assign(events, { setTimeout, clearTimeout }), configurable: true })
let control: any
function Harness({ online = true }: { online?: boolean }) {
  const [data, setData] = useState(base)
  const sync = useStoreSync('test-owner', data, setData, online)
  control = { data, setData, ...sync }
  return null
}
const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 750)) })

test('sync hook hydrates, commits edits, and preserves remote contacts arriving during debounce', async () => {
  storage.clear(); server.reset(base)
  let root: any
  act(() => { root = create(<Harness />) })
  act(() => server.emit(base))
  assert.equal(control.ready, true)
  act(() => control.setData({ ...base, products: [{ ...product, stock: 9 }] }))
  act(() => server.emit({ ...base, customers: [{ ...customer, contact: 'imported' }] }))
  await flush()
  assert.equal(control.status, 'synced'); assert.equal(server.commits.length, 1)
  assert.equal(server.remote.products[0].stock, 9); assert.equal(server.remote.customers[0].contact, 'imported')
  act(() => root.unmount())
})
test('sync hook retains local changes after a failed commit and retries successfully', async () => {
  storage.clear(); server.reset(base); server.setFailure(true)
  let root: any
  act(() => { root = create(<Harness />) }); act(() => server.emit(base))
  act(() => control.setData({ ...base, products: [{ ...product, stock: 8 }] }))
  await flush(); assert.equal(control.status, 'error')
  assert.equal(JSON.parse(storage.get('cc_sync_pending')!).local.products[0].stock, 8)
  server.setFailure(false); act(() => control.retry()); await flush()
  assert.equal(control.status, 'synced'); assert.equal(server.remote.products[0].stock, 8)
  act(() => root.unmount())
})
test('sync hook restores offline edits after remount and sends them when online', async () => {
  storage.clear(); server.reset(base)
  storage.set('cc_sync_pending', JSON.stringify({ owner: 'test-owner', base, local: { ...base, products: [{ ...product, stock: 7 }] } }))
  let root: any
  act(() => { root = create(<Harness online={false} />) })
  assert.equal(control.data.products[0].stock, 7); assert.equal(control.status, 'offline')
  act(() => root.update(<Harness online />)); await flush()
  assert.equal(server.remote.products[0].stock, 7); assert.equal(control.status, 'synced')
  act(() => root.unmount())
})
test('sync hook keeps a conflicting local copy and does not write over the other device', async () => {
  storage.clear(); server.reset(base)
  let root: any
  act(() => { root = create(<Harness />) }); act(() => server.emit(base))
  act(() => control.setData({ ...base, products: [{ ...product, stock: 8 }] }))
  act(() => server.emit({ ...base, products: [{ ...product, stock: 9 }] }))
  await flush()
  assert.equal(control.status, 'conflict'); assert.equal(control.data.products[0].stock, 8)
  assert.equal(server.commits.length, 0)
  act(() => root.unmount())
})
