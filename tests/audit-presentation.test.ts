import assert from 'node:assert/strict'
import test from 'node:test'
import { auditCompactTitle, auditDayLabel, auditEventPresentation } from '../src/audit-presentation'
import type { AuditEntry } from '../src/audit'

const entry = (changes: Partial<AuditEntry> = {}): AuditEntry => ({
  id: 'audit-id', ts: Date.parse('2026-10-01T16:00:00Z'), actor: 'Ana', action: 'alteracao', detail: 'Nutella: preço de R$ 8,50 para R$ 9,00.', ...changes,
})

test('apresenta título e categoria pelo código da ação e preserva a descrição concreta', () => {
  assert.deepEqual(auditEventPresentation(entry()), {
    title: 'Alteração de dados', description: 'Nutella: preço de R$ 8,50 para R$ 9,00.', category: 'Outras alterações',
  })
  assert.deepEqual(auditEventPresentation(entry({ detail: 'Produto Nutella atualizado: preço de R$ 8,50 para R$ 9,00; estoque de 35 para 40' })), {
    title: 'Produto atualizado', description: 'Produto Nutella atualizado: preço de R$ 8,50 para R$ 9,00; estoque de 35 para 40', category: 'Produtos e estoque',
  })
  assert.equal(auditEventPresentation(entry({ detail: 'Venda registrada: 2x Nutella; total R$ 17,00' })).category, 'Vendas e recebimentos')
  assert.equal(auditEventPresentation(entry({ detail: 'Cliente Ana cadastrado' })).category, 'Clientes')
  assert.equal(auditEventPresentation(entry({ detail: 'Venda (Ana Souza; total R$ 17,00) atualizada: situação Pendente para Pago' })).title, 'Venda atualizada')
  assert.equal(auditEventPresentation(entry({ detail: 'Venda (Ana Souza; total R$ 17,00) atualizada: recebido de R$ 5,00 para R$ 7,00 (R$ 12,00 a receber → R$ 10,00 a receber)' })).title, 'Valor recebido da venda alterado')
  assert.equal(auditEventPresentation(entry({ detail: 'Venda (Ana Souza; total R$ 17,00) atualizada: cliente de Ana Souza para João Lima' })).title, 'Cliente da venda alterado')
  assert.deepEqual(auditEventPresentation(entry({ detail: 'Produto Nutella atualizado: estoque de 35 para 40 · Cliente Ana atualizado: contato de vazio para 11999999999' })), {
    title: 'Alterações em vários registros',
    description: 'Produto Nutella atualizado: estoque de 35 para 40 · Cliente Ana atualizado: contato de vazio para 11999999999',
    category: 'Outras alterações',
  })
  const saleEdit = auditEventPresentation(entry({ detail: 'Venda editada: Produto Nutella atualizado: estoque de 35 para 40 · Venda (Ana Souza; 2x Nutella) atualizada: situação Pendente para Pago' }))
  assert.equal(saleEdit.title, 'Venda editada')
  assert.equal(saleEdit.category, 'Vendas e recebimentos')
  const saleDelete = auditEventPresentation(entry({ detail: 'Venda excluída; estoque recomposto: Produto Nutella atualizado: estoque de 35 para 40 · Venda excluída: Ana Souza' }))
  assert.equal(saleDelete.title, 'Venda excluída')
  assert.equal(saleDelete.category, 'Vendas e recebimentos')
  assert.equal(auditEventPresentation(entry({ action: 'produto' })).category, 'Produtos e estoque')
  assert.equal(auditEventPresentation(entry({ action: 'venda' })).category, 'Vendas e recebimentos')
})

test('humaniza prefixos conhecidos e oculta UUIDs sem inferir ação a partir de palavras comuns', () => {
  const id = '9c65593d-8105-4ff0-9ee4-f0b83c0866d3'
  const debit = auditEventPresentation(entry({ detail: `Pagamento de débito: venda ${id} marcada como paga; situação Debitado → Pago` }))
  assert.equal(debit.title, 'Venda atualizada')
  assert.equal(debit.category, 'Vendas e recebimentos')
  assert.match(debit.description, /^Pagamento de débito: venda marcada como paga/)
  assert.doesNotMatch(debit.description, new RegExp(id))
  const unknown = auditEventPresentation(entry({ action: 'acao-antiga', detail: `A palavra venda apareceu no comentário ${id}` }))
  assert.equal(unknown.title, 'Outra alteração')
  assert.equal(unknown.category, 'Outras alterações')
  assert.match(unknown.description, /A palavra venda apareceu no comentário/)
  assert.match(unknown.description, new RegExp(id))
  const legacySale = auditEventPresentation(entry({ detail: `Venda v2-${id} editada: status atualizado` }))
  assert.equal(legacySale.title, 'Venda editada')
  assert.doesNotMatch(legacySale.description, new RegExp(id))
  const reversal = auditEventPresentation(entry({ detail: `Reversão do registro ${id}: estoque restaurado` }))
  assert.equal(reversal.title, 'Reversão aplicada')
  assert.doesNotMatch(reversal.description, new RegExp(id))
})

