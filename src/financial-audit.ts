import type { Transaction } from 'firebase/firestore'
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { sameData } from './store-merge'

export type FinancialSource = 'purchase' | 'payment'
export type FinancialRecord = { data?: Record<string, unknown>; deleted: boolean }

const emailKey = (value: string) => value.trim().toLowerCase()
const actor = (user: User) => (user.displayName || user.email || 'Equipe').slice(0, 120)
const plain = (value: unknown) => value === undefined ? null : JSON.parse(JSON.stringify(value))
export const auditFinancialId = () => `v2-${crypto.randomUUID()}`

export function financialSummary(source: FinancialSource, before: FinancialRecord | null, after: FinancialRecord) {
  const record = (after.data || before?.data || {}) as Record<string, any>
  const amount = source === 'purchase' && Array.isArray(record.items)
    ? record.items.reduce((sum: number, item: Record<string, unknown>) => sum + (typeof item.total === 'number' ? item.total : 0), 0)
    : typeof record.amount === 'number' ? record.amount : 0
  const value = amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const removed = after.deleted, created = !before || before.deleted
  if (source === 'purchase') return `Compra ${String(record.shop || 'sem estabelecimento')}: ${value} · ${removed ? 'removida' : created ? 'registrada' : 'atualizada'}`
  const who = String(record.person || 'pessoa não informada'), what = String(record.description || 'pagamento')
  return `Pagamento de ${who}: ${what} · ${value} · ${removed ? 'removido' : created ? 'registrado' : 'atualizado'}`
}

export type FinancialChange = { id: string; before?: Record<string, unknown>; after?: Record<string, unknown> }

export function writeFinancialAudit(
  tx: Transaction, db: Firestore, user: User, id: string, source: FinancialSource, recordId: string,
  before: FinancialRecord | null, after: FinancialRecord,
) {
  const detail = financialSummary(source, before, after)
  const ref = doc(db, source === 'purchase' ? 'ownerPurchases' : 'ownerPayments', recordId)
  const beforeRecord = before ? { ...before, ...(before.data ? { data: plain(before.data) } : {}) } : null
  const afterRecord = { ...after, ...(after.data ? { data: plain(after.data) } : {}) }
  tx.set(doc(db, 'auditV2', id), {
    id, actorUid: user.uid, actor: actor(user), email: emailKey(user.email || ''), createdAt: serverTimestamp(),
    action: 'financeiro', detail, hasUndo: false, undoOf: '', source, recordId,
  })
  tx.set(doc(db, 'auditSnapshots', id, 'versions', 'before'), { source, recordId, record: beforeRecord })
  tx.set(doc(db, 'auditSnapshots', id, 'versions', 'after'), { source, recordId, record: afterRecord })
  tx.set(ref, after ? { ...(after.data ? { data: plain(after.data) } : {}), deleted: after.deleted, updatedAt: serverTimestamp(), auditId: id } : {})
}

/** Commits bounded, independently atomic chunks. Completed rows are safe to retry. */
export async function commitFinancialChanges(
  db: Firestore, user: User, source: FinancialSource, changes: FinancialChange[], onProgress?: (done: number, total: number) => void,
) {
  let completed = 0
  for (let offset = 0; offset < changes.length; offset += 4) {
    const chunk = changes.slice(offset, offset + 4)
    try {
      await runTransaction(db, async tx => {
        const refs = chunk.map(item => doc(db, source === 'purchase' ? 'ownerPurchases' : 'ownerPayments', item.id))
        const snapshots = await Promise.all(refs.map(ref => tx.get(ref)))
        const plans = chunk.flatMap((item, index) => {
          const snapshot = snapshots[index]
          const data = snapshot.exists() && !snapshot.data().deleted ? snapshot.data().data as Record<string, unknown> : undefined
          if (sameData(data, item.after)) return []
          const deletedTombstone = snapshot.exists() && Boolean(snapshot.data().deleted)
          if (!sameData(data, item.before) || (!item.before && snapshot.exists() && !deletedTombstone)) throw new Error('Este registro mudou em outro aparelho. Atualize os dados; nenhuma alteração deste grupo foi aplicada.')
          const before: FinancialRecord | null = snapshot.exists() ? { ...(snapshot.data().data ? { data: snapshot.data().data } : {}), deleted: Boolean(snapshot.data().deleted) } : null
          const after: FinancialRecord = item.after ? { data: item.after, deleted: false } : { deleted: true }
          return [{ item, before, after }]
        })
        for (const { item, before, after } of plans) writeFinancialAudit(tx, db, user, auditFinancialId(), source, item.id, before, after)
      })
      completed += chunk.length
      onProgress?.(Math.min(completed, changes.length), changes.length)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha desconhecida'
      throw new Error(`${message} Progresso: ${completed} de ${changes.length}; você pode repetir a operação com os mesmos dados.`)
    }
  }
}
