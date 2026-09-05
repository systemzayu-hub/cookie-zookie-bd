import { readFile, writeFile, mkdtemp } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { build } from 'esbuild'
const require = createRequire(import.meta.url)
const option = key => { const i = process.argv.indexOf(key); return i < 0 ? '' : process.argv[i + 1] }
const cli = option('--firebase-tools')
if (!cli) throw Error('Informe --firebase-tools apontando para a pasta lib da CLI autenticada.')
const auth = require(join(cli, 'auth.js')), api = require(join(cli, 'api.js'))
const project = 'sitezayuo', projectPath = 'projects/' + project
const account = auth.getProjectDefaultAccount(process.cwd())
if (!account?.tokens?.refresh_token) throw Error('CLI sem conta autenticada.')
const response = await fetch('https://oauth2.googleapis.com/token', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:new URLSearchParams({refresh_token:account.tokens.refresh_token,client_id:api.clientId(),client_secret:api.clientSecret(),grant_type:'refresh_token'}) })
const token = await response.json()
if (!token.access_token) throw Error('Falha ao autenticar.')
const headers = {Authorization:'Bearer ' + token.access_token,'Content-Type':'application/json'}
async function request(url, method='GET', body) {
  const res=await fetch(url,{method,headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)})
  if (!res.ok) throw Error('API ' + res.status + ': ' + (await res.json()).error?.message)
  return res.json()
}
const who = await request('https://www.googleapis.com/oauth2/v2/userinfo')
const iam = await request('https://cloudresourcemanager.googleapis.com/v1/' + projectPath + ':getIamPolicy','POST',{})
if (!who.verified_email || !iam.bindings?.some(b=>b.role==='roles/owner' && b.members.includes('user:'+who.email))) throw Error('Exige identidade verificada e dona do projeto.')
const billing = await request('https://cloudbilling.googleapis.com/v1/' + projectPath + '/billingInfo')
if (billing.billingEnabled) throw Error('O projeto deixou de estar no plano gratuito. Rever antes de continuar.')
const documents = 'https://firestore.googleapis.com/v1/' + projectPath + '/databases/(default)/documents'
const rulesBase = 'https://firebaserules.googleapis.com/v1/'
const existing = await request(documents + '/teamAccess')
if (existing.documents?.length) throw Error('teamAccess ja existe: esta migracao inicial nao sobrescreve acessos.')
const backup = await mkdtemp(join(tmpdir(),'cookie-free-migration-'))
const store = await request(documents + '/loja/dados')
const release = await request(rulesBase + projectPath + '/releases/cloud.firestore')
const oldRules = await request(rulesBase + release.rulesetName)
for (const [name,value] of Object.entries({store,release,rules:oldRules})) await writeFile(join(backup,name+'.json'),JSON.stringify(value,null,2))
const bundled = await build({entryPoints:[resolve('src/validation.ts')],bundle:true,platform:'node',format:'cjs',write:false})
const modelPath = join(backup,'validation.cjs')
await writeFile(modelPath,bundled.outputFiles[0].contents)
const {validateStoreData} = require(modelPath)
const decode = v => 'mapValue' in v ? Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,v])=>[k,decode(v)])) : 'arrayValue' in v ? (v.arrayValue.values||[]).map(decode) : 'integerValue' in v ? Number(v.integerValue) : 'doubleValue' in v ? v.doubleValue : 'stringValue' in v ? v.stringValue : 'booleanValue' in v ? v.booleanValue : 'timestampValue' in v ? v.timestampValue : null
const encode = v => v === null ? {nullValue:null} : Array.isArray(v) ? {arrayValue:{values:v.map(encode)}} : typeof v==='object' ? {mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,v])=>[k,encode(v)]))}} : typeof v==='number' ? Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v} : typeof v==='boolean'?{booleanValue:v}:{stringValue:v}
const raw = decode({mapValue:{fields:store.fields}})
const data = validateStoreData(raw)
if (!data) throw Error('Banco atual nao passou na validacao; nada foi alterado.')
const counts = {products:data.products.length,customers:data.customers.length,sales:data.sales.length}
console.log(JSON.stringify({backup,counts,billingEnabled:false,normalizationNeeded:JSON.stringify(raw.products)!==JSON.stringify(data.products)||JSON.stringify(raw.sales)!==JSON.stringify(data.sales)||JSON.stringify(raw.customers)!==JSON.stringify(data.customers),apply:process.argv.includes('--apply')}))
if (!process.argv.includes('--apply')) process.exit(0)
const source = await readFile('firestore.rules','utf8')
const nextRules = await request(rulesBase + projectPath + '/rulesets','POST',{source:{files:[{name:'firestore.rules',content:source}]}})
const setRelease = rulesetName => request(rulesBase + release.name,'PATCH',{release:{name:release.name,rulesetName}})
await setRelease(nextRules.name)
let seeded = false
try {
  const revision = 'bootstrap-free-' + Date.now()
  const email = who.email.toLowerCase()
  const documentName = path => projectPath + '/databases/(default)/documents/' + path
  const update = (path,value,condition) => ({update:{name:documentName(path),fields:encode(value).mapValue.fields},...(condition?{currentDocument:condition}:{})})
  const normalized = {...data,schemaVersion:2,auditId:revision}
  const writes = [
    {...update('loja/dados',normalized,{updateTime:store.updateTime}),updateMask:{fieldPaths:Object.keys(normalized)}},
    update('teamAccess/'+email,{email,role:'owner',auditId:revision,updatedAt:new Date().toISOString()},{exists:false}),
    update('catalog/products',{products:data.products,revision},{exists:false}),
    update('catalog/customers',{customers:data.customers.map(({id,name},index)=>({id,name,index})),revision},{exists:false}),
    update('saleRegistry/ids',{ids:data.sales.map(s=>s.id),revision},{exists:false}),
  ]
  await request(documents+':commit','POST',{writes})
  seeded=true
  await writeFile(join(backup,'activation.json'),JSON.stringify({ruleset:nextRules.name,revision,counts}))
  const [liveRelease,liveStore,owner,products] = await Promise.all([request(rulesBase+release.name),request(documents+'/loja/dados'),request(documents+'/teamAccess/'+encodeURIComponent(email)),request(documents+'/catalog/products')])
  if (liveRelease.rulesetName!==nextRules.name || owner.fields.role.stringValue!=='owner' || liveStore.fields.auditId.stringValue!==revision || products.fields.revision.stringValue!==revision) throw Error('Verificacao de ativacao inconsistente.')
  console.log(JSON.stringify({activated:true,ruleset:nextRules.name,counts,billingEnabled:false,backup}))
} catch (error) {
  if (!seeded) { await setRelease(release.rulesetName); console.error('Regras anteriores restauradas; migracao de dados nao aplicada.') }
  throw error
}
