import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, ChevronLeft, ChevronRight, RefreshCw, Search, ShoppingBag } from 'lucide-react'
import { authCurrentUser } from '../sync'
import './SiteOrders.css'

const FEED_URL = 'https://cookie-zookie-gestao.onrender.com/api/integration/orders'
const PAGE_SIZE = 50
const REFRESH_MS = 30_000

type SiteOrder = {
  id: number
  number: string
  createdAt: string
  status: string
  subtotalCents: number
  discountCents: number
  deliveryCents: number
  totalCents: number
  couponCode: string | null
  items: { name: string; quantity: number; unitPriceCents: number; note?: string | null }[]
  paymentMethod: string
  paymentUnconfirmed: true
  fulfillment: string
  customerName?: string | null
  testMode: boolean
}
type FeedPage = { orders: SiteOrder[]; fetchedAt: string; offset: number; limit: number; total: number; hasMore: boolean }

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
function safeText(value: unknown, max = 180): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}
function parseFeed(value: unknown, expectedOffset: number): FeedPage {
  if (!isRecord(value) || !Array.isArray(value.orders)) throw new Error('Resposta do feed inválida.')
  const orders: SiteOrder[] = value.orders.slice(0, PAGE_SIZE).flatMap(row => {
    if (!isRecord(row) || !Array.isArray(row.items)) return []
    const integer = (key: string) => Number.isSafeInteger(row[key]) && Number(row[key]) >= 0 ? Number(row[key]) : 0
    const items = row.items.slice(0, 100).flatMap(item => {
      if (!isRecord(item)) return []
      const quantity = Number(item.quantity)
      if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999) return []
      return [{ name: safeText(item.name, 100) || 'Item', quantity, unitPriceCents: Number.isSafeInteger(item.unitPriceCents) && Number(item.unitPriceCents) >= 0 ? Number(item.unitPriceCents) : 0, note: safeText(item.note, 240) || null }]
    })
    const createdAt = safeText(row.createdAt, 40)
    if (!createdAt || !Number.isFinite(Date.parse(createdAt))) return []
    const id = integer('id')
    const orderNumber = typeof row.number === 'string' || typeof row.number === 'number' ? String(row.number).slice(0, 32) : ''
    return [{
      id, number: orderNumber || String(id), createdAt,
      status: safeText(row.status, 80) || 'Status não informado', subtotalCents: integer('subtotalCents'),
      discountCents: integer('discountCents'), deliveryCents: integer('deliveryCents'), totalCents: integer('totalCents'),
      couponCode: safeText(row.couponCode, 60) || null, items, paymentMethod: safeText(row.paymentMethod, 60) || 'Não informado',
      paymentUnconfirmed: true, fulfillment: safeText(row.fulfillment, 40) || 'Não informado',
      customerName: safeText(row.customerName, 100) || null, testMode: row.testMode !== false,
    }]
  })
  const total = Number.isSafeInteger(value.total) && Number(value.total) >= 0 ? Number(value.total) : orders.length
  const offset = Number.isSafeInteger(value.offset) && Number(value.offset) >= 0 ? Number(value.offset) : expectedOffset
  const limit = Number.isSafeInteger(value.limit) && Number(value.limit) > 0 ? Math.min(Number(value.limit), PAGE_SIZE) : PAGE_SIZE
  const fetchedAt = safeText(value.fetchedAt, 40)
  return { orders, fetchedAt: Number.isFinite(Date.parse(fetchedAt)) ? fetchedAt : new Date().toISOString(), offset, limit, total, hasMore: value.hasMore === true }
}
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
  const [mode, setMode] = useState<'all' | 'test' | 'real'>('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const requestRef = useRef<AbortController | null>(null)
  const offsetRef = useRef(0)
  const canUseGoogleOwnerSession = () => {
    const currentUser = authCurrentUser()
    return Boolean(currentUser?.emailVerified && currentUser.providerData.some(provider => provider.providerId === 'google.com'))
  }

  const refresh = useCallback(async (nextOffset: number, quiet = false) => {
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    if (quiet) setRefreshing(true)
    else { setLoading(true); setRefreshing(false) }
    setError('')
    try {
      if (!canUseGoogleOwnerSession()) throw new Error('Entre com a conta Google verificada do dono para ver os pedidos do site.')
      const currentUser = authCurrentUser()
      if (!currentUser) throw new Error('Sessão encerrada. Entre novamente.')
      const token = await currentUser.getIdToken()
      const response = await fetch(`${FEED_URL}?offset=${nextOffset}&limit=${PAGE_SIZE}`, {
        method: 'GET', credentials: 'omit', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        cache: 'no-store', signal: controller.signal,
      })
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) throw new Error('Acesso ao painel de pedidos não autorizado para esta conta.')
        throw new Error(response.status === 429 ? 'Muitas consultas em sequência. Aguarde e tente novamente.' : `Falha ao carregar pedidos (HTTP ${response.status}).`)
      }
      const data = parseFeed(await response.json(), nextOffset)
      if (!controller.signal.aborted) { setPage(data); setOffset(data.offset); offsetRef.current = data.offset; setError('') }
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Não foi possível consultar os pedidos.')
    } finally {
      if (!controller.signal.aborted) { setLoading(false); setRefreshing(false) }
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
    return () => { requestRef.current?.abort(); window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [refresh])

  const shown = useMemo(() => (page?.orders ?? []).filter(order => {
    const matchesMode = mode === 'all' || (mode === 'test' ? order.testMode : !order.testMode)
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter
    const search = query.trim().toLocaleLowerCase('pt-BR')
    return matchesMode && matchesStatus && (!search || [order.number, order.customerName, ...order.items.map(item => item.name)].some(value => value?.toLocaleLowerCase('pt-BR').includes(search)))
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
      <label className="site-orders-search"><Search size={17} /><span className="sr-only">Buscar nesta página</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar pedido, cliente ou item nesta página" /></label>
      <label className="site-orders-filter">Exibição<select value={mode} onChange={event => setMode(event.target.value as typeof mode)}><option value="all">Todos</option><option value="test">Pedidos de teste</option><option value="real">Pedidos sem marcação de teste</option></select></label>
      <label className="site-orders-filter">Etapa<select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="all">Todas</option>{statuses.map(status => <option key={status} value={status}>{statusLabel(status, page?.orders.find(order => order.status === status)?.fulfillment || '')}</option>)}</select></label>
    </div>
    <div className="site-orders-meta" aria-live="polite">
      <span>{page ? `${first}–${last} de ${page.total} pedidos` : 'Carregando pedidos…'}</span>
      <span>{page ? `Atualizado ${dateTime(page.fetchedAt)}` : ''}</span>
    </div>
    {error && <div className="site-orders-alert" role="alert"><AlertCircle size={18} /><span>{error}{page && <small> · Os dados exibidos são da consulta de {dateTime(page.fetchedAt)}.</small>}</span></div>}
    {loading && !page ? <div className="site-orders-empty" role="status"><RefreshCw className="spin" size={22} />Carregando pedidos…</div>
      : shown.length ? <div className="site-order-list">{shown.map(order => <article className="site-order-card" key={`${order.id}-${order.number}`}>
        <div className="site-order-heading"><div><strong>Pedido {order.number}</strong><span>{dateTime(order.createdAt)}</span></div><div className="site-order-tags"><span className="site-order-status">{statusLabel(order.status, order.fulfillment)}</span>{order.testMode && <span className="site-order-test">Pedido de teste</span>}</div></div>
        {order.customerName && <p className="site-order-customer">{order.customerName}</p>}
        <ul className="site-order-items">{order.items.map((item, index) => <li key={`${order.id}-${index}`}><span>{item.quantity} × {item.name}{item.note ? <small>{item.note}</small> : null}</span><span>{brl(item.unitPriceCents * item.quantity)}</span></li>)}</ul>
        {(order.discountCents > 0 || order.deliveryCents > 0 || order.couponCode) && <dl className="site-order-breakdown">
          <div><dt>Subtotal</dt><dd>{brl(order.subtotalCents)}</dd></div>
          {order.discountCents > 0 && <div><dt>Desconto{order.couponCode ? ` · ${order.couponCode}` : ''}</dt><dd>− {brl(order.discountCents)}</dd></div>}
          {order.deliveryCents > 0 && <div><dt>Taxa de entrega</dt><dd>{brl(order.deliveryCents)}</dd></div>}
        </dl>}
        <div className="site-order-bottom"><span>{order.fulfillment === 'pickup' ? 'Retirada' : order.fulfillment === 'delivery' ? 'Entrega' : order.fulfillment} · {paymentLabel(order.paymentMethod)} · Pagamento: <strong>Não confirmado</strong></span><strong>{brl(order.totalCents)}</strong></div>
      </article>)}</div>
      : <div className="site-orders-empty"><ShoppingBag size={24} /><span>{page?.orders.length ? 'Nenhum pedido corresponde a estes filtros nesta página.' : error ? 'Entre com a conta Google verificada do dono para carregar os pedidos.' : 'Ainda não há pedidos do site.'}</span></div>}
    <nav className="site-orders-pagination" aria-label="Paginação de pedidos">
      <button className="btn btn-secondary" disabled={!page || page.offset <= 0 || loading} onClick={() => void refresh(Math.max(0, offset - PAGE_SIZE))}><ChevronLeft size={17} /> Anterior</button>
      <span>{page ? `Página ${Math.floor(page.offset / PAGE_SIZE) + 1}` : '—'}</span>
      <button className="btn btn-secondary" disabled={!page?.hasMore || loading} onClick={() => void refresh(offset + PAGE_SIZE)}>Próxima <ChevronRight size={17} /></button>
    </nav>
  </div>
}
