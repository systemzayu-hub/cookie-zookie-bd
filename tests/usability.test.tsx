import test from 'node:test'
import assert from 'node:assert/strict'
import { act, create } from 'react-test-renderer'
import { renderToStaticMarkup } from 'react-dom/server'
import { matchesSearch } from '../src/search'
import { SearchableSelect } from '../src/components/SearchableSelect'
import { ProductsView } from '../src/views/Products'
import { PaymentList } from '../src/views/Payments'
import { changeDebit, type DebitChange } from '../src/debit-change'
import { salePaidAmount } from '../src/types'
import { PasswordProvider } from '../src/components/PasswordGate'
import { salesCSV } from '../src/views/Reports'
import { aplicarBackup, exportarDados } from '../src/db'

test('name searches ignore accents, word order and spacing and match unformatted phones', () => {
  assert.equal(matchesSearch('silva joao', 'João da Silva'), true)
  assert.equal(matchesSearch('  JOAO   farinha ', 'João', 'Farinha de trigo'), true)
  assert.equal(matchesSearch('85992343066', 'João', '(85) 99234-3066'), true)
  assert.equal(matchesSearch('João chocolate', 'João', 'Farinha'), false)
  assert.equal(matchesSearch('  ', undefined), true)
})
test('searching a select preserves its chosen customer when another name is searched', () => {
  let root: any
  act(() => { root = create(<SearchableSelect label="Cliente" value="a" onChange={() => {}} options={[{id:'a',name:'João'},{id:'b',name:'Lara'}]} />) })
  act(() => root.root.findByType('input').props.onChange({target:{value:'lara'}}))
  assert.equal(root.root.findByType('select').props.value, 'a')
  assert.deepEqual(root.root.findAllByType('option').map((option: any) => option.props.value), ['', 'a', 'b'])
  act(() => root.unmount())
})
test('combo seleciona a primeira opção com teclado, anuncia foco e mostra o nome escolhido', () => {
  let root: any
  let selected = ''
  const render = () => <SearchableSelect label="Cliente" value={selected} onChange={value => { selected = value }} options={[{ id: 'a', name: 'João' }, { id: 'b', name: 'Lara' }]} required />
  act(() => { root = create(render()) })
  let input = root.root.findByType('input')
  assert.equal(input.props.value, '')
  act(() => { input.props.onKeyDown({ key: 'ArrowDown', preventDefault() {} }) })
  input = root.root.findByType('input')
  const options = root.root.findAllByProps({ role: 'option' })
  assert.equal(input.props['aria-activedescendant'], options[0].props.id)
  assert.equal(options[0].props.className, 'is-active')
  act(() => { input.props.onKeyDown({ key: 'Enter', preventDefault() {} }) })
  assert.equal(selected, 'a')
  act(() => { root.update(render()) })
  input = root.root.findByType('input')
  assert.equal(input.props.value, 'João')
  assert.equal(input.props['aria-expanded'], false)
  assert.equal(input.props.required, true)
  assert.equal(input.props['aria-required'], true)
  assert.equal(root.root.findByType('select').props.required, false)
  act(() => root.unmount())
})
test('renaming an existing product to a known flavor preserves its custom selling price', () => {
  let root: any
  const product = {id:'p',name:'Chocolate',category:'especial',price:12.75,stock:5}
  act(() => {root = create(<PasswordProvider><ProductsView products={[product]} sales={[]} setProducts={() => {}} pushToast={() => {}} /></PasswordProvider>)})
  const edit = root.root.findAllByType('button').find((button: any) => button.props.children?.some?.((child: any) => child === ' Editar'))
  act(() => edit.props.onClick())
  act(() => root.root.findByProps({'aria-label':'Nome do cookie'}).props.onChange({target:{value:'Nutella'}}))
  assert.equal(root.root.findByProps({'aria-label':'Preço (R$)'}).props.value, '12.75')
  act(() => root.unmount())
})
test('archived payment history has no inert edit or delete controls', () => {
  const html = renderToStaticMarkup(<PaymentList title="Excluídos" empty="Vazio" cash rows={[{id:'p',date:'2026-10-01',person:'Teste',description:'Registro',amount:10}]} />)
  assert.doesNotMatch(html, /<button/)
  assert.doesNotMatch(html, /<th>Ações/)
  assert.match(html, /01\/10\/2026/)
})
const sale = {id:'s', date:'2026-10-01T13:00:00Z', customerId:'c', items:[{productId:'p',name:'Cookie',qty:2,unitPrice:6}], total:12, status:'Debitado' as const, payment:'pix' as const, channel:'loja' as const}
const store = {products:[{id:'p',name:'Cookie',category:'tradicional',price:6,stock:10}],customers:[{id:'c',name:'João',contact:'',createdAt:sale.date}],sales:[sale]}
const request: DebitChange = {sale,payment:{id:'pay',date:'2026-10-01',amount:12,person:'João',description:'Cookie',quantity:2,kind:'cookie',status:'paid',sourceSaleId:'s'},reopen:false,operationId:'v2-00000000-0000-4000-8000-000000000000'}
test('settling and reopening a debit preserve stock and sale values and clear received money', () => {
  const settled = changeDebit(store, request)
  assert.equal(salePaidAmount(settled.store.sales[0]),12)
  const reopened = changeDebit(settled.store, {...request,sale:settled.store.sales[0],payment:settled.payment,reopen:true})
  assert.equal(salePaidAmount(reopened.store.sales[0]),0)
  assert.equal(reopened.store.sales[0].items[0].paid,false)
  assert.equal(reopened.payment.archived,true)
  assert.deepEqual(reopened.store.products,store.products)
  assert.equal(reopened.store.sales[0].total,sale.total)
  assert.equal(store.sales[0].status,'Debitado')
})
test('debit reclassification rejects stale, mismatched and replayed requests', () => {
  assert.throws(() => changeDebit({...store,sales:[]},request), /mudou ou foi removida/)
  assert.throws(() => changeDebit(store,{...request,payment:{...request.payment,amount:11}}), /não corresponde/)
  const settled=changeDebit(store,request)
  assert.throws(() => changeDebit(settled.store,{...request,sale:settled.store.sales[0]}), /situação/)
})

