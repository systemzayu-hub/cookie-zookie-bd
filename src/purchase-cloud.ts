import { sameData } from './store-merge'
import { getApp } from 'firebase/app'
import { collection, doc, getFirestore, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore'
import { IngredientPurchase, validPurchase } from './ingredients'
import { auditFinancialId, commitFinancialChanges, writeFinancialAudit } from './financial-audit'
const db = () => getFirestore(getApp())
const ref = (id:string) => doc(db(),'ownerPurchases',id)
export function purchaseCloudData(p:IngredientPurchase): IngredientPurchase {
 const {photo,...data}=p
 return JSON.parse(JSON.stringify(data))
}
export async function migratePurchases(local:IngredientPurchase[]) {
 let conflicts=0
  const user = (await import('firebase/auth')).getAuth(getApp()).currentUser
  if (!user) throw Error('Entre com a conta de dono para importar compras.')
  for(const p of local) {
  if(!validPurchase(p))throw Error('Compra local inválida. Dados preservados.')
 const conflict=await runTransaction(db(),async tx=>{const r=ref(p.id),snap=await tx.get(r);if(!snap.exists()){writeFinancialAudit(tx,db(),user,auditFinancialId(),'purchase',p.id,null,{data:purchaseCloudData(p) as unknown as Record<string,unknown>,deleted:false});return false}return !snap.data().deleted && !sameData(snap.data().data,purchaseCloudData(p))});if(conflict)conflicts++
 }
 return conflicts
}
export function watchPurchases(receive:(rows:IngredientPurchase[],cached:boolean)=>void,fail:()=>void) {
 return onSnapshot(collection(db(),'ownerPurchases'),{includeMetadataChanges:true},snap=>{
  const rows:IngredientPurchase[]=[]
  for(const d of snap.docs){const value=d.data();if(value.deleted)continue;if(!validPurchase(value.data)){fail();return}rows.push(value.data)}
  receive(rows,snap.metadata.fromCache)
 },fail)
}
export async function commitPurchases(before:IngredientPurchase[], after:IngredientPurchase[], onProgress?: (done:number,total:number)=>void) {
 const old=new Map(before.map(p=>[p.id,p])), next=new Map(after.map(p=>[p.id,p]))
 const ids=[...new Set([...old.keys(),...next.keys()])].filter(id=>!sameData(old.get(id) && purchaseCloudData(old.get(id)!),next.get(id) && purchaseCloudData(next.get(id)!)))
 if(ids.length>400)throw Error('Importe no máximo 400 compras por vez.')
 const user = (await import('firebase/auth')).getAuth(getApp()).currentUser
 if (!user) throw Error('Entre com a conta de dono para salvar compras.')
 const changes=ids.map(id=>{
  const beforeValue=old.get(id),afterValue=next.get(id)
  if(afterValue&&!validPurchase(afterValue))throw Error('Compra inválida.')
  return {id,before:beforeValue?purchaseCloudData(beforeValue) as unknown as Record<string,unknown>:undefined,after:afterValue?purchaseCloudData(afterValue) as unknown as Record<string,unknown>:undefined}
 })
 await commitFinancialChanges(db(),user,'purchase',changes,onProgress)
}
