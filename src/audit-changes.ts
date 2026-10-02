import { sameData } from './store-merge'
import type { UndoPatch, UndoRow, UndoSource } from './undo-model'
import type { Customer, Sale } from './types'
import { fmtBRL, saleOutstanding, salePaidAmount } from './types'

export type AuditChange = { entity: string; field: string; before: unknown; after: unknown; source?: UndoSource; entityId?: string }

const sourceNames: Record<UndoSource, string> = { products: 'Produto', sales: 'Venda', customers: 'Cliente', custos: 'Custo', perdas: 'Perda' }
const fieldNames: Record<string, string> = {
  name: 'Nome', contact: 'Contato', createdAt: 'Cadastro', price: 'Preço', category: 'Categoria', stock: 'Estoque',
  date: 'Data', items: 'Itens', payment: 'Pagamento', total: 'Valor total', channel: 'Canal', customerId: 'Cliente',
  status: 'Situação', paidAmount: 'Valor recebido', amount: 'Valor', description: 'Descrição', person: 'Pessoa',
  produto: 'Produto', qtd: 'Quantidade', custoUnit: 'Custo unitário', motivo: 'Motivo', role: 'Cargo',
  paid: 'Item pago', productId: 'Produto associado', customerName: 'Nome do cliente',
}
const valueNames: Record<string, Record<string, string>> = {
  payment: { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão', cartão: 'Cartão', fiado: 'Fiado' },
  channel: { loja: 'Loja', delivery: 'Delivery', evento: 'Evento', whatsapp: 'WhatsApp', encomenda: 'Encomenda' },
  category: { tradicional: 'Tradicional', especial: 'Especial', sazonal: 'Sazonal' },
}
const moneyFields = new Set(['price', 'total', 'unitPrice', 'paidAmount', 'amount', 'custoUnit', 'cost'])
const roleNames: Record<string, string> = { owner: 'Dono', admin: 'Administrador', employee: 'Funcionário', viewer: 'Somente leitura', blocked: 'Bloqueado' }
type AuditContext = { beforeCustomers?: Pick<Customer, 'id' | 'name'>[]; afterCustomers?: Pick<Customer, 'id' | 'name'>[] }
const clean = (value: unknown) => String(value ?? '').replace(/[\r\n]+/g, ' ').trim()
const customerName = (id: unknown, customers?: Pick<Customer, 'id' | 'name'>[]) => {
  if (!id) return 'sem cliente'
  return customers?.find(customer => customer.id === id)?.name || 'cliente sem nome disponível'
}
const formatDate = (value: unknown) => {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') value = (value as { toDate(): Date }).toDate()
  // ISO date-only strings represent a calendar date, not midnight UTC.
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-')
    const parsed = new Date(`${value}T00:00:00.000Z`)
    if (!Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value) return `${day}/${month}/${year}`
  }
  const date = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(date.getTime()) ? clean(value) : date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

function saleEntity(sale: Record<string, unknown>, customers?: Pick<Customer, 'id' | 'name'>[]) {
  const items = Array.isArray(sale.items) ? sale.items.map(item => {
    const row = item as Record<string, unknown>
    return `${row.qty ?? '?'}x ${clean(row.name) || 'item'}`
  }).join(', ') : ''
  const date = sale.date ? formatDate(sale.date) : ''
  const total = typeof sale.total === 'number' ? fmtBRL(sale.total) : ''
  const facts = [customerName(sale.customerId, customers), date, total, items].filter(Boolean)
  return `${sourceNames.sales}${facts.length ? `: ${facts.join(' · ')}` : ''}`
}

function label(source: UndoSource, row: UndoRow | null, customers?: Pick<Customer, 'id' | 'name'>[]) {
  const value = row as Record<string, unknown> | null
  if (source === 'sales' && value) return saleEntity(value, customers)
  const name = value && (typeof value.name === 'string' ? value.name : typeof value.customerName === 'string' ? value.customerName : typeof value.produto === 'string' ? value.produto : '')
  return `${sourceNames[source]}${name ? `: ${clean(name)}` : ''}`
}

export function changesFromPatches(patches: UndoPatch[], context?: AuditContext): AuditChange[] {
  return patches.flatMap(({ source, id, before, after }) => {
    const entity = label(source, after || before, after ? context?.afterCustomers : context?.beforeCustomers)
    const beforeValue = before as Record<string, unknown> | null
    const afterValue = after as Record<string, unknown> | null
    const fields = new Set([...Object.keys(beforeValue || {}), ...Object.keys(afterValue || {})])
    return [...fields].filter(field => field !== 'id' && !sameData(beforeValue?.[field], afterValue?.[field]))
      .map(field => ({
        entity,
        before: field === 'customerId' ? (!beforeValue || !Object.prototype.hasOwnProperty.call(beforeValue, field) ? undefined : customerName(beforeValue[field], context?.beforeCustomers)) : beforeValue?.[field],
        after: field === 'customerId' ? (!afterValue || !Object.prototype.hasOwnProperty.call(afterValue, field) ? undefined : customerName(afterValue[field], context?.afterCustomers)) : afterValue?.[field],
        field: field === 'customerId' ? 'customerName' : field,
        source,
        entityId: id,
      }))
  })
}

export function auditFieldLabel(field: string): string {
  return fieldNames[field] || field.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, letter => letter.toUpperCase())
}