test('report CSV includes customer, partial receipts and protects formula cells and quoted names', () => {
  const csv = salesCSV([{...sale,status:'Pendente',paidAmount:2}], [{...store.customers[0],name:'=João "Teste"'}])
  assert.match(csv, /^\uFEFFData;Cliente;Itens;Pagamento;Status;Canal;Total;Recebido/)
  assert.match(csv, /"'=João ""Teste"""/)
  assert.match(csv, /"Pendente";"loja";"12,00";"2,00"/)
})

test('cancelled or failed backup confirmation leaves local extras untouched', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'FileReader')
  const costs = localStorage.getItem('cc_custos')
  const losses = localStorage.getItem('cc_perdas')
  const validCost = { id: 'replacement', name: 'Nutella', precoVenda: 8.5, custoUnitario: 3, lucroUnitario: 5.5, margem: 5.5 / 8.5 }
  class Reader {
    result = ''
    onload?: () => void
    readAsText() { this.result = JSON.stringify({...store,version:2,extras:{custos:[validCost],perdas:[]}}); this.onload?.() }
  }
  Object.defineProperty(globalThis,'FileReader',{value:Reader,configurable:true})
  try {
    await aplicarBackup({size:100} as File, async () => false)
    assert.equal(localStorage.getItem('cc_custos'),costs)
    assert.equal(localStorage.getItem('cc_perdas'),losses)
    await assert.rejects(aplicarBackup({size:100} as File, async () => {throw Error('network failed')}), /network failed/)
    assert.equal(localStorage.getItem('cc_custos'),costs)
  } finally {
    if (original) Object.defineProperty(globalThis,'FileReader',original)
    else Reflect.deleteProperty(globalThis,'FileReader')
  }
})

test('backup exporta recibos como histórico somente leitura e rejeita extras inválidos antes do callback', async () => {
  const receipt = { id: 'receipt-1', customerId: 'c', amount: 2, recordedAt: 1, actor: 'Conta', actorUid: 'u', allocations: [{ saleId: 's', amount: 2 }], kind: 'receipt', auditId: 'v2-00000000-0000-4000-8000-000000000000', payment: 'pix', date: '2026-10-01' } as any
  const exported = exportarDados(store.products, store.sales, store.customers, { customerReceipts: { c: [receipt] } })
  const payload = JSON.parse(exported)
  assert.equal(payload.version, 2)
  assert.equal(payload.receiptHistory.c[0].id, 'receipt-1')

  const original = Object.getOwnPropertyDescriptor(globalThis, 'FileReader')
  try {
    let imported: any
    class Reader {
      onload?: () => void
      readAsText() { this.onload?.() }
      get result() { return exported }
    }
    Object.defineProperty(globalThis, 'FileReader', { value: Reader, configurable: true })
    await aplicarBackup({ size: exported.length } as File, data => { imported = data; return false })
    assert.equal(imported.receiptHistory, undefined)

    const invalid = JSON.stringify({ ...store, version: 2, extras: { custos: [{ id: 'broken', name: 'Sem valores' }], perdas: [] } })
    let called = false
    class InvalidReader {
      onload?: () => void
      readAsText() { this.onload?.() }
      get result() { return invalid }
    }
    Object.defineProperty(globalThis, 'FileReader', { value: InvalidReader, configurable: true })
    await assert.rejects(aplicarBackup({ size: invalid.length } as File, () => { called = true }), /extras|custos inválidos/)
    assert.equal(called, false)
  } finally {
    if (original) Object.defineProperty(globalThis, 'FileReader', original)
    else Reflect.deleteProperty(globalThis, 'FileReader')
  }
})

test('backup preserva custo com lucro e margem negativos quando os valores são finitos', async () => {
  const negativeCost = { id: 'below-margin', name: 'Nutella', precoVenda: 8.5, custoUnitario: 10, lucroUnitario: -1.5, margem: -1.5 / 8.5 }
  const backup = JSON.stringify({ ...store, version: 2, extras: { custos: [negativeCost], perdas: [] } })
  const original = Object.getOwnPropertyDescriptor(globalThis, 'FileReader')
  try {
    let imported: any
    class Reader {
      onload?: () => void
      readAsText() { this.onload?.() }
      get result() { return backup }
    }
    Object.defineProperty(globalThis, 'FileReader', { value: Reader, configurable: true })
    await aplicarBackup({ size: backup.length } as File, data => { imported = data; return false })
    assert.deepEqual(imported.extras?.custos, [negativeCost])
  } finally {
    if (original) Object.defineProperty(globalThis, 'FileReader', original)
    else Reflect.deleteProperty(globalThis, 'FileReader')
  }
})
