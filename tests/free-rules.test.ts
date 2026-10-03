import { before, beforeEach, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, getDocFromServer, getDocs, collection, setDoc, updateDoc, deleteDoc, runTransaction, serverTimestamp, arrayUnion, setLogLevel } from 'firebase/firestore'
import { createFreeStore, catalogCustomers, dashboardSale } from '../src/free-store'
import { validateStoreData } from '../src/validation'
import { salePaidAmount } from '../src/types'
import { commitFinancialChanges } from '../src/financial-audit'
import type { CashPayment } from '../src/payments'
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
  env = await initializeTestEnvironment({ projectId: process.env.TEST_PROJECT_ID || 'demo-cookie-zookie', firestore: { host: '127.0.0.1', port: 8089, rules: readFileSync('firestore.rules', 'utf8') } })
})
beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore() as any
    await Promise.all([
      setDoc(doc(db, 'loja', 'dados'), { ...base, schemaVersion: 2, auditId: 'bootstrap' }),
      setDoc(doc(db, 'catalog', 'products'), { products: base.products, revision: 'bootstrap' }),
      setDoc(doc(db, 'catalog', 'customers'), { customers: catalogCustomers(base), revision: 'bootstrap' }),
      setDoc(doc(db, 'dashboard', 'public'), { sales:[], revision:'bootstrap' }),
      setDoc(doc(db, 'saleRegistry', 'ids'), { ids: [], revision: 'bootstrap' }),
      ...['owner','admin','employee','blocked'].map(role => setDoc(doc(db, 'teamAccess', role + '@example.test'), { email: role + '@example.test', role })),
    ])
  })
})
after(async () => { await env?.cleanup() })

