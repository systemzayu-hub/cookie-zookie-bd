import { combineCustomers } from '../src/combine-customers'
import { mergeStore, SyncConflict } from '../src/store-merge'
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

test('dates default to today and selected dates are overridden only by explicit text headers', () => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  const automatic = parseText('Kinder - Nova Pessoa', products, [])[0]
  assert.equal(automatic.date, today)
  assert.equal(automatic.dateAutomatic, true)
  const result = parseText('Kinder - Primeira\n\n15/01\nKinder - Segunda\n16/01/25:\nKinder - Terceira', products, [], { date: '2025-01-10' })
  assert.deepEqual(result.map(line => line.date), ['2025-01-10', '2025-01-15', '2025-01-16'])
  assert.deepEqual(result.map(line => line.lineNum), [1, 4, 6])
  assert.deepEqual(result.map(line => line.dateAutomatic), [true, false, false])
  const relative = parseText('ontem\nKinder - Primeira\nhoje\nKinder - Segunda', products, [])
  assert.equal(relative[1].date, today)
  assert.equal(Date.parse(relative[1].date!) - Date.parse(relative[0].date!), 86_400_000)
})

test('paste supports optional quantities, x notation, full statuses, spreadsheet columns and hyphenated names', () => {
  const catalog = [...products, { ...products[0], id: 'ma', name: 'Meio Amargo' }]
  const result = parseText('Kinder - Ana-Maria - Pago\n2x Kinder - Bruno - D\n3 × Kinder - Carla - presente\n2\tKinder\tDaniel\tPendente\n1 Meio-Amargo - Ana-Maria - C\n2Meio-Amargo-Ana-Maria-C\nKinder - C', catalog, [], { status: 'Pago' })
  assert.deepEqual(result.map(line => line.error), Array(7).fill(null))
  assert.deepEqual(result.map(line => line.qty), [1, 2, 3, 2, 1, 2, 1])
  assert.deepEqual(result.map(line => line.status), ['Pago', 'Debitado', 'Presente', 'Pendente', 'Pago', 'Pago', 'Pago'])
  assert.equal(result[4].customerNameRaw, 'Ana-Maria')
  assert.equal(result[5].customerNameRaw, 'Ana-Maria')
  assert.equal(result[5].productId, 'ma')
  assert.equal(result[6].customerNameRaw, 'C')
  for (const code of ['--', '-', '—', 'presente', 'brinde']) assert.equal(parseText(`1 Kinder - Ana - ${code}`, products, [])[0].status, 'Presente')
  assert.ok(parseText('1\tKinder\tAna\tINVALIDO', products, [])[0].error)
})

test('ambiguous product names are not silently assigned to the first product', () => {
  const catalog = [{ ...products[0], name: 'Kinder branco' }, { ...products[0], id: 'p2', name: 'Kinder chocolate' }]
  assert.ok(parseText('Kinder - Ana', catalog, [])[0].error)
})

test('date and status defaults are shown before saving and per-line dates can be corrected', () => {
  setRole('owner')
  let root: any, payload: any
  act(() => { root = create(<PasswordProvider><QuickSaleView products={products} customers={[]} pushToast={() => {}} onSalesImported={(sales, customers) => { payload = { sales, customers }; return true }} /></PasswordProvider>) })
  act(() => root.root.findByProps({ id: 'import-default-date' }).props.onChange({ target: { value: '2026-09-03' } }))
  act(() => root.root.findByProps({ id: 'import-default-status' }).props.onChange({ target: { value: 'Pago' } }))
  act(() => root.root.findByType('textarea').props.onChange({ target: { value: 'Kinder - Nova Pessoa' } }))
  assert.match(label(root.root), /1 linha\(s\) de venda/)
  act(() => button(root, 'Processar texto').props.onClick())
  const dateInput = () => root.root.findByProps({ 'aria-label': 'Data da linha 1' })
  assert.equal(dateInput().props.value, '2026-09-03')
  act(() => dateInput().props.onChange({ target: { value: '' } }))
  assert.equal(button(root, 'Confirmar e criar').props.disabled, true)
  act(() => dateInput().props.onChange({ target: { value: '2026-09-04' } }))
  act(() => button(root, 'Confirmar e criar').props.onClick())
  assert.equal(payload.sales[0].date, '2026-09-04T15:00:00.000Z')
  assert.equal(payload.sales[0].status, 'Pago')
  assert.equal(payload.sales[0].paidAmount, 10)
  act(() => root.unmount())
})

