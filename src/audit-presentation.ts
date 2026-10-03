import type { AuditEntry } from './audit'
import { formatAuditValue } from './audit-changes'
import { OWNER_KEY_EMAIL } from './owner-access'

const actions: Record<string, string> = {
  alteracao: 'Alteração de dados', venda: 'Venda registrada', recebimento: 'Recebimento', financeiro: 'Financeiro', desfazer: 'Reversão',
  equipe: 'Acesso da equipe', custo: 'Custo', perda: 'Perda', produto: 'Produto',
  cliente: 'Cliente', estoque: 'Estoque', cobranca: 'Cobrança', pagamento: 'Pagamento',
  backup: 'Backup', login: 'Acesso ao sistema', 'venda-rapida': 'Venda importada',
}
const titles: Record<string, string> = {
  alteracao: 'Alteração de dados', venda: 'Venda registrada', recebimento: 'Recebimento registrado', financeiro: 'Registro financeiro atualizado', desfazer: 'Reversão aplicada',
  equipe: 'Acesso da equipe alterado', custo: 'Custo atualizado', perda: 'Perda registrada',
  produto: 'Produto atualizado', cliente: 'Cadastro de cliente atualizado', estoque: 'Estoque atualizado',
  cobranca: 'Cobrança atualizada', pagamento: 'Pagamento atualizado', backup: 'Backup', login: 'Acesso ao sistema',
  'venda-rapida': 'Vendas importadas',
}
const categories: Record<string, string> = {
  produto: 'Produtos e estoque', estoque: 'Produtos e estoque',
  venda: 'Vendas e recebimentos', recebimento: 'Vendas e recebimentos', cobranca: 'Vendas e recebimentos', pagamento: 'Vendas e recebimentos', 'venda-rapida': 'Vendas e recebimentos',
  financeiro: 'Financeiro',
  cliente: 'Clientes', equipe: 'Equipe', custo: 'Custos e perdas', perda: 'Custos e perdas',
  alteracao: 'Outras alterações', desfazer: 'Outras alterações', backup: 'Outras alterações', login: 'Outras alterações',
}
const UUID = '(?:v2-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const cleanDetail = (detail: string) => detail
  .replace(new RegExp(`^(Pagamento de débito: venda\\s+|Venda\\s+|Reversão do registro\\s+)${UUID}(?=$|\\s|[:;,.])`, 'i'), '$1')
  .replace(/\bID:\s*(?:v2-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '')
  .replace(/\s+([,;:.])/g, '$1').replace(/ {2,}/g, ' ').trim()

type DetailKind = 'products' | 'sales' | 'customers'
function detailKinds(detail: string) {
  const kinds = new Set<DetailKind>()
  if (/(?:^|[.:·]\s*)Produto\s+.+?\s+(?:cadastrado|atualizado|removido)(?::|$)/im.test(detail)) kinds.add('products')
  if (/(?:^|[.:·]\s*)(?:Venda\s+(?:registrada|excluída|editada)|Venda\s+.+?\)\s+atualizada|Pagamento de débito:\s*venda\b)(?::|\s|$)/im.test(detail)) kinds.add('sales')
  if (/(?:^|[.:·]\s*)Cliente\s+.+?\s+(?:cadastrado|atualizado|removido)(?::|$)/im.test(detail)) kinds.add('customers')
  return kinds
}
function operationTitle(detail: string, kind: DetailKind) {
  if (kind === 'products') {
    const operations = [...detail.matchAll(/Produto\s+.+?\s+(cadastrado|atualizado|removido)(?::|$)/gim)]
    if (operations.length !== 1) return 'Produtos e estoque atualizados'
    return `Produto ${operations[0][1].toLowerCase()}`
  }
  if (kind === 'customers') {
    const operations = [...detail.matchAll(/Cliente\s+.+?\s+(cadastrado|atualizado|removido)(?::|$)/gim)]
    if (operations.length !== 1) return 'Clientes atualizados'
    return `Cliente ${operations[0][1].toLowerCase()}`
  }
  if (/Venda registrada/i.test(detail)) return 'Venda registrada'
  if (/Venda excluída/i.test(detail)) return 'Venda excluída'
  if (/Venda editada/i.test(detail)) return 'Venda editada'
  if (!detail.includes(' · ')) {
    const update = /^Venda\s+.+?\)\s+atualizada:\s*(.+)$/i.exec(detail)
    if (update && /^recebido de .+ para .+ \(.+ a receber → .+ a receber\)$/i.test(update[1])) return 'Valor recebido da venda alterado'
    if (update && /^cliente de .+ para .+$/i.test(update[1])) return 'Cliente da venda alterado'
  }
  if (/Venda\s+.+?\)\s+atualizada/i.test(detail)) return 'Venda atualizada'
  return 'Vendas e recebimentos atualizados'
}

