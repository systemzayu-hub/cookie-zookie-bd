import assert from 'node:assert/strict'
import test from 'node:test'
import { summarizeSale, summarizeStoreChange, summarizeTeam } from '../src/audit-summary'
import { isDebitAudit } from '../src/debit-change'

const product = { id: 'p1', name: 'Nutella', price: 8.5, category: 'especial', stock: 35 }
const customer = { id: 'c1', name: 'Ana Souza', contact: '', createdAt: '2026-01-01T00:00:00Z' }
const sale = { id: '9c65593d-8105-4ff0-9ee4-f0b83c0866d3', date: '2026-01-01T12:00:00Z', items: [{ productId: 'p1', name: product.name, qty: 2, unitPrice: 8.5 }], payment: 'pix' as const, total: 17, channel: 'loja' as const, customerId: 'c1', status: 'Pendente' as const, paidAmount: 5 }
const before = { products: [product], sales: [], customers: [customer] }

test('resume preço e estoque em uma descrição concreta e conjunta', () => {
  const detail = summarizeStoreChange(before, { ...before, products: [{ ...product, price: 9, stock: 40 }] })
  assert.match(detail, /Nutella/)
  assert.match(detail, /preço de .*8,50.* para .*9,00/)
  assert.match(detail, /estoque de 35 para 40/)
  assert.ok(detail.length <= 1000)
})

test('resume venda com cliente, itens, total, recebido e saldo calculados pela regra de venda', () => {
  const detail = summarizeSale(sale, before)
  assert.match(detail, /2x Nutella/)
  assert.match(detail, /Ana Souza/)
  assert.match(detail, /total .*17,00/)
  assert.match(detail, /recebido .*5,00/)
  assert.match(detail, /a receber .*12,00/)
  assert.match(detail, /pagamento Pix/)
  assert.match(detail, /canal Loja/)
  assert.doesNotMatch(detail, new RegExp(sale.id))
})

test('agrupa os campos alterados de uma venda e descreve recebido/saldo reais', () => {
  const oldSale = { ...sale, status: 'Pendente' as const, paidAmount: 5 }
  const newSale = { ...sale, status: 'Pago' as const, paidAmount: 5, total: 19 }
  const detail = summarizeStoreChange({ ...before, sales: [oldSale] }, { ...before, sales: [newSale] })
  assert.match(detail, /situação Pendente → Pago/)
  assert.match(detail, /recebido de .*5,00 para .*19,00/)
  assert.match(detail, /a receber → .*0,00 a receber/)
  assert.match(detail, /total de .*17,00 para .*19,00/)
  assert.equal((detail.match(/Venda \(/g) || []).length, 1)
})

test('explicita criação e exclusão sem expor UUID da venda', () => {
  const created = summarizeStoreChange(before, { ...before, sales: [sale] })
  const deleted = summarizeStoreChange({ ...before, sales: [sale] }, before)
  assert.match(created, /Venda registrada: 2x Nutella/)
  assert.match(deleted, /Venda excluída: Ana Souza/)
  assert.doesNotMatch(`${created} ${deleted}`, new RegExp(sale.id))
})

test('preserva o prefixo de pagamento de débito usado na regra de reversão', () => {
  const detail = summarizeStoreChange({ ...before, sales: [{ ...sale, status: 'Debitado' }] }, { ...before, sales: [{ ...sale, status: 'Pago' }] }, `Pagamento de débito: venda ${sale.id} marcada como paga`)
  assert.ok(isDebitAudit(detail))
  assert.match(detail, /^Pagamento de débito: venda marcada como paga:/)
  assert.match(detail, /situação Debitado → Pago/)
})

test('remove UUID de contextos de edição, exclusão e reversão sem ocultar o tipo de operação', () => {
  const id = sale.id
  const edit = summarizeStoreChange(before, { ...before, products: [{ ...product, stock: 34 }] }, `Venda ${id} editada`)
  const deletion = summarizeStoreChange(before, { ...before, products: [] }, `Venda ${id} excluída; estoque recomposto`)
  const undo = summarizeStoreChange(before, { ...before, products: [{ ...product, stock: 34 }] }, `Reversão do registro ${id}`)
  assert.match(edit, /^Venda editada:/)
  assert.match(deletion, /^Venda excluída; estoque recomposto:/)
  assert.match(undo, /^Reversão do registro:/)
  assert.doesNotMatch(`${edit} ${deletion} ${undo}`, new RegExp(id))
})

test('mostra rótulos de enum legíveis nas mudanças de pagamento e canal', () => {
  const detail = summarizeStoreChange({ ...before, sales: [sale] }, { ...before, sales: [{ ...sale, payment: 'dinheiro', channel: 'delivery' }] })
  assert.match(detail, /pagamento de Pix para Dinheiro/)
  assert.match(detail, /canal de Loja para Delivery/)
})

test('fala com honestidade quando não identifica campos alterados e respeita o limite de texto', () => {
  const unknown = summarizeStoreChange(before, { ...before, customers: [{ ...customer, custom: 'valor' }] as typeof before.customers })
  assert.match(unknown, /Outros campos foram atualizados; consulte os detalhes/)
  const many = { ...before, products: Array.from({ length: 200 }, (_, index) => ({ ...product, id: `p${index}`, name: `Produto ${index} com nome longo` })) }
  const limited = summarizeStoreChange(before, many, 'Lote importado')
  assert.ok(limited.length <= 1000)
  assert.match(limited, /demais alterações omitidas/)
})

test('registra conta e cargos anterior e novo', () => {
  const result = summarizeTeam('equipe@example.com', 'viewer', 'employee')
  assert.match(result, /equipe@example.com/)
  assert.match(result, /Sem cargo · somente leitura → Funcionário/)
})