test('sales draft survives unmount and reload, stays scoped to the account, and clears after import', () => {
  setRole('owner')
  const key = 'draft-persistence-test'
  let root: any, payload: any
  const mount = (draftKey = key) => act(() => { root = create(<PasswordProvider><QuickSaleView draftKey={draftKey} products={products} customers={[]} pushToast={() => {}} onSalesImported={(sales, customers) => { payload = { sales, customers }; return true }} /></PasswordProvider>) })
  mount()
  act(() => root.root.findByType('textarea').props.onChange({ target: { value: 'Kinder - Minha Lista' } }))
  act(() => root.root.findByProps({ id: 'import-default-date' }).props.onChange({ target: { value: '2026-09-02' } }))
  act(() => root.root.findByProps({ id: 'import-default-status' }).props.onChange({ target: { value: 'Pago' } }))
  assert.equal(JSON.parse(localStorage.getItem(key)!).text, 'Kinder - Minha Lista')
  act(() => root.unmount())
  mount('draft-other-account')
  assert.equal(root.root.findByType('textarea').props.value, '')
  act(() => root.unmount())
  mount()
  assert.equal(root.root.findByType('textarea').props.value, 'Kinder - Minha Lista')
  assert.equal(root.root.findByProps({ id: 'import-default-date' }).props.value, '2026-09-02')
  assert.equal(root.root.findByProps({ id: 'import-default-status' }).props.value, 'Pago')
  act(() => root.root.findByType('textarea').props.onChange({ target: { value: 'Kinder - Minha Lista\n2 Kinder - Minha Lista' } }))
  act(() => button(root, 'Processar texto').props.onClick())
  act(() => root.unmount())
  mount()
  assert.match(root.root.findByType('textarea').props.value, /2 Kinder/)
  act(() => button(root, 'Processar texto').props.onClick())
  act(() => button(root, 'Confirmar e criar').props.onClick())
  assert.equal(payload.sales[0].total, 30)
  assert.equal(JSON.parse(localStorage.getItem(key)!).text, '')
  act(() => root.unmount())
  mount()
  assert.equal(root.root.findByType('textarea').props.value, '')
  act(() => root.unmount())
})

test('failed import preserves the saved draft for retry', () => {
  setRole('owner')
  let root: any
  const key = 'draft-failed-import'
  act(() => { root = create(<PasswordProvider><QuickSaleView draftKey={key} products={products} customers={[]} pushToast={() => {}} onSalesImported={() => false} /></PasswordProvider>) })
  act(() => root.root.findByType('textarea').props.onChange({ target: { value: 'Kinder - Minha Lista' } }))
  act(() => button(root, 'Processar texto').props.onClick())
  act(() => button(root, 'Confirmar e criar').props.onClick())
  assert.equal(JSON.parse(localStorage.getItem(key)!).text, 'Kinder - Minha Lista')
  act(() => root.unmount())
})

test('single-letter product aliases work in either case without matching unrelated products', () => {
  const catalog = ['Nutella', 'Kinder', 'Tradicional', 'Meio Amargo'].map((name, index) => ({ ...products[0], id: String(index), name }))
  for (const [alias, name] of [['n', 'Nutella'], ['k', 'Kinder'], ['t', 'Tradicional'], ['m', 'Meio Amargo'], ['ma', 'Meio Amargo']]) {
    for (const token of [alias, alias.toUpperCase(), alias + '.']) {
      const line = parseText(`2 ${token} - Marcos - C`, catalog, [])[0]
      assert.equal(line.productNameMatched, name)
      assert.equal(line.qty, 2)
      assert.equal(line.customerNameRaw, 'Marcos')
      assert.equal(line.status, 'Pago')
      assert.equal(line.error, null)
    }
  }
  assert.equal(parseText('2n-Marcos-C', catalog, [])[0].productNameMatched, 'Nutella')
  assert.ok(parseText('2 n - Marcos - C', [products[0]], [])[0].error)
})

