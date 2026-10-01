import test from 'node:test'
import assert from 'node:assert/strict'
import { act, create } from 'react-test-renderer'
import { CobrancaView } from '../src/views/Cobranca'
import { SalesView } from '../src/views/Sales'
import { PasswordProvider } from '../src/components/PasswordGate'
import { setRole } from '../src/auth'
import type { Customer, Product, Sale } from '../src/types'

const product: Product = { id: 'p1', name: 'Chocolate', price: 10, stock: 8, category: 'tradicional', emoji: '🍪' }
const secondProduct: Product = { id: 'p2', name: 'Red Velvet', price: 12, stock: 24, category: 'especial', emoji: '❤️' }
const customer: Customer = { id: 'c1', name: 'Ana Souza', contact: '', createdAt: '2026-09-01T12:00:00Z' }
const pendingSale = (changes: Partial<Sale> = {}): Sale => ({
  id: 's1', date: '2026-09-10T12:00:00Z', customerId: customer.id,
  items: [{ productId: product.id, name: product.name, qty: 1, unitPrice: product.price }],
  total: 10, paidAmount: 0, status: 'Pendente', payment: 'pix', channel: 'loja', ...changes,
})
const label = (node: any): string => typeof node === 'string' ? node : (node.children || []).map(label).join('')

test('manual sale product rows expose searchable price and stock and keep the selected id', () => {
  setRole('owner')
  let root: any
  act(() => { root = create(<PasswordProvider><SalesView products={[product, secondProduct]} customers={[]} sales={[]} onSaleAdded={() => true} onSaleDeleted={async () => true} onSaleEdited={async () => {}} onSalesImported={() => true} pushToast={() => {}} /></PasswordProvider>) })
  let select = root.root.findAllByType('select').find((node: any) => node.props.value === product.id)
  assert.ok(select)
  const firstOption = select.findAllByType('option').find((node: any) => node.props.value === product.id)
  assert.match(label(firstOption), /Chocolate/)
  assert.match(label(firstOption), /10,00/)
  assert.match(label(firstOption), /Estoque: 8/)

  const search = root.root.findByProps({ 'aria-label': 'Buscar produto' })
  act(() => { search.props.onChange({ target: { value: 'red velvet' } }) })
  select = root.root.findAllByType('select').find((node: any) => node.props.value === product.id)
  assert.equal(select.props.value, product.id)
  assert.deepEqual(select.findAllByType('option').map((node: any) => node.props.value), ['', product.id, secondProduct.id])

  act(() => { select.props.onChange({ target: { value: secondProduct.id } }) })
  assert.equal(root.root.findAllByType('select').find((node: any) => node.props.value === secondProduct.id)?.props.value, secondProduct.id)
  act(() => { root.unmount() })
})

test('partial billing rejects values above the group balance before invoking the payment callback', () => {
  setRole('owner')
  let root: any
  const requests: any[] = []
  const messages: string[] = []
  act(() => { root = create(<PasswordProvider><CobrancaView customers={[customer]} sales={[pendingSale()]} setSales={() => {}} pushToast={message => messages.push(message)} onCustomerPayment={request => { requests.push(request); return true }} onSaleTransfer={() => true} /></PasswordProvider>) })
  act(() => { root.root.findByType('article').findAllByProps({ role: 'button' })[0].props.onClick() })
  const input = root.root.findByProps({ 'aria-label': `Valor parcial para ${customer.name}` })
  act(() => { input.props.onChange({ target: { value: '10,01' } }) })
  const submit = () => { root.root.findAllByType('button').find((button: any) => label(button).includes('Descontar')).props.onClick({ stopPropagation() {} }) }
  act(submit)
  assert.equal(requests.length, 0)
  assert.match(messages[messages.length - 1] || '', /10,00/)

  act(() => { input.props.onChange({ target: { value: '3,501' } }) })
  act(submit)
  assert.equal(requests.length, 0)
  assert.match(messages[messages.length - 1] || '', /duas casas/)

  act(() => { input.props.onChange({ target: { value: '3,50' } }) })
  act(submit)
  assert.equal(requests.length, 1)
  assert.equal(requests[0].amount, 3.5)
  act(() => { root.unmount() })
})

test('quitar tudo confirms the customer context, leaves cancellation untouched, and rejects stale pending sales', async () => {
  setRole('owner')
  let root: any
  let currentSales = [pendingSale()]
  const requests: any[] = []
  const messages: string[] = []
  const render = () => <PasswordProvider><CobrancaView customers={[customer]} sales={currentSales} setSales={() => {}} pushToast={message => messages.push(message)} onCustomerPayment={request => { requests.push(request); return true }} onSaleTransfer={() => true} /></PasswordProvider>
  act(() => { root = create(render()) })
  act(() => { root.root.findAllByType('button').find((button: any) => label(button).includes('Quitar tudo')).props.onClick({ stopPropagation() {} }) })
  assert.match(label(root.root), /Ana Souza/)
  assert.match(label(root.root), /10,00/)
  assert.match(label(root.root), /1 venda/)
  const cancel = root.root.findAllByType('button').find((button: any) => label(button).trim() === 'Cancelar')
  assert.ok(cancel)
  act(() => { cancel.props.onClick() })
  assert.equal(requests.length, 0)

  act(() => { root.root.findAllByType('button').find((button: any) => label(button).includes('Quitar tudo')).props.onClick({ stopPropagation() {} }) })
  currentSales = [pendingSale({ total: 11 })]
  act(() => { root.update(render()) })
  const confirm = root.root.findAllByType('button').find((button: any) => label(button).trim() === 'Confirmar')
  assert.ok(confirm)
  await act(async () => { confirm.props.onClick(); await Promise.resolve() })
  assert.equal(requests.length, 0)
  assert.match(messages[messages.length - 1] || '', /pendências mudaram/)

  act(() => { root.root.findAllByType('button').find((button: any) => label(button).includes('Quitar tudo')).props.onClick({ stopPropagation() {} }) })
  const validConfirm = root.root.findAllByType('button').find((button: any) => label(button).trim() === 'Confirmar')
  assert.ok(validConfirm)
  await act(async () => { validConfirm.props.onClick(); await Promise.resolve() })
  assert.equal(requests.length, 1)
  assert.equal(requests[0].amount, 11)
  assert.equal(requests[0].sales[0].total, 11)
  act(() => { root.unmount() })
})
