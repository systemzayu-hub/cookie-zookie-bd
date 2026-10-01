import assert from 'node:assert/strict'
import test from 'node:test'
import { summarizeSale, summarizeStoreChange, summarizeTeam } from '../src/audit-summary'
import { isDebitAudit } from '../src/debit-change'

const product = { id: 'p1', name: 'Chocolate "especial"', price: 8.5, category: 'especial', stock: 10 }
const customer = { id: 'c1', name: 'Ana & João', contact: '', createdAt: '2026-01-01T00:00:00Z' }
const sale = { id: 'v-1', date: '2026-01-01T00:00:00Z', items: [{ productId: 'p1', name: product.name, qty: 2, unitPrice: 8.5 }], payment: 'pix' as const, total: 17, channel: 'loja' as const, customerId: 'c1', status: 'Pendente' as const, paidAmount: 5 }
const before = { products: [product], sales: [], customers: [customer] }

test('detalhar um débito mantém a identificação que exige reversão pela área Pagamentos', () => {
  const detail = summarizeStoreChange({ ...before, sales: [{ ...sale, status: 'Debitado' }] }, { ...before, sales: [{ ...sale, status: 'Pago' }] }, 'Pagamento de débito: venda v-1 marcada como paga')
  assert.equal(isDebitAudit(detail), true)
  assert.match(detail, /Debitado→Pago/)
  assert.ok(detail.length <= 1000)
})

test('resume venda com itens, cliente, pagamento parcial e caracteres especiais', () => {
  const detail = summarizeSale(sale, { ...before, sales: [] })
  assert.match(detail, /v-1/)
  assert.match(detail, /2x Chocolate "especial"/)
  assert.match(detail, /Ana & João/)
  assert.match(detail, /R\$\s*17,00/)
  assert.match(detail, /recebido R\$\s*5,00/)
  assert.match(detail, /Pendente/)
})

test('descreve antes e depois de preço, estoque, venda e cliente', () => {
  const after = { products: [{ ...product, price: 9, stock: 8 }], sales: [sale], customers: [{ ...customer, name: 'Ana Silva' }] }
  const detail = summarizeStoreChange(before, after)
  assert.match(detail, /preço/)
  assert.match(detail, /estoque 10→8/)
  assert.match(detail, /Venda v-1/)
  assert.match(detail, /cliente Ana Silva cadastrado|cliente Ana & João renomeado para Ana Silva/)
})

test('não perde alterações isoladas de categoria, pagamento, itens ou contato', () => {
  const category = summarizeStoreChange(before, { ...before, products: [{ ...product, category: 'tradicional' }] })
  const payment = summarizeStoreChange({ ...before, sales: [sale] }, { ...before, sales: [{ ...sale, payment: 'cartão' }] })
  const items = summarizeStoreChange({ ...before, sales: [sale] }, { ...before, sales: [{ ...sale, items: [{ ...sale.items[0], qty: 1 }] }] })
  const contact = summarizeStoreChange(before, { ...before, customers: [{ ...customer, contact: '11999999999' }] })
  assert.match(category, /categoria/)
  assert.match(payment, /pagamento/)
  assert.match(items, /itens atualizados/)
  assert.match(contact, /contato atualizado/)
})

test('identifica exclusão e lote sem ultrapassar o limite', () => {
  const removed = summarizeStoreChange(before, { products: [], sales: [], customers: [] }, 'Lote importado')
  assert.match(removed, /removido/)
  const many = { ...before, products: Array.from({ length: 200 }, (_, index) => ({ ...product, id: `p${index}`, name: `Produto ${index} com nome longo` })) }
  assert.ok(summarizeStoreChange(before, many).length <= 1000)
  assert.match(summarizeStoreChange(before, many), /demais alterações omitidas/)
})

test('registra conta e cargo anterior e novo', () => {
  assert.equal(summarizeTeam('equipe@example.com', 'viewer', 'employee'), 'Acesso da conta equipe@example.com alterado: Sem cargo · somente leitura→Funcionário.')
})
