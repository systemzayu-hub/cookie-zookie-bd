import { sameData } from './store-merge'
import { getApp } from 'firebase/app'
import { collection, doc, getFirestore, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore'
import { IngredientPurchase, validPurchase } from './ingredients'
const db = () => getFirestore(getApp())
const ref = (id:string) => doc(db(),'ownerPurchases',id)
export function purchaseCloudData(p:IngredientPurchase): IngredientPurchase {
 const {photo,...data}=p
 return JSON.parse(JSON.stringify(data))
}
export async function migratePurchases(local:IngredientPurchase[]) {
 let conflicts=0
 for(const p of local) {
  if(!validPurchase(p))throw Error('Compra local inválida. Dados preservados.')
  const conflict=await runTransaction(db(),async tx=>{const r=ref(p.id),snap=await tx.get(r);if(!snap.exists()){tx.set(r,{data:purchaseCloudData(p),deleted:false,updatedAt:serverTimestamp()});return false}return !snap.data().deleted && !sameData(snap.data().data,purchaseCloudData(p))});if(conflict)conflicts++
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
export async function commitPurchases(before:IngredientPurchase[], after:IngredientPurchase[]) {
 const old=new Map(before.map(p=>[p.id,p])), next=new Map(after.map(p=>[p.id,p]))
 const ids=[...new Set([...old.keys(),...next.keys()])].filter(id=>!sameData(old.get(id) && purchaseCloudData(old.get(id)!),next.get(id) && purchaseCloudData(next.get(id)!)))
 if(ids.length>400)throw Error('Importe no máximo 400 compras por vez.')
 await runTransaction(db(),async tx=>{
  const snapshots=await Promise.all(ids.map(id=>tx.get(ref(id))))
  snapshots.forEach((snap,i)=>{
   const id=ids[i],expected=old.get(id),remote=snap.exists()&&!snap.data().deleted?snap.data().data:undefined
   if(!sameData(remote,expected && purchaseCloudData(expected)))throw Error('Esta compra mudou em outro aparelho. Atualize a lista e tente novamente; o rascunho foi mantido.')
   if(!expected&&snap.exists())throw Error('Este registro já foi excluído. Crie uma nova compra.')
   const value=next.get(id)
   if(value&&!validPurchase(value))throw Error('Compra inválida.')
   tx.set(ref(id),value?{data:purchaseCloudData(value),deleted:false,updatedAt:serverTimestamp()}:{deleted:true,updatedAt:serverTimestamp()})
  })
 })
}
