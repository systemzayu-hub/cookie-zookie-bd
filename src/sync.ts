import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getFirestore, doc, onSnapshot, collection, query, orderBy, limit, getDocs, type Firestore } from 'firebase/firestore'
import { getAuth, setPersistence, browserLocalPersistence, inMemoryPersistence, signInWithEmailAndPassword, signInWithPopup, reauthenticateWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, type Auth, type User } from 'firebase/auth'
import { FIREBASE_APP_CHECK_SITE_KEY, FIREBASE_CONFIG } from './firebase-config'
import { validateStoreData, type StoreData } from './validation'
import { OWNER_KEY_EMAIL } from './owner-access'
import { createFreeStore } from './free-store'
import type { Role } from './roles'
import type { UndoPatch } from './undo-model'

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
    await setPersistence(auth, browserLocalPersistence)
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
export async function authLoginOwnerKey(key: string) {
  await firebaseReady()
  if (!auth || !key || key.length > 128) throw new Error('Informe a chave de acesso.')
  await setPersistence(auth, inMemoryPersistence)
  await signInWithEmailAndPassword(auth, OWNER_KEY_EMAIL, key)
}
export async function authLogout(): Promise<void> {
  if (!auth) return
  try {
    await signOut(auth)
  } catch {
    /* ignore */
  }
}


export async function callBackend<T>(name: string, data: unknown = {}): Promise<T> {
  await firebaseReady()
  if (!app || !auth?.currentUser) throw new Error('Entre com Google para continuar.')
  if (!db) throw new Error('Banco indisponível.')
  const service = createFreeStore(db, () => auth?.currentUser || null)
  const operation = (service as unknown as Record<string, (input: unknown) => Promise<unknown>>)[name]
  if (!operation) throw new Error('Operação inválida.')
  return await operation(data) as T
}
export async function syncCommit(base: StoreData, local: StoreData): Promise<StoreData> {
  return callBackend<StoreData>('commitStore', { base, local })
}

export async function watchAccess(uid: string, callback: (role: Role | null) => void, failure: () => void) {
  await callBackend('getMyAccess')
  if (!db) throw new Error('Acesso indisponível.')
  const email = auth?.currentUser?.email?.toLowerCase()
  if (!email || auth?.currentUser?.uid !== uid) throw new Error('A conta mudou.')
  return onSnapshot(doc(db, 'teamAccess', email), { includeMetadataChanges: true }, snapshot => {
    if (snapshot.metadata.fromCache) { callback(null); return }
    const role = snapshot.data()?.role
    callback(!snapshot.exists() ? 'viewer' : ['owner', 'admin', 'employee', 'viewer'].includes(role) ? role : 'blocked')
  }, failure)
}
export type TeamMember = { uid?: string; email: string; role: Role; name?: string; invited?: boolean }
export function watchTeam(callback: (members: TeamMember[]) => void, failure: () => void) {
  if (!db) return () => {}
  let access: TeamMember[] = [], profiles: TeamMember[] = []
  const emit = () => {
    const merged = new Map(profiles.map(p => [p.email, { ...p, role: 'viewer' as Role }]))
    access.forEach(a => merged.set(a.email, { ...merged.get(a.email), ...a }))
    callback([...merged.values()].sort((a,b) => (a.name || a.email).localeCompare(b.name || b.email)))
  }
  const a = onSnapshot(collection(db, 'teamAccess'), snap => { access = snap.docs.map(d => d.data() as TeamMember); emit() }, failure)
  const b = onSnapshot(collection(db, 'loginProfiles'), snap => { profiles = snap.docs.map(d => d.data() as TeamMember); emit() }, failure)
  return () => { a(); b() }
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
  undo?: UndoPatch[]
  hasUndo?: boolean
  undoOf?: string
  local?: boolean
}


function readAudit(value: Record<string, any>): AuditEntryDB {
  return { ...value, ts: value.createdAt?.toMillis?.() || value.ts || 0 } as AuditEntryDB
}
export async function auditPullDB(max = 1000): Promise<AuditEntryDB[]> {
  if (!await firebaseReady() || !db) throw new Error('Auditoria indisponível.')
  const [recent, legacy] = await Promise.all([
    getDocs(query(collection(db, 'auditV2'), orderBy('createdAt', 'desc'), limit(max))),
    getDocs(query(collection(db, 'audit'), orderBy('ts', 'desc'), limit(max))),
  ])
  return [...recent.docs.map(d => readAudit(d.data())), ...legacy.docs.map(d => ({ ...readAudit(d.data()), hasUndo: false }))]
}
export function onAuditChanges(cb: (entries: AuditEntryDB[]) => void, failure?: () => void): () => void {
  if (!db) return () => {}
  return onSnapshot(query(collection(db, 'auditV2'), orderBy('createdAt', 'desc'), limit(500)),
    snap => cb(snap.docs.map(d => readAudit(d.data()))), () => failure?.())
}
