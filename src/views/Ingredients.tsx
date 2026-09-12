import { migratePurchases, watchPurchases, commitPurchases } from '../purchase-cloud'
import { useRole } from '../auth'
import { purchaseProfit } from '../purchase-profit'
import { useEffect, useRef, useState } from 'react'
import { get, set } from 'idb-keyval'
import { IngredientPurchase, parseIngredients, purchaseTotal, validPurchase, purchasesSummary, purchaseDue, groupDebts, normalizeIngredient, creditorName, replacePurchase, deletePurchase, readPurchasesBackup } from '../ingredients'
import { Sale, fmtBRL, uid } from '../types'
import { PurchaseEditor, PurchaseDraft } from './PurchaseEditor'
import { PurchasePrices } from './PurchasePrices'
import { MetricBars } from '../components/MetricBars'
import { PurchaseEntry } from './PurchaseEntry'
import './Ingredients.css'
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
const empty = (): PurchaseDraft => ({ id: uid(), date: today(), shop: '', items: [], text: '', paymentStatus: 'paid' })
export function IngredientsView(props: { owner: string; sales?: Sale[] }) {
  const role = useRole()
  return role === 'owner' ? <OwnerPurchases {...props} /> : null
}
function OwnerPurchases({ owner, sales = [] }: { owner: string; sales?: Sale[] }) {
  const role = useRole()
  const isOwner = role === 'owner'
  const key = 'cc_ingredients:' + owner.toLowerCase()
  const [purchases, setPurchases] = useState<IngredientPurchase[]>([]), [draft, setDraft] = useState(empty)
  const [syncMessage,setSyncMessage]=useState('Conectando compras…')
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState('')
  const [area, setArea] = useState('compras'), [editor, setEditor] = useState(false)
  const [from, setFrom] = useState(''), [to, setTo] = useState(''), [search, setSearch] = useState(''), [status, setStatus] = useState('all'), [archived, setArchived] = useState(false)
  const [ignored, setIgnored] = useState<string[]>([]), [draftSaved, setDraftSaved] = useState(true)
  const photos=useRef<Record<string,string>>({})
  const alive = useRef(true), lock = useRef(false)
  const queue = useRef(Promise.resolve()), draftVersion = useRef(0)
  useEffect(() => {
    let cancelled=false, stop=()=>{}, starting=false
    alive.current=true
    const start=async()=>{
      if(starting || cancelled)return
      starting=true
      try {
        const [data,saved,migrated]=await Promise.all([get(key),get(key+':draft'),get(key+':cloud-migrated')])
        if(data!==undefined&&(!Array.isArray(data)||!data.every(validPurchase)))throw Error()
        const local:IngredientPurchase[]=data||[]
        photos.current={...Object.fromEntries(local.filter(p=>p.photo).map(p=>[p.id,p.photo!])),...await get(key+':photos')}
        if(!migrated){if(await get(key+':before-cloud')===undefined)await set(key+':before-cloud',local);const conflicts=await migratePurchases(local);if(conflicts&&!cancelled)setMessage(`${conflicts} compras deste aparelho diferem das já sincronizadas. Mantivemos a versão do banco e preservamos os originais no backup anterior à sincronização.`);await set(key+':cloud-migrated',true)}
        if(cancelled)return
        if(saved&&typeof saved.text==='string'&&Array.isArray(saved.items)){setDraft(saved);setEditor(!!(saved.text||saved.items.length||saved.photo))}
        stop()
        stop=watchPurchases((rows,cached)=>{
          if(cancelled)return
          const merged=rows.map(p=>({...p,...(photos.current[p.id]?{photo:photos.current[p.id]}:{})}))
          setPurchases(merged);setReady(true);setSyncMessage(cached?'Sem confirmação do servidor. Conecte-se para atualizar.':'Compras sincronizadas entre seus aparelhos.')
          if(!cached)void set(key,merged).catch(()=>{if(!cancelled)setSyncMessage('Sincronizado, mas não foi possível atualizar a cópia local.')})
        },()=>{if(!cancelled)setSyncMessage('Falha na sincronização. Verifique sua conexão e atualize a página. Os dados locais foram preservados.')})
      }catch{if(!cancelled){setMessage('Não foi possível sincronizar as compras. Conecte-se à internet e tente novamente. Os dados deste aparelho foram preservados.');setSyncMessage('Aguardando conexão para sincronizar.')}}
      finally{starting=false}
    }
    void start();window.addEventListener('online',start)
    return()=>{cancelled=true;alive.current=false;stop();window.removeEventListener('online',start)}
  },[key])
  const change = (next: PurchaseDraft) => {
    setDraft(next); setDraftSaved(false); const version = ++draftVersion.current
    queue.current = queue.current.then(() => set(key + ':draft', next)).then(() => { if (alive.current && draftVersion.current === version) setDraftSaved(true) }).catch(() => { if (alive.current) setMessage('Falha ao salvar rascunho. Confira o espaço do navegador.') })
  }
  const persist = async (transform: (old: IngredientPurchase[]) => IngredientPurchase[]) => {
    const next=transform(purchases)
    photos.current=Object.fromEntries(next.filter(p=>p.photo).map(p=>[p.id,p.photo!]))
    await set(key+':photos',photos.current)
    await commitPurchases(purchases,next)
    // The realtime listener is the source of truth; do not overwrite newer remote data here.
  }
  const process = (text: string) => {
    const parsed = parseIngredients(text)
    setIgnored(parsed.ignored)
    if (!parsed.items.length) { setMessage('Nenhum produto reconhecido. Use: 2x Farinha 1kg - 12,50 (total das duas unidades). Seus itens foram mantidos.'); return }
    change({ ...draft, text, items: parsed.items, scanConfirmed: false, scanConfidence: undefined })
    setMessage(`${parsed.items.length} produtos preparados. Confira quantidades e totais antes de salvar.${parsed.ignored.length ? ' Há linhas não incluídas para conferir.' : ''}`)
  }
  const readPhoto = async (file: File) => {
    if (lock.current) return
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 15 * 1024 * 1024) { setMessage('Escolha uma foto JPG, PNG ou WebP de até 15 MB.'); return }
    lock.current = true; setBusy(true)
    try {
      const photo = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file) })
      if (alive.current) { change({ ...draft, photo, scanConfirmed: false, scanConfidence: undefined }); setMessage('Foto anexada para conferência. Cole a transcrição no campo de texto; a imagem não será transcrita automaticamente.') }
    } catch { if (alive.current) setMessage('Não foi possível anexar a foto. Seu rascunho foi preservado.') }
    finally { lock.current = false; if (alive.current) setBusy(false) }
  }
  const savePurchase = async () => {
    if (lock.current) return
    if (draft.photo && !draft.scanConfirmed) { setMessage('Confira a lista com a foto e marque a confirmação antes de salvar.'); return }
    const { text, quickPaid, quickDue, photoKind, editingBefore, expectedTotal, scanConfidence, scanConfirmed, ...purchase } = draft
    if (purchase.paymentStatus === 'paid') purchase.paidAmount = undefined
    if (!validPurchase(purchase)) { setMessage('Confira data, produtos, valores e quantidades. O valor devido deve estar entre zero e o total da compra.'); return }
    if (purchase.paymentStatus === 'pending' && purchaseDue(purchase) === 0) { purchase.paymentStatus = 'paid'; purchase.paidAmount = undefined; purchase.paidAt = today() }
    lock.current = true; setBusy(true)
    try {
      await persist(old => editingBefore ? replacePurchase(old, editingBefore, purchase) : old.some(p => p.id === purchase.id) ? (() => { throw Error('Esta compra já foi salva. Atualize a aba.') })() : [...old, purchase])
      change(empty()); setEditor(false); setIgnored([]); setMessage('Compra salva.')
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Falha ao salvar. Rascunho preservado.') }
    finally { lock.current = false; setBusy(false) }
  }
  const action = async (before: IngredientPurchase, after: IngredientPurchase, success: string) => {
    if (lock.current) return
    lock.current = true; setBusy(true)
    try { await persist(old => replacePurchase(old, before, after)); setMessage(success) }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Não foi possível atualizar a compra.') }
    finally { lock.current = false; setBusy(false) }
  }
  const removePurchase = async (p: IngredientPurchase) => {
    if (lock.current) return
    if (!confirm(`Excluir este registro de ${fmtBRL(purchaseTotal(p))} (${p.shop || 'Local não informado'})? Ele será removido dos totais, pendências e histórico. Esta ação não pode ser desfeita.`)) return
    lock.current = true; setBusy(true)
    try {
      await persist(old => deletePurchase(old, p))
      if (draft.editingBefore?.id === p.id) { change(empty()); setEditor(false); setIgnored([]) }
      setMessage('Registro excluído. Totais e pendências atualizados.')
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Não foi possível excluir. O registro foi preservado.') }
    finally { lock.current = false; if (alive.current) setBusy(false) }
  }
  const edit = (p: IngredientPurchase) => {
    if ((draft.text || draft.items.length || draft.photo) && !confirm('Abrir esta compra substituirá o rascunho atual. Continuar?')) return
    change({ ...p, text: '', editingBefore: p }); setEditor(true); setArea('compras'); setIgnored([])
    requestAnimationFrame(() => document.querySelector('.purchase-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
  const backup = async (original = false) => {
    try {
      const saved = await get(original ? key+':before-cloud' : key) || []
      const blob = new Blob([JSON.stringify({ kind: 'cookie-zookie-ingredients', version: 2, purchases: saved })], { type: 'application/json' })
      const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `compras-${original ? 'originais-' : ''}${today()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch { setMessage('Não foi possível exportar o backup.') }
  }
  const restore = async (file: File) => {
    if (lock.current) return
    lock.current = true; setBusy(true)
    try {
      if (file.size > 100 * 1024 * 1024) throw Error()
      const incoming = readPurchasesBackup(await file.text()); let added = 0
      await persist(old => { const fresh = incoming.filter(p => !old.some(o => o.id === p.id)); added = fresh.length; return [...old, ...fresh] })
      setMessage(`Backup importado: ${added} compras adicionadas. ${incoming.length - added} já existentes foram preservadas, sem duplicar.`)
    } catch { setMessage('Não foi possível importar. Confira o backup e o espaço disponível.') }
    finally { lock.current = false; setBusy(false) }
  }
  const period = purchases.filter(p => (!from || p.date >= from) && (!to || p.date <= to))
  const summary = purchasesSummary(period)
  const profit = isOwner ? purchaseProfit(sales, purchases) : null
  const ingredientTotals = new Map<string, {label: string; value: number}>()
  period.filter(p => !p.archived).forEach(p => p.items.forEach(item => { const name = normalizeIngredient(item.name); const previous = ingredientTotals.get(name); ingredientTotals.set(name, { label: previous?.label || item.name, value: (Math.round((previous?.value || 0) * 100) + Math.round(item.total * 100)) / 100 }) }))
  const matchesSearch = (p: IngredientPurchase) => normalizeIngredient(`${p.shop} ${creditorName(p)} ${p.items.map(i => i.name).join(' ')}`).includes(normalizeIngredient(search))
  const filtered = period.filter(p => !!p.archived === archived && matchesSearch(p) && (status === 'all' || (purchaseDue(p) > 0 ? 'pending' : 'paid') === status)).sort((a,b) => b.date.localeCompare(a.date))
  const debts = groupDebts(period.filter(matchesSearch))
  const renderEntry = (p: IngredientPurchase) => <PurchaseEntry key={p.id} purchase={p} busy={busy} remove={() => void removePurchase(p)} today={today()} edit={() => edit(p)} pay={() => void action(p, { ...p, paymentStatus: 'paid', paidAmount: undefined, paidAt: today() }, 'Pagamento registrado. A compra continua no histórico.')} archive={() => {
    if (!p.archived && !confirm('Arquivar retira esta compra dos totais e das pendências. Você poderá restaurá-la. Continuar?')) return
    void action(p, { ...p, archived: !p.archived }, p.archived ? 'Compra restaurada.' : 'Compra arquivada. Você pode restaurá-la pelo filtro Arquivadas.')
  }} />
  if (!ready) return <p role="status">{message || 'Abrindo compras…'}</p>
  return <div className="ingredients-view">
    <header className="purchase-header"><div><h1>Compras</h1><p>Ingredientes, preços e pagamentos em um só lugar.</p><p role="status">{syncMessage}</p></div><details className="purchase-tools"><summary>Backup e armazenamento</summary><p>Valores e registros sincronizam entre os aparelhos do dono. Fotos anexadas e rascunhos continuam neste navegador. O backup inclui as fotos disponíveis neste aparelho.</p><div className="purchase-actions"><button className="btn btn-secondary" onClick={() => void backup()}>Exportar compras e fotos</button><button className="btn btn-secondary" onClick={() => void backup(true)}>Backup anterior à sincronização</button><label className="purchase-upload">Importar backup<input aria-label="Importar backup de compras" type="file" accept=".json" disabled={busy} onChange={e => { const f = e.target.files?.[0]; if (f) void restore(f); e.target.value = '' }} /></label></div><small>Compras antigas sem situação foram consideradas pagas. Você pode alterar isso em Editar compra.</small></details></header>
    <nav className="purchase-tabs" aria-label="Áreas de compras">{[['compras','Compras'],['precos','Histórico de preços'],['pendencias','Pagamentos / Pendências'],...(isOwner ? [['lucro','Lucro líquido']] : [])].map(([id,label]) => <button key={id} aria-pressed={area === id} onClick={() => setArea(id)}>{label}{id === 'pendencias' && purchasesSummary(purchases).due > 0 && <span className="purchase-count">{purchases.filter(p => !p.archived && purchaseDue(p) > 0).length}</span>}</button>)}</nav>
    {message && <p className="purchase-message" role="status" aria-live="polite">{message}</p>}
    {area === 'lucro' ? (isOwner && profit ? <section className="card" aria-label="Lucro líquido do dono">
      <h2>Lucro líquido estimado</h2><p>Acumulado de todos os registros · exclusivo do dono.</p>
      <dl className="purchase-summary"><div><dt>Lucro líquido estimado</dt><dd>{fmtBRL(profit.net)}</dd></div><div><dt>Saldo recebido menos pago</dt><dd>{fmtBRL(profit.cash)}</dd></div></dl>
      <dl className="summary-list"><div><dt>Vendas (sem presentes)</dt><dd>{fmtBRL(profit.revenue)}</dd></div><div><dt>Total comprado</dt><dd>{fmtBRL(profit.total)}</dd></div><div><dt>Recebido das vendas</dt><dd>{fmtBRL(profit.received)}</dd></div><div><dt>Compras já pagas</dt><dd>{fmtBRL(profit.paid)}</dd></div><div><dt>A receber das vendas</dt><dd>{fmtBRL(profit.receivable)}</dd></div><div><dt>A pagar nas compras</dt><dd>{fmtBRL(profit.due)}</dd></div></dl>
      <p className="purchase-muted">Estimativa: vendas menos todas as compras, incluindo valores sem detalhamento e contas a pagar. O saldo considera somente o recebido menos o pago. Compras arquivadas ou excluídas não entram.</p>
      <p className="purchase-muted">Inclui apenas os registros cadastrados. Não desconta novamente custos de produção ou perdas, para evitar contar a mesma compra duas vezes. Compras sincronizam entre seus aparelhos; despesas não cadastradas e ingredientes ainda em estoque podem alterar o lucro real.</p>
    </section> : null) : area === 'precos' ? <PurchasePrices purchases={purchases} /> : <>
      <dl className="purchase-summary" aria-label="Resumo financeiro"><div><dt>Total comprado</dt><dd>{fmtBRL(summary.total)}</dd></div><div><dt>Total pago</dt><dd>{fmtBRL(summary.paid)}</dd></div><div className="purchase-due"><dt>A pagar</dt><dd>{fmtBRL(summary.due)}</dd></div></dl>
      <div className="purchase-section-heading"><small>{from || to ? 'Totais do período selecionado' : 'Totais de todas as compras'} · excluem arquivadas</small>{area === 'compras' && <button className="btn btn-primary" disabled={busy} onClick={() => setEditor(!editor)}>{editor ? 'Ocultar cadastro' : draft.items.length || draft.text || draft.photo ? 'Continuar rascunho' : '+ Nova compra'}</button>}</div>
      {editor && area === 'compras' && <><PurchaseEditor draft={draft} change={change} busy={busy} onSave={() => void savePurchase()} onClose={() => setEditor(false)} onPhoto={file => void readPhoto(file)} onProcess={() => { if (!draft.items.length || confirm('Reprocessar substituirá os produtos da revisão. Continuar?')) process(draft.text) }} ignored={ignored}/><div className="purchase-section-heading"><small role="status">{draftSaved ? 'Rascunho salvo neste navegador.' : 'Salvando rascunho…'}</small><button className="btn btn-ghost" disabled={busy} onClick={() => { if (confirm('Descartar o rascunho? As compras salvas serão mantidas.')) { change(empty()); setIgnored([]) } }}>Descartar rascunho</button></div></>}
      {!(editor && area === 'compras') && <section className="purchase-list-section"><div className="purchase-section-heading"><h2>{area === 'compras' ? 'Suas compras' : 'Para quem devo'}</h2>{area === 'pendencias' && <strong>{fmtBRL(debts.reduce((sum,g) => sum + Math.round(g.due * 100),0)/100)} a pagar</strong>}</div>
        <div className="purchase-filters"><label>Buscar<input value={search} placeholder="Produto, local ou pessoa" onChange={e => setSearch(e.target.value)} /></label><label>De<input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label><label>Até<input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>{area === 'compras' && <><label>Situação<select value={status} onChange={e => setStatus(e.target.value)}><option value="all">Todas</option><option value="paid">✓ Pagas</option><option value="pending">○ A pagar</option></select></label><label>Registros<select value={archived ? 'archived' : 'active'} onChange={e => setArchived(e.target.value === 'archived')}><option value="active">Ativos</option><option value="archived">Arquivadas</option></select></label></>}</div>
        {from && to && from > to && <p role="alert">A data inicial deve ser anterior à final.</p>}
        {area === 'compras' ? <>{filtered.length ? filtered.map(renderEntry) : <p className="purchase-empty">Nenhuma compra encontrada. Ajuste os filtros ou registre uma compra.</p>}</> : <>{debts.length ? debts.map(group => <section className="purchase-creditor" key={normalizeIngredient(group.name)}><div className="purchase-section-heading"><h3>{group.name}</h3><strong>{fmtBRL(group.due)} a pagar</strong></div>{group.purchases.sort((a,b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999')).map(renderEntry)}</section>) : <p className="purchase-empty">✓ Nenhuma pendência encontrada no período.</p>}</>}
        {area === 'compras' && <details className="purchase-spending"><summary>Comprado por ingrediente · maiores gastos no período</summary><MetricBars items={[...ingredientTotals.values()].sort((a,b) => b.value - a.value).slice(0,10)} format={fmtBRL} /></details>}
      </section>}
    </>}
  </div>
}
