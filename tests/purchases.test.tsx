import test from 'node:test'
import assert from 'node:assert/strict'
import { create, act } from 'react-test-renderer'
import { useState } from 'react'
import { IngredientPurchase, parseIngredients, parseProductScreenshot, purchaseTotal, purchasePaid, purchaseDue, purchasesSummary, groupDebts, normalizedPrice, priceStats, validPurchase, replacePurchase, readPurchasesBackup } from '../src/ingredients'
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
import { parsePurchaseImage, changeItemQuantity } from '../src/purchase-scan'
test('receipt review separates tax from totals and reads item quantities', () => {
 const scan = parsePurchaseImage('LOJA TESTE\nItem Codigo Descricao Qtde Unid Vl.unit Valor total\n001 123456 UTENSILIO A 2 un X 9,99 (7,49) 19,98\n002 234567 UTENSILIO B 2 un X 16,99 (14,70) 33,98\nVALOR TOTAL: 53,96\nCartao de Debito 53,96\nTributos 22,19','receipt')
 assert.equal(scan.items.length,2); assert.equal(purchaseTotal(scan),53.96); assert.equal(scan.expectedTotal,53.96)
 assert.equal(scan.items[0].quantity,2); assert.equal(scan.items[0].unitPrice,9.99)
})
test('receipt review joins wrapped items while retaining fractional quantities', () => {
 const scan=parsePurchaseImage('Item Codigo Descricao Qtde Unid Vl.unit Valor total\n001 1234567890123 SACO DECORADO\n0.506 un X 43,49 22,01\n002 2345678901234 CREME 650G\n2 un X 39,99 79,98\nVALOR TOTAL: 101,99','receipt')
 assert.equal(scan.items.length,2); assert.equal(purchaseTotal(scan),101.99)
 assert.equal(scan.items[0].quantity,.506); assert.equal(scan.items[1].quantity,2); assert.equal(scan.items[1].packageSize,650)
 assert.equal(changeItemQuantity(scan.items[0],1).total,43.49)
})
test('cart print preserves multiple row totals instead of multiplying them by quantity again', () => {
 const scan = parsePurchaseImage('Creme de teste 1,01... R$ 90,98\n2 unidades\nAçúcar Teste 1kg R$ 20,95\n5 unidades','receipt')
 assert.equal(scan.items.length,2); assert.equal(purchaseTotal(scan),111.93)
 assert.equal(scan.items[0].quantity,2); assert.equal(scan.items[1].quantity,5)
 assert.equal(scan.items[0].packageSize,undefined); assert.equal(scan.items[1].packageSize,1)
 assert.equal(changeItemQuantity(scan.items[0],3).total,136.47)
})
test('unreadable fiscal text cannot turn tax totals into purchased products', () => {
 const scan=parsePurchaseImage('NFC FISCAL CNPJ\nTexto perdido R$ 9,33\nTributo Federal 3,75','receipt')
 assert.equal(scan.items.length,0)
 assert.match(scan.warning,/parcial/)
})
test('missing OCR prices stay empty for review and never become an invented purchase value', () => {
 const scan=parsePurchaseImage('Item Codigo Descricao Qtde Unid Vl.unit Valor total\n001 123456 PRODUTO ILEGIVEL\n1 un X 13,49\nVALOR TOTAL: 13,49','receipt')
 assert.equal(scan.items[0].total,0); assert.match(scan.warning,/parcial/)
})

test('package unit count is not mistaken for purchased quantity', () => {
 const scan=parsePurchaseImage('Item Codigo Descricao Qtde Unid Vl.unit Valor total\n001 123456 SACO ADESIVO C 100UN\n1 un X 14,99 14,99\nVALOR TOTAL: 14,99','receipt')
 assert.equal(scan.items[0].quantity,1); assert.equal(scan.items[0].total,14.99); assert.equal(scan.items[0].name,'SACO ADESIVO C 100UN')
})
test('photo review requires confirmation and changing quantity invalidates it', () => {
 let latest: PurchaseDraft = {...old,text:'',items:[{name:'Produto',total:20,quantity:2}]}
 function Review() { const [draft,setDraft] = useState(latest); latest=draft; return <PurchaseEditor draft={draft} change={setDraft} busy={false} onSave={()=>{}} onClose={()=>{}} onPhoto={()=>{}} onProcess={()=>{}} ignored={[]} /> }
 let tree: ReturnType<typeof create>; act(()=>{tree=create(<Review />)})
 const save = () => tree.root.findAllByType('button').find(b => b.props.children === 'Salvar compra')!
 assert.equal(save().props.disabled,true)
 act(()=>tree.root.findAllByType('input').find(i=>i.props.type === 'checkbox')!.props.onChange({target:{checked:true}}))
 assert.equal(save().props.disabled,false)
 act(()=>tree.root.findAllByType('input').find(i=>i.props['aria-label'] === 'Quantidade do produto 1')!.props.onChange({target:{value:'3'}}))
 assert.equal(latest.items[0].total,30); assert.equal(save().props.disabled,true)
 act(()=>tree.unmount())
})

test('pasted purchases extract quantities and packaging without multiplying line totals', () => {
 const result = parseIngredients('2x Creme Bueno - 90,98\n5x Açúcar 1kg - 20,95\nManteiga 500g - 20,90\nTotal - 132,83\nlinha sem preço')
 assert.equal(result.items.length,3)
 assert.deepEqual(result.items.map(i=>i.quantity),[2,5,1])
 assert.equal(result.items[1].name,'Açúcar 1kg')
 assert.equal(result.items[1].packageSize,1)
 assert.equal(result.items[1].unit,'kg')
 assert.equal(purchaseTotal(result),132.83)
 assert.equal(result.ignored.length,2)
 assert.equal(parseIngredients('0x Farinha - 10,00').items.length,0)
})

test('quick totals register paid and pending without product details', () => {
 let latest: PurchaseDraft = {id:'quick',date:'2026-09-08',shop:'',items:[],text:'',quickPaid:650,quickDue:2000}
 function Quick() { const [draft,setDraft] = useState(latest); latest=draft; return <PurchaseEditor draft={draft} change={setDraft} busy={false} onSave={()=>{}} onClose={()=>{}} onPhoto={()=>{}} onProcess={()=>{}} ignored={[]} /> }
 let tree: ReturnType<typeof create>; act(()=>{tree=create(<Quick />)})
 act(()=>tree.root.findAllByType('button').find(b=>b.props.children==='Usar estes valores')!.props.onClick())
 assert.equal(purchaseTotal(latest),2650); assert.equal(purchasePaid(latest),650); assert.equal(purchaseDue(latest),2000); assert.equal(validPurchase(latest),true)
 act(()=>tree.unmount())
})
