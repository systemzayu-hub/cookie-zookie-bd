import test from 'node:test'
import assert from 'node:assert/strict'
import { act, create } from 'react-test-renderer'
import { customerCandidates } from '../src/customer-matching'
import { recordSalesBatch } from '../src/record-sale'
import { QuickSaleView, parseText } from '../src/views/QuickSale'
import { CustomersView } from '../src/views/Customers'
import { CobrancaView } from '../src/views/Cobranca'
import { PasswordProvider } from '../src/components/PasswordGate'
import { setRole } from '../src/auth'
import type { Customer, Sale } from '../src/types'

const products = [{ id: 'p', name: 'Kinder', stock: 20, price: 10, category: 'kinder' }]
const customer = (id: string, name: string): Customer => ({ id, name, contact: '', createdAt: '2026-09-01T12:00:00Z' })
const customers = [customer('a', 'João Silva'), customer('b', 'Joana Silva'), customer('c', 'Lara 2°'), customer('d', 'Lara 1°')]
const sale: Sale = { id: 's', date: '2026-09-08T12:00:00Z', customerId: 'a', items: [{ productId: 'p', name: 'Kinder', qty: 2, unitPrice: 10 }], total: 20, status: 'Pendente', payment: 'pix', channel: 'loja' }
const label = (node: any): string => typeof node === 'string' ? node : (node.children || []).map(label).join('')
const button = (root: any, text: string) => root.root.findAllByType('button').find((node: any) => label(node).includes(text))

test('customer suggestions handle accents, spaces, typos, partial names and retain class identifiers', () => {
  assert.equal(customerCandidates('  JOAO  SILVA ', customers)[0].id, 'a')
  assert.equal(customerCandidates('Joo Silva', customers)[0].id, 'a')
  assert.equal(customerCandidates('Lara', customers).length, 2)
  assert.equal(customerCandidates('Lara 2°', customers)[0].id, 'c')
  assert.deepEqual(customerCandidates('Pessoa Inédita', customers), [])
  assert.deepEqual(customerCandidates('A', customers), [])
})

test('paste defaults new names to creation and requires a choice for similar or duplicate names', () => {
  assert.equal(parseText('1 Kinder - Pessoa Inédita', products, customers)[0].customerChoice, 'new')
  assert.equal(parseText('1 Kinder - Lara', products, customers)[0].customerChoice, '')
  assert.equal(parseText('1 Kinder - Joo Silva', products, customers)[0].customerChoice, '')
  assert.equal(parseText('1 Kinder - João Silva', products, [customers[0]])[0].customerChoice, 'a')
  assert.equal(parseText('1 Kinder - João Silva', products, [customers[0], customer('duplicate', 'João Silva')])[0].customerChoice, '')
  assert.ok(parseText('0 Kinder - Pessoa Inédita', products, customers)[0].error)
})

test('batch creates customers, links sales and decrements stock atomically; failures keep source intact', () => {
  const source = { products, customers: [], sales: [] }
  const result = recordSalesBatch(source, [sale], [customers[0]])
  assert.equal(result.customers[0].contact, '')
  assert.equal(result.sales[0].customerId, 'a')
  assert.equal(result.products[0].stock, 18)
  assert.throws(() => recordSalesBatch(source, [sale, { ...sale, id: 's2', items: [{ ...sale.items[0], qty: 20 }], total: 200 }], [customers[0]]))
  assert.throws(() => recordSalesBatch(source, [sale, sale], [customers[0]]))
  assert.throws(() => recordSalesBatch(source, [sale], []))
  assert.equal(source.products[0].stock, 20)
  assert.equal(source.sales.length, 0)
  assert.equal(source.customers.length, 0)
})

test('paste UI creates a single customer for repeated names and does not resubmit on a double click', () => {
  setRole('owner')
  let payload: any, calls = 0, root: any
  act(() => { root = create(<PasswordProvider><QuickSaleView products={products} customers={[]} pushToast={() => {}} onSalesImported={(sales, customers) => { calls++; payload = { sales, customers }; return true }} /></PasswordProvider>) })
  act(() => root.root.findByType('textarea').props.onChange({ target: { value: '08/09/2026\n1 Kinder - Pessoa Nova\n2 Kinder - pessoa nova' } }))
  act(() => button(root, 'Processar texto').props.onClick())
  assert.equal(calls, 0)
  const confirm = button(root, 'Confirmar e criar')
  assert.equal(confirm.props.disabled, false)
  act(() => { confirm.props.onClick(); confirm.props.onClick() })
  assert.equal(calls, 1)
  assert.equal(payload.customers.length, 1)
  assert.equal(payload.customers[0].name, 'Pessoa Nova')
  assert.equal(payload.customers[0].contact, '')
  assert.equal(payload.sales.length, 1)
  assert.equal(payload.sales[0].customerId, payload.customers[0].id)
  assert.equal(payload.sales[0].total, 30)
  act(() => root.unmount())
})

