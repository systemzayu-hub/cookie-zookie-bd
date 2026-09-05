import { load, save } from './data'
import { diffRows, reversePatches, undoSources, type UndoPatch, type UndoRecord, type UndoRow, type UndoSource, type UndoState } from './undo-model'
import type { StoreData } from './validation'
import { validateStoreData } from './validation'

let owner: string | null = null
let adapter: { read: () => StoreData; write: (data: StoreData) => void } | null = null
const pending = new Map<UndoSource, { before: UndoRow[]; after: UndoRow[] }>()
const key = () => `cc_undo_v1:${encodeURIComponent(owner || '')}`
export const UNDO_CHANGED = 'cookie-zookie:undo-changed'
const emit = () => window.dispatchEvent(new Event(UNDO_CHANGED))

export function setUndoOwner(value: string | null) { if (owner !== value) pending.clear(); owner = value }
export function configureUndoStore(value: typeof adapter) { adapter = value }
export function trackChange(source: UndoSource, before: UndoRow[], after: UndoRow[]) {
  if (!owner || !['custos', 'perdas'].includes(source)) return
  pending.set(source, { before: pending.get(source)?.before ?? before, after })
  // A change without a matching audit action must not attach to an unrelated later action.
  queueMicrotask(() => pending.delete(source))
}

function records(): UndoRecord[] {
  const value = load<unknown>(key(), [])
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is UndoRecord => entry && typeof entry.id === 'string' && Number.isFinite(entry.ts) && Array.isArray(entry.patches) && entry.patches.length <= 8000 && entry.patches.every((patch: UndoPatch) => patch && undoSources.includes(patch.source) && typeof patch.id === 'string')).slice(0, 100)
}

export function captureUndo(id: string, ts: number) {
  const patches = [...pending].flatMap(([source, changes]) => diffRows(source, changes.before, changes.after))
  pending.clear()
  if (!owner || !patches.length) return
  const list = [{ id, ts, patches }, ...records()].slice(0, 100)
  while (JSON.stringify(list).length > 1_500_000 && list.length > 1) list.pop()
  if (JSON.stringify(list).length <= 1_500_000) save(key(), list)
  emit()
}

function currentState(): UndoState {
  if (!adapter) throw new Error('Os dados da loja ainda estão carregando.')
  return { ...adapter.read(), custos: load<UndoRow[]>('cc_custos', []), perdas: load<UndoRow[]>('cc_perdas', []) }
}
export function undoStatus(id: string): 'available' | 'undone' | 'unavailable' {
  const record = records().find(item => item.id === id)
  return record ? record.undone ? 'undone' : 'available' : 'unavailable'
}
export function previewUndo(id: string): { source: UndoSource; count: number }[] {
  const record = records().find(item => item.id === id)
  if (!record || record.undone) throw new Error('Esta ação não está disponível para desfazer neste aparelho.')
  reversePatches(currentState(), record.patches)
  return undoSources.map(source => ({ source, count: record.patches.filter(patch => patch.source === source).length })).filter(item => item.count)
}
export function performUndo(id: string) {
  if (!owner || !adapter) throw new Error('Entre na conta que registrou a ação.')
  const list = records(), record = list.find(item => item.id === id)
  if (!record || record.undone) throw new Error('Esta ação já foi desfeita ou não está disponível neste aparelho.')
  const next = reversePatches(currentState(), record.patches)
  const store = validateStoreData(next)
  if (!store) throw new Error('A reversão produziria dados inválidos.')
  // Reserve the reversal before applying it, preventing a double click or another tab from replaying it.
  if (!save(key(), list.map(item => item.id === id ? { ...item, undone: true } : item))) throw new Error('Não foi possível salvar a reversão neste aparelho.')
  for (const source of ['custos', 'perdas'] as const) {
    if (record.patches.some(patch => patch.source === source) && !save(`cc_${source}`, next[source])) {
      save(key(), list)
      throw new Error('Não foi possível salvar os dados restaurados.')
    }
  }
  // Local expense reversals must never generate a second shared-store commit.
  void store
  emit()
}
