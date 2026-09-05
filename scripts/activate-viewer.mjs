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

const backup = await mkdtemp(join(tmpdir(),'cookie-viewer-migration-'))
const store = await request(documents+'/loja/dados')
const release = await request(rulesBase+projectPath+'/releases/cloud.firestore')
const oldRules = await request(rulesBase+release.rulesetName)
await writeFile(join(backup,'store.json'),JSON.stringify(store))
await writeFile(join(backup,'release.json'),JSON.stringify(release))
await writeFile(join(backup,'rules.json'),JSON.stringify(oldRules))
let profiles=[], page=''
do {
 const result=await request('https://identitytoolkit.googleapis.com/v1/'+projectPath+'/accounts:batchGet?maxResults=1000'+(page?'&nextPageToken='+encodeURIComponent(page):''))
 profiles.push(...(result.users||[]).filter(u=>u.emailVerified&&!u.disabled&&u.email))
 page=result.nextPageToken||''
} while(page)
const source=await readFile('firestore.rules','utf8')
const next=await request(rulesBase+projectPath+'/rulesets','POST',{source:{files:[{name:'firestore.rules',content:source}]}})
const publish = name => request(rulesBase+release.name,'PATCH',{release:{name:release.name,rulesetName:name}})
await publish(next.name)
try{
 const saleValues=(store.fields.sales.arrayValue.values||[]).map(s=>({mapValue:{fields:Object.fromEntries(['id','date','items','status'].map(k=>[k,s.mapValue.fields[k]]))}}))
 const root=projectPath+'/databases/(default)/documents/'
 const text=v=>({stringValue:v})
 const writes=[
  {update:{name:store.name,fields:{auditId:store.fields.auditId}},updateMask:{fieldPaths:["auditId"]},currentDocument:{updateTime:store.updateTime}},
  {update:{name:root+'dashboard/public',fields:{sales:{arrayValue:{values:saleValues}},revision:store.fields.auditId}}},
  ...profiles.map(u=>({update:{name:root+'loginProfiles/'+u.email.toLowerCase(),fields:{uid:text(u.localId),email:text(u.email.toLowerCase()),name:text((u.displayName||u.email).slice(0,120)),lastSeen:{timestampValue:new Date(Number(u.lastLoginAt)||Date.now()).toISOString()}}}}))
 ]
 await request(documents+':commit','POST',{writes})
 console.log(JSON.stringify({activated:true,profiles:profiles.length,sales:saleValues.length,backup,ruleset:next.name,billingEnabled:false}))
}catch(e){await publish(release.rulesetName);throw e}
