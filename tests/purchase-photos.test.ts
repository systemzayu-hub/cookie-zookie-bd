import test from 'node:test'
import assert from 'node:assert/strict'
import { commitPurchasePhotos } from '../src/purchase-photos'

test('failed deletion retains the purchase photo in memory and persisted recovery', async () => {
  let persisted = { p1: 'original-photo' }, current = persisted
  await assert.rejects(commitPurchasePhotos(persisted, {}, async photos => { persisted = photos as typeof persisted }, async () => { throw Error('Conflict') }, photos => { current = photos as typeof current }), /Conflict/)
  assert.equal(current.p1, 'original-photo')
  assert.equal(persisted.p1, 'original-photo')
})

test('partially failed imports retain new attachments and restore edited existing attachments', async () => {
  let current: Record<string, string> = { p1: 'original-photo' }, persisted = current
  await assert.rejects(commitPurchasePhotos(current, { p1: 'replacement', p2: 'new-photo' }, async photos => { persisted = photos }, async () => { throw Error('Partial import') }, photos => { current = photos }), /Partial import/)
  assert.deepEqual(current, { p1: 'original-photo', p2: 'new-photo' })
  assert.deepEqual(persisted, current)
})

test('local photo cleanup failure does not report an already confirmed purchase as failed', async () => {
  let commits = 0, writes = 0, current: Record<string, string> = { p1: 'photo' }
  const cleaned = await commitPurchasePhotos(current, {}, async () => { if (++writes === 2) throw Error('Storage full') }, async () => { commits++ }, photos => { current = photos })
  assert.equal(commits, 1)
  assert.equal(cleaned, false)
  assert.equal(current.p1, 'photo')
})
