import test from 'node:test'
import assert from 'node:assert/strict'
import { create, act } from 'react-test-renderer'
import { useState } from 'react'
import { IngredientPurchase, parseProductScreenshot, purchaseTotal, purchasePaid, purchaseDue, purchasesSummary, groupDebts, normalizedPrice, priceStats, validPurchase, replacePurchase, readPurchasesBackup } from '../src/ingredients'
import { PurchaseEditor, PurchaseDraft } from '../src/views/PurchaseEditor'
const old: IngredientPurchase = { id: 'legacy', date: '2026-09-08', shop: 'Mercado X', items: [{ name: 'Farinha', total: 100 }], photo: 'data:image/png;base64,YQ==' }
const pending: IngredientPurchase = { ...old, id: 'pending', paymentStatus: 'pending', paidAmount: 15, dueDate: '2026-09-20', creditor: 'Mercado X', note: 'Entregar comprovante' }
test('legacy purchases and backups remain valid and count as paid without mutation', () => {
 const original = JSON.stringify(old)
 assert.equal(validPurchase(old), true); assert.equal(purchasePaid(old),100); assert.equal(purchaseDue(old),0)
 for (const version of [1,2]) assert.deepEqual(readPurchasesBackup(JSON.stringify({kind:'cookie-zookie-ingredients',version,purchases:[old]})),[old])
 assert.equal(JSON.stringify(old),original)
})
test('purchase summary separates total, actual paid and remaining, excluding archives', () => {
 const other: IngredientPurchase = {...pending,id:'other',items:[{name:'Manteiga',total:42.5}],paidAmount:0,creditor:'Fornecedor Y'}
 assert.deepEqual(purchasesSummary([old,pending,other,{...pending,id:'archived',archived:true}]), {total:242.5,paid:115,due:127.5})
 assert.deepEqual(purchasesSummary([]),{total:0,paid:0,due:0})
 assert.equal(purchaseTotal({items:[{name:'a',total:.1},{name:'b',total:.2}]}),.3)
})
test('creditor debts combine name variations and use outstanding amount, not total', () => {
 const groups = groupDebts([pending,{...pending,id:'b',creditor:'  mércado   x ',items:[{name:'a',total:20}],paidAmount:10},old])
 assert.equal(groups.length,1); assert.equal(groups[0].due,95); assert.equal(groups[0].purchases.length,2)
})
test('paying a purchase preserves receipt, note, purchase date and identity', () => {
 const paid = {...pending,paymentStatus:'paid' as const,paidAmount:undefined,paidAt:'2026-09-10'}
 const result = replacePurchase([pending],pending,paid)
 assert.equal(purchaseDue(result[0]),0); assert.equal(purchasePaid(result[0]),100)
 assert.equal(result[0].photo,pending.photo); assert.equal(result[0].note,pending.note); assert.equal(result[0].date,pending.date)
 assert.throws(() => replacePurchase(result,pending,{...pending,shop:'Changed'}),/outra aba/)
 assert.throws(() => replacePurchase([pending],pending,{...pending,id:'different'}))
})
test('pending amounts and optional quantities/dates validate without deleting legacy records', () => {
 assert.equal(validPurchase(pending),true)
 for (const patch of [{paidAmount:-1},{paidAmount:101},{dueDate:'2026-02-30'},{paymentStatus:'invalid'},{items:[{name:'a',total:10,quantity:0}]},{items:[{name:'a',total:10,unit:'invalid'}]}]) assert.equal(validPurchase({...pending,...patch}),false)
 const json = JSON.stringify({kind:'cookie-zookie-ingredients',version:2,purchases:[pending]})
 assert.deepEqual(readPurchasesBackup(json),[pending])
 assert.throws(() => readPurchasesBackup(JSON.stringify({kind:'cookie-zookie-ingredients',version:2,purchases:[old,old]})))
})
test('normalized prices compare total package weight and convert compatible units only', () => {
 assert.deepEqual(normalizedPrice({name:'a',total:20,quantity:2,packageSize:500,unit:'g'}),{value:20,unit:'kg'})
 assert.deepEqual(normalizedPrice({name:'a',total:20,quantity:1,packageSize:1,unit:'kg'}),{value:20,unit:'kg'})
 assert.deepEqual(normalizedPrice({name:'a',total:12,quantity:2,packageSize:500,unit:'ml'}),{value:12,unit:'l'})
 assert.deepEqual(normalizedPrice({name:'a',total:12,quantity:6,packageSize:1,unit:'un'}),{value:2,unit:'un'})
 assert.equal(normalizedPrice(old.items[0]),null)
 assert.equal(normalizedPrice({name:'a',total:12,quantity:0,packageSize:1,unit:'un'}),null)
})
test('price comparison uses chronological first and last, with cheapest location', () => {
 const result = priceStats([{date:'2026-09-03',value:12,shop:'B'},{date:'2026-09-01',value:10,shop:'A'},{date:'2026-09-02',value:8,shop:'C'}])!
 assert.equal(result.last,12); assert.equal(result.min,8); assert.equal(result.max,12); assert.equal(result.change,20); assert.equal(result.cheapest,'C')
 assert.equal(priceStats([]),null)
})
test('editor exposes pending amount and maps partial payment back to paid amount', () => {
 let latest: PurchaseDraft = {...old,text:''}
 function Harness() { const [draft,setDraft] = useState(latest); latest = draft; return <PurchaseEditor draft={draft} change={setDraft} busy={false} onSave={()=>{}} onClose={()=>{}} onPhoto={()=>{}} onProcess={()=>{}} ignored={[]} /> }
 let tree: ReturnType<typeof create>; act(()=>{tree=create(<Harness />)})
 act(()=>tree.root.findAllByType('select').find(s => s.props.value === 'paid')!.props.onChange({target:{value:'pending'}}))
 assert.equal(latest.paymentStatus,'pending')
 const amount = tree.root.findAllByType('input').find(i=>i.props.max===100)!
 act(()=>amount.props.onChange({target:{value:'85'}}))
 assert.equal(latest.paidAmount,15); assert.equal(purchaseDue(latest),85)
 act(()=>tree.root.findAllByType('select').find(s => s.props.value === 'pending')!.props.onChange({target:{value:'paid'}}))
 assert.equal(purchasePaid(latest),100); assert.equal(purchaseDue(latest),0)
 act(()=>tree.unmount())
})

test('product screenshots join wrapped titles and exclude installment prices', () => {
 const r = parseProductScreenshot('CHOCOLATE MEIO AMARGO\nEM GOTAS 1 KG\nR$ 39,90\n3x de R$ 13,30 sem juros\nAdicionar ao carrinho')
 assert.deepEqual(r.items,[{name:'CHOCOLATE MEIO AMARGO EM GOTAS 1 KG',total:39.9}])
 assert.equal(parseProductScreenshot('Chocolate\nDe R$ 49,90\nPor R$ 39,90').items.length,0)
 assert.equal(parseProductScreenshot('Chocolate\nR$ 39,90\nR$ 35,90 no Pix').items.length,0)
 assert.equal(parseProductScreenshot('Farinha - R$ 12,50').items[0].total,12.5)
 assert.equal(parseProductScreenshot('Produto sem preço').items.length,0)
})
