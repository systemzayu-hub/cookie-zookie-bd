import { before, beforeEach, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, getDocFromServer, getDocs, collection, setDoc, updateDoc, deleteDoc, runTransaction, serverTimestamp, arrayUnion, setLogLevel } from 'firebase/firestore'
import { createFreeStore, catalogCustomers } from '../src/free-store'
import { validateStoreData } from '../src/validation'
setLogLevel('silent')
let env: Awaited<ReturnType<typeof initializeTestEnvironment>>
const p = { id: 'p1', name: 'Tradicional', price: 6, stock: 10, category: 'tradicional' }
const c = { id: 'c1', name: 'Cliente teste', contact: 'private-contact', createdAt: new Date(0).toISOString() }
const base = { products: [p, { ...p, id: 'p2', name: 'Especial', price: 8 }], customers: [c], sales: [] }
const user = (id: string) => ({ uid: id, email: id + '@example.test', emailVerified: true, displayName: id }) as any
const client = (id: string, verified = true) => env.authenticatedContext(id, { email: id + '@example.test', email_verified: verified }).firestore() as any
const api = (id: string) => createFreeStore(client(id), () => user(id))
const sale = (id = crypto.randomUUID()) => ({ id, date: new Date().toISOString(), items: [{ productId: 'p1', name: 'Tradicional', qty: 2, unitPrice: 6 }], payment: 'pix', channel: 'loja', total: 12, status: 'Pago' }) as any
async function readStore() { return (await getDocFromServer(doc(client('owner'), 'loja', 'dados'))).data()! }
async function audits() { return (await getDocs(collection(client('owner'), 'auditV2'))).docs.map(d => d.data()) }
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-cookie-zookie', firestore: { host: '127.0.0.1', port: 8089, rules: readFileSync('firestore.rules', 'utf8') } })
})
beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore() as any
    await Promise.all([
      setDoc(doc(db, 'loja', 'dados'), { ...base, schemaVersion: 2, auditId: 'bootstrap' }),
      setDoc(doc(db, 'catalog', 'products'), { products: base.products, revision: 'bootstrap' }),
      setDoc(doc(db, 'catalog', 'customers'), { customers: catalogCustomers(base), revision: 'bootstrap' }),
      setDoc(doc(db, 'saleRegistry', 'ids'), { ids: [], revision: 'bootstrap' }),
      ...['owner','admin','employee','blocked'].map(role => setDoc(doc(db, 'teamAccess', role + '@example.test'), { email: role + '@example.test', role })),
    ])
  })
})
after(async () => { await env?.cleanup() })

test('anonymous, unverified and uninvited accounts cannot read the catalog or store', async () => {
  for (const db of [env.unauthenticatedContext().firestore(), client('employee', false), client('missing'), client('blocked')]) {
    await assertFails(getDocFromServer(doc(db as any, 'catalog', 'products')))
    await assertFails(getDocFromServer(doc(db as any, 'loja', 'dados')))
  }
  assert.equal((await api('missing').getMyAccess()).role, 'blocked')
})
test('employee sees operational catalog but cannot read finance, audit, snapshots or other access records', async () => {
  const data = await api('employee').getOperations()
  assert.equal(data.products.length, 2); assert.equal((data.customers[0] as any).contact, undefined)
  const db = client('employee')
  for (const path of [['loja','dados'],['audit','legacy'],['auditV2','v2-test'],['teamAccess','owner@example.test'],['auditSnapshots','v2-test','versions','before']]) {
    await assertFails(getDocFromServer(doc(db, ...path as [string,string])))
  }
  await assertFails(getDocs(collection(db, 'teamAccess')))
})
test('owner manages access with an immutable audit; admin cannot promote, invite or block anyone', async () => {
  await api('owner').changeTeamAccess({ email: 'new@example.test', role: 'employee' })
  assert.equal((await api('new').getMyAccess()).role, 'employee')
  await assert.rejects(() => api('admin').changeTeamAccess({ email: 'new@example.test', role: 'admin' }))
  await assertFails(setDoc(doc(client('admin'), 'teamAccess', 'new@example.test'), { email: 'new@example.test', role: 'admin' }))
  await assertFails(updateDoc(doc(client('owner'), 'teamAccess', 'owner@example.test'), { role: 'blocked' }))
  await assertFails(deleteDoc(doc(client('owner'), 'teamAccess', 'owner@example.test')))
  assert.equal((await audits()).length, 1)
  await api('owner').changeTeamAccess({ email: 'employee@example.test', role: 'blocked' })
  await assertFails(getDocFromServer(doc(client('employee'), 'catalog','products')))
})
test('manager commits must include truthful immutable snapshots and audit in the same transaction', async () => {
  const db = client('admin')
  await assertFails(updateDoc(doc(db,'loja','dados'), { products: [] }))
  const next = { ...base, products: [{ ...p, stock: 15 }, base.products[1]] }
  const result = await api('admin').commitStore({ base, local: next })
  assert.equal(result.products[0].stock,15)
  const events = await audits(); assert.equal(events.length,1)
  const snapshot = await getDocFromServer(doc(db,'auditSnapshots',events[0].id,'versions','before'))
  assert.deepEqual(snapshot.data(),base)
  await assertFails(updateDoc(doc(db,'auditV2',events[0].id),{ detail:'forged' }))
  await assertFails(deleteDoc(doc(db,'auditSnapshots',events[0].id,'versions','before')))
})
test('employee paid and pending sales atomically reduce stock without reading shared sales', async () => {
  await api('employee').createSale({ sale: sale('paid') })
  await api('employee').createSale({ sale: { ...sale('pending'), status:'Pendente', customerId:'c1' } })
  const store = await readStore()
  assert.equal(store.sales.length,2); assert.equal(store.products[0].stock,6); assert.equal(store.sales[1].paidAmount,0)
  assert.equal((await audits()).length,2)
})
test('five-flavor sale is atomic and within rule evaluation limits', async () => {
  const products = Array.from({ length:5 },(_,i)=>({ ...p,id:'p'+(i+1),name:'Sabor '+i }))
  await api('admin').commitStore({ base, local:{ ...base, products } })
  const input = { ...sale(), items:products.map(p=>({ productId:p.id,name:p.name,qty:1,unitPrice:p.price })),total:30 }
  await api('employee').createSale({sale:input})
  assert.ok((await readStore()).products.every(p=>p.stock===9))
})
test('reversal restores stock, preserves later sale, and cannot be replayed', async () => {
  const first = sale('first')
  await api('employee').createSale({ sale:first })
  const entry = (await audits())[0]
  await api('employee').createSale({sale:sale('later')})
  await assert.rejects(()=>api('employee').undoAction({id:entry.id}))
  await api('admin').undoAction({id:entry.id})
  const store=await readStore()
  assert.equal(store.products[0].stock,8); assert.deepEqual(store.sales.map(s=>s.id),['later'])
  await assert.rejects(()=>api('admin').undoAction({id:entry.id}))
  assert.equal((await api('employee').createSale({sale:first})).repeated,true)
  assert.equal((await readStore()).products[0].stock,8)
})
test('competing transactions cannot oversell', async () => {
  const input = (id:string) => ({ ...sale(id),total:36,items:[{...sale().items[0],qty:6}] })
  const results = await Promise.allSettled([api('employee').createSale({sale:input('race1')}), api('employee').createSale({sale:input('race2')})])
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
  assert.equal((await readStore()).products[0].stock,4)
})

