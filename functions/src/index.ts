import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { createHash, randomUUID } from 'node:crypto'
import { can, canChangeRole, type Role, type Permission } from '../../src/roles'
import { validateStoreData, validateSales, type StoreData } from '../../src/validation'
import { mergeStore, SyncConflict } from '../../src/store-merge'
import { employeeSale } from '../../src/employee-sale'
import { recordSale } from '../../src/record-sale'
import { diffRows, reversePatches, type UndoPatch } from '../../src/undo-model'

initializeApp()
const db = getFirestore()
const options = { region: 'southamerica-east1', maxInstances: 5, cors: true }
const shop = db.doc('loja/dados')
const roles: Role[] = ['owner', 'admin', 'employee', 'blocked']
const invitationId = (email: string) => createHash('sha256').update(email).digest('hex')

function identity(request: CallableRequest) {
  if (!request.auth || request.auth.token.email_verified !== true || typeof request.auth.token.email !== 'string') throw new HttpsError('unauthenticated', 'Entre com uma conta Google verificada.')
  return { uid: request.auth.uid, email: request.auth.token.email.toLowerCase(), name: String(request.auth.token.name || request.auth.token.email).slice(0, 120) }
}
async function member(transaction: FirebaseFirestore.Transaction, request: CallableRequest, permission: Permission) {
  const user = identity(request)
  const snapshot = await transaction.get(db.doc(`team/${user.uid}`))
  const role = snapshot.data()?.role as Role
  if (!can(role, permission)) throw new HttpsError('permission-denied', 'Seu cargo não permite esta ação.')
  return { ...user, role }
}
function readStore(snapshot: FirebaseFirestore.DocumentSnapshot): StoreData {
  const value = validateStoreData(snapshot.data())
  if (!value) throw new HttpsError('failed-precondition', 'Os dados da loja precisam ser verificados.')
  return value
}
function journal(transaction: FirebaseFirestore.Transaction, user: { uid: string; email: string; name: string }, action: string, detail: string, extra: object = {}, id = randomUUID()) {
  transaction.create(db.doc(`audit/${id}`), { id, ts: Date.now(), actor: user.name, actorUid: user.uid, email: user.email, action, detail, ...extra })
}
function saveStore(transaction: FirebaseFirestore.Transaction, before: StoreData, after: StoreData, user: { uid: string; email: string; name: string }, action: string, detail: string) {
  const patches = (['products', 'sales', 'customers'] as const).flatMap(source => diffRows(source, before[source], after[source]))
  if (!patches.length) return
  transaction.set(shop, { ...after, schemaVersion: 2, updatedAt: FieldValue.serverTimestamp(), updatedBy: user.uid, updatedByEmail: user.email }, { merge: true })
  // Large restores still have an audit entry, but never exceed the document size limit with snapshots.
  const undo = Buffer.byteLength(JSON.stringify(patches), 'utf8') <= 350_000 ? { undo: patches } : {}
  journal(transaction, user, action, detail, undo)
}
function execute(handler: (request: CallableRequest<any>) => Promise<unknown>) {
  return onCall(options, async request => {
    try { return await handler(request) }
    catch (error) {
      if (error instanceof HttpsError) throw error
      if (error instanceof SyncConflict) throw new HttpsError('aborted', 'Outro aparelho alterou o mesmo registro.')
      throw new HttpsError('failed-precondition', error instanceof Error ? error.message : 'Não foi possível concluir a ação.')
    }
  })
}

export const getMyAccess = execute(async request => {
  const user = identity(request)
  return db.runTransaction(async transaction => {
    const ref = db.doc(`team/${user.uid}`), snapshot = await transaction.get(ref)
    if (snapshot.exists) return { role: roles.includes(snapshot.data()?.role) ? snapshot.data()!.role : 'blocked' }
    const invitation = db.doc(`invitations/${invitationId(user.email)}`)
    const invited = await transaction.get(invitation)
    const role = invited.data()?.role
    if (role !== 'admin' && role !== 'employee') return { role: 'blocked' }
    transaction.create(ref, { ...user, role, updatedAt: FieldValue.serverTimestamp() })
    transaction.delete(invitation)
    return { role }
  })
})

export const commitStore = execute(async request => {
  const base = validateStoreData(request.data?.base), local = validateStoreData(request.data?.local)
  if (!base || !local) throw new HttpsError('invalid-argument', 'Alterações inválidas.')
  return db.runTransaction(async transaction => {
    const user = await member(transaction, request, 'manage')
    const before = readStore(await transaction.get(shop))
    const after = validateStoreData(mergeStore(base, local, before))
    if (!after) throw new HttpsError('failed-precondition', 'A alteração produziria dados inválidos.')
    const changed = (['products', 'sales', 'customers'] as const).map(source => ({ source, count: diffRows(source, before[source], after[source]).length })).filter(item => item.count)
    const names = { products: 'produto(s)', sales: 'venda(s)', customers: 'cliente(s)' }
    saveStore(transaction, before, after, user, 'alteracao', changed.map(item => `${item.count} ${names[item.source]}`).join(' · '))
    return after
  })
})

