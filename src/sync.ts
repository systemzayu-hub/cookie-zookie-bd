import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getFirestore, doc, setDoc, runTransaction, onSnapshot, collection, query, orderBy, limit, getDocs, serverTimestamp, type Firestore } from 'firebase/firestore'
import { getAuth, signInWithPopup, reauthenticateWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, type Auth, type User } from 'firebase/auth'
import { FIREBASE_APP_CHECK_SITE_KEY, FIREBASE_CONFIG } from './firebase-config'
import { validateStoreData, type StoreData } from './validation'
import { mergeStore } from './store-merge'

let app: FirebaseApp | null = null
let db: Firestore | null = null
let auth: Auth | null = null
let firebaseInitialized = false
let appCheckInitialized = false

/** Inicializa o Firebase (idempotente). Retorna true se ok, false se falhar. */
export async function firebaseReady(): Promise<boolean> {
  if (firebaseInitialized) return !!db
  try {
    app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG)
    if (FIREBASE_APP_CHECK_SITE_KEY && !appCheckInitialized) {
      const { initializeAppCheck, ReCaptchaV3Provider } = await import('firebase/app-check')
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(FIREBASE_APP_CHECK_SITE_KEY),
        isTokenAutoRefreshEnabled: true,
      })
      appCheckInitialized = true
    }
    db = getFirestore(app)
    auth = getAuth(app)
    firebaseInitialized = true
    return true
  } catch {
    firebaseInitialized = false
    return false
  }
}

/** Retorna a instância do Firestore (inicializa se necessário). */
export function getDb(): Firestore | null {
  return db
}

/** Retorna a instância do Auth (inicializa se necessário). */
export function getAuthInstance(): Auth | null {
  return auth
}

/** Faz login com Google (popup). Retorna o usuário ou null se falhar/cancelar. */
export async function authLoginGoogle(): Promise<User | null> {
  await firebaseReady()
  if (!auth) return null
  try {
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })
    const result = await signInWithPopup(auth, provider)
    return result.user
  } catch (e) {
    throw e
  }
}

/** Retorna o usuário logado no momento (ou null). */
export function authCurrentUser(): User | null {
  return auth?.currentUser ?? null
}

/** Exige autenticação Google recente antes de revelar ou alterar dados sensíveis. */
export async function authReauthenticateGoogle(): Promise<User> {
  await firebaseReady()
  const user = auth?.currentUser
  if (!user) throw new Error('Usuário não autenticado')
  const result = await reauthenticateWithPopup(user, new GoogleAuthProvider())
  return result.user
}

/** Observa mudanças de estado de autenticação. Retorna função de unsubscribe. */
export function authOnChange(cb: (user: User | null) => void): () => void {
  if (!auth) {
    cb(null)
    return () => {}
  }
  return onAuthStateChanged(auth, cb)
}

/** Faz logout do usuário atual. */
export async function authLogout(): Promise<void> {
  if (!auth) return
  try {
    await signOut(auth)
  } catch {
    /* ignore */
  }
}

/** Atomically merge against the version actually edited by this device. */
export async function syncCommit(base: StoreData, local: StoreData): Promise<StoreData> {
  await firebaseReady()
  const user = auth?.currentUser
  if (!db || !user) throw new Error('Entre com Google para sincronizar.')
  const reference = doc(db, 'loja', 'dados')
  return runTransaction(db, async transaction => {
    const snapshot = await transaction.get(reference)
    const remote = snapshot.exists() ? validateStoreData(snapshot.data()) : base
    if (!remote) throw new Error('Os dados da equipe precisam ser verificados.')
    const merged = validateStoreData(mergeStore(base, local, remote))
    if (!merged) throw new Error('Dados inválidos. Revise as alterações.')
    transaction.set(reference, {
      ...merged, schemaVersion: 2, updatedAt: serverTimestamp(),
      updatedBy: user.uid, updatedByEmail: user.email || '',
    }, { merge: true })
    return merged
  })
}

