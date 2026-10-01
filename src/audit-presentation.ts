import type { AuditEntry } from './audit'
import { OWNER_KEY_EMAIL } from './owner-access'

const actions: Record<string, string> = {
  alteracao: 'Alteração de dados', venda: 'Venda registrada', desfazer: 'Reversão',
  equipe: 'Acesso da equipe', custo: 'Custo', perda: 'Perda', produto: 'Produto',
  cliente: 'Cliente', estoque: 'Estoque', cobranca: 'Cobrança', pagamento: 'Pagamento',
  backup: 'Backup', login: 'Acesso ao sistema',
}
export const auditActionLabel = (action: string) => actions[action] || action
export const auditAuthor = (entry: Pick<AuditEntry, 'actor' | 'email'>) =>
  entry.email === OWNER_KEY_EMAIL ? 'Acesso com chave do dono' : entry.actor || entry.email || 'Conta sem identificação'

export function mergeAuditEntries(...sources: AuditEntry[][]): AuditEntry[] {
  return [...new Map(sources.flat().map(entry => [entry.id, entry])).values()]
    .sort((a, b) => b.ts - a.ts || a.id.localeCompare(b.id))
}
