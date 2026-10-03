import { OWNER_KEY_UID } from './owner-access'
import { arrayUnion, doc, getDocFromServer, setDoc, runTransaction, serverTimestamp, type Firestore, type Transaction } from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { mergeStore, sameData } from './store-merge'
import { validateStoreData, type StoreData } from './validation'
import { employeeSale } from './employee-sale'
import { recordSale, removeSale } from './record-sale'
import { editSale, type SaleEdit } from './edit-sale'
import { changeDebit, isDebitAudit, type DebitChange } from './debit-change'
import { diffRows, reversePatches } from './undo-model'
import { changesFromPatches } from './audit-changes'
import { can, type Role } from './roles'
import type { Sale } from './types'
import { summarizeSale, summarizeStoreChange, summarizeTeam } from './audit-summary'
import { payCustomer, type CustomerPayment } from './sale-adjustments'
import { combineCustomers as combineCustomerData, type CustomerMerge } from './combine-customers'
import { adjustmentReceiptId, customerReceiptRequestHash, receiptAllocations, receiptAdjustmentRows, validCustomerReceiptRequest } from './customer-receipts'

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
  const writeStore = (tx: Transaction, user: User, id: string, before: StoreData, after: StoreData, action: string, detail: string, undoOf = '', hasUndo = !undoOf, extra: Record<string, unknown> = {}) => {
    const adjustments = action === 'recebimento' ? [] : receiptAdjustmentRows(before, after)
    if (adjustments.length > 450) throw new Error('Esta alteração afetaria mais de 450 saldos de recebimentos. Divida a atualização em grupos menores; nenhum dado foi alterado.')
    tx.update(shop, { ...after, schemaVersion: 2, auditId: id, updatedAt: serverTimestamp(), updatedBy: user.uid, updatedByEmail: accessKey(user.email!) })
    tx.set(doc(db, 'saleRegistry', 'ids'), { ids: arrayUnion(...after.sales.map(sale => sale.id)), revision: id }, { merge: true })
    tx.set(doc(db, 'dashboard', 'public'), { sales: after.sales.map(dashboardSale), revision: id })
    tx.set(doc(db, 'catalog', 'products'), { products: after.products, revision: id })
    tx.set(doc(db, 'catalog', 'customers'), { customers: catalogCustomers(after), revision: id })
    tx.set(doc(db, 'auditV2', id), { ...header(user, id, action, detail, hasUndo, undoOf), ...extra })
    writeSnapshots(tx, id, before, after)
    if (action !== 'recebimento') {
      for (const adjustment of adjustments) {
        const receiptId = adjustmentReceiptId(id, adjustment.saleId)
        tx.set(doc(db, 'customerReceipts', adjustment.customerId, 'entries', receiptId), {
          id: receiptId, customerId: adjustment.customerId, amount: adjustment.amount,
          recordedAt: serverTimestamp(), actor: (user.displayName || user.email || 'Equipe').slice(0, 120), actorUid: user.uid,
          allocations: [{ saleId: adjustment.saleId, amount: adjustment.amount }], kind: 'adjustment', auditId: id,
        })
      }
    }
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
          const detail = summarizeStoreChange(before, after)
          writeStore(tx, user, id, before, after, 'alteracao', detail)
        }
        return after
      })
    },
    async payCustomer(request: CustomerPayment) {
      const user = identity()
      if (!validCustomerReceiptRequest(request)) throw new Error('Informe forma e data do recebimento antes de continuar.')
      const id = auditId(), receiptRef = doc(db, 'customerReceipts', request.customerId, 'entries', request.receiptId)
      return runTransaction(db, async tx => {
        const [store, existing] = await Promise.all([tx.get(shop), tx.get(receiptRef)])
        if (existing.exists()) {
          const data = existing.data()
          if (data.customerId !== request.customerId || data.requestHash !== customerReceiptRequestHash(request)) throw new Error('Este identificador já foi usado para outro recebimento.')
          return core(store.data())
        }
        const before = core(store.data())
        const after = core(payCustomer(before, request))
        const allocations = receiptAllocations(before, after)
        if (!allocations.length || Math.abs(allocations.reduce((sum, row) => sum + row.amount, 0) - request.amount) > 0.001) throw new Error('Não foi possível vincular o recebimento às vendas pendentes.')
        if (allocations.length > 1000) throw new Error('Este recebimento abrangeria mais de 1.000 vendas. Selecione uma venda ou faça recebimentos menores; nenhum dado foi alterado.')
        const customer = before.customers.find(item => item.id === request.customerId)!
        const detail = `Recebimento de ${request.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} para ${customer.name}`
        const requestHash = customerReceiptRequestHash(request)
        writeStore(tx, user, id, before, after, 'recebimento', detail, '', false, { receiptId: request.receiptId, customerId: request.customerId, amount: request.amount, payment: request.payment, date: request.date, allocations, requestHash })
        tx.set(receiptRef, {
          id: request.receiptId, customerId: request.customerId, amount: request.amount, payment: request.payment, date: request.date,
          recordedAt: serverTimestamp(), actor: (user.displayName || user.email || 'Equipe').slice(0, 120), actorUid: user.uid,
          allocations, kind: 'receipt', auditId: id, requestHash,
        })
        return after
      })
    },
    async combineCustomers(request: CustomerMerge) {
      const user = identity(), id = auditId()
      return runTransaction(db, async tx => {
        const [access, store, sourceAliases, targetAliases] = await Promise.all([
          tx.get(doc(db, 'teamAccess', accessKey(user.email!))), tx.get(shop),
          tx.get(doc(db, 'customerReceiptAliases', request.source.id)), tx.get(doc(db, 'customerReceiptAliases', request.target.id)),
        ])
        if (!can(access.data()?.role, 'manage')) throw new Error('Seu cargo não permite combinar clientes.')
        const before = core(store.data())
        const after = core(combineCustomerData(before, request))
        const sourceIds = [...new Set([request.source.id, ...(Array.isArray(sourceAliases.data()?.sources) ? sourceAliases.data()!.sources : []), ...(Array.isArray(targetAliases.data()?.sources) ? targetAliases.data()!.sources : [])])]
        if (sourceIds.length > 350) throw new Error('Este cliente tem muitas origens de histórico para combinar de uma só vez. O cadastro foi preservado; peça ao dono para revisar a combinação.')
        writeStore(tx, user, id, before, after, 'alteracao', summarizeStoreChange(before, after, `Cliente ${request.source.name} combinado com ${request.target.name}`))
        tx.set(doc(db, 'customerReceiptAliases', request.target.id), { customerId: request.target.id, sources: sourceIds, auditId: id, updatedAt: serverTimestamp(), actorUid: user.uid })
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
        tx.set(doc(db, 'auditV2', id), { ...header(user, id, 'venda', summarizeSale(sale, operational)), saleId: sale.id, sale, beforeProducts: products, afterProducts: after.products })
        return { id: sale.id, repeated: false }
      })
    },
    async editSale({ sale, changes, reviewed, operationId }: SaleEdit) {
      const user = identity()
      if (!/^v2-[a-f0-9-]{36}$/.test(operationId)) throw new Error('Identificador da edição inválido.')
      return runTransaction(db, async tx => {
        const [access, store, receipt] = await Promise.all([
          tx.get(doc(db, 'teamAccess', accessKey(user.email!))), tx.get(shop),
          tx.get(doc(db, 'auditSnapshots', operationId, 'versions', 'after')),
        ])
        if (!can(access.data()?.role, 'manage')) throw new Error('Seu cargo não permite editar vendas.')
        if (receipt.exists()) throw new Error('Esta edição já foi aplicada. Atualize o histórico.')
        const before = core(store.data())
        const after = core(editSale(before, sale, changes))
        if (!sameData(after.sales.find(s => s.id === sale.id), reviewed)) throw new Error('Os preços ou os dados mudaram. Revise novamente a edição antes de salvar.')
        if (!sameData(before, after)) writeStore(tx, user, operationId, before, after, 'alteracao', summarizeStoreChange(before, after, `Venda ${sale.id} editada`))
        return after
      })
    },
    async changeDebit(request: DebitChange) {
      const user = identity()
      if (!/^v2-[a-f0-9-]{36}$/.test(request.operationId)) throw Error('Identificador da alteração inválido.')
      if (!request.payment?.id || request.payment.id.includes('/')) throw Error('Identificador do pagamento inválido.')
      const paymentRef = doc(db, 'ownerPayments', request.payment.id)
      return runTransaction(db, async tx => {
        const [access, store, payment, receipt] = await Promise.all([
          tx.get(doc(db, 'teamAccess', accessKey(user.email!))), tx.get(shop), tx.get(paymentRef),
          tx.get(doc(db, 'auditSnapshots', request.operationId, 'versions', 'after')),
        ])
        if (!can(access.data()?.role, 'manage')) throw Error('Seu cargo não permite alterar pagamentos.')
        if (receipt.exists()) throw Error('Esta alteração já foi aplicada. Atualize o histórico.')
        const remote = payment.exists() && !payment.data().deleted ? payment.data().data : undefined
        if (request.reopen ? !sameData(remote, request.payment) : remote !== undefined) throw Error('Este pagamento mudou em outro aparelho. Atualize o histórico.')
        const before = core(store.data())
        const changed = changeDebit(before, request)
        const after = core(changed.store)
        const financialBefore = !payment.exists() ? null : payment.data().deleted ? { deleted: true } : { data: JSON.parse(JSON.stringify(remote)), deleted: false }
        const financialAfter = { data: JSON.parse(JSON.stringify(changed.payment)), deleted: false }
        writeStore(tx, user, request.operationId, before, after, 'alteracao', summarizeStoreChange(before, after, `Pagamento de débito: venda ${request.sale.id} ${request.reopen ? 'reaberta como debitada' : 'marcada como paga'}; histórico de pagamento atualizado na mesma operação`), '', false, { source: 'payment', recordId: request.payment.id, financialBefore, financialAfter })
        tx.set(paymentRef, {...financialAfter, updatedAt: serverTimestamp(), auditId: request.operationId})
        return after
      })
    },
    async deleteSale({ sale }: { sale: Sale }) {
      const user = identity(), id = auditId()
      if (!sale || typeof sale.id !== 'string' || !sale.id) throw new Error('Venda inválida.')
      return runTransaction(db, async tx => {
        const [access, store] = await Promise.all([
          tx.get(doc(db, 'teamAccess', accessKey(user.email!))),
          tx.get(shop),
        ])
        if (!can(access.data()?.role, 'manage')) throw new Error('Seu cargo não permite excluir vendas.')
        const before = core(store.data())
        const after = core(removeSale(before, sale))
        const detail = summarizeStoreChange(before, after, `Venda ${sale.id} excluída; estoque recomposto`)
        writeStore(tx, user, id, before, after, 'alteracao', detail)
        return after
      })
    },
    async previewUndo({ id }: { id: string }) {
      identity()
      const entry = await getDocFromServer(doc(db, 'auditV2', id))
      if (isDebitAudit(entry.data()?.detail || '')) throw Error('Reverta o débito na área Pagamentos para manter a venda e o histórico consistentes.')
      if (entry.data()?.action === 'venda') {
        const e = entry.data()!
        return [{ source: 'products', count: diffRows('products', e.beforeProducts, e.afterProducts).length }, { source: 'sales', count: 1 }]
      }
      const [before, after] = await Promise.all([getDocFromServer(doc(db, 'auditSnapshots', id, 'versions', 'before')), getDocFromServer(doc(db, 'auditSnapshots', id, 'versions', 'after'))])
      const b = core(before.data()), a = core(after.data())
      return (['products', 'sales', 'customers'] as const).map(source => ({ source, count: diffRows(source, b[source], a[source]).length })).filter(item => item.count)
    },
    async auditDetails({ id }: { id: string }) {
      identity()
      const entry = await getDocFromServer(doc(db, 'auditV2', id))
      if (!entry.exists()) return { changes: [], unavailable: true }
      const event = entry.data()
      if (event.action === 'equipe') return { changes: [{ entity: `Acesso: ${event.targetEmail || 'conta'}`, field: 'role', before: event.beforeRole, after: event.afterRole }] }
      if (event.action === 'financeiro' && ['cost', 'loss'].includes(event.source) && typeof event.recordId === 'string') {
        const [beforeDoc, afterDoc] = await Promise.all([getDocFromServer(doc(db, 'auditSnapshots', id, 'versions', 'before')), getDocFromServer(doc(db, 'auditSnapshots', id, 'versions', 'after'))])
        const beforeValue = beforeDoc.data()?.record && typeof beforeDoc.data()!.record === 'object' ? beforeDoc.data()!.record as Record<string, unknown> : undefined
        const afterValue = afterDoc.data()?.record && typeof afterDoc.data()!.record === 'object' ? afterDoc.data()!.record as Record<string, unknown> : undefined
        const record = afterValue || beforeValue || {}
        const name = String(event.source === 'cost' ? record.name || 'produto não identificado' : record.produto || 'produto não identificado')
        const entity = `${event.source === 'cost' ? 'Custo' : 'Perda'}: ${name}`
        const changes = [...new Set([...Object.keys(beforeValue || {}), ...Object.keys(afterValue || {})])].filter(field => field !== 'id' && !sameData(beforeValue?.[field], afterValue?.[field]))
          .map(field => ({ entity, field, before: beforeValue?.[field], after: afterValue?.[field], source: event.source as 'cost' | 'loss', entityId: event.recordId }))
        if (event.baselineDeclared) changes.unshift({ entity, field: 'Registro anterior', before: 'Sem registro anterior no servidor', after: 'Estado inicial informado neste aparelho', source: event.source as 'cost' | 'loss', entityId: event.recordId })
        return { changes, unavailable: !changes.length }
      }
      if (event.action === 'financeiro' && ['purchase', 'payment'].includes(event.source) && typeof event.recordId === 'string') {
        const [beforeDoc, afterDoc] = await Promise.all([getDocFromServer(doc(db, 'auditSnapshots', id, 'versions', 'before')), getDocFromServer(doc(db, 'auditSnapshots', id, 'versions', 'after'))])
        const oldRecord = beforeDoc.data()?.record, newRecord = afterDoc.data()?.record
        const beforeValue = oldRecord?.data && typeof oldRecord.data === 'object' ? oldRecord.data as Record<string, unknown> : {}
        const afterValue = newRecord?.data && typeof newRecord.data === 'object' ? newRecord.data as Record<string, unknown> : {}
        const record = Object.keys(afterValue).length ? afterValue : beforeValue
        const name = event.source === 'purchase' ? String(record.shop || 'Estabelecimento não informado') : String(record.description || record.person || 'Pagamento sem descrição')
        const entity = event.source === 'purchase' ? `Compra: ${name}` : `Pagamento: ${name}`
        const changes = Object.keys({ ...beforeValue, ...afterValue }).filter(field => field !== 'id' && !sameData(beforeValue[field], afterValue[field]))
          .map(field => ({ entity, field, before: beforeValue[field], after: afterValue[field], source: event.source, entityId: event.recordId }))
        if (oldRecord?.deleted !== newRecord?.deleted) changes.push({ entity, field: 'Registro', before: oldRecord ? oldRecord.deleted ? 'Excluído' : 'Ativo' : undefined, after: newRecord ? newRecord.deleted ? 'Excluído' : 'Ativo' : undefined, source: event.source, entityId: event.recordId })
        return { changes, unavailable: !changes.length }
      }
      if (event.action === 'alteracao' && event.source === 'payment' && 'financialBefore' in event && event.financialAfter) {
        const [beforeDoc, afterDoc] = await Promise.all([getDocFromServer(doc(db, 'auditSnapshots', id, 'versions', 'before')), getDocFromServer(doc(db, 'auditSnapshots', id, 'versions', 'after'))])
        const left = validateStoreData(beforeDoc.data()), right = validateStoreData(afterDoc.data())
        const patches = left && right ? (['products', 'sales', 'customers'] as const).flatMap(source => diffRows(source, left[source], right[source])) : []
        const changes = left && right ? changesFromPatches(patches, { beforeCustomers: left.customers, afterCustomers: right.customers }) : []
        const oldRecord = event.financialBefore?.data as Record<string, unknown> | undefined
        const newRecord = event.financialAfter.data as Record<string, unknown> | undefined
        const entity = `Pagamento: ${String(newRecord?.person || oldRecord?.person || newRecord?.description || oldRecord?.description || 'débito')}`
        for (const field of new Set([...Object.keys(oldRecord || {}), ...Object.keys(newRecord || {})])) {
          if (!sameData(oldRecord?.[field], newRecord?.[field])) changes.push({ entity, field, before: oldRecord?.[field], after: newRecord?.[field], source: 'payment', entityId: event.recordId })
        }
        if (event.financialBefore?.deleted !== event.financialAfter.deleted) changes.push({ entity, field: 'Registro', before: event.financialBefore?.deleted ? 'Excluído' : oldRecord ? 'Ativo' : 'Sem registro anterior', after: event.financialAfter.deleted ? 'Excluído' : newRecord ? 'Ativo' : 'Sem registro anterior', source: 'payment', entityId: event.recordId })
        return { changes, unavailable: !changes.length }
      }
      // A failed request must remain retryable, rather than look like missing history.
      const [before, after] = event.action === 'venda'
        ? [{ data: () => ({ products: event.beforeProducts || [], sales: [], customers: [] }) }, { data: () => ({ products: event.afterProducts || [], sales: event.sale ? [event.sale] : [], customers: [] }) }]
        : await Promise.all([getDocFromServer(doc(db, 'auditSnapshots', id, 'versions', 'before')), getDocFromServer(doc(db, 'auditSnapshots', id, 'versions', 'after'))])
      const left = validateStoreData(before.data()), right = validateStoreData(after.data())
      if (!left || !right) return { changes: [], unavailable: true }
      const patches = (['products', 'sales', 'customers'] as const).flatMap(source => diffRows(source, left[source], right[source]))
      return { changes: changesFromPatches(patches, { beforeCustomers: left.customers, afterCustomers: right.customers }), unavailable: !patches.length }
    },
    async undoAction({ id }: { id: string }) {
      const user = identity(), nextId = auditId()
      if (!/^v2-[a-f0-9-]{36}$/.test(id)) throw new Error('Ação sem dados de recuperação.')
      return runTransaction(db, async tx => {
        const entry = await tx.get(doc(db, 'auditV2', id))
        const [receipt, store] = await Promise.all([tx.get(doc(db, 'auditReversals', id)), tx.get(shop)])
        if (receipt.exists()) throw new Error('Esta ação já foi desfeita.')
        if (isDebitAudit(entry.data()?.detail || '')) throw Error('Reverta o débito na área Pagamentos para manter a venda e o histórico consistentes.')
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
        writeStore(tx, user, nextId, current, after, 'desfazer', summarizeStoreChange(current, after, 'Reversão do registro ' + id), id)
        tx.set(doc(db, 'auditReversals', id), { auditId: nextId, actorUid: user.uid, createdAt: serverTimestamp() })
        return { done: true }
      })
    },
    async changeTeamAccess({ email, role }: { email: string; role: Role }) {
      const user = identity(), target = accessKey(email), id = auditId()
      if (!/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(target) || target.length > 254 || !['owner', 'admin', 'employee', 'viewer', 'blocked'].includes(role)) throw new Error('E-mail ou cargo inválido.')
      const ownRef = doc(db, 'teamAccess', accessKey(user.email!))
      const access = await getDocFromServer(ownRef)
      if (!can(access.data()?.role, 'team') || target === accessKey(user.email!)) throw new Error('Apenas o dono pode alterar outros acessos. O dono não pode ser alterado.')
      return runTransaction(db, async tx => {
        const ref = doc(db, 'teamAccess', target)
        const own = await tx.get(ownRef)
        if (!can(own.data()?.role, 'team') || target === accessKey(user.email!)) throw new Error('Apenas o dono pode alterar outros acessos. O dono não pode ser alterado.')
        const previous = await tx.get(ref)
        if (previous.data()?.role === 'owner') throw new Error('O acesso do dono não pode ser alterado.')
        tx.set(ref, { email: target, role, updatedAt: serverTimestamp(), auditId: id })
        const beforeRole = (previous.data()?.role || 'blocked') as Role
        tx.set(doc(db, 'auditV2', id), { ...header(user, id, 'equipe', summarizeTeam(target, beforeRole, role), false), targetEmail: target, beforeRole, afterRole: role })
        return { done: true }
      })
    },
  }
}