function formatItem(item: unknown): string {
  if (!item || typeof item !== 'object') return clean(item) || 'item'
  const current = item as Record<string, unknown>
  const name = clean(current.name) || 'item'
  const qty = current.qty === undefined ? '' : `${current.qty}x `
  const unit = typeof current.unitPrice === 'number' ? ` · ${fmtBRL(current.unitPrice)} cada` : ''
  const paid = typeof current.paid === 'boolean' ? ` · ${current.paid ? 'pago' : 'não pago'}` : ''
  const status = typeof current.status === 'string' ? ` · ${auditFieldLabel('status')}: ${current.status}` : ''
  return `${qty}${name}${unit}${paid}${status}`
}

function formatStructured(value: Record<string, unknown>, depth: number): string {
  if (depth > 2) return 'dados detalhados disponíveis'
  if (Array.isArray(value.items)) {
    const items = value.items.map(formatItem).join('; ')
    const details = [typeof value.customerName === 'string' ? `cliente ${value.customerName}` : '', typeof value.total === 'number' ? `total ${fmtBRL(value.total)}` : ''].filter(Boolean)
    if (typeof value.total === 'number' && typeof value.status === 'string') {
      const sale = value as unknown as Sale
      details.push(`recebido ${fmtBRL(salePaidAmount(sale))}`, `${fmtBRL(saleOutstanding(sale))} a receber`)
    } else if (typeof value.paidAmount === 'number') details.push(`recebido ${fmtBRL(value.paidAmount)}`)
    if (typeof value.status === 'string') details.push(`situação ${value.status}`)
    if (typeof value.payment === 'string') details.push(`pagamento ${formatAuditValue(value.payment, 'payment')}`)
    return `${items}${details.length ? ` (${details.join('; ')})` : ''}`
  }
  return Object.entries(value).filter(([key]) => !['id', 'productId', 'customerId'].includes(key)).map(([key, child]) => {
    const shown = child && typeof child === 'object' ? formatStructured(child as Record<string, unknown>, depth + 1) : formatAuditValue(child, key)
    return `${auditFieldLabel(key)}: ${shown}`
  }).join('; ') || 'Dados estruturados sem campos legíveis'
}

export function formatAuditValue(value: unknown, field = ''): string {
  if (value === undefined) return 'Sem dado registrado'
  if (value === null) return 'Sem valor'
  if (value === '') return 'Vazio'
  if (typeof value === 'number' && moneyFields.has(field)) return fmtBRL(value)
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (field === 'role' && typeof value === 'string') return roleNames[value] || value
  if (field === 'customerId') return typeof value === 'string' && value.includes('@') ? value : 'Cliente sem nome disponível'
  if (['id', 'productId', 'saleId'].includes(field)) return 'Registro associado'
  if (typeof value === 'string' && valueNames[field]?.[value]) return valueNames[field][value]
  if (typeof value === 'string' && ['date', 'createdAt'].includes(field)) return formatDate(value)
  if (field === 'items' && Array.isArray(value)) return value.map(formatItem).join('; ')
  if (Array.isArray(value)) return value.map(item => item && typeof item === 'object' ? formatStructured(item as Record<string, unknown>, 0) : formatAuditValue(item)).join('; ')
  if (value instanceof Date) return formatDate(value)
  if (value && typeof value === 'object') return formatStructured(value as Record<string, unknown>, 0)
  return String(value)
}