test('anonymous, unverified and uninvited accounts cannot read the catalog or store', async () => {
  for (const db of [env.unauthenticatedContext().firestore(), client('employee', false), client('blocked')]) {
    await assertFails(getDocFromServer(doc(db as any, 'catalog', 'products')))
    await assertFails(getDocFromServer(doc(db as any, 'loja', 'dados')))
  }
  assert.equal((await api('missing').getMyAccess()).role, 'viewer')
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
  await assert.rejects(()=>api('admin').undoAction({id:entry.id}))
  await api('owner').undoAction({id:entry.id})
  const store=await readStore()
  assert.equal(store.products[0].stock,8); assert.deepEqual(store.sales.map(s=>s.id),['later'])
  await assert.rejects(()=>api('owner').undoAction({id:entry.id}))
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
    tx.update(doc(db,'dashboard','public'),{sales:arrayUnion(dashboardSale(s)),revision:id})
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

test('visitor enters read-only and appears in owner list without gaining write privileges',async()=>{
  assert.equal((await api('visitor').getMyAccess()).role,'viewer')
  const db=client('visitor')
  await assertSucceeds(getDocFromServer(doc(db,'dashboard','public')))
  await assertFails(getDocFromServer(doc(db,'loja','dados')))
  await assertFails(getDocs(collection(db,'loginProfiles')))
  await assertFails(updateDoc(doc(db,'dashboard','public'),{sales:[]}))
  await assertFails(setDoc(doc(db,'teamAccess','visitor@example.test'),{email:'visitor@example.test',role:'owner'}))
  await assertFails(setDoc(doc(db,'loginProfiles','owner@example.test'),{uid:'visitor',email:'owner@example.test',name:'fake',lastSeen:serverTimestamp()}))
  await assert.rejects(()=>api('visitor').createSale({sale:sale()}))
  assert.ok((await getDocs(collection(client('owner'),'loginProfiles'))).docs.some(d=>d.data().email==='visitor@example.test'))
  await api('owner').changeTeamAccess({email:'visitor@example.test',role:'employee'})
  await api('visitor').createSale({sale:sale()})
  const summary=(await getDocFromServer(doc(client('owner'),'dashboard','public'))).data()!
  assert.equal(summary.sales.length,1);assert.equal(summary.sales[0].customerId,undefined)
  await api('owner').changeTeamAccess({email:'visitor@example.test',role:'viewer'})
  await assert.rejects(()=>api('visitor').createSale({sale:sale()}))
  await api('owner').changeTeamAccess({email:'visitor@example.test',role:'blocked'})
  await assertFails(getDocFromServer(doc(db,'dashboard','public')))
})

test('owner can promote another signed-in account and new owner can administer team',async()=>{
  await api('new').getMyAccess()
  await api('owner').changeTeamAccess({email:'new@example.test',role:'owner'})
  assert.equal((await api('new').getMyAccess()).role,'owner')
  await api('new').changeTeamAccess({email:'employee@example.test',role:'admin'})
  await assert.rejects(()=>api('admin').changeTeamAccess({email:'visitor@example.test',role:'owner'}))
  await assertFails(updateDoc(doc(client('new'),'teamAccess','owner@example.test'),{role:'blocked'}))
})
test('key identity requires server-issued claim and password provider',async()=>{
  await env.withSecurityRulesDisabled(async ctx=>{
    await setDoc(doc(ctx.firestore() as any,'teamAccess','owner-key@sitezayuo.invalid'),{email:'owner-key@sitezayuo.invalid',role:'owner'})
  })
  const claims={email:'owner-key@sitezayuo.invalid',email_verified:false,ownerKey:true,firebase:{sign_in_provider:'password'}}
  const granted=env.authenticatedContext('cookie-zookie-owner-key',claims).firestore() as any
  await assertSucceeds(getDocs(collection(granted,'auditV2')))
  for(const [uid,token] of [['other',claims],['cookie-zookie-owner-key',{...claims,ownerKey:false}],['cookie-zookie-owner-key',{...claims,firebase:{sign_in_provider:'custom'}}]] as any){
    await assertFails(getDocs(collection(env.authenticatedContext(uid,token).firestore() as any,'auditV2')))
  }
})

test('debit settlement and reopening atomically update sale, history and route reversal to payments', async () => {
  const debit = {...sale('debit-test'), status:'Debitado', customerId:'c1', paidAmount:0}
  await api('owner').commitStore({base, local:{...base,sales:[debit]}})
  const payment: CashPayment = {id:'debit-payment',date:'2026-10-01',amount:12,description:'Cookie',person:'Cliente teste',quantity:2,sourceSaleId:debit.id,kind:'cookie',status:'paid'}
  const request = {sale:debit,payment,reopen:false,operationId:'v2-'+crypto.randomUUID()}
  const settled = await assertSucceeds(api('owner').changeDebit(request))
  assert.equal(settled.sales[0].status,'Pago')
  assert.equal(salePaidAmount(settled.sales[0]),12)
  const snapshot = await getDocFromServer(doc(client('owner'),'ownerPayments',payment.id))
  assert.equal(snapshot.data()?.data.sourceSaleId,debit.id)
  assert.equal((await audits()).find(row => row.id === request.operationId)?.hasUndo,false)
  const paidDetails=await api('owner').auditDetails({id:request.operationId})
  assert.ok(paidDetails.changes.some((change:any)=>change.entity==='Pagamento: Cliente teste'&&change.field==='amount'&&change.after===12))
  assert.ok(paidDetails.changes.some((change:any)=>change.entity?.startsWith('Venda')&&['status','paidAmount'].includes(change.field)))
  await assert.rejects(api('owner').undoAction({id:request.operationId}), /área Pagamentos/)
  await assert.rejects(api('owner').changeDebit(request), /já foi aplicada/)
  const reopened = await assertSucceeds(api('owner').changeDebit({sale:settled.sales[0],payment:snapshot.data()!.data,reopen:true,operationId:'v2-'+crypto.randomUUID()}))
  assert.equal(reopened.sales[0].status,'Debitado')
  assert.equal(salePaidAmount(reopened.sales[0]),0)
  assert.equal((await getDocFromServer(doc(client('owner'),'ownerPayments',payment.id))).data()?.data.archived,true)
  assert.deepEqual(reopened.products,base.products)
})
test('competing debit receipts cannot create duplicate payments, and staff cannot reclassify', async () => {
  const debit = {...sale('debit-race'),status:'Debitado',customerId:'c1',paidAmount:0}
  await api('owner').commitStore({base,local:{...base,sales:[debit]}})
  const payment: CashPayment = {id:'pay-a',date:'2026-10-01',amount:12,description:'Cookie',person:'Cliente teste',quantity:2,sourceSaleId:debit.id,kind:'cookie',status:'paid'}
  for (const id of ['employee','blocked','missing']) await assertFails(api(id).changeDebit({sale:debit,payment,reopen:false,operationId:'v2-'+crypto.randomUUID()}))
  const result = await Promise.allSettled(['pay-a','pay-b'].map(id => api('owner').changeDebit({sale:debit,payment:{...payment,id},reopen:false,operationId:'v2-'+crypto.randomUUID()})))
  assert.equal(result.filter(row => row.status === 'fulfilled').length,1)
  assert.equal((await getDocs(collection(client('owner'),'ownerPayments'))).docs.length,1)
  assert.equal((await readStore()).sales[0].status,'Pago')
})
test('financial records require a tied immutable audit; purchase snapshots remain owner-only', async () => {
 const write = async (identity:'owner'|'admin',source:'purchase'|'payment',recordId:string,record:any,before:any=null) => {
  const db=client(identity),who=user(identity),id='v2-'+crypto.randomUUID(),collectionName=source==='purchase'?'ownerPurchases':'ownerPayments'
  const afterRecord=record?{data:record,deleted:false}:{deleted:true}
  await runTransaction(db,async tx=>{
   tx.set(doc(db,collectionName,recordId),{...(record?{data:record}:{}),deleted:!record,updatedAt:serverTimestamp(),auditId:id})
   tx.set(doc(db,'auditV2',id),{id,actorUid:who.uid,actor:who.displayName,email:who.email,createdAt:serverTimestamp(),action:'financeiro',detail:'Registro financeiro',hasUndo:false,undoOf:'',source,recordId})
   tx.set(doc(db,'auditSnapshots',id,'versions','before'),{source,recordId,record:before})
   tx.set(doc(db,'auditSnapshots',id,'versions','after'),{source,recordId,record:afterRecord})
  })
  return id
 }
 const purchase={id:'purchase-test',date:'2026-09-12',shop:'Mercado',items:[{name:'Sem detalhamento',total:2650}],paymentStatus:'pending',paidAmount:650}
 await assertFails(setDoc(doc(client('owner'),'ownerPurchases',purchase.id),{data:purchase,deleted:false,updatedAt:serverTimestamp()}))
 const purchaseAudit=await assertSucceeds(write('owner','purchase',purchase.id,purchase))
 assert.equal((await getDocFromServer(doc(client('owner'),'ownerPurchases',purchase.id))).data()?.data.paidAmount,650)
 for(const id of ['admin','employee','blocked','missing']) {
  await assertFails(getDocs(collection(client(id),'ownerPurchases')))
  await assertFails(setDoc(doc(client(id),'ownerPurchases',purchase.id),{data:purchase,deleted:false,updatedAt:serverTimestamp()}))
 }
 await assertFails(getDocFromServer(doc(client('admin'),'auditSnapshots',purchaseAudit,'versions','after')))
 const update={...purchase,paidAmount:1000}
 await assertSucceeds(write('owner','purchase',purchase.id,update,{data:purchase,deleted:false}))
 await assertFails(deleteDoc(doc(client('owner'),'ownerPurchases',purchase.id)))

 const payment={id:'payment-test',amount:25,description:'Frete',person:'Mercado',date:'2026-10-02'}
 const paymentAudit=await assertSucceeds(write('admin','payment',payment.id,payment))
 assert.equal((await getDocFromServer(doc(client('admin'),'ownerPayments',payment.id))).data()?.data.amount,25)
 await assertSucceeds(getDocFromServer(doc(client('admin'),'auditSnapshots',paymentAudit,'versions','after')))
 await assertFails(getDocFromServer(doc(client('employee'),'ownerPayments',payment.id)))
})

test('financial commit helper writes eight rows in bounded chunks, retries safely, and stops before a conflicting second chunk', async () => {
 const db=client('owner'), who=user('owner')
 const changes=Array.from({length:8},(_,index)=>({id:`chunk-${index}`,after:{id:`chunk-${index}`,date:'2026-10-02',shop:'Mercado',items:[{name:'Item',total:index+10}],paymentStatus:'paid',paidAmount:index+10}}))
 const progress:Array<[number,number]>=[]
 await commitFinancialChanges(db,who,'purchase',changes,(done,total)=>progress.push([done,total]))
 assert.deepEqual(progress,[[4,8],[8,8]])
 assert.equal((await getDocs(collection(db,'ownerPurchases'))).size,8)
 assert.equal((await getDocs(collection(db,'auditV2'))).size,8)
 const replay:Array<[number,number]>=[]
 await commitFinancialChanges(db,who,'purchase',changes,(done,total)=>replay.push([done,total]))
 assert.deepEqual(replay,[[4,8],[8,8]])
 assert.equal((await getDocs(collection(db,'auditV2'))).size,8)

 const seeded=Array.from({length:4},(_,index)=>({id:`conflict-${index}`,after:{id:`conflict-${index}`,date:'2026-10-02',shop:'Seed',items:[{name:'Old',total:5}],paymentStatus:'paid',paidAmount:5}}))
 await commitFinancialChanges(db,who,'purchase',seeded)
 const attempted=[...Array.from({length:4},(_,index)=>({id:`partial-${index}`,after:{id:`partial-${index}`,date:'2026-10-02',shop:'New',items:[{name:'New',total:9}],paymentStatus:'paid',paidAmount:9}})),
  ...seeded.map(item=>({...item,after:{...item.after,shop:'Replacement'}}))]
 const partialProgress:Array<[number,number]>=[]
 await assert.rejects(commitFinancialChanges(db,who,'purchase',attempted,(done,total)=>partialProgress.push([done,total])),/Progresso: 4 de 8/)
 assert.deepEqual(partialProgress,[[4,8]])
 for(let index=0;index<4;index++) assert.equal((await getDocFromServer(doc(db,'ownerPurchases',`partial-${index}`))).data()?.data.shop,'New')
 for(let index=0;index<4;index++) assert.equal((await getDocFromServer(doc(db,'ownerPurchases',`conflict-${index}`))).data()?.data.shop,'Seed')

 const restored={id:'restore-tombstone',date:'2026-10-02',shop:'Backup',items:[{name:'Restored',total:12}],paymentStatus:'paid',paidAmount:12}
 await commitFinancialChanges(db,who,'purchase',[{id:restored.id,after:restored}])
 await commitFinancialChanges(db,who,'purchase',[{id:restored.id,before:restored}])
 assert.equal((await getDocFromServer(doc(db,'ownerPurchases',restored.id))).data()?.deleted,true)
 await commitFinancialChanges(db,who,'purchase',[{id:restored.id,after:restored}])
 assert.deepEqual((await getDocFromServer(doc(db,'ownerPurchases',restored.id))).data()?.data,restored)
})

test('device financial mirror ties immutable events to manager-owned local records', async () => {
 const db=client('admin'), uid='admin', device=crypto.randomUUID(), auditId='v2-'+crypto.randomUUID()
 const recordKey='loss_loss-1', recordRef=doc(db,'deviceFinancial',uid,'devices',device,'records',recordKey)
 const auditRef=doc(db,'auditV2',auditId)
 const before={id:'loss-1',date:'2026-10-02',produto:'Nutella',qtd:2,motivo:'Queimado',custoUnit:4,custoTotal:8}
 const after={...before,qtd:3,custoTotal:12}
 const commitLocal=async(id:string,previous:any,next:any,baseline:boolean)=>{
  const beforeRef=doc(db,'auditSnapshots',id,'versions','before'), afterRef=doc(db,'auditSnapshots',id,'versions','after')
  const ref=doc(db,'auditV2',id)
  await runTransaction(db,async tx=>{
   tx.set(ref,{id,actorUid:uid,actor:'admin',email:'admin@example.test',createdAt:serverTimestamp(),action:'financeiro',detail:'Perda registrada: Nutella · 3 un · Queimado · R$ 12,00',hasUndo:false,undoOf:'',source:'loss',recordId:'loss-1',originUid:uid,deviceId:device,recordKey,baselineDeclared:baseline,before:previous,after:next})
   tx.set(beforeRef,{source:'loss',recordId:'loss-1',deviceId:device,baselineDeclared:baseline,recordKey,record:previous})
   tx.set(afterRef,{source:'loss',recordId:'loss-1',deviceId:device,baselineDeclared:baseline,recordKey,record:next})
   tx.set(recordRef,{source:'loss',recordId:'loss-1',deviceId:device,actorUid:uid,lastAuditId:id,data:next,deleted:next===null,updatedAt:serverTimestamp()})
  })
 }
 await assertSucceeds(runTransaction(db,async tx=>{
  tx.set(auditRef,{id:auditId,actorUid:uid,actor:'admin',email:'admin@example.test',createdAt:serverTimestamp(),action:'financeiro',detail:'Perda registrada: Nutella · 3 un · Queimado · R$ 12,00',hasUndo:false,undoOf:'',source:'loss',recordId:'loss-1',originUid:uid,deviceId:device,recordKey,baselineDeclared:true,before,after})
  tx.set(doc(db,'auditSnapshots',auditId,'versions','before'),{source:'loss',recordId:'loss-1',deviceId:device,baselineDeclared:true,recordKey,record:before})
  tx.set(doc(db,'auditSnapshots',auditId,'versions','after'),{source:'loss',recordId:'loss-1',deviceId:device,baselineDeclared:true,recordKey,record:after})
  tx.set(recordRef,{source:'loss',recordId:'loss-1',deviceId:device,actorUid:uid,lastAuditId:auditId,data:after,deleted:false,updatedAt:serverTimestamp()})
 }))
 assert.deepEqual((await getDocFromServer(recordRef)).data()?.data,after)
 await assertFails(updateDoc(auditRef,{detail:'alterado'}))
 await assertFails(updateDoc(recordRef,{data:before}))
 await assertFails(getDocFromServer(doc(client('employee'),'deviceFinancial',uid,'devices',device,'records',recordKey)))
 assert.equal((await getDocFromServer(doc(client('owner'),'deviceFinancial',uid,'devices',device,'records',recordKey))).data()?.actorUid,uid)
 await assertFails(getDocFromServer(doc(client('admin'),'auditV2',auditId)))
 assert.equal((await getDocFromServer(doc(client('admin'),'auditSnapshots',auditId,'versions','after'))).data()?.record.qtd,3)
 const details=await api('owner').auditDetails({id:auditId})
 assert.ok(details.changes.some((change:any)=>change.field==='Registro anterior' && String(change.after).includes('Estado inicial informado')))
 assert.ok(details.changes.some((change:any)=>change.field==='custoTotal' && change.before===8 && change.after===12))

 const undoAudit='v2-'+crypto.randomUUID()
 await assertSucceeds(commitLocal(undoAudit,after,before,false))
 assert.deepEqual((await getDocFromServer(recordRef)).data()?.data,before)

 await assertFails(updateDoc(recordRef,{data:after,lastAuditId:'v2-'+crypto.randomUUID(),updatedAt:serverTimestamp()}))
 await assertFails(runTransaction(db,async tx=>{
  tx.set(recordRef,{source:'loss',recordId:'loss-1',deviceId:device,actorUid:uid,lastAuditId:'v2-'+crypto.randomUUID(),data:after,deleted:false,updatedAt:serverTimestamp()})
 }))
 await assertFails(updateDoc(recordRef,{lastAuditId:auditId,updatedAt:serverTimestamp()}))
 const forgedId='v2-'+crypto.randomUUID()
 await assertFails(runTransaction(db,async tx=>{
  tx.set(doc(db,'auditV2',forgedId),{id:forgedId,actorUid:uid,actor:'admin',email:'admin@example.test',createdAt:serverTimestamp(),action:'financeiro',detail:'Perda adulterada',hasUndo:false,undoOf:'',source:'loss',recordId:'loss-1',originUid:uid,deviceId:device,recordKey,baselineDeclared:false,before:after,after})
  tx.set(doc(db,'auditSnapshots',forgedId,'versions','before'),{source:'loss',recordId:'loss-1',deviceId:device,baselineDeclared:false,recordKey,record:after})
  tx.set(doc(db,'auditSnapshots',forgedId,'versions','after'),{source:'loss',recordId:'loss-1',deviceId:device,baselineDeclared:false,recordKey,record:after})
  tx.set(recordRef,{source:'loss',recordId:'loss-1',deviceId:device,actorUid:uid,lastAuditId:forgedId,data:after,deleted:false,updatedAt:serverTimestamp()})
 }))
})

test('customer receipts are immutable, idempotent, and sale removal creates a non-cash adjustment', async () => {
 const pending={...sale('receipt-sale'),status:'Pendente',customerId:'c1',paidAmount:0}
 const started=await api('admin').commitStore({base,local:{...base,sales:[pending]}})
 const request={customerId:'c1',amount:5,sales:started.sales,payment:'pix',date:'2026-10-02',receiptId:'receipt-one'} as any
 const after=await assertSucceeds(api('admin').payCustomer(request))
 assert.equal(after.sales[0].paidAmount,5)
 const receiptRef=doc(client('owner'),'customerReceipts','c1','entries','receipt-one')
 const receipt=(await getDocFromServer(receiptRef)).data()!
 assert.equal(receipt.amount,5); assert.equal(receipt.kind,'receipt'); assert.equal(receipt.payment,'pix')
 assert.equal((await api('admin').payCustomer(request)).sales[0].paidAmount,5)
 await assert.rejects(api('admin').payCustomer({...request,amount:4}))
 await assertFails(updateDoc(receiptRef,{amount:1}))
 await assertFails(deleteDoc(receiptRef))
 await assertFails(getDocFromServer(doc(client('employee'),'customerReceipts','c1','entries','receipt-one')))
 await api('admin').deleteSale({sale:after.sales[0]})
 const rows=await getDocs(collection(client('admin'),'customerReceipts','c1','entries'))
 const adjustment=rows.docs.map(row=>row.data()).find(row=>row.kind==='adjustment')
 assert.equal(adjustment?.amount,-5); assert.equal(adjustment?.payment,undefined); assert.equal(adjustment?.date,undefined)
})

test('customer receipt source indexes flatten repeated merges, including customers with no current sales', async () => {
 const customers=[c,{...c,id:'c2',name:'Cliente B'},{...c,id:'c3',name:'Cliente C'}]
 const initial={...base,customers}
 const pending={...sale('receipt-merge-sale'),status:'Pendente',customerId:'c3',paidAmount:0}
 const started=await api('admin').commitStore({base,local:{...initial,sales:[pending]}})
 const paid=await api('admin').payCustomer({customerId:'c3',amount:3,sales:started.sales,payment:'dinheiro',date:'2026-10-02',receiptId:'receipt-merge',} as any)
 await api('admin').deleteSale({sale:paid.sales[0]})
 await api('admin').combineCustomers({source:customers[2],target:customers[1],contact:customers[1].contact})
 const mergedB=(await getDocFromServer(doc(client('admin'),'customerReceiptAliases','c2'))).data()!
 assert.deepEqual(mergedB.sources,['c3'])
 await api('admin').combineCustomers({source:customers[1],target:customers[0],contact:customers[0].contact})
 const mergedA=(await getDocFromServer(doc(client('admin'),'customerReceiptAliases','c1'))).data()!
 assert.deepEqual(new Set(mergedA.sources),new Set(['c2','c3']))
 const original=await getDocFromServer(doc(client('admin'),'customerReceipts','c3','entries','receipt-merge'))
 assert.equal(original.data()?.customerId,'c3')
 const beforeCount=(await getDocs(collection(client('admin'),'customerReceipts','c3','entries'))).size
 assert.equal(beforeCount,2)
})
