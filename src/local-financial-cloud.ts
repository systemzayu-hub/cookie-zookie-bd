import { getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { doc, getFirestore, runTransaction, serverTimestamp } from 'firebase/firestore'
import { sameData } from './store-merge'

export type LocalFinancialSource = 'cost' | 'loss'

const db = () => getFirestore(getApp())
const deviceKey = 'cc_financial_device_id_v1'
function deviceId() {
  let value = localStorage.getItem(deviceKey)
  if (!value) {
    value = crypto.randomUUID()
    localStorage.setItem(deviceKey, value)
  }
  return value
}

function clone(value: Record<string, unknown> | undefined) {
  return value === undefined ? null : JSON.parse(JSON.stringify(value)) as Record<string, unknown>
}

function recordId(row: Record<string, unknown>) {
  const id = row.id
  if (typeof id !== 'string' || !id || id.length > 300 || id.includes('/')) throw new Error('Um registro local tem identificador inválido. Corrija-o antes de sincronizar.')
  return id
}

function detail(source: LocalFinancialSource, before: Record<string, unknown> | undefined, after: Record<string, unknown> | undefined) {
  const row = after || before || {}
  const name = String(source === 'cost' ? row.name || 'produto' : row.produto || 'produto').slice(0, 100)
  const money = (amount: unknown) => typeof amount === 'number' && Number.isFinite(amount) ? `R$ ${amount.toFixed(2).replace('.', ',')}` : 'sem valor'
  if (source === 'cost') {
    if (!before) return `Custo de ${name} registrado: ${money(after?.custoUnitario)}`
    if (!after) return `Custo de ${name} removido: ${money(before.custoUnitario)}`
    return `Custo de ${name} alterado: ${money(before.custoUnitario)} para ${money(after.custoUnitario)}`
  }
  const qty = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? `${value} un` : 'quantidade não informada'
  const reason = String(row.motivo || '').trim().slice(0, 100)
  const action = !before ? 'registrada' : !after ? 'removida' : 'atualizada'
  return `Perda ${action}: ${name} · ${qty(row.qtd)}${reason ? ` · ${reason}` : ''} · ${money(row.custoTotal)}`.slice(0, 400)
}

function objectMap(rows: Record<string, unknown>[]) {
  const map = new Map<string, Record<string, unknown>>()
  for (const row of rows) {
    const id = recordId(row)
    if (map.has(id)) throw new Error('Há identificadores repetidos nos dados financeiros locais.')
    map.set(id, clone(row)!)
  }
  return map
}

/** Mirrors each changed local row with its immutable before/after event before UI state is committed. */
export async function commitLocalFinancialChanges(
  source: LocalFinancialSource,
  before: Record<string, unknown>[],
  after: Record<string, unknown>[],
  onProgress?: (done: number, total: number) => void,
) {
  const user = getAuth(getApp()).currentUser
  if (!user || !user.emailVerified) throw new Error('Entre com uma conta autorizada e sincronizada para registrar a alteração financeira.')
  const device = deviceId()
  const oldRows = objectMap(before), nextRows = objectMap(after)
  const ids = [...new Set([...oldRows.keys(), ...nextRows.keys()])].filter(id => !sameData(oldRows.get(id), nextRows.get(id)))
  if (ids.length > 10_000) throw new Error('Atualize no máximo 10.000 registros financeiros por vez.')
  let done = 0
  const commitOne = async (id: string) => {
      const oldValue = oldRows.get(id), nextValue = nextRows.get(id)
      const entityKey = `${source}_${encodeURIComponent(id)}`
      const entityRef = doc(db(), 'deviceFinancial', user.uid, 'devices', device, 'records', entityKey)
    await runTransaction(db(), async tx => {
      const remote = await tx.get(entityRef)
      const current = remote.exists() && !remote.data().deleted ? remote.data().data as Record<string, unknown> : undefined
      if (remote.exists() && sameData(current, nextValue)) return
      if (remote.exists() && !sameData(current, oldValue)) throw new Error(`O registro “${String((nextValue || oldValue)?.name || (nextValue || oldValue)?.produto || id)}” foi alterado em outra aba ou aparelho. Atualize a tela e tente novamente.`)
      const auditId = `v2-${crypto.randomUUID()}`
      const auditRef = doc(db(), 'auditV2', auditId)
      const beforeRef = doc(db(), 'auditSnapshots', auditId, 'versions', 'before')
      const afterRef = doc(db(), 'auditSnapshots', auditId, 'versions', 'after')
      const baselineDeclared = !remote.exists()
      const beforeSnapshot = clone(remote.exists() ? current : oldValue)
      const afterSnapshot = clone(nextValue)
      const bytes = JSON.stringify({ before: beforeSnapshot, after: afterSnapshot }).length
      if (bytes > 250_000) throw new Error('Este registro é grande demais para registrar com segurança no histórico local.')
      tx.set(auditRef, {
        id: auditId, actorUid: user.uid, actor: (user.displayName || user.email || 'Equipe').slice(0, 120),
        email: user.email?.trim().toLowerCase() || '', createdAt: serverTimestamp(), action: 'financeiro',
        detail: detail(source, oldValue, nextValue), hasUndo: false, undoOf: '', source,
        recordId: id, originUid: user.uid, deviceId: device, recordKey: entityKey, baselineDeclared,
        before: beforeSnapshot, after: afterSnapshot,
      })
      tx.set(beforeRef, { source, recordId: id, deviceId: device, baselineDeclared, recordKey: entityKey, record: beforeSnapshot })
      tx.set(afterRef, { source, recordId: id, deviceId: device, baselineDeclared, recordKey: entityKey, record: afterSnapshot })
      tx.set(entityRef, {
        source, recordId: id, deviceId: device, actorUid: user.uid, lastAuditId: auditId,
        data: afterSnapshot, deleted: nextValue === undefined, updatedAt: serverTimestamp(),
      })
    })
  }
  const concurrency = 10
  for (let offset = 0; offset < ids.length; offset += concurrency) {
    const results = await Promise.allSettled(ids.slice(offset, offset + concurrency).map(commitOne))
    let failure: unknown
    for (const result of results) {
      if (result.status === 'fulfilled') {
        done++
        onProgress?.(done, ids.length)
      } else if (failure === undefined) failure = result.reason
    }
    if (failure !== undefined) {
      const message = failure instanceof Error ? failure.message : 'Falha desconhecida ao registrar o histórico.'
      throw new Error(`${message} Progresso confirmado neste aparelho: ${done} de ${ids.length}. Repita a mesma operação para continuar com segurança.`)
    }
  }
  if (!ids.length) onProgress?.(0, 0)
}