test('gera títulos compactos de negócio sem métricas, com fallback honesto', () => {
  const compact = (detail: string, action: AuditEntry['action'] = 'alteracao') => auditCompactTitle(entry({ action, detail }))
  assert.equal(compact('Produto Nutella atualizado: preço de R$ 8,50 para R$ 9,00; estoque de 35 para 40'), 'Nutella: preço e estoque alterados')
  assert.equal(compact('Produto Nutella atualizado: preço de R$ 8,50 para R$ 9,00'), 'Nutella: preço alterado')
  assert.equal(compact('Produto Nutella atualizado: estoque de 35 para 40'), 'Nutella: estoque alterado')
  assert.equal(compact('Produto Turma 2 cadastrado'), 'Produto Turma 2 cadastrado')
  assert.equal(compact('Venda registrada: 2x Nutella; cliente Lara Almeida; total R$ 17,00'), 'Venda registrada para Lara Almeida')
  assert.equal(compact('Venda registrada: 2x Nutella; cliente Lara Almeida; total R$ 17,00', 'venda'), 'Venda registrada para Lara Almeida')
  assert.equal(compact('Venda (Lara Almeida; total R$ 17,00) atualizada: recebido de R$ 5,00 para R$ 7,00'), 'Recebimento da venda de Lara Almeida alterado')
  assert.equal(compact('Venda (Lara Almeida; total R$ 17,00) atualizada: cliente de Lara Almeida para João Silva'), 'Cliente da venda alterado')
  assert.equal(compact('Venda editada: Produto Nutella atualizado: estoque de 35 para 40'), 'Venda editada')
  assert.equal(compact('Venda registrada: cliente pessoa@example.com; total R$ 17,00'), 'Venda registrada')
  assert.equal(compact('Cliente Lara Almeida atualizado: contato de vazio para 11999999999', 'cliente'), 'Cliente Lara Almeida atualizado')
  assert.equal(compact('Produto Nutella atualizado: estoque de 35 para 40 · Cliente Lara Almeida atualizado: contato de vazio para 11999999999'), 'Alterações em vários registros')
  assert.equal(compact('Produto Nutella atualizado: estoque de 35 para 40 · Produto Oreo atualizado: preço de R$ 4,00 para R$ 5,00'), 'Produtos e estoque atualizados')
  assert.equal(compact('comentário legado com preço de R$ 8,50 para R$ 9,00'), 'Alteração de dados')
  assert.equal(compact('acesso da equipe atualizado', 'equipe'), 'Acesso da equipe alterado')
  assert.equal(auditEventPresentation(entry({ action: 'financeiro', source: 'cost', detail: 'Custo de Nutella alterado: R$ 4,00 para R$ 5,00' })).category, 'Financeiro')
  assert.equal(auditCompactTitle(entry({ action: 'financeiro', source: 'cost', detail: 'Custo de Nutella alterado: R$ 4,00 para R$ 5,00' })), 'Custo de Nutella alterado')
  assert.equal(auditCompactTitle(entry({ action: 'financeiro', source: 'loss', detail: 'Perda registrada: Nutella · 3 un · Queimado · R$ 12,00' })), 'Perda de Nutella registrada')
})

test('troca JSON legado por texto de campos e explica detalhes vazios', () => {
  const parsed = auditEventPresentation(entry({ detail: '{"status":"Pendente","total":17,"customerId":"c1"}' }))
  assert.match(parsed.description, /Situação: Pendente/)
  assert.match(parsed.description, /Valor total: R\$ 17,00/)
  assert.doesNotMatch(parsed.description, /\{|customerId|c1/)
  assert.equal(auditEventPresentation(entry({ detail: '' })).description, 'Detalhes não informados neste registro.')
})

test('agrupa dias pelo calendário de Brasília, inclusive na virada UTC e na virada do dia', () => {
  const now = Date.parse('2026-10-02T01:00:00Z') // 22:00 de 1º de outubro em Brasília
  assert.equal(auditDayLabel(Date.parse('2026-10-02T02:00:00Z'), now), 'Hoje')
  assert.equal(auditDayLabel(Date.parse('2026-10-01T02:30:00Z'), now), 'Ontem')
  assert.equal(auditDayLabel(Date.parse('2026-09-30T02:30:00Z'), now), '29/09/2026')
  assert.equal(auditDayLabel(0, now), 'Data não informada')
  assert.equal(auditDayLabel(Number.NaN, now), 'Data não informada')
})
