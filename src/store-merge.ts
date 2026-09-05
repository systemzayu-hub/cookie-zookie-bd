import type { StoreData } from './validation'

export class SyncConflict extends Error {
  constructor() { super('Outro aparelho alterou o mesmo registro. Exporte suas alterações antes de carregar a versão da equipe.'); this.name = 'SyncConflict' }
}

export const sameData = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false
  const left = a as Record<string, unknown>, right = b as Record<string, unknown>
  const keys = Object.keys(left).filter(key => left[key] !== undefined)
  return keys.length === Object.keys(right).filter(key => right[key] !== undefined).length && keys.every(key => sameData(left[key], right[key]))
}

// Merge independent edits; never choose silently between conflicting changes.
function mergeList<T extends { id: string }>(base: T[], local: T[], remote: T[], protectStock = false): T[] {
  const before = new Map(base.map(row => [row.id, row]))
  const ours = new Map(local.map(row => [row.id, row]))
  const theirs = new Map(remote.map(row => [row.id, row]))
  const result: T[] = []
  for (const id of new Set([...ours.keys(), ...theirs.keys(), ...before.keys()])) {
    const b = before.get(id), l = ours.get(id), r = theirs.get(id)
    if (protectStock && b && l && r) {
      const field = 'stock' as keyof T
      if (!sameData(l[field], b[field]) && !sameData(r[field], b[field])) throw new SyncConflict()
    }
    if (sameData(l, b)) { if (r) result.push(r); continue }
    if (sameData(r, b) || sameData(l, r)) { if (l) result.push(l); continue }
    if (!b || !l || !r) throw new SyncConflict()
    const merged = { ...r }
    for (const key of new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(r)]) as Set<keyof T>) {
      if (sameData(l[key], b[key])) continue
      if (!sameData(r[key], b[key]) && !sameData(l[key], r[key])) throw new SyncConflict()
      merged[key] = l[key]
    }
    result.push(merged)
  }
  return result
}

export function mergeStore(base: StoreData, local: StoreData, remote: StoreData): StoreData {
  return {
    products: mergeList(base.products, local.products, remote.products, true),
    sales: mergeList(base.sales, local.sales, remote.sales),
    customers: mergeList(base.customers, local.customers, remote.customers),
  }
}
