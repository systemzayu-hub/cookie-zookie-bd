import { OWNER_KEY_UID } from './owner-access'
import { arrayUnion, doc, getDocFromServer, setDoc, runTransaction, serverTimestamp, type Firestore, type Transaction } from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { mergeStore, sameData } from './store-merge'
import { validateStoreData, type StoreData } from './validation'
import { employeeSale } from './employee-sale'
import { recordSale } from './record-sale'
import { diffRows, reversePatches } from './undo-model'
import { can, type Role } from './roles'
import type { Sale } from './types'

export const dashboardSale = ({ id, date, items, status }: Sale) => ({ id, date, items, status: status || 'Pago' })
export const FREE_MAX_FLAVORS = 5
export const catalogCustomers = (data: StoreData) => data.customers.map(({ id, name }, index) => ({ id, name, index }))
const auditId = () => 'v2-' + crypto.randomUUID()
const accessKey = (email: string) => email.trim().toLowerCase()
export function createFreeStore(db: Firestore, currentUser: () => User | null) {
  const identity = () => {
    const user = currentUser()
    if (!user?.email || (!user.emailVerified && user.uid !== OWNER_KEY_UID)) throw new Error('Entre com uma conta Google verificada.')
    return user
  }
  const core = (raw: unknown) => {
    const value = validateStoreData(raw)
    if (!value) throw new Error('Não foi possível validar os dados da loja.')
    return value
  }
  const shop = doc(db, 'loja', 'dados')
  const header = (user: User, id: string, action: string, detail: string, hasUndo = true, undoOf = '') => ({
    id, actorUid: user.uid, actor: (user.displayName || user.email || 'Equipe').slice(0, 120),
    email: accessKey(user.email!), createdAt: serverTimestamp(), action, detail: detail.slice(0, 1000), hasUndo, undoOf,
  })
  const writeSnapshots = (tx: Transaction, id: string, before: StoreData, after: StoreData) => {
    tx.set(doc(db, 'auditSnapshots', id, 'versions', 'before'), before)
    tx.set(doc(db, 'auditSnapshots', id, 'versions', 'after'), after)
  }
  const writeStore = (tx: Transaction, user: User, id: string, before: StoreData, after: StoreData, action: string, detail: string, undoOf = '') => {
    tx.update(shop, { ...after, schemaVersion: 2, auditId: id, updatedAt: serverTimestamp(), updatedBy: user.uid, updatedByEmail: accessKey(user.email!) })
    tx.set(doc(db, 'saleRegistry', 'ids'), { ids: arrayUnion(...after.sales.map(sale => sale.id)), revision: id }, { merge: true })
    tx.set(doc(db, 'dashboard', 'public'), { sales: after.sales.map(dashboardSale), revision: id })
    tx.set(doc(db, 'catalog', 'products'), { products: after.products, revision: id })
    tx.set(doc(db, 'catalog', 'customers'), { customers: catalogCustomers(after), revision: id })
    tx.set(doc(db, 'auditV2', id), header(user, id, action, detail, !undoOf, undoOf))
    writeSnapshots(tx, id, before, after)
  }
  return {
    async getMyAccess() {
      const user = identity()
      const snap = await getDocFromServer(doc(db, 'teamAccess', accessKey(user.email!)))
      await setDoc(doc(db, 'loginProfiles', accessKey(user.email!)), { uid: user.uid, email: accessKey(user.email!), name: (user.displayName || user.email!).slice(0,120), lastSeen: serverTimestamp() })
      return { role: snap.data()?.role || 'viewer' }
    },
    async getOperations() {
      identity()
      const [products, customers] = await Promise.all([getDocFromServer(doc(db, 'catalog', 'products')), getDocFromServer(doc(db, 'catalog', 'customers'))])
      if (!products.exists() || !customers.exists()) throw new Error('O catálogo ainda não está disponível.')
      return { products: products.data().products, customers: customers.data().customers.map(({ id, name }: { id: string; name: string }) => ({ id, name })) }
    },
    async commitStore({ base, local }: { base: StoreData; local: StoreData }) {
      const user = identity(), id = auditId()
      return runTransaction(db, async tx => {
        const before = core((await tx.get(shop)).data())
        const after = core(mergeStore(core(base), core(local), before))
        if (!sameData(before, after)) {
          const names = { products: 'produto(s)', sales: 'venda(s)', customers: 'cliente(s)' }
          const detail = (['products', 'sales', 'customers'] as const).map(source => ({ source, count: diffRows(source, before[source], after[source]).length })).filter(item => item.count).map(item => item.count + ' ' + names[item.source]).join(' · ')
          writeStore(tx, user, id, before, after, 'alteracao', detail)
        }
        return after
      })
    },
    async createSale({ sale: input }: { sale: Sale }) {
      const user = identity(), id = auditId()
      if (!/^[a-zA-Z0-9_-]{1,100}$/.test(input.id)) throw new Error('Identificador de venda inválido.')
      const requestRef = doc(db, 'saleRequests', user.uid, 'items', input.id)
      const fingerprint = JSON.stringify(input)
      return runTransaction(db, async tx => {
        const receipt = await tx.get(requestRef)
        if (receipt.exists()) {
          if (receipt.data().fingerprint !== fingerprint) throw new Error('Identificador já utilizado para outra venda.')
          return { id: input.id, repeated: true }
        }
        const [productDoc, customerDoc] = await Promise.all([tx.get(doc(db, 'catalog', 'products')), tx.get(doc(db, 'catalog', 'customers'))])
        const products = productDoc.data()?.products || []
        const customers = customerDoc.data()?.customers || []
        const operational: StoreData = { products, sales: [], customers: customers.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name, contact: '', createdAt: new Date(0).toISOString() })) }
        const sale = employeeSale(input, operational)
        if (sale.items.length > FREE_MAX_FLAVORS || new Set(sale.items.map(item => item.productId)).size !== sale.items.length) throw new Error('Selecione até 5 sabores diferentes por venda.')
        const after = recordSale(operational, sale)
        const indices = sale.items.map(item => products.findIndex((p: { id: string }) => p.id === item.productId))
        const customerIndex = sale.customerId ? customers.find((c: { id: string }) => c.id === sale.customerId)?.index ?? -1 : -1
        tx.set(requestRef, { sale, indices, customerIndex, fingerprint, auditId: id, createdAt: serverTimestamp() })
        tx.update(shop, { products: after.products, sales: arrayUnion(sale), schemaVersion: 2, auditId: id, updatedAt: serverTimestamp(), updatedBy: user.uid, updatedByEmail: accessKey(user.email!) })
        tx.update(doc(db, 'dashboard', 'public'), { sales: arrayUnion(dashboardSale(sale)), revision: id })
        tx.update(doc(db, 'saleRegistry', 'ids'), { ids: arrayUnion(sale.id), revision: id })
        tx.set(doc(db, 'catalog', 'products'), { products: after.products, revision: id })
        tx.set(doc(db, 'auditV2', id), { ...header(user, id, 'venda', 'Venda registrada'), saleId: sale.id, sale, beforeProducts: products, afterProducts: after.products })
        return { id: sale.id, repeated: false }
      })
    },
    async previewUndo({ id }: { id: string }) {
      identity()
      const entry = await getDocFromServer(doc(db, 'auditV2', id))
      if (entry.data()?.action === 'venda') {
        const e = entry.data()!
        return [{ source: 'products', count: diffRows('products', e.beforeProducts, e.afterProducts).length }, { source: 'sales', count: 1 }]
      }
      const [before, after] = await Promise.all([getDocFromServer(doc(db, 'auditSnapshots', id, 'versions', 'before')), getDocFromServer(doc(db, 'auditSnapshots', id, 'versions', 'after'))])
      const b = core(before.data()), a = core(after.data())
      return (['products', 'sales', 'customers'] as const).map(source => ({ source, count: diffRows(source, b[source], a[source]).length })).filter(item => item.count)
    },
    async undoAction({ id }: { id: string }) {
      const user = identity(), nextId = auditId()
      if (!/^v2-[a-f0-9-]{36}$/.test(id)) throw new Error('Ação sem dados de recuperação.')
      return runTransaction(db, async tx => {
        const entry = await tx.get(doc(db, 'auditV2', id))
        const [receipt, store] = await Promise.all([tx.get(doc(db, 'auditReversals', id)), tx.get(shop)])
        if (receipt.exists()) throw new Error('Esta ação já foi desfeita.')
        if (!entry.data()?.hasUndo) throw new Error('Esta ação não pode ser desfeita.')
        let originalBefore: StoreData, originalAfter: StoreData
        if (entry.data()?.action === 'venda') {
          const e = entry.data()!
          originalBefore = core({ products: e.beforeProducts, sales: [], customers: [] })
          originalAfter = core({ products: e.afterProducts, sales: [e.sale], customers: [] })
        } else {
          const [beforeDoc, afterDoc] = await Promise.all([tx.get(doc(db, 'auditSnapshots', id, 'versions', 'before')), tx.get(doc(db, 'auditSnapshots', id, 'versions', 'after'))])
          originalBefore = core(beforeDoc.data()); originalAfter = core(afterDoc.data())
        }
        const current = core(store.data())
        const patches = (['products', 'sales', 'customers'] as const).flatMap(source => diffRows(source, originalBefore[source], originalAfter[source]))
        const after = core(reversePatches({ ...current, custos: [], perdas: [] }, patches))
        writeStore(tx, user, nextId, current, after, 'desfazer', 'Reversão de ' + id, id)
        tx.set(doc(db, 'auditReversals', id), { auditId: nextId, actorUid: user.uid, createdAt: serverTimestamp() })
        return { done: true }
      })
    },
    async changeTeamAccess({ email, role }: { email: string; role: Role }) {
      const user = identity(), target = accessKey(email), id = auditId()
      if (!/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(target) || target.length > 254 || !['owner', 'admin', 'employee', 'viewer', 'blocked'].includes(role)) throw new Error('E-mail ou cargo inválido.')
      return runTransaction(db, async tx => {
        const ref = doc(db, 'teamAccess', target)
        const [previous, own] = await Promise.all([tx.get(ref), tx.get(doc(db, 'teamAccess', accessKey(user.email!)))])
        if (!can(own.data()?.role, 'team') || target === accessKey(user.email!) || previous.data()?.role === 'owner') throw new Error('Apenas o dono pode alterar outros acessos. O dono não pode ser alterado.')
        tx.set(ref, { email: target, role, updatedAt: serverTimestamp(), auditId: id })
        tx.set(doc(db, 'auditV2', id), { ...header(user, id, 'equipe', 'Acesso da equipe atualizado', false), targetEmail: target, beforeRole: previous.data()?.role || 'blocked', afterRole: role })
        return { done: true }
      })
    },
  }
}