test('paste UI applies ambiguous choice to repeated names, including create-new option', () => {
  setRole('owner')
  let payload: any, root: any
  act(() => { root = create(<PasswordProvider><QuickSaleView products={products} customers={customers} pushToast={() => {}} onSalesImported={(sales, customers) => { payload = { sales, customers }; return true }} /></PasswordProvider>) })
  act(() => root.root.findByType('textarea').props.onChange({ target: { value: '1 Kinder - Lara\n1 Kinder - Lara' } }))
  act(() => button(root, 'Processar texto').props.onClick())
  assert.equal(button(root, 'Confirmar e criar').props.disabled, true)
  const newChoice = root.root.findAllByType('label').find((node: any) => label(node).includes('Criar novo cliente: Lara'))
  act(() => newChoice.findByType('input').props.onChange())
  assert.equal(button(root, 'Confirmar e criar').props.disabled, false)
  const existingChoice = root.root.findAllByType('label').find((node: any) => label(node).includes('Lara 2°'))
  act(() => existingChoice.findByType('input').props.onChange())
  act(() => button(root, 'Confirmar e criar').props.onClick())
  assert.equal(payload.customers.length, 0)
  assert.equal(payload.sales[0].customerId, 'c')
  assert.equal(payload.sales[0].total, 20)
  act(() => root.unmount())
})

test('paste rejects bad dates and aggregate stock shortages before creating customers', () => {
  setRole('owner')
  for (const value of ['31/02/2026\n1 Kinder - Pessoa Nova', '15 Kinder - Pessoa Nova\n10 Kinder - Pessoa Nova']) {
    let root: any, called = false, message = ''
    act(() => { root = create(<PasswordProvider><QuickSaleView products={products} customers={[]} pushToast={text => { message = text }} onSalesImported={() => { called = true; return true }} /></PasswordProvider>) })
    act(() => root.root.findByType('textarea').props.onChange({ target: { value } }))
    act(() => button(root, 'Processar texto').props.onClick())
    act(() => button(root, 'Confirmar e criar').props.onClick())
    assert.equal(called, false)
    assert.ok(message.includes('datas') || message.includes('Estoque'))
    act(() => root.unmount())
  }
})

test('customer form saves without phone and still rejects incomplete supplied numbers', () => {
  setRole('owner')
  let root: any, saved: Customer[] = [], message = ''
  act(() => { root = create(<PasswordProvider><CustomersView customers={[]} sales={[]} setCustomers={update => { saved = typeof update === 'function' ? update(saved) : update }} pushToast={text => { message = text }} /></PasswordProvider>) })
  act(() => button(root, 'Novo Cliente').props.onClick())
  act(() => root.root.findByProps({ placeholder: 'Nome do cliente' }).props.onChange({ target: { value: 'Pessoa Nova' } }))
  act(() => root.root.findByProps({ placeholder: '(11) 99999-0000' }).props.onChange({ target: { value: '1199' } }))
  act(() => button(root, 'Adicionar').props.onClick())
  assert.equal(saved.length, 0)
  assert.match(message, /telefone válido/)
  act(() => root.root.findByProps({ placeholder: '(11) 99999-0000' }).props.onChange({ target: { value: '' } }))
  act(() => button(root, 'Adicionar').props.onClick())
  assert.equal(saved.length, 1)
  assert.equal(saved[0].contact, '')
  act(() => root.unmount())
})

test('billing search filters names without accents and restores cards when cleared', () => {
  let root: any
  act(() => { root = create(<PasswordProvider><CobrancaView customers={customers} sales={[sale, { ...sale, id: 's2', customerId: 'c' }]} setSales={() => {}} pushToast={() => {}} /></PasswordProvider>) })
  assert.equal(root.root.findAllByType('article').length, 2)
  act(() => root.root.findByProps({ id: 'billing-search' }).props.onChange({ target: { value: ' JOAO ' } }))
  assert.equal(root.root.findAllByType('article').length, 1)
  assert.ok(label(root.root.findByType('article')).includes('João Silva'))
  act(() => root.root.findByProps({ id: 'billing-search' }).props.onChange({ target: { value: 'Não existe' } }))
  assert.equal(root.root.findAllByType('article').length, 0)
  assert.ok(label(root.root).includes('Nenhum cliente encontrado'))
  act(() => root.root.findByProps({ id: 'billing-search' }).props.onChange({ target: { value: '' } }))
  assert.equal(root.root.findAllByType('article').length, 2)
  act(() => root.unmount())
})
