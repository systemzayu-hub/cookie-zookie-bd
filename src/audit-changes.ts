import { sameData } from './store-merge'
import type { UndoPatch, UndoRow, UndoSource } from './undo-model'

export type AuditChange = { entity: string; field: string; before: unknown; after: unknown }

const sourceNames: Record<UndoSource, string> = { products: 'Produto', sales: 'Venda', customers: 'Cliente', custos: 'Custo', perdas: 'Perda' }
const fieldNames: Record<string, string> = {
  name: 'Nome', contact: 'Contato', createdAt: 'Cadastro', price: 'Preço', category: 'Categoria', stock: 'Estoque',
  date: 'Data', items: 'Itens', payment: 'Pagamento', total: 'Valor total', channel: 'Canal', customerId: 'Cliente',
  status: 'Situação', paidAmount: 'Valor pago', amount: 'Valor', description: 'Descrição', person: 'Pessoa',
  produto: 'Produto', qtd: 'Quantidade', custoUnit: 'Custo unitário', motivo: 'Motivo', role: 'Cargo',
  paid: 'Item pago', productId: 'Produto', customerName: 'Nome do cliente',
}
const valueNames: Record<string, Record<string, string>> = {
  payment: { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão', fiado: 'Fiado' },
  channel: { loja: 'Loja', delivery: 'Delivery', evento: 'Evento', whatsapp: 'WhatsApp' },
  category: { tradicional: 'Tradicional', especial: 'Especial' },
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

type AuditContext = { beforeCustomers?: { id: string; name: string }[]; afterCustomers?: { id: string; name: string }[] }
export function changesFromPatches(patches: UndoPatch[], context?: AuditContext): AuditChange[] {
  const customerValue = (value: unknown, customers?: { id: string; name: string }[]) => {
    if (!value) return value
    const customer = customers?.find(row => row.id === value)
    return customer ? `${customer.name} (ID: ${customer.id})` : value
  }
  return patches.flatMap(({ source, id, before, after }) => {
    const entity = label(source, after || before, id)
    const beforeValue = before as Record<string, unknown> | null
    const afterValue = after as Record<string, unknown> | null
    const fields = new Set([...Object.keys(beforeValue || {}), ...Object.keys(afterValue || {})])
    return [...fields].filter(field => field !== 'id' && !sameData(beforeValue?.[field], afterValue?.[field]))
      .map(field => ({ entity, field,
        before: field === 'customerId' ? customerValue(beforeValue?.[field], context?.beforeCustomers) : beforeValue?.[field],
        after: field === 'customerId' ? customerValue(afterValue?.[field], context?.afterCustomers) : afterValue?.[field],
      }))
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
  if (typeof value === 'string' && valueNames[field]?.[value]) return valueNames[field][value]
  if (typeof value === 'string' && ['date', 'createdAt'].includes(field)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(value + 'T12:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) return date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  }
  if (field === 'items' && Array.isArray(value)) return value.map(item => {
    const current = item as Record<string, unknown>
    const unit = typeof current.unitPrice === 'number' ? ` · ${formatAuditValue(current.unitPrice, 'unitPrice')} cada` : ''
    const paid = typeof current.paid === 'boolean' ? ` · ${current.paid ? 'pago' : 'não pago'}` : ''
    const product = current.productId ? ` · ID: ${current.productId}` : ''
    return `${current.qty || 0}x ${current.name || 'item'}${unit}${paid}${product}`
  }).join('; ')
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  try { return JSON.stringify(value) } catch { return String(value) }
}
