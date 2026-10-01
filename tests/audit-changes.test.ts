import assert from 'node:assert/strict'
import test from 'node:test'
import { auditFieldLabel, changesFromPatches, formatAuditValue } from '../src/audit-changes'
import { auditActionLabel, auditAuthor, mergeAuditEntries } from '../src/audit-presentation'
import { OWNER_KEY_EMAIL } from '../src/owner-access'

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

test('mostra quem mudou o cliente usando os nomes de cada versão, mantendo o ID quando falta contexto', () => {
  const patch = { source: 'sales' as const, id: 'v1', before: { id: 'v1', customerId: 'a' }, after: { id: 'v1', customerId: 'b' } }
  const changes = changesFromPatches([patch], { beforeCustomers: [{ id: 'a', name: 'João antigo' }], afterCustomers: [{ id: 'b', name: 'Lara' }] })
  assert.equal(changes[0].before, 'João antigo (ID: a)')
  assert.equal(changes[0].after, 'Lara (ID: b)')
  assert.equal(changesFromPatches([patch])[0].before, 'a')
  assert.equal(patch.before.customerId, 'a')
})

test('a comparação de itens distingue pagamento e não desloca datas sem horário', () => {
  const item = { name: 'Nutella', productId: 'p1', qty: 1, unitPrice: 8.5 }
  assert.notEqual(formatAuditValue([{ ...item, paid: false }], 'items'), formatAuditValue([{ ...item, paid: true }], 'items'))
  assert.match(formatAuditValue([{ ...item, paid: true }], 'items'), /pago · ID: p1/)
  assert.equal(formatAuditValue('2026-10-01', 'date'), '01/10/2026')
  assert.equal(formatAuditValue('pix', 'payment'), 'Pix')
})

test('a carga inicial não apaga eventos recebidos pelo listener e não duplica registros', () => {
  const event = (id: string, ts: number) => ({ id, ts, actor: 'João', action: 'alteracao', detail: id })
  const rows = mergeAuditEntries([event('novo', 20)], [event('antigo', 10), event('novo', 20)])
  assert.deepEqual(rows.map(row => row.id), ['novo', 'antigo'])
})

test('o nome do acesso nunca atribui uma chave compartilhada a uma pessoa', () => {
  assert.equal(auditAuthor({ actor: 'Dono', email: OWNER_KEY_EMAIL }), 'Acesso com chave do dono')
  assert.equal(auditAuthor({ actor: '', email: 'joao@example.test' }), 'joao@example.test')
  assert.equal(auditActionLabel('alteracao'), 'Alteração de dados')
  assert.equal(auditActionLabel('acao-antiga'), 'acao-antiga')
})
