import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getFirestore, doc, getDoc, setDoc, onSnapshot, collection, query, orderBy, limit, getDocs, addDoc, type Firestore } from 'firebase/firestore'
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, type Auth, type User } from 'firebase/auth'
import { FIREBASE_CONFIG } from './firebase-config'

let app: FirebaseApp | null = null
let db: Firestore | null = null
let auth: Auth | null = null
let firebaseInitialized = false

/** Inicializa o Firebase (idempotente). Retorna true se ok, false se falhar. */
export async function firebaseReady(): Promise<boolean> {
  if (firebaseInitialized) return !!db
  try {
    app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG)
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

/** Puxa dados do Firestore (collection 'loja', doc 'dados'). */
export async function syncPull(): Promise<{ products: unknown[]; sales: unknown[]; customers: unknown[]; pendencias: unknown[] } | null> {
  const ready = await firebaseReady()
  if (!ready || !db) return null
  try {
    const snap = await getDoc(doc(db, 'loja', 'dados'))
    if (!snap.exists()) return null
    const data = snap.data()
    return {
      products: data.products ?? [],
      sales: data.sales ?? [],
      customers: data.customers ?? [],
      pendencias: data.pendencias ?? [],
    }
  } catch {
    return null
  }
}

/** Empurra dados para o Firestore (collection 'loja', doc 'dados'). */
export async function syncPush(products: unknown[], sales: unknown[], customers: unknown[], pendencias?: unknown[]): Promise<void> {
  const ready = await firebaseReady()
  if (!ready || !db) return
  try {
    await setDoc(doc(db, 'loja', 'dados'), {
      products,
      sales,
      customers,
      ...(pendencias ? { pendencias } : {}),
      updatedAt: new Date().toISOString(),
    })
  } catch {
    /* ignore - localStorage é fallback */
  }
}

/** Observa mudanças remotas no doc 'dados'. Retorna função de unsubscribe. */
export function onRemoteChanges(cb: (data: { products: unknown[]; sales: unknown[]; customers: unknown[]; pendencias: unknown[] }) => void): () => void {
  if (!db) return () => {}
  const unsub = onSnapshot(doc(db, 'loja', 'dados'), (snap) => {
    if (!snap.exists()) return
    const data = snap.data()
    cb({
      products: data.products ?? [],
      sales: data.sales ?? [],
      customers: data.customers ?? [],
      pendencias: data.pendencias ?? [],
    })
  })
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
    await addDoc(collection(db, 'audit'), entry)
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