import { FREE_MAX_FLAVORS } from '../free-store'
import { useEffect, useRef, useState } from 'react'
import { callBackend } from '../sync'
import { CHANNELS, PAYMENTS, fmtBRL, uid, type Product, type Sale } from '../types'
import { CookieArt } from '../components/CookieArt'
type Catalog = { products: Product[]; customers: { id: string; name: string }[] }
export function EmployeeSales({ name, onLogout }: { name: string; onLogout: () => void }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [customer, setCustomer] = useState('')
  const [status, setStatus] = useState<'Pago' | 'Pendente'>('Pago')
  const [payment, setPayment] = useState<Sale['payment']>('pix')
  const [channel, setChannel] = useState<Sale['channel']>('loja')
  const [busy, setBusy] = useState(false)
  const sending = useRef(false)
  const pendingSale = useRef<Sale | null>(null)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const reload = async () => { setCatalog(await callBackend<Catalog>('getOperations')) }
  useEffect(() => {
    let active = true
    const refresh = () => callBackend<Catalog>('getOperations').then(data => { if (active) setCatalog(data) }).catch(() => { if (active) { setFailed(true); setMessage('Não foi possível atualizar o catálogo.') } })
    void refresh()
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh() }, 60000)
    return () => { active = false; window.clearInterval(timer) }
  }, [])
  const items = (catalog?.products || []).filter(p => quantities[p.id] > 0).map(p => ({ productId: p.id, name: p.name, qty: quantities[p.id], unitPrice: p.price }))
  const total = Math.round(items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0) * 100) / 100
  const submit = async () => {
    if (sending.current || !items.length || status === 'Pendente' && !customer) return
    sending.current = true; setBusy(true); setMessage('')
    const draft: Sale = { id: uid(), date: new Date().toISOString(), items, total, payment, channel, status, ...(customer ? { customerId: customer } : {}) }
    // Keep the identifier across retries when the response was lost.
    const sale = pendingSale.current || draft
    pendingSale.current = sale
    try {
      const result = await callBackend<{ repeated?: boolean }>('createSale', { sale })
      pendingSale.current = null; setQuantities({}); setCustomer(''); setStatus('Pago')
      setFailed(false); setMessage(result.repeated ? 'Esta solicitação já foi processada. Confira o registro com o administrador.' : 'Venda registrada.')
      await reload().catch(() => {})
    } catch (error) {
      const code = (error as { code?: string }).code
      if (code === 'functions/already-exists') {
        pendingSale.current = null; setQuantities({}); setFailed(false); setMessage('Esta venda já foi registrada.'); await reload().catch(() => {})
      } else {
        if (!['functions/unavailable', 'functions/deadline-exceeded', 'functions/internal', 'unavailable', 'deadline-exceeded', 'internal'].includes(code || '')) pendingSale.current = null
        setFailed(true); setMessage((error as Error).message || 'Não foi possível registrar a venda.')
        await reload().catch(() => {})
      }
    } finally { sending.current = false; setBusy(false) }
  }
  return <main className="employee-workspace">
    <header className="page-row"><div className="page-title"><h1>Atendimento</h1><p>{name} · Funcionário</p></div><button className="btn btn-secondary" onClick={onLogout}>Sair</button></header>
    {message && <p className="card" role={failed ? 'alert' : 'status'}>{message}</p>}
    {!catalog ? <button className="btn btn-secondary" onClick={() => void reload().catch(() => setMessage('Não foi possível atualizar.'))}>Carregar catálogo</button> : <form onSubmit={e => { e.preventDefault(); void submit() }}>
      <fieldset disabled={busy || !!pendingSale.current} style={{ border: 0, padding: 0 }}>
        <div className="product-grid">{catalog.products.map(p => <label className="card" key={p.id}>
          <CookieArt name={p.name} size={48}/><strong>{p.name}</strong><p>{fmtBRL(p.price)} · {p.stock} disponíveis</p>
          <span>Quantidade de {p.name}</span><input className="input" type="number" min={0} max={p.stock} step={1} value={quantities[p.id] || 0} onChange={e => setQuantities(q => ({ ...q, [p.id]: Number(e.target.value) }))}/>
        </label>)}</div>
        <section className="card checkout-fields">
          <label>Cliente<select className="input" value={customer} onChange={e => setCustomer(e.target.value)} required={status === 'Pendente'}><option value="">Sem cliente</option>{catalog.customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>Status<select className="input" value={status} onChange={e => setStatus(e.target.value as typeof status)}><option>Pago</option><option>Pendente</option></select></label>
          <label>Pagamento<select className="input" value={payment} onChange={e => setPayment(e.target.value as Sale['payment'])}>{PAYMENTS.map(p => <option key={p}>{p}</option>)}</select></label>
          <label>Canal<select className="input" value={channel} onChange={e => setChannel(e.target.value as Sale['channel'])}>{CHANNELS.map(c => <option key={c}>{c}</option>)}</select></label>
        </section>
      </fieldset>
      {items.length > FREE_MAX_FLAVORS && <p role="alert">Selecione até {FREE_MAX_FLAVORS} sabores diferentes por venda.</p>}
      <div className="page-row card"><strong>Total: {fmtBRL(total)}</strong><button className="btn btn-primary" disabled={busy || !items.length || items.length > FREE_MAX_FLAVORS || status === 'Pendente' && !customer}>{busy ? 'Registrando…' : pendingSale.current ? 'Verificar e tentar novamente' : 'Registrar venda'}</button></div>
    </form>}
  </main>
}