export const auditActionLabel = (action: string) => actions[action] || 'Outra alteração'
export const auditAuthor = (entry: Pick<AuditEntry, 'actor' | 'email'>) =>
  entry.email === OWNER_KEY_EMAIL ? 'Acesso com chave do dono' : entry.actor || entry.email || 'Conta sem identificação'

export function auditEventPresentation(entry: AuditEntry): { title: string; description: string; category: string } {
  let title = titles[entry.action] || 'Outra alteração'
  let category = categories[entry.action] || 'Outras alterações'
  let description = cleanDetail(typeof entry.detail === 'string' ? entry.detail : '')

  if (entry.action === 'financeiro') {
    title = entry.source === 'purchase' ? 'Compra financeira alterada' : entry.source === 'payment' ? 'Pagamento financeiro alterado' : title
    if (entry.source === 'cost') title = 'Custo de produção alterado'
    if (entry.source === 'loss') title = /^Perda (?:registrada|registrado)/i.test(description) ? 'Perda registrada' : /^Perda removida/i.test(description) ? 'Perda removida' : 'Perda atualizada'
    category = 'Financeiro'
  }

  if (entry.action === 'alteracao') {
    if (/^Venda editada:/i.test(description)) {
      title = 'Venda editada'
      category = 'Vendas e recebimentos'
    } else if (/^Venda excluída; estoque recomposto:/i.test(description)) {
      title = 'Venda excluída'
      category = 'Vendas e recebimentos'
    } else if (/^Pagamento de débito:/i.test(description)) {
      title = 'Venda atualizada'
      category = 'Vendas e recebimentos'
    } else if (/^Reversão do registro:/i.test(description)) {
      title = 'Reversão aplicada'
    } else {
      const kinds = detailKinds(description)
      if (kinds.size > 1) {
        title = 'Alterações em vários registros'
        category = 'Outras alterações'
      } else if (kinds.size === 1) {
        const kind = [...kinds][0]
        title = operationTitle(description, kind)
        category = kind === 'products' ? 'Produtos e estoque' : kind === 'sales' ? 'Vendas e recebimentos' : 'Clientes'
      } else title = 'Alteração de dados'
    }
  }

  if (!description) description = 'Detalhes não informados neste registro.'
  if (/^\s*[\[{]/.test(description)) {
    try { description = formatAuditValue(JSON.parse(description) as unknown) }
    catch { /* Preserve legacy text that only resembles JSON. */ }
  }
  return { title, description, category }
}

const compactName = (value: string | undefined) => {
  const name = value?.trim()
  if (!name || /@/.test(name) || new RegExp(`^${UUID}$`, 'i').test(name) || /^(?:cliente sem nome(?: no registro| disponível)?|sem cliente)$/i.test(name)) return undefined
  return name.length > 76 ? `${name.slice(0, 75).trimEnd()}…` : name
}
const compactTitle = (value: string) => value.length <= 100 ? value : `${value.slice(0, 99).trimEnd()}…`

/** Short row title that omits metrics while preserving recognized business names and operations. */
export function auditCompactTitle(entry: AuditEntry): string {
  const detail = cleanDetail(typeof entry.detail === 'string' ? entry.detail : '')
  const baseTitle = auditEventPresentation(entry).title
  let title: string | undefined
  const hasSaleContext = /^Venda (?:editada:|excluída; estoque recomposto:)/i.test(detail)
  if (['Produtos e estoque atualizados', 'Clientes atualizados', 'Vendas e recebimentos atualizados'].includes(baseTitle)) return compactTitle(baseTitle)
  if (entry.action === 'alteracao' && !hasSaleContext && detailKinds(detail).size > 1) return compactTitle(baseTitle)

  if (entry.action === 'financeiro' && entry.source === 'cost') {
    const match = /^Custo de (.+?) (registrado|removido|alterado):/i.exec(detail)
    const name = compactName(match?.[1])
    return compactTitle(name ? `Custo de ${name} ${match![2].toLowerCase()}` : 'Custo de produção alterado')
  }
  if (entry.action === 'financeiro' && entry.source === 'loss') {
    const match = /^Perda (?:registrada|registrado|removida|atualizada):\s*([^·]+)/i.exec(detail)
    const name = compactName(match?.[1])
    const operation = /^Perda removida/i.test(detail) ? 'removida' : /^Perda atualizada/i.test(detail) ? 'atualizada' : 'registrada'
    return compactTitle(name ? `Perda de ${name} ${operation}` : `Perda ${operation}`)
  }

  if (entry.action === 'alteracao' || entry.action === 'venda' || entry.action === 'cliente') {
    if (/^Venda editada:/i.test(detail)) title = 'Venda editada'
    else if (/^Venda excluída; estoque recomposto:/i.test(detail)) title = 'Venda excluída'
    else {
      let match = /^Produto (.+?) cadastrado(?:$|:)/i.exec(detail)
      if (match) title = compactName(match[1]) ? `Produto ${compactName(match[1])} cadastrado` : 'Produto cadastrado'
      else if ((match = /^Produto (.+?) removido(?:$|:)/i.exec(detail))) title = compactName(match[1]) ? `Produto ${compactName(match[1])} removido` : 'Produto removido'
      else if ((match = /^Produto (.+?) atualizado:\s*(.+)$/i.exec(detail))) {
        const name = compactName(match[1])
        const fields = match[2]
        const price = /(?:^|;\s*)preço de\b/i.test(fields)
        const stock = /(?:^|;\s*)estoque de\b/i.test(fields)
        const onlyPriceAndStock = /^(?:(?:preço|estoque) de\b[^;]+)(?:;\s*(?:preço|estoque) de\b[^;]+)?$/i.test(fields)
        const what = price && stock && onlyPriceAndStock ? 'preço e estoque alterados'
          : price && onlyPriceAndStock ? 'preço alterado'
            : stock && onlyPriceAndStock ? 'estoque alterado' : undefined
        title = name ? (what ? `${name}: ${what}` : `Produto ${name} atualizado`) : 'Produto atualizado'
      } else if ((match = /^Venda registrada:\s*(.*)$/i.exec(detail))) {
        const customer = /(?:^|;\s*)cliente\s+([^;]+)/i.exec(match[1])?.[1]
        const name = compactName(customer)
        title = name ? `Venda registrada para ${name}` : 'Venda registrada'
      } else if ((match = /^Venda \(([^)]*)\) atualizada:\s*(.*)$/i.exec(detail))) {
        const identity = match[1]
        const name = compactName(identity.split(';')[0])
        const changes = match[2]
        if (/^cliente de\b/i.test(changes)) title = 'Cliente da venda alterado'
        else if (/^recebido de\b/i.test(changes) && !/;/.test(changes)) title = name ? `Recebimento da venda de ${name} alterado` : 'Recebimento da venda alterado'
        else title = name ? `Venda de ${name} atualizada` : 'Venda atualizada'
      } else if ((match = /^Cliente (.+?) (cadastrado|atualizado|removido)(?:$|:)/i.exec(detail))) {
        const name = compactName(match[1])
        title = name ? `Cliente ${name} ${match[2].toLowerCase()}` : baseTitle
      }
    }
  }

  return compactTitle(title || baseTitle)
}

const dateParts = (ts: number) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(ts))
  return Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value])) as { year: string; month: string; day: string }
}
const dateKey = (parts: { year: string; month: string; day: string }) => `${parts.year}-${parts.month}-${parts.day}`

export function auditDayLabel(ts: number, now = Date.now()): string {
  if (!Number.isFinite(ts) || ts <= 0 || !Number.isFinite(now) || Number.isNaN(new Date(now).getTime())) return 'Data não informada'
  const date = new Date(ts)
  if (Number.isNaN(date.getTime())) return 'Data não informada'
  const key = dateKey(dateParts(ts)), today = dateParts(now)
  if (key === dateKey(today)) return 'Hoje'
  const previous = new Date(Date.UTC(Number(today.year), Number(today.month) - 1, Number(today.day) - 1))
  const yesterday = { year: String(previous.getUTCFullYear()), month: String(previous.getUTCMonth() + 1).padStart(2, '0'), day: String(previous.getUTCDate()).padStart(2, '0') }
  if (key === dateKey(yesterday)) return 'Ontem'
  return date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

export function mergeAuditEntries(...sources: AuditEntry[][]): AuditEntry[] {
  return [...new Map(sources.flat().map(entry => [entry.id, entry])).values()]
    .sort((a, b) => b.ts - a.ts || a.id.localeCompare(b.id))
}