async function forgedSale(kind: string) {
  const db=client('employee'),who=user('employee'),id='v2-'+crypto.randomUUID(),s={...sale(),paidAmount:12}
  const products=base.products.map((p,i)=>i===0?{...p,stock:8}:p)
  if(kind==='price'){s.items[0].unitPrice=1;s.total=2;s.paidAmount=2}
  if(kind==='status')s.status='Presente'
  if(kind==='negative-stock'){s.items[0].qty=20;s.total=120;s.paidAmount=120;products[0].stock=-10}
  if(kind==='paid-flag')s.items[0].paid=true
  if(kind==='catalog-price')products[1]={...products[1],price:1}
  if(kind==='catalog-stock')products[1]={...products[1],stock:99}
  if(kind==='backdated')s.date='2020-01-01T00:00:00.000Z'
  if(kind==='customer')s.customerId='missing'
  const head={id,actorUid:who.uid,actor:who.displayName,email:who.email,createdAt:serverTimestamp(),action:'venda',detail:'Venda registrada',hasUndo:true,undoOf:'',saleId:s.id,sale:s,beforeProducts:kind==='forged-snapshot'?[]:base.products,afterProducts:products}
  if(kind==='missing-snapshot')delete (head as any).beforeProducts
  if(kind==='actor')head.actorUid='owner'
  return runTransaction(db,async tx=>{
    tx.set(doc(db,'saleRequests',who.uid,'items',s.id),{sale:s,indices:[0],customerIndex:-1,fingerprint:'forged',auditId:id,createdAt:serverTimestamp()})
    tx.update(doc(db,'loja','dados'),{ products,sales:arrayUnion(s),schemaVersion:2,auditId:id,updatedAt:serverTimestamp(),updatedBy:who.uid,updatedByEmail:who.email,...(kind==='delete-history'?{sales:[s]}:{}) })
    tx.set(doc(db,'catalog','products'),{products,revision:id})
    tx.update(doc(db,'saleRegistry','ids'),{ids:arrayUnion(s.id),revision:id})
    tx.set(doc(db,'auditV2',id),head)
  })
}
for(const kind of ['price','status','negative-stock','paid-flag','catalog-price','catalog-stock','backdated','customer','actor','missing-snapshot','forged-snapshot']) {
  test('rules reject direct malicious write: '+kind,async()=>{
    await assertFails(forgedSale(kind))
    assert.deepEqual(validateStoreData(await readStore()),base)
    assert.equal((await audits()).length,0)
  })
}
test('employee cannot erase existing sales through a direct update',async()=>{
  await api('employee').createSale({sale:sale('existing')})
  await assertFails(forgedSale('delete-history'))
  assert.equal((await readStore()).sales.length,1)
})

test('valid direct employee transaction is accepted as a control for attack tests',async()=>{await assertSucceeds(forgedSale('valid'));assert.equal((await readStore()).products[0].stock,8)})