/** Read the latest customers and update only contacts, with conflict retries. */
export async function importCustomerContacts(contacts: Record<string, string>) {
  await firebaseReady()
  const user = auth?.currentUser
  if (!db || !user) throw new Error('Entre com Google para importar os contatos.')
  const reference = doc(db, 'loja', 'dados')
  return runTransaction(db, async transaction => {
    const snapshot = await transaction.get(reference)
    const data = snapshot.exists() ? validateStoreData(snapshot.data()) : null
    if (!data) throw new Error('Não foi possível ler os clientes cadastrados.')
    const normalize = (name: string) => name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[°º]/g, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('pt-BR')
    const remaining = Object.keys(contacts)
    let updated = 0
    const customers = data.customers.map(customer => {
      const key = remaining.find(name => normalize(name) === normalize(customer.name))
      if (!key) return customer
      // Ambiguous names must be reviewed rather than assigned a phone silently.
      if (data.customers.filter(item => normalize(item.name) === normalize(key)).length !== 1) return customer
      remaining.splice(remaining.indexOf(key), 1)
      if (customer.contact === contacts[key]) return customer
      updated++
      return { ...customer, contact: contacts[key] }
    })
    if (updated) transaction.update(reference, {
      customers, schemaVersion: 2, updatedAt: serverTimestamp(),
      updatedBy: user.uid, updatedByEmail: user.email || '',
    })
    return { updated, missing: remaining, customers }
  })
}

/** Observa mudanças remotas no doc 'dados'. Retorna função de unsubscribe. */
export function onRemoteChanges(cb: (data: StoreData) => void, onError?: () => void): () => void {
  if (!db) return () => {}
  const unsub = onSnapshot(doc(db, 'loja', 'dados'), { includeMetadataChanges: true }, (snap) => {
    if (snap.metadata.fromCache || snap.metadata.hasPendingWrites) return
    if (!snap.exists()) { cb({ products: [], sales: [], customers: [] }); return }
    const data = validateStoreData(snap.data())
    if (data) cb(data)
    else onError?.()
  }, () => onError?.())
  return unsub
}

/* ================= AUDITORIA (sincronizada no Firestore) =================
 * A auditoria vive em uma coleção Firestore separada ('audit') com um
 * documento por entrada. Assim qualquer dispositivo (máquina/celular)
 * adiciona o que ELE fez sem sobrescrever o que os outros fizeram.
 */

export type AuditEntryDB = {
  id: string
  ts: number
  actor: string
  email?: string
  action: string
  detail: string
}

/** Grava UMA entrada de auditoria no Firestore (fire-and-forget). */
export async function auditPushDB(entry: AuditEntryDB): Promise<void> {
  const ready = await firebaseReady()
  if (!ready || !db) return
  try {
    await setDoc(doc(db, 'audit', entry.id), entry)
  } catch (e) {
    console.error('[audit] falha ao gravar no Firestore', e)
  }
}

/** Puxa as auditorias do Firestore (mais recentes primeiro). */
export async function auditPullDB(max = 2000): Promise<AuditEntryDB[]> {
  const ready = await firebaseReady()
  if (!ready || !db) return []
  try {
    const snap = await getDocs(query(collection(db, 'audit'), orderBy('ts', 'desc'), limit(max)))
    return snap.docs.map(d => d.data() as AuditEntryDB)
  } catch (e) {
    console.error('[audit] falha ao puxar do Firestore', e)
    return []
  }
}

/** Observa novas entradas de auditoria em tempo real. Retorna unsubscribe. */
export function onAuditChanges(cb: (entries: AuditEntryDB[]) => void): () => void {
  if (!db) return () => {}
  const unsub = onSnapshot(
    query(collection(db, 'audit'), orderBy('ts', 'desc'), limit(500)),
    (snap) => {
      cb(snap.docs.map(d => d.data() as AuditEntryDB))
    },
    (err) => console.error('[audit] falha no snapshot', err)
  )
  return unsub
}
