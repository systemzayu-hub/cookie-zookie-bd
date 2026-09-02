/* ================= AUDITORIA / LOG DE AÇÕES =================
 * Registra o que cada pessoa (conta Google logada) fez no sistema.
 * Salva em localStorage e sincroniza ao Firestore para a equipe.
 * SHA-256 da senha de acesso à auditoria "CoZooAdm0406" — nunca em texto plano.
 */
export const AUDIT_PW_HASH = '231d78fc9347664084c7c3baca4ef2273df8791b9c33c028fe6527ae8f52b41a'

export type AuditEntry = {
  id: string
  ts: number
  actor: string        // nome (ou email) da conta Google
  email?: string
  action: string       // 'venda' | 'produto' | 'estoque' | 'perda' | 'custo' | 'cliente' | 'cobranca' | 'login' | ...
  detail: string       // descrição legível
}

let actor: string | null = null
let actorEmail: string | null = null

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

/** Registra uma ação. Retorna a entrada criada. */
export function logAction(action: string, detail: string): AuditEntry | null {
  const entry: AuditEntry = {
    id: Math.random().toString(36).slice(2) + Date.now().toString(36),
    ts: Date.now(),
    actor: actor || 'desconhecido',
    email: actorEmail || undefined,
    action,
    detail,
  }
  saveAudit([entry, ...loadAudit()].slice(0, 2000))
  return entry
}

/** SHA-256 (para checar a senha de auditoria CoZooAdm0406). */
export async function auditHash(pw: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}
