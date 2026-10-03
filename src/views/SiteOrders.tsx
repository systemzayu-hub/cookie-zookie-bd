import { SearchInput } from '../components/SearchInput'
import { matchesSearch } from '../search'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, ChevronLeft, ChevronRight, RefreshCw, Search, ShoppingBag } from 'lucide-react'
import { authCurrentUser } from '../sync'
import './SiteOrders.css'
import { parseFeed, matchesOrderMode, type FeedPage } from '../site-orders-model'

const FEED_URL = 'https://cookie-zookie-gestao.onrender.com/api/integration/orders'
const PAGE_SIZE = 50
const REFRESH_MS = 30_000
const REQUEST_TIMEOUT_MS = 90_000

const brl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dateTime = (value: string) => new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })
const paymentLabel = (value: string) => ({ cash: 'Dinheiro', money: 'Dinheiro', dinheiro: 'Dinheiro', pix: 'Pix', card: 'Cartão', credit_card: 'Cartão' } as Record<string, string>)[value.toLowerCase()] || value
const statusLabel = (status: string, fulfillment: string) => status === 'Saiu Para Entrega' && fulfillment === 'pickup' ? 'Pronto para retirada' : status

export function SiteOrdersView() {
  const [page, setPage] = useState<FeedPage | null>(null)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'all' | 'test' | 'real' | 'unknown'>('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const requestRef = useRef<AbortController | null>(null)
  const timeoutRef = useRef<number | null>(null)
  const offsetRef = useRef(0)
  const canUseGoogleOwnerSession = () => {
    const currentUser = authCurrentUser()
    return Boolean(currentUser?.emailVerified && currentUser.providerData.some(provider => provider.providerId === 'google.com'))
  }

  const refresh = useCallback(async (nextOffset: number, quiet = false) => {
    // Never let the 30-second background poll cancel a slow Render cold start.
    if (quiet && requestRef.current) return
    requestRef.current?.abort()
    if(timeoutRef.current!==null)window.clearTimeout(timeoutRef.current)
    const controller = new AbortController()
    requestRef.current = controller
    let timedOut = false
    const timeoutId = window.setTimeout(() => { timedOut = true; controller.abort() }, REQUEST_TIMEOUT_MS)
    timeoutRef.current = timeoutId
    if (quiet) setRefreshing(true)
    else { setLoading(true); setRefreshing(false) }
    setError('')
    try {
      if (!canUseGoogleOwnerSession()) throw new Error('Entre com a conta Google verificada do dono para ver os pedidos do site.')
      const currentUser = authCurrentUser()
      if (!currentUser) throw new Error('Sessão encerrada. Entre novamente.')
      const url=`${FEED_URL}?offset=${nextOffset}&limit=${PAGE_SIZE}`
      const request=async(token:string)=>fetch(url,{
        method:'GET',credentials:'omit',headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},
        cache:'no-store',signal:controller.signal,
      })
      let response=await request(await currentUser.getIdToken())
      if(response.status===401)response=await request(await currentUser.getIdToken(true))
      if (!response.ok) {
        if(response.status===401)throw new Error('Sessão expirada ou conta não autorizada. Entre novamente com a conta Google verificada do dono.')
        if(response.status===403)throw new Error('Esta conta não tem acesso ao painel de pedidos do site.')
        if(response.status===429)throw new Error('Muitas consultas em sequência. Aguarde e tente novamente.')
        if([502,503,504].includes(response.status))throw new Error(`O serviço de pedidos está temporariamente indisponível (HTTP ${response.status}). Tente novamente em instantes.`)
        throw new Error(`Falha ao carregar pedidos (HTTP ${response.status}).`)
      }
      const data = parseFeed(await response.json(), nextOffset)
      if (!controller.signal.aborted) { setPage(data); setOffset(data.offset); offsetRef.current = data.offset; setError('') }
    } catch (cause) {
      if (requestRef.current === controller) {
        if (timedOut) setError('A consulta demorou mais de 90 segundos. O serviço pode estar iniciando; tente atualizar novamente.')
        else if (!controller.signal.aborted) setError(cause instanceof TypeError ? 'Não foi possível conectar ao serviço de pedidos. Confira a conexão e tente atualizar em instantes.' : cause instanceof Error ? cause.message : 'Não foi possível consultar os pedidos.')
      }
    } finally {
      window.clearTimeout(timeoutId)
      if (requestRef.current === controller) { requestRef.current = null; timeoutRef.current = null; setLoading(false); setRefreshing(false) }
    }
  }, [])

  useEffect(() => {
    if (!canUseGoogleOwnerSession()) {
      setLoading(false)
      setError('Entre com a conta Google verificada do dono para ver os pedidos do site.')
      return
    }
    void refresh(0)
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh(offsetRef.current, true)
    }, REFRESH_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(offsetRef.current, true) }
    document.addEventListener('visibilitychange', onVisible)
    return () => { requestRef.current?.abort(); if(timeoutRef.current!==null)window.clearTimeout(timeoutRef.current); window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [refresh])

  const shown = useMemo(() => (page?.orders ?? []).filter(order => {
    const matchesMode = matchesOrderMode(order, mode)
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter
    return matchesMode && matchesStatus && matchesSearch(query, order.number, order.customerName, ...order.items.map(item => item.name))
  }), [page, mode, statusFilter, query])
  const statuses = [...new Set((page?.orders ?? []).map(order => order.status))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const first = page && page.total ? page.offset + 1 : 0
  const last = page ? Math.min(page.offset + page.orders.length, page.total) : 0

  return <div className="site-orders-view">
    <header className="page-row">
      <div className="page-title"><h1>Pedidos do site</h1><p>Acompanhamento somente leitura. Pagamentos não são confirmados aqui.</p></div>
      <button className="btn btn-secondary" onClick={() => void refresh(offset, true)} disabled={refreshing || loading} aria-label="Atualizar pedidos">
        <RefreshCw size={16} className={refreshing ? 'spin' : ''} /> {refreshing ? 'Atualizando…' : 'Atualizar'}
      </button>
    </header>
    <div className="site-orders-toolbar">
      <SearchInput label="Buscar nesta página" value={query} onChange={setQuery} placeholder="Pedido, cliente ou item…" />
      <label className="site-orders-filter">Exibição<select value={mode} onChange={event => setMode(event.target.value as typeof mode)}><option value="all">Todos</option><option value="test">Pedidos de teste</option><option value="real">Pedidos reais</option><option value="unknown">Classificação não informada</option></select></label>
      <label className="site-orders-filter">Etapa<select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="all">Todas</option>{statuses.map(status => <option key={status} value={status}>{statusLabel(status, page?.orders.find(order => order.status === status)?.fulfillment || '')}</option>)}</select></label>
    </div>
    <div className="site-orders-meta" aria-live="polite">
      {page && <span>{shown.length} resultados nesta página</span>}
      {(query || mode !== "all" || statusFilter !== "all") && <button className="btn btn-ghost btn-sm" onClick={() => {setQuery(""); setMode("all"); setStatusFilter("all")}}>Limpar filtros</button>}
      <span>{page ? `${first}–${last} de ${page.total} pedidos` : loading ? 'Carregando pedidos…' : error ? 'Consulta indisponível' : 'Nenhum pedido carregado'}</span>
      <span>{page ? `Atualizado ${dateTime(page.fetchedAt)}` : ''}</span>
    </div>
    {error && <div className="site-orders-alert" role="alert"><AlertCircle size={18} /><span>{error}{page && <small> · Os dados exibidos são da consulta de {dateTime(page.fetchedAt)}.</small>}</span></div>}
    {loading && !page ? <div className="site-orders-empty" role="status"><RefreshCw className="spin" size={22} />Carregando pedidos…</div>
      : shown.length ? <div className="site-order-list">{shown.map(order => <article className="site-order-card" key={`${order.id}-${order.number}`}>
        <div className="site-order-heading"><div><strong>Pedido {order.number}</strong><span>{dateTime(order.createdAt)}</span></div><div className="site-order-tags"><span className="site-order-status">{statusLabel(order.status, order.fulfillment)}</span>{order.testMode === true && <span className="site-order-test">Pedido de teste</span>}{order.testMode === null && <span className="site-order-status">Classificação não informada</span>}</div></div>
        {order.customerName && <p className="site-order-customer">{order.customerName}</p>}
        <ul className="site-order-items">{order.items.map((item, index) => <li key={`${order.id}-${index}`}><span>{item.quantity} × {item.name}{item.note ? <small>{item.note}</small> : null}</span><span>{brl(item.unitPriceCents * item.quantity)}</span></li>)}</ul>
        {(order.discountCents > 0 || order.deliveryCents > 0 || order.couponCode) && <dl className="site-order-breakdown">
          <div><dt>Subtotal</dt><dd>{brl(order.subtotalCents)}</dd></div>
          {order.discountCents > 0 && <div><dt>Desconto{order.couponCode ? ` · ${order.couponCode}` : ''}</dt><dd>− {brl(order.discountCents)}</dd></div>}
          {order.deliveryCents > 0 && <div><dt>Taxa de entrega</dt><dd>{brl(order.deliveryCents)}</dd></div>}
        </dl>}
        <div className="site-order-bottom"><span>{order.fulfillment === 'pickup' ? 'Retirada' : order.fulfillment === 'delivery' ? 'Entrega' : order.fulfillment} · {paymentLabel(order.paymentMethod)} · Pagamento: <strong>Não confirmado</strong></span><strong>{brl(order.totalCents)}</strong></div>
      </article>)}</div>
      : <div className="site-orders-empty"><ShoppingBag size={24} /><span>{page?.orders.length ? 'Nenhum pedido corresponde a estes filtros nesta página.' : error ? 'Os pedidos não puderam ser carregados. Veja o aviso acima e tente Atualizar.' : 'Ainda não há pedidos do site.'}</span></div>}
    <nav className="site-orders-pagination" aria-label="Paginação de pedidos">
      <button className="btn btn-secondary" disabled={!page || page.offset <= 0 || loading} onClick={() => void refresh(Math.max(0, offset - PAGE_SIZE))}><ChevronLeft size={17} /> Anterior</button>
      <span>{page ? `Página ${Math.floor(page.offset / PAGE_SIZE) + 1}` : '—'}</span>
      <button className="btn btn-secondary" disabled={!page?.hasMore || loading} onClick={() => void refresh(offset + PAGE_SIZE)}>Próxima <ChevronRight size={17} /></button>
    </nav>
  </div>
}
