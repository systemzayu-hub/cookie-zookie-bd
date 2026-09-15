import assert from 'node:assert/strict'
import test from 'node:test'
import { auditFieldLabel, changesFromPatches, formatAuditValue } from '../src/audit-changes'

test('expõe entidade, campo e valores de um patch', () => {
  const changes = changesFromPatches([{ source: 'products', id: 'p1', before: { id: 'p1', name: 'Chocolate', stock: 2 }, after: { id: 'p1', name: 'Chocolate', stock: 5 } }])
  assert.deepEqual(changes, [{ entity: 'Produto: Chocolate', field: 'stock', before: 2, after: 5 }])
})

test('formata valores ausentes e estruturados para a auditoria', () => {
  assert.equal(formatAuditValue(undefined), '—')
  assert.equal(formatAuditValue({ unit: 'kg' }), '{"unit":"kg"}')
  assert.equal(formatAuditValue(17, 'total'), 'R$ 17,00')
  assert.equal(formatAuditValue(true), 'Sim')
  assert.equal(auditFieldLabel('paidAmount'), 'Valor pago')
  assert.equal(formatAuditValue('admin', 'role'), 'Administrador')
})

test('resume vendas e descreve itens sem exigir rolagem tabular', () => {
  const changes = changesFromPatches([{ source: 'sales', id: 'v1', before: null, after: { id: 'v1', items: [{ name: 'Nutella', qty: 2, unitPrice: 8.5 }], total: 17 } }])
  assert.equal(changes[0].entity, 'Venda: 2x Nutella')
  assert.equal(formatAuditValue(changes[0].after, changes[0].field), '2x Nutella · R$ 8,50 cada')
})
