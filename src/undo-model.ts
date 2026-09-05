import { sameData } from './store-merge'

export type UndoRow = { id: string }
export type UndoSource = 'products' | 'sales' | 'customers' | 'custos' | 'perdas'
export type UndoState = Record<UndoSource, UndoRow[]>
export type UndoPatch = { source: UndoSource; id: string; before: UndoRow | null; after: UndoRow | null }
export type UndoRecord = { id: string; ts: number; patches: UndoPatch[]; undone?: boolean }
export const undoSources: UndoSource[] = ['products', 'sales', 'customers', 'custos', 'perdas']

export function diffRows(source: UndoSource, before: UndoRow[], after: UndoRow[]): UndoPatch[] {
  const left = new Map(before.map(row => [row.id, row]))
  const right = new Map(after.map(row => [row.id, row]))
  return [...new Set([...left.keys(), ...right.keys()])].flatMap(id => {
    const b = left.get(id) ?? null, a = right.get(id) ?? null
    return sameData(b, a) ? [] : [{ source, id, before: b, after: a }]
  })
}

export function reversePatches(state: UndoState, patches: UndoPatch[]): UndoState {
  const next = Object.fromEntries(undoSources.map(source => [source, [...state[source]]])) as UndoState
  for (const patch of patches) {
    if (!undoSources.includes(patch.source) || !patch.id) throw new Error('Registro de reversão inválido.')
    const rows = next[patch.source], index = rows.findIndex(row => row.id === patch.id)
    const current = rows[index] as Record<string, unknown> | undefined
    const before = patch.before as Record<string, unknown> | null, after = patch.after as Record<string, unknown> | null
    if (before && before.id !== patch.id || after && after.id !== patch.id) throw new Error('Registro de reversão inválido.')
    if (!before) {
      if (!current || !sameData(current, after)) throw new Error('Este registro mudou depois da ação. Desfaça primeiro as alterações mais recentes.')
      rows.splice(index, 1)
    } else if (!after) {
      if (current) throw new Error('Já existe um registro com esse identificador.')
      rows.push(patch.before!)
    } else {
      if (!current) throw new Error('O registro foi excluído depois desta ação.')
      const restored = { ...current }
      for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
        if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Campo inválido.')
        if (sameData(before[key], after[key])) continue
        if (patch.source === 'products' && key === 'stock') {
          const stock = Number(current.stock) + Number(before.stock) - Number(after.stock)
          if (!Number.isFinite(stock) || stock < 0) throw new Error('Não há estoque suficiente para desfazer essa reposição.')
          restored.stock = stock
        } else {
          if (!sameData(current[key], after[key])) throw new Error('Este campo mudou depois da ação. Desfaça primeiro a alteração mais recente.')
          if (Object.prototype.hasOwnProperty.call(before, key)) restored[key] = before[key]
          else delete restored[key]
        }
      }
      rows[index] = restored as UndoRow
    }
  }
  for (const source of ['products', 'customers'] as const) {
    const removed = state[source].filter(row => !next[source].some(other => other.id === row.id))
    for (const row of removed) {
      const referenced = next.sales.some(sale => {
        const value = sale as unknown as { customerId?: string; items?: { productId: string }[] }
        return source === 'customers' ? value.customerId === row.id : value.items?.some(item => item.productId === row.id)
      })
      if (referenced) throw new Error('Este cadastro já possui vendas. Desfaça essas vendas antes de remover o cadastro.')
    }
  }
  return next
}
