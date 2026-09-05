// Run only with authorized Application Default Credentials; never put a key in the repo.
import { createRequire } from 'node:module'
const require = createRequire(new URL('../functions/package.json', import.meta.url))
const { initializeApp, applicationDefault } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const emailIndex = process.argv.indexOf('--email')
const email = emailIndex >= 0 ? process.argv[emailIndex + 1]?.trim().toLowerCase() : ''
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Informe --email com a conta Google do dono.')
const projectId = 'sitezayuo'
initializeApp({ credential: applicationDefault(), projectId })
const user = await getAuth().getUserByEmail(email)
if (!user.emailVerified || user.disabled) throw new Error('A conta precisa estar ativa e verificada.')
const db = getFirestore()
if (!process.argv.includes('--apply')) {
  console.log('Prévia: definir a conta informada como dono em ' + projectId + '. Acrescente --apply para executar.')
} else {
  await db.runTransaction(async tx => {
    const owners = await tx.get(db.collection('team').where('role', '==', 'owner'))
    if (!owners.empty) throw new Error('Já existe um dono. Este script não transfere propriedade.')
    const store = await tx.get(db.doc('loja/dados'))
    if (!store.exists) throw new Error('A loja não foi encontrada. Confira o projeto.')
    tx.set(db.doc('team/' + user.uid), { uid: user.uid, email, role: 'owner', name: user.displayName || email, updatedAt: FieldValue.serverTimestamp() })
    const id = crypto.randomUUID()
    tx.create(db.doc('audit/' + id), { id, ts: Date.now(), actor: 'Configuração inicial', actorUid: user.uid, action: 'equipe', detail: 'Dono inicial configurado por operador autorizado.' })
  })
  console.log('Dono inicial configurado.')
}
