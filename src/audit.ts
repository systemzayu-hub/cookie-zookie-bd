/* ================= AUDITORIA / LOG DE AÇÕES =================
 * Registra o que cada pessoa (conta Google logada) fez no sistema.
 * Fonte de verdade: Firestore (coleção 'audit'), com localStorage como cache local.
 * Acesso visual à auditoria exige reautenticação recente pela conta Google.
 */
import { auditPushDB, auditPullDB, type AuditEntryDB } from './sync'

export type AuditEntry = AuditEntryDB

let actor: string | null = null
let actorEmail: string | null = null
const undoHandlers = new Map<string, () => void>()

/** Define quem está agindo (chamado pelo App quando o login Google muda). */
export function setAuditActor(name: string | null, email: string | null) {
  actor = name || email || null
  actorEmail = email || null
}
export function getAuditActor() { return actor }

const KEY = 'cc_audit'
export function loadAudit(): AuditEntry[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') as AuditEntry[] } catch { return [] }
}
function saveAudit(list: AuditEntry[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

/**
 * Carrega a auditoria mesclando o cache local com o Firestore.
 * O Firestore é a fonte de verdade; o local cobre quando está offline.
 */
export async function loadAuditRemote(): Promise<AuditEntry[]> {
  const local = loadAudit()
  const remote = await auditPullDB(2000)
  // Mescla por id (sem duplicar) e ordena por ts decrescente
  const byId = new Map<string, AuditEntry>()
  for (const e of remote) byId.set(e.id, e)
  for (const e of local) if (!byId.has(e.id)) byId.set(e.id, e)
  const all = Array.from(byId.values()).sort((a, b) => (b.ts || 0) - (a.ts || 0))
  saveAudit(all.slice(0, 2000))
  return all
}

/** Registra uma ação — grava no Firestore (para toda a equipe) e em cache local. */
export function logAction(action: string, detail: string, undo?: () => void): AuditEntry {
  const entry: AuditEntry = {
    id: Math.random().toString(36).slice(2) + Date.now().toString(36),
    ts: Date.now(),
    actor: actor || 'desconhecido',
    action,
    detail,
  }
  if (actorEmail) entry.email = actorEmail
  if (undo) undoHandlers.set(entry.id, undo)
  // cache local imediato
  saveAudit([entry, ...loadAudit()].slice(0, 2000))
  // grava no Firestore (fire-and-forget, não bloqueia a UI)
  auditPushDB(entry)
  return entry
}

export function canUndoAction(id: string) { return undoHandlers.has(id) }

export function undoAuditAction(entry: AuditEntry): AuditEntry | null {
  const undo = undoHandlers.get(entry.id)
  if (!undo) return null
  undoHandlers.delete(entry.id)
  undo()
  return logAction('auditoria', `Desfez a ação: ${entry.detail}`)
}
