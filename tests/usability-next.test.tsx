import test from 'node:test'
import assert from 'node:assert/strict'
import { act, create } from 'react-test-renderer'
import { renderToStaticMarkup } from 'react-dom/server'
import { CobrancaView } from '../src/views/Cobranca'
import { SalesView } from '../src/views/Sales'
import { PasswordProvider } from '../src/components/PasswordGate'
import { CustomerProfile, dateLabel } from '../src/components/CustomerProfile'
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

test('manual sale product rows expose the name and price and keep the selected id', () => {
  setRole('owner')
  let root: any
  act(() => { root = create(<PasswordProvider><SalesView products={[product, secondProduct]} customers={[]} sales={[]} onSaleAdded={() => true} onSaleDeleted={async () => true} onSaleEdited={async () => {}} onSalesImported={() => true} pushToast={() => {}} /></PasswordProvider>) })
  let select = root.root.findAllByType('select').find((node: any) => node.props.value === product.id)
  assert.ok(select)
  const firstOption = select.findAllByType('option').find((node: any) => node.props.value === product.id)
  assert.match(label(firstOption), /Chocolate/)
  assert.match(label(firstOption), /10,00/)
  assert.doesNotMatch(label(firstOption), /Estoque:/)

  const search = root.root.findByProps({ 'aria-label': 'Buscar produto' })
  act(() => { search.props.onChange({ target: { value: 'red velvet' } }) })
  select = root.root.findAllByType('select').find((node: any) => node.props.value === product.id)
  assert.equal(select.props.value, product.id)
  assert.deepEqual(select.findAllByType('option').map((node: any) => node.props.value), ['', product.id, secondProduct.id])

  act(() => { select.props.onChange({ target: { value: secondProduct.id } }) })
  assert.equal(root.root.findAllByType('select').find((node: any) => node.props.value === secondProduct.id)?.props.value, secondProduct.id)
  act(() => { root.unmount() })
})

test('partial billing rejects values above the group balance before invoking the payment callback', async () => {
  setRole('owner')
  let root: any
  const requests: any[] = []
  const messages: string[] = []
  act(() => { root = create(<PasswordProvider><CobrancaView customers={[customer]} sales={[pendingSale()]} setSales={() => {}} pushToast={message => messages.push(message)} onCustomerPayment={request => { requests.push(request); return true }} onSaleTransfer={() => true} /></PasswordProvider>) })
  act(() => { root.root.findByType('article').findAllByProps({ role: 'button' })[0].props.onClick() })
  const input = root.root.findByProps({ 'aria-label': `Valor parcial para ${customer.name}` })
  act(() => { input.props.onChange({ target: { value: '10,01' } }) })
  const submit = () => { root.root.findAllByType('button').find((button: any) => label(button).includes('Descontar')).props.onClick({ stopPropagation() {} }) }
  act(() => { submit() })
  assert.equal(requests.length, 0)
  assert.match(messages[messages.length - 1] || '', /10,00/)

  act(() => { input.props.onChange({ target: { value: '3,501' } }) })
  act(() => { submit() })
  assert.equal(requests.length, 0)
  assert.match(messages[messages.length - 1] || '', /duas casas/)

  act(() => { input.props.onChange({ target: { value: '3,50' } }) })
  await act(async () => { submit(); await Promise.resolve() })
  const confirm = root.root.findAllByType('button').find((button: any) => label(button).trim() === 'Confirmar')
  assert.ok(confirm)
  await act(async () => { confirm.props.onClick(); await Promise.resolve() })
  assert.equal(requests.length, 1)
  assert.equal(requests[0].amount, 3.5)
  assert.equal(requests[0].payment, 'pix')
  assert.match(requests[0].date, /^\d{4}-\d{2}-\d{2}$/)
  assert.equal(typeof requests[0].receiptId, 'string')
  act(() => { root.unmount() })
})

test('recebimento aguarda resposta, bloqueia duplo clique e reaproveita receiptId no retry', async () => {
  setRole('owner')
  let root: any
  let resolvePayment: ((accepted: boolean) => void) | undefined
  const requests: any[] = []
  const render = () => <PasswordProvider><CobrancaView customers={[customer]} sales={[pendingSale()]} setSales={() => {}} pushToast={() => {}} onCustomerPayment={request => { requests.push(request); return new Promise<boolean>(resolve => { resolvePayment = resolve }) }} onSaleTransfer={() => true} /></PasswordProvider>
  act(() => { root = create(render()) })
  act(() => { root.root.findByType('article').findAllByProps({ role: 'button' })[0].props.onClick() })
  const input = root.root.findByProps({ 'aria-label': `Valor parcial para ${customer.name}` })
  act(() => { input.props.onChange({ target: { value: '3,50' } }) })
  const submit = () => { root.root.findAllByType('button').find((button: any) => label(button).includes('Descontar')).props.onClick() }
  await act(async () => { submit(); await Promise.resolve() })
  const confirm = root.root.findAllByType('button').find((button: any) => label(button).trim() === 'Confirmar')
  await act(async () => { confirm.props.onClick(); await Promise.resolve() })
  assert.equal(requests.length, 1)
  const firstReceiptId = requests[0].receiptId
  assert.equal(typeof firstReceiptId, 'string')
  assert.equal(root.root.findByProps({ 'aria-label': `Valor parcial para ${customer.name}` }).props.disabled, true)
  const pendingSubmit = root.root.findAllByType('button').find((button: any) => label(button).includes('Descontar'))
  assert.equal(pendingSubmit.props.disabled, true)
  act(() => { pendingSubmit.props.onClick() })
  assert.equal(requests.length, 1)
  resolvePayment?.(false)
  await act(async () => { await Promise.resolve() })
  assert.equal(root.root.findByProps({ 'aria-label': `Valor parcial para ${customer.name}` }).props.disabled, false)
  await act(async () => { submit(); await Promise.resolve() })
  const retryConfirm = root.root.findAllByType('button').find((button: any) => label(button).trim() === 'Confirmar')
  await act(async () => { retryConfirm.props.onClick(); await Promise.resolve() })
  assert.equal(requests.length, 2)
  assert.equal(requests[1].receiptId, firstReceiptId)
  resolvePayment?.(true)
  await act(async () => { await Promise.resolve() })
  assert.equal(root.root.findByProps({ 'aria-label': `Valor parcial para ${customer.name}` }).props.value, '')
  act(() => { root.unmount() })
})

test('ficha separa débito e preserva datas civis sem deslocamento de fuso', () => {
  const debit = pendingSale({ id: 'debit', date: '2026-10-01', total: 12, status: 'Debitado', paidAmount: 0 })
  assert.equal(dateLabel('2026-10-01'), '01/10/2026')
  assert.equal(dateLabel('data inválida'), 'Data não informada')
  const html = renderToStaticMarkup(<CustomerProfile customer={customer} sales={[debit]} onClose={() => {}} />)
  assert.match(html, /01\/10\/2026/)
  assert.match(html, /Debitado · conferir em Pagamentos/)
  assert.match(html, /sem entrar como recebido/)
  assert.match(html, /<small>Debitado<\/small>/)
  const withoutDebit = renderToStaticMarkup(<CustomerProfile customer={customer} sales={[pendingSale()]} onClose={() => {}} />)
  assert.doesNotMatch(withoutDebit, /<small>Debitado<\/small>/)
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
