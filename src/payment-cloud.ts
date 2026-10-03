import { collection, doc, getFirestore, onSnapshot } from 'firebase/firestore'
import { getApp } from 'firebase/app'
import { sameData } from './store-merge'
import { CashPayment, validCashPayment } from './payments'
import { commitFinancialChanges } from './financial-audit'

const db = () => getFirestore(getApp())
const ref = (id: string) => doc(db(), 'ownerPayments', id)
const plain = (payment: CashPayment) => JSON.parse(JSON.stringify(payment)) as CashPayment

export function watchCashPayments(receive: (rows: CashPayment[], cached: boolean) => void, fail: () => void) {
  return onSnapshot(collection(db(), 'ownerPayments'), { includeMetadataChanges: true }, snapshot => {
    const rows: CashPayment[] = []
    for (const item of snapshot.docs) { const value = item.data(); if (value.deleted) continue; if (!validCashPayment(value.data)) { fail(); return }; rows.push(value.data) }
    receive(rows, snapshot.metadata.fromCache)
  }, fail)
}

export async function commitCashPayments(before: CashPayment[], after: CashPayment[], onProgress?: (done:number,total:number)=>void) {
  const old = new Map(before.map(p => [p.id, p])), next = new Map(after.map(p => [p.id, p]))
  const ids = [...new Set([...old.keys(), ...next.keys()])].filter(id => !sameData(old.get(id), next.get(id)))
  if (ids.length > 400) throw Error('Atualize no máximo 400 pagamentos por vez.')
  const user=(await import('firebase/auth')).getAuth(getApp()).currentUser
  if(!user)throw Error('Entre com uma conta autorizada para salvar pagamentos.')
  const changes=ids.map(id=>{
    const beforeValue=old.get(id),afterValue=next.get(id)
    if(afterValue&&!validCashPayment(afterValue))throw Error('Pagamento inválido.')
    return {id,before:beforeValue?plain(beforeValue) as unknown as Record<string,unknown>:undefined,after:afterValue?plain(afterValue) as unknown as Record<string,unknown>:undefined}
  })
  await commitFinancialChanges(db(),user,'payment',changes,onProgress)
}
