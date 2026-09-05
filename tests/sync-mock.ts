import { mergeStore } from '../src/store-merge'
import type { StoreData } from '../src/validation'
export const listeners = new Set<(data: StoreData) => void>()
export let commits: StoreData[] = []
export let remote: StoreData
export let fail = false
export function reset(data: StoreData) { remote = structuredClone(data); commits = []; fail = false; listeners.clear() }
export function setFailure(value: boolean) { fail = value }
export function emit(data: StoreData) { remote = structuredClone(data); listeners.forEach(listener => listener(data)) }
export function onRemoteChanges(cb: (data: StoreData) => void) { listeners.add(cb); return () => { listeners.delete(cb) } }
export async function syncCommit(base: StoreData, local: StoreData) {
  if (fail) throw new Error('Network unavailable')
  const merged = mergeStore(base, local, remote)
  remote = merged; commits.push(merged)
  return merged
}
