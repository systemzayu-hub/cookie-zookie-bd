import { collection, doc, getFirestore, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore'
import { getApp } from 'firebase/app'
import { sameData } from './store-merge'
import { CashPayment, validCashPayment } from './payments'

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

export async function commitCashPayments(before: CashPayment[], after: CashPayment[]) {
  const old = new Map(before.map(p => [p.id, p])), next = new Map(after.map(p => [p.id, p]))
  const ids = [...new Set([...old.keys(), ...next.keys()])].filter(id => !sameData(old.get(id), next.get(id)))
  if (ids.length > 400) throw Error('Atualize no máximo 400 pagamentos por vez.')
  await runTransaction(db(), async transaction => {
    const snapshots = await Promise.all(ids.map(id => transaction.get(ref(id))))
    snapshots.forEach((snapshot, index) => {
      const id = ids[index], expected = old.get(id), remote = snapshot.exists() && !snapshot.data().deleted ? snapshot.data().data : undefined
      if (!sameData(remote, expected && plain(expected))) throw Error('Este pagamento mudou em outro aparelho. Atualize a lista e tente novamente.')
      const value = next.get(id)
      if (value && !validCashPayment(value)) throw Error('Pagamento inválido.')
      transaction.set(ref(id), value ? { data: plain(value), deleted: false, updatedAt: serverTimestamp() } : { deleted: true, updatedAt: serverTimestamp() })
    })
  })
}
