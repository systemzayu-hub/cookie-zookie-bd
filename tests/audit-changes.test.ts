import assert from 'node:assert/strict'
import test from 'node:test'
import { auditFieldLabel, changesFromPatches, formatAuditValue } from '../src/audit-changes'

test('expõe campo, valores e metadados técnicos sem misturar UUID à entidade legível', () => {
  const id = 'p1'
  const changes = changesFromPatches([{ source: 'products', id, before: { id, name: 'Chocolate', stock: 2 }, after: { id, name: 'Chocolate', stock: 5 } }])
  assert.deepEqual(changes, [{ entity: 'Produto: Chocolate', field: 'stock', before: 2, after: 5, source: 'products', entityId: id }])
})

test('distingue vendas diferentes mesmo quando a descrição humana coincide', () => {
  const row = { name: 'Nutella', qty: 2, unitPrice: 8.5 }
  const changes = changesFromPatches([
    { source: 'sales', id: 'sale-a', before: null, after: { id: 'sale-a', date: '2026-09-01T12:00:00Z', customerId: 'c1', items: [row], total: 17, status: 'Pago' } },
    { source: 'sales', id: 'sale-b', before: null, after: { id: 'sale-b', date: '2026-09-01T12:00:00Z', customerId: 'c1', items: [row], total: 17, status: 'Pago' } },
  ], { afterCustomers: [{ id: 'c1', name: 'Ana' }] })
  assert.equal(changes.length, 10)
  assert.equal(changes[0].entity, changes[5].entity)
  assert.notEqual(changes[0].entityId, changes[5].entityId)
  assert.ok(changes.every(change => change.source === 'sales'))
  assert.match(changes[0].entity, /Ana/)
  assert.doesNotMatch(changes[0].entity, /sale-a|sale-b|c1/)
})

test('converte IDs de cliente conhecidos em nomes históricos e oculta ID desconhecido', () => {
  const patch = { source: 'sales' as const, id: 'sale-a', before: { id: 'sale-a', customerId: 'old' }, after: { id: 'sale-a', customerId: 'new' } }
  const changes = changesFromPatches([patch], { beforeCustomers: [{ id: 'old', name: 'João antigo' }], afterCustomers: [{ id: 'new', name: 'Lara' }] })
  assert.equal(changes[0].before, 'João antigo')
  assert.equal(changes[0].after, 'Lara')
  assert.equal(changes[0].field, 'customerName')
  assert.equal(formatAuditValue(changes[0].before, changes[0].field), 'João antigo')
  assert.equal(formatAuditValue(changes[0].after, changes[0].field), 'Lara')
  assert.equal(formatAuditValue(changesFromPatches([patch])[0].before, 'customerId'), 'Cliente sem nome disponível')
})

test('exibe nomes históricos na mudança de cliente sem expor IDs ao formatador', () => {
  const patch = { source: 'sales' as const, id: 'sale', before: { id: 'sale', customerId: 'c-old' }, after: { id: 'sale', customerId: 'c-new' } }
  const changes = changesFromPatches([patch], { beforeCustomers: [{ id: 'c-old', name: 'João da Silva' }], afterCustomers: [{ id: 'c-new', name: 'Lara Almeida' }] })
  assert.equal(formatAuditValue(changes[0].before, changes[0].field), 'João da Silva')
  assert.equal(formatAuditValue(changes[0].after, changes[0].field), 'Lara Almeida')
  assert.doesNotMatch(`${changes[0].before} ${changes[0].after}`, /c-old|c-new/)
})

test('formata valores ausentes e dados estruturados sem JSON bruto nem IDs de itens', () => {
  assert.equal(formatAuditValue(undefined), 'Sem dado registrado')
  assert.equal(formatAuditValue(null), 'Sem valor')
  assert.match(formatAuditValue({ unit: 'kg' }), /Unit: kg/)
  assert.equal(formatAuditValue(17, 'total'), 'R$ 17,00')
  assert.equal(formatAuditValue(true), 'Sim')
  assert.equal(auditFieldLabel('paidAmount'), 'Valor recebido')
  assert.equal(formatAuditValue('admin', 'role'), 'Administrador')
  const item = formatAuditValue([{ name: 'Nutella', productId: 'p1', qty: 2, unitPrice: 8.5, paid: false }], 'items')
  assert.match(item, /2x Nutella/)
  assert.match(item, /não pago/)
  assert.doesNotMatch(item, /p1|\{|\[object Object\]/)
})

test('calcula recebido efetivo e saldo conforme situação da venda', () => {
  const sale = { items: [{ name: 'Nutella', qty: 2, unitPrice: 8.5 }], total: 17, paidAmount: 4, status: 'Pago', payment: 'pix' }
  const text = formatAuditValue(sale)
  assert.match(text, /recebido R\$ 17,00/)
  assert.match(text, /R\$ 0,00 a receber/)
  assert.match(text, /Pix/)
})

test('usa ausência explícita nos lados sem registro durante criação ou exclusão', () => {
  const patch = { source: 'sales' as const, id: 'sale', before: null, after: { id: 'sale', customerId: 'c1' } }
  const change = changesFromPatches([patch], { afterCustomers: [{ id: 'c1', name: 'Ana' }] }).find(item => item.field === 'customerName')!
  assert.equal(formatAuditValue(change.before, change.field), 'Sem dado registrado')
  assert.equal(formatAuditValue(change.after, change.field), 'Ana')
})

test('formata status, forma de pagamento e datas sem deslocar o dia', () => {
  assert.match(formatAuditValue([{ name: 'Nutella', productId: 'p1', qty: 1, unitPrice: 8.5, paid: true }], 'items'), /pago/)
  assert.equal(formatAuditValue('2026-10-01', 'date'), '01/10/2026')
  assert.equal(formatAuditValue('pix', 'payment'), 'Pix')
})
