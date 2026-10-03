import test from 'node:test'
import assert from 'node:assert/strict'
import { parseFeed, matchesOrderMode } from '../src/site-orders-model'

test('feed separates confirmed test and real orders from missing or malformed classification', () => {
  const orders = [true, false, undefined, null, 'false', 0].map((testMode, id) => ({
    id, number: `P-${id}`, createdAt: '2026-10-02T12:00:00Z', items: [], testMode,
  }))
  const page = parseFeed({ orders }, 0)
  assert.deepEqual(page.orders.filter(order => matchesOrderMode(order, 'test')).map(order => order.number), ['P-0'])
  assert.deepEqual(page.orders.filter(order => matchesOrderMode(order, 'real')).map(order => order.number), ['P-1'])
  assert.deepEqual(page.orders.filter(order => matchesOrderMode(order, 'unknown')).map(order => order.number), ['P-2', 'P-3', 'P-4', 'P-5'])
  assert.equal(page.orders.filter(order => matchesOrderMode(order, 'all')).length, 6)
})
