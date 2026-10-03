import test from 'node:test'
import assert from 'node:assert/strict'
import { act, create } from 'react-test-renderer'
import { CobrancaView } from '../src/views/Cobranca'
import { PasswordProvider } from '../src/components/PasswordGate'
import { setRole } from '../src/auth'
import type { Customer, Sale } from '../src/types'

const customerA: Customer = { id: 'ca', name: 'Ana Souza', contact: '', createdAt: '2026-09-01T12:00:00Z' }
const customerB: Customer = { id: 'cb', name: 'Bia Lima', contact: '', createdAt: '2026-09-01T12:00:00Z' }
const item = { productId: 'p', name: 'Cookie', qty: 1, unitPrice: 10 }
const sale = (id: string, customerId: string, total: number, status: Sale['status'], paidAmount?: number): Sale => ({
  id, date: '2026-09-10T12:00:00Z', customerId, items: [{ ...item, unitPrice: total }], total, paidAmount, status, payment: 'pix', channel: 'loja',
})
const text = (node: any): string => typeof node === 'string' ? node : (node.children || []).map(text).join('')

function renderBilling(sales: Sale[]) {
  setRole('owner')
  let root: any
  act(() => { root = create(<PasswordProvider><CobrancaView customers={[customerA, customerB]} sales={sales} pushToast={() => {}} onCustomerPayment={() => true} onSaleTransfer={() => true} /></PasswordProvider>) })
  return root
}

test('resumo global de cobrança aparece antes da busca e preserva parcial, grupos e vendas abertas', () => {
  const root = renderBilling([
    sale('partial', customerA.id, 10, 'Pendente', 2),
    sale('open', customerA.id, 5, 'Pendente', 0),
    sale('other', customerB.id, 7, 'Pendente', 0),
    sale('paid', customerA.id, 30, 'Pago', 30),
    sale('present', customerB.id, 40, 'Presente', 0),
  ])
  const overview = root.root.findByProps({ className: 'card cb-billing-overview' })
  const toolbar = root.root.findByProps({ className: 'card cb-billing-toolbar' })
  const children = overview.parent.children
  const overviewIndex = children.indexOf(overview)
  const toolbarIndex = children.indexOf(toolbar)
  assert.ok(overviewIndex >= 0)
  assert.ok(toolbarIndex >= 0)
  assert.ok(overviewIndex < toolbarIndex)
  assert.match(text(overview), /Todas as pendências/)
  assert.match(text(overview), /R\$\s*20,00/)
  assert.match(text(overview), /Clientes2/)
  assert.match(text(overview), /Vendas em aberto3/)

  act(() => { root.root.findByProps({ id: 'billing-search' }).props.onChange({ target: { value: 'Ana' } }) })
  assert.equal(root.root.findAllByType('article').length, 1)
  assert.match(text(root.root.findByProps({ className: 'card cb-billing-overview' })), /R\$\s*20,00/)
  assert.match(text(root.root.findByProps({ className: 'card cb-billing-overview' })), /Vendas em aberto3/)
  act(() => root.unmount())
})

test('resumo de cobrança mostra zero quando não há pendências exibíveis', () => {
  const root = renderBilling([sale('paid', customerA.id, 30, 'Pago', 30), sale('present', customerB.id, 40, 'Presente', 0)])
  const overview = root.root.findByProps({ className: 'card cb-billing-overview' })
  assert.match(text(overview), /R\$\s*0,00/)
  assert.match(text(overview), /Clientes0/)
  assert.match(text(overview), /Vendas em aberto0/)
  assert.match(text(root.root), /Nenhuma pendência encontrada/)
  act(() => root.unmount())
})
