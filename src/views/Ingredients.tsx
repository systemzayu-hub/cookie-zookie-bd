import { useEffect, useRef, useState } from 'react'
import { get, set, update } from 'idb-keyval'
import { IngredientPurchase, parseIngredients, purchaseTotal, validPurchase } from '../ingredients'
import { fmtBRL, uid } from '../types'
import { MetricBars } from '../components/MetricBars'
import './Ingredients.css'
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
const empty = (): IngredientPurchase & { text: string } => ({ id: uid(), date: today(), shop: '', items: [], text: '' })
export function IngredientsView({ owner }: { owner: string }) {
  const key = 'cc_ingredients:' + owner.toLowerCase()
  const [purchases, setPurchases] = useState<IngredientPurchase[]>([])
  const [draft, setDraft] = useState(empty)
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState('')
  const [month, setMonth] = useState(today().slice(0,7)), [search, setSearch] = useState(''), [archived, setArchived] = useState(false)
  const [ignored, setIgnored] = useState<string[]>([])
  const alive = useRef(true), lock = useRef(false), worker = useRef<import('tesseract.js').Worker>()
  const queue = useRef(Promise.resolve())
  useEffect(() => { alive.current = true; Promise.all([get(key), get(key + ':draft')]).then(([data, saved]) => {
    if (!alive.current) return
    setPurchases(Array.isArray(data) ? data.filter(validPurchase) : [])
    if (saved && typeof saved.text === 'string' && Array.isArray(saved.items)) setDraft(saved)
    setReady(true)
  }).catch(() => setMessage('Não foi possível abrir os registros neste navegador.'))
    return () => { alive.current = false; void worker.current?.terminate() }
  }, [key])
  const change = (next: typeof draft) => {
    setDraft(next)
    queue.current = queue.current.then(() => set(key + ':draft', next)).catch(() => { if (alive.current) setMessage('Falha ao salvar rascunho. Confira o espaço do navegador.') })
  }
  const persist = async (transform: (old: IngredientPurchase[]) => IngredientPurchase[]) => {
    let next: IngredientPurchase[] = []
    await update<IngredientPurchase[]>(key, old => { next = transform(old || []); return next })
    if (alive.current) setPurchases(next)
  }
  const process = (text: string, photo = draft.photo) => {
    const parsed = parseIngredients(text)
    setIgnored(parsed.ignored); change({ ...draft, text, photo, items: parsed.items })
    setMessage(parsed.items.length ? 'Confira os produtos e o valor total de cada linha antes de salvar.' : 'Não encontrei valores. Use: Farinha - 12,50. Você também pode adicionar linhas manualmente.')
  }
  const readPhoto = async (file: File) => {
    if (lock.current) return
    if ((draft.text || draft.items.length) && !confirm('Ler outra nota substituirá o texto e os itens atuais. Continuar?')) return
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 15 * 1024 * 1024) { setMessage('Escolha uma foto JPG, PNG ou WebP de até 15 MB.'); return }
    lock.current = true; setBusy(true)
    try {
      const photo = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file) })
      if (!alive.current) return
      change({ ...draft, photo }); setMessage('Preparando leitura da nota… A primeira leitura pode demorar.')
      const { createWorker, OEM } = await import('tesseract.js')
      const base = new URL(import.meta.env.BASE_URL + 'ocr/', document.baseURI).href
      const w = await createWorker('por', OEM.LSTM_ONLY, { workerPath: base + 'worker.min.js', corePath: base, langPath: base, workerBlobURL: false, logger: m => { if (alive.current && m.status === 'recognizing text') setMessage(`Lendo nota: ${Math.round(m.progress * 100)}%`) } })
      worker.current = w
      if (!alive.current) { await w.terminate(); return }
      const result = await w.recognize(photo)
      if (alive.current) process(result.data.text, photo)
    } catch { if (alive.current) setMessage('Não consegui ler a foto. Ela ficou anexada; digite os itens ou tente uma foto mais nítida.') }
    finally { await worker.current?.terminate(); worker.current = undefined; lock.current = false; if (alive.current) setBusy(false) }
  }
  const savePurchase = async () => {
    if (lock.current) return
    if (!validPurchase(draft)) { setMessage('Preencha a data, os nomes e valores maiores que zero.'); return }
    lock.current = true; setBusy(true)
    try {
      const { text, ...purchase } = draft
      await persist(old => { if (old.some(p => p.id === purchase.id)) throw Error('Esta compra já foi salva. Recarregue a aba.'); return [...old, purchase] })
      change(empty()); setIgnored([]); setMessage('Compra salva!')
    } catch (e) { setMessage(e instanceof Error && e.message.includes('já foi') ? e.message : 'Não foi possível salvar a compra. Seu rascunho foi preservado.') }
    finally { lock.current = false; setBusy(false) }
  }
  const backup = () => {
    const blob = new Blob([JSON.stringify({ kind: 'cookie-zookie-ingredients', version: 1, purchases })], { type: 'application/json' })
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `ingredientes-${today()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const restore = async (file: File) => {
    if (lock.current) return
    lock.current = true; setBusy(true)
    try {
      if (file.size > 100 * 1024 * 1024) throw Error()
      const data = JSON.parse(await file.text())
      if (data.kind !== 'cookie-zookie-ingredients' || data.version !== 1 || !Array.isArray(data.purchases) || data.purchases.length > 5000 || !data.purchases.every(validPurchase) || new Set(data.purchases.map((p: IngredientPurchase) => p.id)).size !== data.purchases.length) throw Error()
      await persist(old => [...old, ...data.purchases.filter((p: IngredientPurchase) => !old.some(o => o.id === p.id))]); setMessage('Backup importado. Compras já existentes foram mantidas sem duplicar.')
    } catch { setMessage('Não foi possível importar. Verifique o arquivo de backup e o espaço disponível.') }
    finally { lock.current = false; setBusy(false) }
  }
  const filtered = purchases.filter(p => !!p.archived === archived && (!month || p.date.startsWith(month)) && (p.shop + ' ' + p.items.map(i => i.name).join(' ')).toLocaleLowerCase().includes(search.toLocaleLowerCase()))
  const spent = purchases.filter(p => !p.archived && (!month || p.date.startsWith(month)))
  const totals = new Map<string, number>(); spent.forEach(p => p.items.forEach(i => { const name = i.name.trim().toLocaleLowerCase(); totals.set(name, (totals.get(name) || 0) + i.total) }))
  if (!ready) return <p role="status">{message || 'Abrindo compras…'}</p>
  return <div className="ingredients-view"><h1>Compras de ingredientes</h1><p>Leia uma nota ou escreva os produtos para acompanhar seus gastos.</p>
    <p className="ingredients-note">Compras, fotos e rascunho ficam neste navegador, nesta conta. Não são sincronizados com a equipe. Use o backup desta aba antes de trocar de aparelho ou limpar o navegador.</p>
    <div className="ingredients-toolbar"><button className="btn btn-secondary" onClick={backup}>Exportar compras e fotos</button><label className="btn btn-secondary">Importar backup<input aria-label="Importar backup de ingredientes" type="file" accept=".json" disabled={busy} onChange={e => { const f = e.target.files?.[0]; if (f) void restore(f); e.target.value = '' }} /></label></div>
    <section className="card"><h2>Nova compra</h2><fieldset disabled={busy}><div className="ingredients-toolbar"><label>Data<input type="date" value={draft.date} onChange={e => change({ ...draft, date: e.target.value || today() })} /></label><label>Loja (opcional)<input value={draft.shop} maxLength={200} onChange={e => change({ ...draft, shop: e.target.value })} /></label><label>Foto da nota<input aria-label="Foto da nota" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { const f = e.target.files?.[0]; if (f) void readPhoto(f); e.target.value = '' }} /></label></div>
    {draft.photo && <details><summary>Ver foto anexada</summary><img className="receipt-photo" src={draft.photo} alt="Nota da compra" /><button className="btn btn-secondary" onClick={() => change({ ...draft, photo: undefined })}>Remover foto</button></details>}
    <label>Produtos e valores<textarea rows={6} value={draft.text} placeholder={'Farinha de trigo - 12,50\n2 caixas de leite - 11,00'} onChange={e => change({ ...draft, text: e.target.value })} /></label><p>Um produto por linha. O último valor é o total da linha, já incluindo a quantidade. Ex.: 2 caixas de leite - 11,00 significa R$ 11,00 pelas duas.</p>
    <button className="btn btn-secondary" onClick={() => { if (!draft.items.length || confirm('Reprocessar o texto substituirá os itens da revisão. Continuar?')) process(draft.text) }}>Preparar itens do texto</button>
    {ignored.length > 0 && <details><summary>{ignored.length} linhas não incluídas — confira a nota</summary><pre style={{ whiteSpace: 'pre-wrap' }}>{ignored.join('\n')}</pre></details>}
    <h3>Revisar produtos e valores</h3><p>A leitura de fotos pode errar ou omitir itens. Confira também descontos e o total da nota.</p>
    {draft.items.map((item, index) => <div className="ingredient-row" key={index}><input aria-label={`Produto ${index + 1}`} maxLength={500} value={item.name} onChange={e => change({ ...draft, items: draft.items.map((i, n) => n === index ? { ...i, name: e.target.value } : i) })} /><input aria-label={`Total do produto ${index + 1}`} type="number" min="0.01" step="0.01" value={item.total || ''} onChange={e => change({ ...draft, items: draft.items.map((i, n) => n === index ? { ...i, total: Number(e.target.value) } : i) })} /><button className="btn btn-ghost" onClick={() => change({ ...draft, items: draft.items.filter((_, n) => n !== index) })}>Remover</button></div>)}
    <button className="btn btn-secondary" onClick={() => change({ ...draft, items: [...draft.items, { name: '', total: 0 }] })}>Adicionar produto</button><h3>Total da compra: {fmtBRL(purchaseTotal(draft))}</h3><button className="btn btn-primary" disabled={!draft.items.length} onClick={() => void savePurchase()}>Conferi os valores · Salvar compra</button></fieldset></section>
    <p role="status" aria-live="polite">{message}</p>
    <section className="card"><h2>Gastos e histórico</h2><div className="ingredients-toolbar"><label>Mês (vazio mostra tudo)<input type="month" value={month} onChange={e => setMonth(e.target.value)} /></label><label>Buscar loja ou ingrediente<input value={search} onChange={e => setSearch(e.target.value)} /></label><label><input type="checkbox" checked={archived} onChange={e => setArchived(e.target.checked)} /> Mostrar arquivadas</label></div><h3>{fmtBRL(spent.reduce((s,p) => s + purchaseTotal(p), 0))} gastos no período · {spent.length} compras</h3><MetricBars items={[...totals].sort((a,b) => b[1]-a[1]).slice(0,10).map(([label,value]) => ({label,value}))} format={fmtBRL} />
    {filtered.length === 0 && <p>Nenhuma compra encontrada.</p>}{[...filtered].sort((a,b) => b.date.localeCompare(a.date)).map(p => <details key={p.id}><summary>{p.date.split('-').reverse().join('/')} · {p.shop || 'Loja não informada'} · {fmtBRL(purchaseTotal(p))}</summary><ul>{p.items.map((i,n) => <li key={n}>{i.name} — {fmtBRL(i.total)}</li>)}</ul>{p.photo && <img className="receipt-photo" src={p.photo} alt="Nota da compra salva" />}<button className="btn btn-secondary" disabled={busy} onClick={async () => { if (lock.current) return; lock.current = true; setBusy(true); try { await persist(old => old.map(o => o.id === p.id ? { ...o, archived: !p.archived } : o)) } catch { setMessage('Não foi possível atualizar a compra.') } finally { lock.current = false; setBusy(false) } }}>{p.archived ? 'Restaurar compra' : 'Arquivar compra (retirar dos gastos)'}</button></details>)}
    </section></div>
}
