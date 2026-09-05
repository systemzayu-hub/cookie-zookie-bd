import { auditPullDB, type AuditEntryDB } from './sync'
import { captureUndo, performUndo, undoStatus } from './undo'
import { isUnlocked } from './auth'
export type AuditEntry = AuditEntryDB
let actor: string | null = null, actorEmail: string | null = null
export function setAuditActor(name: string | null, email: string | null) { actor = name || email; actorEmail = email }
export function getAuditActor() { return actor }
const key = () => 'cc_local_audit:' + encodeURIComponent(actorEmail || '')
export function loadAudit(): AuditEntry[] {
  if (!isUnlocked('audit')) return []
  try { const rows = JSON.parse(localStorage.getItem(key()) || '[]'); return Array.isArray(rows) ? rows.filter(e => e && typeof e.id === 'string' && typeof e.detail === 'string' && Number.isFinite(e.ts)).slice(0, 500) : [] } catch { return [] }
}
export async function loadAuditRemote(): Promise<AuditEntry[]> {
  return [...await auditPullDB(), ...loadAudit()].sort((a,b) => b.ts - a.ts)
}
export function logAction(action: string, detail: string, _legacyUndo?: () => void): AuditEntry {
  const entry: AuditEntry = { id: crypto.randomUUID(), ts: Date.now(), actor: actor || 'Conta local', action, detail, local: true, ...(actorEmail ? { email: actorEmail } : {}) }
  // Shared changes are journaled inside the server transaction. Local financial
  // records remain clearly identified as device-only history.
  if (['custo', 'perda'].includes(action) && isUnlocked('audit')) {
    captureUndo(entry.id, entry.ts)
    try { localStorage.setItem(key(), JSON.stringify([entry, ...loadAudit()].slice(0, 500))) } catch { /* storage error is handled by data persistence */ }
  }
  return entry
}
export function canUndoAction(id: string) { return isUnlocked('audit') && undoStatus(id) === 'available' }
export async function undoAuditAction(entry: AuditEntry) {
  if (!isUnlocked('audit')) throw new Error('Seu cargo não permite desfazer ações.')
  if (!navigator.locks) throw new Error('Use um navegador atualizado para desfazer registros locais.')
  await navigator.locks.request('cookie-zookie-local-undo', () => {
    if (!isUnlocked('audit')) throw new Error('Seu acesso mudou.')
    performUndo(entry.id)
  })
}