test('combining customers reassigns all history without changing amounts, payments, dates or stock', () => {
  const source = customer('source', 'Marcus F'), target = customer('target', 'Marcus')
  const statuses = ['Pago', 'Pendente', 'Debitado', 'Presente'] as const
  const sales = statuses.map((status, i) => ({ ...sale, id: 'merge-' + i, customerId: source.id, status, paidAmount: 5 }))
  const data = { products, customers: [source, target, customers[0]], sales: [...sales, sale] }
  const snapshot = JSON.stringify(data)
  const combined = combineCustomers(data, { source, target, contact: '(11) 99999-0000' })
  assert.equal(combined.customers.length, 2)
  assert.equal(combined.customers.find(c => c.id === target.id)?.name, 'Marcus')
  assert.equal(combined.customers.find(c => c.id === target.id)?.contact, '(11) 99999-0000')
  assert.deepEqual(combined.sales, [...sales.map(s => ({ ...s, customerId: target.id })), sale])
  assert.deepEqual(combined.products, products)
  assert.equal(JSON.stringify(data), snapshot)
  assert.throws(() => combineCustomers(data, { source, target: source, contact: '' }))
  assert.throws(() => combineCustomers({ ...data, customers: [target] }, { source, target, contact: '' }))
  assert.throws(() => combineCustomers(data, { source: { ...source, name: 'changed' }, target, contact: '' }))
})

test('sync rejects a customer combination racing with a new sale for the removed customer', () => {
  const source = customer('source', 'Marcus F'), target = customer('target', 'Marcus')
  const base = { products, customers: [source, target], sales: [] }
  const local = combineCustomers(base, { source, target, contact: '' })
  const remote = { ...base, sales: [{ ...sale, customerId: source.id }] }
  assert.throws(() => mergeStore(base, local, remote), SyncConflict)
  assert.throws(() => mergeStore(base, remote, local), SyncConflict)
})

test('renaming to an existing client asks before combining and requires choosing between different phones', () => {
  setRole('owner')
  const source = { ...customer('source', 'Marcus F'), contact: '(11) 99999-0000' }
  const target = { ...customer('target', 'Marcus'), contact: '(11) 98888-0000' }
  let root: any, request: any, renamed = false
  act(() => { root = create(<PasswordProvider><CustomersView customers={[source, target]} sales={[{ ...sale, customerId: source.id }]} setCustomers={() => { renamed = true }} pushToast={() => {}} onCustomersCombined={value => { request = value; return true }} /></PasswordProvider>) })
  act(() => root.root.findByProps({ 'aria-label': 'Editar Marcus F' }).props.onClick())
  act(() => root.root.findByProps({ placeholder: 'Nome do cliente' }).props.onChange({ target: { value: 'Marcus' } }))
  act(() => button(root, 'Salvar').props.onClick())
  assert.equal(renamed, false)
  assert.equal(request, undefined)
  assert.ok(label(root.root).includes('Tem certeza de que quer combinar clientes?'))
  assert.equal(button(root, 'Só renomear'), undefined)
  assert.equal(button(root, 'Sim, combinar clientes').props.disabled, true)
  act(() => root.root.findByProps({ name: 'merge-customer' }).props.onChange())
  assert.equal(button(root, 'Sim, combinar clientes').props.disabled, true)
  act(() => root.root.findAllByProps({ name: 'merge-phone' })[1].props.onChange())
  act(() => button(root, 'Sim, combinar clientes').props.onClick())
  assert.equal(request.source.id, source.id)
  assert.equal(request.target.id, target.id)
  assert.equal(request.contact, source.contact)
  assert.equal(root.root.findAllByProps({ 'aria-label': 'Combinar clientes' }).length, 0)
  act(() => root.unmount())
})

test('similar rename can be cancelled or saved without combining; reverse exact rename also prompts', () => {
  setRole('owner')
  const source = customer('source', 'Marcus'), target = customer('target', 'Marcus F')
  let root: any, renamed: any, combined = false
  act(() => { root = create(<PasswordProvider><CustomersView customers={[source, target]} sales={[]} setCustomers={update => { renamed = typeof update === 'function' ? update([source, target]) : update }} pushToast={() => {}} onCustomersCombined={() => { combined = true; return true }} /></PasswordProvider>) })
  act(() => root.root.findByProps({ 'aria-label': 'Editar Marcus' }).props.onClick())
  act(() => root.root.findByProps({ placeholder: 'Nome do cliente' }).props.onChange({ target: { value: 'Marcus F' } }))
  act(() => button(root, 'Salvar').props.onClick())
  assert.ok(label(root.root).includes('Tem certeza de que quer combinar clientes?'))
  act(() => button(root, 'Voltar à edição').props.onClick())
  assert.equal(renamed, undefined)
  act(() => root.root.findByProps({ placeholder: 'Nome do cliente' }).props.onChange({ target: { value: 'Marcus G' } }))
  act(() => button(root, 'Salvar').props.onClick())
  act(() => button(root, 'Só renomear').props.onClick())
  assert.equal(renamed[0].name, 'Marcus G')
  assert.equal(renamed.length, 2)
  assert.equal(combined, false)
  act(() => root.unmount())
})