export const createSale = execute(async request => {
  const sale = validateSales([request.data?.sale])?.[0]
  if (!sale || !['Pago', 'Pendente'].includes(sale.status || '')) throw new HttpsError('invalid-argument', 'Funcionários podem registrar vendas pagas ou pendentes.')
  return db.runTransaction(async transaction => {
    const user = await member(transaction, request, 'operate')
    const before = readStore(await transaction.get(shop))
    const requestRef = db.doc('saleRequests/' + invitationId(user.uid + ':' + sale.id))
    const receipt = await transaction.get(requestRef)
    const fingerprint = invitationId(JSON.stringify(sale))
    if (receipt.exists) {
      if (receipt.data()?.fingerprint !== fingerprint) throw new HttpsError('failed-precondition', 'Identificador já utilizado para outra venda.')
      return { id: sale.id, repeated: true }
    }
    const verifiedSale = employeeSale(request.data?.sale, before)
    const existing = before.sales.find(item => item.id === sale.id)
    if (existing) throw new HttpsError('already-exists', 'A venda já foi registrada. Atualize a lista antes de tentar novamente.')
    if (sale.status === 'Pendente' && !sale.customerId) throw new HttpsError('invalid-argument', 'Venda pendente precisa de cliente.')
    if (sale.items.some(item => before.products.find(product => product.id === item.productId)?.price !== item.unitPrice)) throw new HttpsError('failed-precondition', 'O preço mudou. Confira os valores atuais.')
    const after = recordSale(before, verifiedSale)
    transaction.create(requestRef, { fingerprint, uid: user.uid, saleId: sale.id, ts: Date.now() })
    saveStore(transaction, before, after, user, 'venda', verifiedSale.items.map(item => `${item.qty}× ${item.name}`).join(', '))
    return { id: sale.id }
  })
})

export const undoAction = execute(async request => {
  const id = String(request.data?.id || '')
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new HttpsError('invalid-argument', 'Ação inválida.')
  return db.runTransaction(async transaction => {
    const user = await member(transaction, request, 'audit')
    const original = await transaction.get(db.doc(`audit/${id}`))
    const receiptRef = db.doc(`auditReversals/${id}`), receipt = await transaction.get(receiptRef)
    const before = readStore(await transaction.get(shop))
    const patches = original.data()?.undo as UndoPatch[] | undefined
    if (receipt.exists) throw new HttpsError('already-exists', 'Esta ação já foi desfeita.')
    if (!patches?.length) throw new HttpsError('failed-precondition', 'Esta ação não possui dados para desfazer.')
    const after = validateStoreData(reversePatches({ ...before, custos: [], perdas: [] }, patches))
    if (!after) throw new HttpsError('failed-precondition', 'A reversão produziria dados inválidos.')
    transaction.set(shop, { ...after, updatedAt: FieldValue.serverTimestamp(), updatedBy: user.uid, updatedByEmail: user.email }, { merge: true })
    transaction.create(receiptRef, { originalId: id, uid: user.uid, ts: Date.now() })
    journal(transaction, user, 'desfazer', `Desfez: ${original.data()?.detail || 'alteração'}`, { undoOf: id })
    return { done: true }
  })
})

export const changeTeamAccess = execute(async request => {
  const role = request.data?.role as Role
  const email = String(request.data?.email || '').trim().toLowerCase()
  if (!['admin', 'employee', 'blocked'].includes(role) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new HttpsError('invalid-argument', 'Informe um e-mail e cargo válidos.')
  let targetUid: string | null = null
  await db.runTransaction(transaction => member(transaction, request, 'team'))
  try { targetUid = (await getAuth().getUserByEmail(email)).uid }
  catch (error) { if ((error as { code?: string }).code !== 'auth/user-not-found') throw error }
  return db.runTransaction(async transaction => {
    const user = await member(transaction, request, 'team')
    if (email === user.email) throw new HttpsError('failed-precondition', 'Você não pode bloquear ou rebaixar seu próprio acesso.')
    const ref = targetUid ? db.doc(`team/${targetUid}`) : db.doc(`invitations/${invitationId(email)}`)
    const previous = await transaction.get(ref)
    const invitation = db.doc(`invitations/${invitationId(email)}`)
    if (targetUid) await transaction.get(invitation)
    if (!canChangeRole(user.role, previous.data()?.role || 'blocked', role, targetUid === user.uid)) throw new HttpsError('permission-denied', 'Não é permitido alterar o acesso do dono.')
    transaction.set(ref, { email, role, ...(targetUid ? { uid: targetUid } : {}), updatedAt: FieldValue.serverTimestamp(), updatedBy: user.uid }, { merge: true })
    if (targetUid) transaction.delete(invitation)
    journal(transaction, user, 'equipe', `${role === 'blocked' ? 'Bloqueou' : 'Alterou'} acesso de ${email}: ${role}`)
    return { done: true, invited: !targetUid }
  })
})

export const getOperations = execute(async request => db.runTransaction(async transaction => {
  await member(transaction, request, 'operate')
  const store = readStore(await transaction.get(shop))
  return { products: store.products, customers: store.customers.map(({ id, name }) => ({ id, name })) }
}))
