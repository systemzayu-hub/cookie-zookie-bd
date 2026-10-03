import { useMemo, useRef, useState } from 'react'
import { Calendar, CheckCircle2, ChevronDown, ChevronRight, ChevronUp, HandCoins, MessageSquare, UserRound } from 'lucide-react'
import { SearchInput } from '../components/SearchInput'
import { useConfirmation } from '../components/useConfirmation'
import { matchesSearch } from '../search'
import { Customer, fmtBRL, fmtDate, saleOutstanding, salePaidAmount, Sale, uid } from '../types'
import { CookieArt } from '../components/CookieArt'
import { usePasswordGuard } from '../components/PasswordGate'
import { MaskedMoney } from '../components/MaskedMoney'
import { MaskedPII } from '../components/MaskedPII'
import { CustomerProfile } from '../components/CustomerProfile'
import { BillingMessagePreview } from '../components/BillingMessagePreview'
import { SaleTransferDialog } from '../components/SaleTransferDialog'
import type { CustomerPayment, SaleTransfer } from '../sale-adjustments'
import { sameData } from '../store-merge'

type PaymentRequest = CustomerPayment & {
  payment: Sale['payment']
  date: string
  receiptId: string
  saleId?: string
}
type PaymentResult = boolean | Promise<boolean>
type PaymentHandler = (request: PaymentRequest) => PaymentResult

interface CobrancaViewProps {
  sales: Sale[]
  setSales?: React.Dispatch<React.SetStateAction<Sale[]>>
  customers: Customer[]
  setCustomers?: React.Dispatch<React.SetStateAction<Customer[]>>
  pushToast: (msg: string, type?: 'success' | 'error') => void
  onCustomerPayment: PaymentHandler
  onSaleTransfer: (request: SaleTransfer) => boolean
}

type CustomerGroup = {
  customerId: string
  customer: Customer
  sales: Sale[]
  total: number
  received: number
  totalPending: number
  totalQty: number
}

