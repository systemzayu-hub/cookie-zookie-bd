import { sameData } from './store-merge'
import type { UndoPatch, UndoRow, UndoSource } from './undo-model'

export type AuditChange = { entity: string; field: string; before: unknown; after: unknown }

const sourceNames: Record<UndoSource, string> = { products: 'Produto', sales: 'Venda', customers: 'Cliente', custos: 'Custo', perdas: 'Perda' }
const fieldNames: Record<string, string> = {
  name: 'Nome', contact: 'Contato', createdAt: 'Cadastro', price: 'Preço', category: 'Categoria', stock: 'Estoque',
  date: 'Data', items: 'Itens', payment: 'Pagamento', total: 'Valor total', channel: 'Canal', customerId: 'Cliente',
  status: 'Situação', paidAmount: 'Valor pago', amount: 'Valor', description: 'Descrição', person: 'Pessoa',
  produto: 'Produto', qtd: 'Quantidade', custoUnit: 'Custo unitário', motivo: 'Motivo', role: 'Cargo',
}
const moneyFields = new Set(['price', 'total', 'unitPrice', 'paidAmount', 'amount', 'custoUnit', 'cost'])
const roleNames: Record<string, string> = { owner: 'Dono', admin: 'Administrador', employee: 'Funcionário', viewer: 'Somente leitura', blocked: 'Bloqueado' }
const label = (source: UndoSource, row: UndoRow | null, id: string) => {
  const value = row as Record<string, unknown> | null
  const saleItems = source === 'sales' && Array.isArray(value?.items)
    ? value.items.map(item => {
      const current = item as Record<string, unknown>
      return `${current.qty || 0}x ${current.name || 'item'}`
    }).join(' + ')
    : ''
  const name = value && (typeof value.name === 'string' ? value.name : typeof value.customerName === 'string' ? value.customerName : typeof value.produto === 'string' ? value.produto : saleItems)
  return `${sourceNames[source]}${name ? `: ${name}` : `: ${id}`}`
}

export function changesFromPatches(patches: UndoPatch[]): AuditChange[] {
  return patches.flatMap(({ source, id, before, after }) => {
    const entity = label(source, after || before, id)
    const beforeValue = before as Record<string, unknown> | null
    const afterValue = after as Record<string, unknown> | null
    const fields = new Set([...Object.keys(beforeValue || {}), ...Object.keys(afterValue || {})])
    return [...fields].filter(field => field !== 'id' && !sameData(beforeValue?.[field], afterValue?.[field]))
      .map(field => ({ entity, field, before: beforeValue?.[field], after: afterValue?.[field] }))
  })
}

export function auditFieldLabel(field: string): string {
  return fieldNames[field] || field.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, letter => letter.toUpperCase())
}

export function formatAuditValue(value: unknown, field = ''): string {
  if (value === undefined || value === null || value === '') return '—'
  if (typeof value === 'number' && moneyFields.has(field)) return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (field === 'role' && typeof value === 'string') return roleNames[value] || value
  if (typeof value === 'string' && ['date', 'createdAt'].includes(field)) {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) return date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  }
  if (field === 'items' && Array.isArray(value)) return value.map(item => {
    const current = item as Record<string, unknown>
    const unit = typeof current.unitPrice === 'number' ? ` · ${formatAuditValue(current.unitPrice, 'unitPrice')} cada` : ''
    return `${current.qty || 0}x ${current.name || 'item'}${unit}`
  }).join('; ')
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  try { return JSON.stringify(value) } catch { return String(value) }
}