const saleOrder = (a: Sale, b: Sale) => Date.parse(a.date) - Date.parse(b.date) || a.id.localeCompare(b.id)
const samePendingSales = (left: Sale[], right: Sale[]) => sameData([...left].sort(saleOrder), [...right].sort(saleOrder))
const parsePaymentCents = (raw: string) => {
  const normalized = raw.trim().replace(',', '.')
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null
  const value = Number(normalized)
  const cents = Math.round(value * 100)
  return Number.isSafeInteger(cents) ? cents : null
}
const todayInSaoPaulo = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
const validPaymentDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00.000Z`))
const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits ? `(${digits}` : ''
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}
const paymentLabels: Record<Sale['payment'], string> = { dinheiro: 'Dinheiro', cartão: 'Cartão', pix: 'Pix' }

export function CobrancaView({ sales, setSales: _setSales, customers, setCustomers, pushToast, onCustomerPayment, onSaleTransfer }: CobrancaViewProps) {
  const { guard } = usePasswordGuard()
  const { confirm, confirmation } = useConfirmation()
  const salesRef = useRef(sales)
  salesRef.current = sales
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'total' | 'nome' | 'qtd' | 'data'>('total')
  const [sortDesc, setSortDesc] = useState(true)
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())
  const [partialAmounts, setPartialAmounts] = useState<Record<string, string>>({})
  const [paymentMethods, setPaymentMethods] = useState<Record<string, Sale['payment']>>({})
  const [paymentDates, setPaymentDates] = useState<Record<string, string>>({})
  const [pendingPayments, setPendingPayments] = useState<Set<string>>(new Set())
  const receiptIds = useRef<Record<string, string>>({})
  const pendingPaymentKeys = useRef(new Set<string>())
  const [transfer, setTransfer] = useState<{ sale: Sale; customer: Customer } | null>(null)
  const [profile, setProfile] = useState<Customer | null>(null)
  const [preview, setPreview] = useState<CustomerGroup | null>(null)

  const pendentes = useMemo(() => sales.filter(sale => sale.status === 'Pendente' && saleOutstanding(sale) > 0), [sales])
  const groups = useMemo(() => {
    const map = new Map<string, CustomerGroup>()
    pendentes.forEach(sale => {
      const customer = customers.find(item => item.id === sale.customerId)
      if (!customer) return
      const current = map.get(customer.id) || { customerId: customer.id, customer, sales: [], total: 0, received: 0, totalPending: 0, totalQty: 0 }
      current.sales.push(sale)
      current.total += sale.total
      current.received += salePaidAmount(sale)
      current.totalPending += saleOutstanding(sale)
      current.totalQty += sale.items.filter(item => !item.paid).reduce((sum, item) => sum + item.qty, 0)
      map.set(customer.id, current)
    })
    return [...map.values()]
  }, [customers, pendentes])

  const sortedGroups = useMemo(() => groups.filter(group => matchesSearch(search, group.customer.name, group.customer.contact)).sort((a, b) => {
    let compare = sortBy === 'total' ? a.totalPending - b.totalPending : sortBy === 'nome' ? a.customer.name.localeCompare(b.customer.name, 'pt-BR') : sortBy === 'qtd' ? a.totalQty - b.totalQty : Math.max(...a.sales.map(sale => Date.parse(sale.date))) - Math.max(...b.sales.map(sale => Date.parse(sale.date)))
    return sortDesc ? -compare : compare
  }), [groups, search, sortBy, sortDesc])

  const paymentMethodFor = (group: CustomerGroup) => paymentMethods[group.customerId] || 'pix'
  const paymentDateFor = (group: CustomerGroup) => paymentDates[group.customerId] || todayInSaoPaulo()
  const receiptIdFor = (key: string) => receiptIds.current[key] || (receiptIds.current[key] = uid())
  const isPaymentPending = (key: string) => pendingPaymentKeys.current.has(key)
  const makeRequest = (group: CustomerGroup, amount: number, salesSnapshot: Sale[], saleId?: string, date = paymentDateFor(group)): PaymentRequest => ({
    customerId: group.customerId,
    amount: Math.round(amount * 100) / 100,
    sales: salesSnapshot,
    payment: paymentMethodFor(group),
    date,
    receiptId: receiptIdFor(saleId ? `${group.customerId}:${saleId}` : group.customerId),
    ...(saleId ? { saleId } : {}),
  })

  const completePayment = (request: PaymentRequest, key: string, success: () => void) => {
    if (isPaymentPending(key)) return
    pendingPaymentKeys.current.add(key)
    setPendingPayments(previous => new Set(previous).add(key))
    const finish = (ok: boolean) => {
      pendingPaymentKeys.current.delete(key)
      setPendingPayments(previous => { const next = new Set(previous); next.delete(key); return next })
      if (ok) { delete receiptIds.current[key]; success() }
    }
    try {
      const result = onCustomerPayment(request)
      if (typeof result === 'boolean') { finish(result); return }
      void result.then(finish).catch(error => { finish(false); pushToast((error as Error)?.message || 'Não foi possível registrar o recebimento.', 'error') })
    } catch (error) {
      finish(false)
      pushToast((error as Error)?.message || 'Não foi possível registrar o recebimento.', 'error')
    }
  }

  const applyPartialPayment = (group: CustomerGroup) => {
    const key = group.customerId
    if (isPaymentPending(key)) return
    const pendingCents = Math.max(0, Math.round(group.totalPending * 100))
    const amountCents = parsePaymentCents(partialAmounts[group.customerId] || '')
    if (amountCents === null || amountCents <= 0) {
      pushToast(`Informe um valor positivo com até duas casas decimais (máximo ${fmtBRL(pendingCents / 100)}).`, 'error')
      return
    }
    if (amountCents > pendingCents) {
      pushToast(`O valor não pode superar o saldo pendente de ${fmtBRL(pendingCents / 100)}.`, 'error')
      return
    }
    const amount = amountCents / 100
    const date = paymentDateFor(group)
    if (!validPaymentDate(date)) { pushToast('Informe uma data válida para o recebimento.', 'error'); return }
    guard('Registrar recebimento', () => {
      void (async () => {
        const accepted = await confirm(`Registrar ${fmtBRL(amount)} em ${date} por ${paymentLabels[paymentMethodFor(group)]} para ${group.customer.name}? O valor será aplicado às vendas mais antigas.`, 'Confirmar recebimento')
        if (!accepted) return
        completePayment(makeRequest(group, amount, group.sales, undefined, date), key, () => {
          setPartialAmounts(previous => ({ ...previous, [group.customerId]: '' }))
          pushToast(`${fmtBRL(amount)} registrado como recebido!`)
        })
      })()
    })
  }

  const markAllPaid = (group: CustomerGroup) => {
    const key = group.customerId
    if (isPaymentPending(key)) return
    guard('Quitar tudo', () => {
      const requestedSales = group.sales.map(sale => ({ ...sale, items: sale.items.map(item => ({ ...item })) }))
      const requestedBalance = group.totalPending
      void (async () => {
        const date = paymentDateFor(group)
        if (!validPaymentDate(date)) { pushToast('Informe uma data válida para a quitação.', 'error'); return }
        const accepted = await confirm(`Conta de ${group.customer.name}: ${group.sales.length} ${group.sales.length === 1 ? 'venda' : 'vendas'}, saldo pendente de ${fmtBRL(requestedBalance)}. Registrar em ${date} por ${paymentLabels[paymentMethodFor(group)]} e quitar tudo?`, 'Confirmar quitação')
        if (!accepted) return
        const currentPending = salesRef.current.filter(sale => sale.customerId === group.customerId && sale.status === 'Pendente' && saleOutstanding(sale) > 0)
        if (!samePendingSales(currentPending, requestedSales)) { pushToast('As pendências mudaram. Confira o saldo e tente novamente.', 'error'); return }
        const amount = Math.round(currentPending.reduce((sum, sale) => sum + saleOutstanding(sale), 0) * 100) / 100
        if (!Number.isFinite(amount) || amount <= 0) { pushToast('Não há saldo pendente para quitar.', 'error'); return }
        completePayment(makeRequest(group, amount, currentPending, undefined, date), key, () => pushToast(group.sales.length > 1 ? 'Pendências do cliente quitadas!' : 'Venda quitada!'))
      })()
    })
  }

  const receiveItem = (group: CustomerGroup, sale: Sale, item: Sale['items'][number]) => {
    const key = `${group.customerId}:${sale.id}`
    if (isPaymentPending(key)) return
    const amount = Math.min(item.unitPrice * item.qty, saleOutstanding(sale))
    if (amount <= 0) return
    guard('Registrar recebimento', () => {
      void (async () => {
        const date = paymentDateFor(group)
        if (!validPaymentDate(date)) { pushToast('Informe uma data válida para o recebimento.', 'error'); return }
        const accepted = await confirm(`Registrar ${fmtBRL(amount)} recebido em ${date} por ${paymentLabels[paymentMethodFor(group)]} para esta venda, usando ${item.qty}x ${item.name} apenas como referência?`, 'Confirmar recebimento')
        if (!accepted) return
        completePayment(makeRequest(group, amount, [sale], sale.id, date), key, () => pushToast(`${fmtBRL(amount)} registrado nesta venda!`))
      })()
    })
  }

  const toggleCard = (customerId: string) => setExpandedCards(previous => { const next = new Set(previous); next.has(customerId) ? next.delete(customerId) : next.add(customerId); return next })
  const toggleProductSection = (saleId: string) => setExpandedProducts(previous => { const next = new Set(previous); next.has(saleId) ? next.delete(saleId) : next.add(saleId); return next })
  const saveContact = (customer: Customer, rawContact: string) => {
    if (!setCustomers) return false
    const contact = formatPhone(rawContact.trim())
    if (contact && !/^\(\d{2}\) \d{4,5}-\d{4}$/.test(contact)) { pushToast('Informe um telefone válido com DDD.', 'error'); return false }
    guard('Alterar telefone', () => {
      setCustomers(previous => previous.map(item => item.id === customer.id ? { ...item, contact } : item))
      pushToast('Telefone atualizado!')
    })
    return true
  }

  const totalReceber = groups.reduce((sum, group) => sum + group.totalPending, 0)
  const totalSalesOpen = groups.reduce((sum, group) => sum + group.sales.length, 0)
  const sortOptions = [{ value: 'data', label: 'Data mais recente' }, { value: 'total', label: 'Maior saldo' }, { value: 'nome', label: 'Nome A-Z' }, { value: 'qtd', label: 'Mais unidades' }] as const

  return <div className="customer-billing-view">
    <div className="page-row"><div className="page-title"><h2>Cobrança</h2><p>Confira saldos e registre pagamentos.</p></div></div>
    <section className="card cb-billing-overview" aria-label="Resumo das cobranças">
      <span className="cb-overview-note">Todas as pendências</span>
      <div className="cb-overview-balance"><small>Total a receber</small><strong><MaskedMoney value={totalReceber} /></strong></div>
      <div className="cb-overview-counts"><div><small>Clientes</small><strong>{groups.length}</strong></div><div><small>Vendas em aberto</small><strong>{totalSalesOpen}</strong></div></div>
    </section>
    {groups.length === 0 ? <div className="card empty-state" role="status"><CheckCircle2 className="icon" size={48} color="var(--ok-500)" /><p>Nenhuma pendência encontrada.</p><p>As vendas presentes e pagas ficam fora desta lista.</p></div> : <>
      <section className="card cb-billing-toolbar" aria-label="Buscar cobranças">
        <SearchInput inputId="billing-search" label="Buscar cliente" placeholder="Nome ou telefone…" value={search} onChange={setSearch} />
        <label className="field-label" htmlFor="billing-sort">Ordenar por<select id="billing-sort" value={sortBy} onChange={event => setSortBy(event.target.value as typeof sortBy)}><option value="total">Maior saldo</option><option value="nome">Nome A-Z</option><option value="qtd">Mais unidades</option><option value="data">Data mais recente</option></select></label>
        <button className="btn btn-ghost btn-sm cb-sort-toggle" onClick={() => setSortDesc(previous => !previous)} aria-label="Alternar ordem da lista">{sortDesc ? <ChevronDown size={16} /> : <ChevronUp size={16} />} <span className="cb-sort-direction">{sortDesc ? 'Maior primeiro' : 'Menor primeiro'}</span></button>
        <span className="result-count">{sortedGroups.length} {sortedGroups.length === 1 ? 'pessoa' : 'pessoas'}</span>
      </section>
      {sortedGroups.length === 0 && <div className="card empty-state" role="status"><p>Nenhum cliente encontrado para “{search}”.</p></div>}
      <div className="cb-billing-list">
        {sortedGroups.map(group => {
          const expanded = expandedCards.has(group.customerId)
          return <article key={group.customerId} className="cb-billing-card">
            <button className="cb-billing-header" role="button" onClick={() => toggleCard(group.customerId)} aria-expanded={expanded} aria-controls={`billing-details-${group.customerId}`}>
              <span className="cb-billing-main"><span>{group.customer.name}</span><span className="cb-billing-meta"><span>{group.sales.length} {group.sales.length === 1 ? 'venda' : 'vendas'} pendente{group.sales.length === 1 ? '' : 's'}</span><span>·</span><MaskedPII value={group.customer.contact} type="phone" /></span></span>
              <span className="cb-billing-balance"><MaskedMoney value={group.totalPending} /><small className="cb-billing-meta">Falta receber</small></span>
              {expanded ? <ChevronDown size={18} aria-hidden="true" /> : <ChevronRight size={18} aria-hidden="true" />}
            </button>
            <div className="cb-billing-actions" style={{ padding: '0 var(--sp-4) var(--sp-3)' }}>
              <button className="btn btn-primary btn-sm" onClick={() => setPreview(group)}><MessageSquare size={15} /> Cobrar</button>
            </div>
            <details open={expanded} className="cb-secondary-details" onToggle={event => { if (event.currentTarget.open !== expanded) toggleCard(group.customerId) }}>
              <summary className="sr-only">Ver detalhes de {group.customer.name}</summary>
              <div id={`billing-details-${group.customerId}`} className="cb-billing-details" aria-busy={isPaymentPending(group.customerId)}>
                <div className="cb-inline-metrics" aria-label={`Resumo das vendas pendentes de ${group.customer.name}`}><span><small>Total dessas vendas</small><strong><MaskedMoney value={group.total} /></strong></span><span><small>Já recebido</small><strong><MaskedMoney value={group.received} /></strong></span><span><small>Falta receber</small><strong><MaskedMoney value={group.totalPending} /></strong></span></div>
                <div className="cb-billing-actions">
                  <button className="btn btn-success btn-sm" disabled={isPaymentPending(group.customerId)} onClick={() => markAllPaid(group)}><CheckCircle2 size={15} /> Quitar tudo</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setProfile(group.customer)}><UserRound size={15} /> Ver ficha</button>
                </div>
                <div className="cb-payment-panel">
                  <label>Valor recebido<input type="text" inputMode="decimal" placeholder="Ex.: 6,00" aria-label={`Valor parcial para ${group.customer.name}`} disabled={isPaymentPending(group.customerId)} value={partialAmounts[group.customerId] || ''} onChange={event => setPartialAmounts(previous => ({ ...previous, [group.customerId]: event.target.value }))} /></label>
                  <label>Forma<select aria-label={`Forma de recebimento de ${group.customer.name}`} disabled={isPaymentPending(group.customerId)} value={paymentMethodFor(group)} onChange={event => setPaymentMethods(previous => ({ ...previous, [group.customerId]: event.target.value as Sale['payment'] }))}>{(Object.keys(paymentLabels) as Sale['payment'][]).map(payment => <option key={payment} value={payment}>{paymentLabels[payment]}</option>)}</select></label>
                  <label>Data do recebimento<input type="date" aria-label={`Data do recebimento de ${group.customer.name}`} disabled={isPaymentPending(group.customerId)} value={paymentDateFor(group)} onChange={event => setPaymentDates(previous => ({ ...previous, [group.customerId]: event.target.value }))} /></label>
                  <button className="btn btn-primary" disabled={isPaymentPending(group.customerId)} onClick={() => applyPartialPayment(group)}><HandCoins size={15} /> <span>{isPaymentPending(group.customerId) ? 'Registrando…' : 'Registrar pagamento'}</span><span className="sr-only"> (Descontar do saldo)</span></button>
                  <p className="cb-payment-hint">O valor é aplicado às vendas pendentes mais antigas primeiro. Falta agora <MaskedMoney value={group.totalPending} />.</p>
                </div>
                <div className="cb-sale-list">
                  {group.sales.map(sale => {
                    const itemPaid = sale.items.filter(item => item.paid).length
                    const itemPending = sale.items.length - itemPaid
                    const saleExpanded = expandedProducts.has(sale.id)
                    return <section key={sale.id} className="cb-sale-row">
                      <button type="button" className="cb-sale-summary" onClick={() => toggleProductSection(sale.id)} aria-expanded={saleExpanded} aria-controls={`sale-items-${sale.id}`}>
                        <span><Calendar size={14} aria-hidden="true" /> {fmtDate(sale.date)}</span><span className="badge badge-neutral">{paymentLabels[sale.payment]}</span><span><strong><MaskedMoney value={saleOutstanding(sale)} /></strong><small className="cb-billing-meta">Falta nesta venda</small></span><span>{itemPending} pendente{itemPending === 1 ? '' : 's'}{itemPaid ? ` · ${itemPaid} pago${itemPaid === 1 ? '' : 's'}` : ''}{saleExpanded ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}</span>
                      </button>
                      {saleExpanded && <div id={`sale-items-${sale.id}`} className="cb-sale-items">
                        <p className="cb-payment-hint">Total <MaskedMoney value={sale.total} /> · Recebido <MaskedMoney value={salePaidAmount(sale)} /> · Falta <MaskedMoney value={saleOutstanding(sale)} /></p>
                        {sale.items.map((item, index) => {
                          const itemTotal = item.unitPrice * item.qty
                          return <div key={`${sale.id}-${index}`} className="cb-sale-item">
                            <div className="cb-sale-item-name"><CookieArt name={item.name} size={22} /><strong>{item.qty}x {item.name}</strong><div className="cb-sale-item-meta"><MaskedMoney value={item.unitPrice} /> por unidade · <MaskedMoney value={itemTotal} /></div></div>
                            <span className={item.paid ? 'badge badge-success' : 'badge badge-warning'}>{item.paid ? 'Pago' : 'Pendente'}</span>
                            {!item.paid && <button className="btn btn-secondary btn-sm" disabled={isPaymentPending(`${group.customerId}:${sale.id}`)} onClick={() => receiveItem(group, sale, item)}><HandCoins size={14} /> Receber</button>}
                          </div>
                        })}
                        {group.customer && <button className="btn btn-ghost btn-sm" onClick={() => setTransfer({ sale, customer: group.customer })}>Trocar cliente desta venda</button>}
                      </div>}
                    </section>
                  })}
                </div>
              </div>
            </details>
          </article>
        })}
      </div>
    </>}
    {profile && <CustomerProfile customer={customers.find(customer => customer.id === profile.id) || profile} sales={sales} onClose={() => setProfile(null)} onSaveContact={setCustomers ? saveContact : undefined} />}
    {preview && <BillingMessagePreview customer={preview.customer} sales={preview.sales} onClose={() => setPreview(null)} pushToast={pushToast} />}
    {transfer && <SaleTransferDialog key={transfer.sale.id} customer={transfer.customer} initialSale={transfer.sale} customers={customers} sales={sales} onTransfer={onSaleTransfer} onClose={() => setTransfer(null)} />}
    {confirmation}
  </div>
}
