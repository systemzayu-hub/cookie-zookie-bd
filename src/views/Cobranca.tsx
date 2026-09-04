import { useState, useMemo } from 'react'
import { MessageSquare, CheckCircle2, Copy, ChevronDown, ChevronUp, DollarSign, Users, AlertCircle, Calendar, Minus, Check, ChevronRight } from 'lucide-react'
import { Sale, Customer, fmtBRL, saleOutstanding } from '../types'
import { CookieArt } from '../components/CookieArt'
import { usePasswordGuard } from '../components/PasswordGate'
import { MaskedMoney } from '../components/MaskedMoney'
import { MaskedPII } from '../components/MaskedPII'
import { logAction } from '../audit'

interface CobrancaViewProps {
  sales: Sale[]
  setSales: React.Dispatch<React.SetStateAction<Sale[]>>
  customers: Customer[]
  pushToast: (msg: string, type?: 'success' | 'error') => void
}

type CustomerGroup = {
  customerId: string
  customer: Customer | undefined
  sales: Sale[]
  totalPending: number
  totalQty: number
}

export function CobrancaView({ sales, setSales, customers, pushToast }: CobrancaViewProps) {
  const { guard } = usePasswordGuard()
  const [sortBy, setSortBy] = useState<'total' | 'nome' | 'qtd' | 'data'>('data')
  const [sortDesc, setSortDesc] = useState(true)
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())
  const [partialAmounts, setPartialAmounts] = useState<Record<string, string>>({})

  // Derive pendentes
  const pendentes = useMemo(() => sales.filter(s => s.status === 'Pendente'), [sales])

  // Group by customer
  const groups = useMemo(() => {
    const map = new Map<string, CustomerGroup>()
    pendentes.forEach(sale => {
      const customer = customers.find(c => c.id === sale.customerId)
      if (!customer) return
      const cid = customer.id
      if (!map.has(cid)) {
        map.set(cid, {
          customerId: cid,
          customer,
          sales: [],
          totalPending: 0,
          totalQty: 0,
        })
      }
      const g = map.get(cid)!
      g.sales.push(sale)
      g.totalPending += saleOutstanding(sale)
      g.totalQty += sale.items.filter(i => !i.paid).reduce((a, i) => a + i.qty, 0)
    })
    return Array.from(map.values())
  }, [pendentes, customers])

  // Sort
  const sortedGroups = useMemo(() => {
    return [...groups].sort((a, b) => {
      let cmp = 0
      if (sortBy === 'total') cmp = a.totalPending - b.totalPending
      else if (sortBy === 'nome') cmp = (a.customer?.name || 'ZZZ').localeCompare(b.customer?.name || 'ZZZ')
      else if (sortBy === 'qtd') cmp = a.totalQty - b.totalQty
      else if (sortBy === 'data') {
        const latestA = Math.max(...a.sales.map(s => new Date(s.date).getTime()))
        const latestB = Math.max(...b.sales.map(s => new Date(s.date).getTime()))
        cmp = latestA - latestB
      }
      return sortDesc ? -cmp : cmp
    })
  }, [groups, sortBy, sortDesc])

  // --- Actions ---
  const normalizeWhats = (raw: string): string => {
    let n = raw.normalize('NFKC').replace(/[^0-9]/g, '')
    if (n && !n.startsWith('55')) n = '55' + n
    return n
  }

  const buildMessage = (g: CustomerGroup) => {
    const name = g.customer?.name || 'cliente'
    const items = g.sales.flatMap(s => s.items.filter(i => !i.paid).map(i => `${i.qty}x ${i.name}`))
    const totalUnpaid = g.sales.reduce((a, s) => a + saleOutstanding(s), 0)
    return `Oi, ${name}! Passando aqui pra lembrar das pendências de cookies 🍪\n${items.join(', ')}\nTotal pendente: ${fmtBRL(totalUnpaid)}\nQuando puder acertar, me avisa 😊`
  }

  const openWhatsApp = (g: CustomerGroup) => {
    const telefone = normalizeWhats(g.customer?.contact || '')
    if (!telefone) { pushToast('Telefone não informado', 'error'); return }
    window.open(`https://wa.me/${telefone}?text=${encodeURIComponent(buildMessage(g))}`, '_blank', 'noopener,noreferrer')
    logAction('cobranca', `Abriu cobrança por WhatsApp para ${g.customer?.name || 'cliente sem cadastro'}`)
  }

  const copyMessage = async (g: CustomerGroup) => {
    try {
      await navigator.clipboard.writeText(buildMessage(g))
      pushToast('Mensagem copiada!')
      logAction('cobranca', `Copiou cobrança para ${g.customer?.name || 'cliente sem cadastro'}`)
    } catch {
      pushToast('Não foi possível copiar. Selecione a mensagem manualmente.', 'error')
    }
  }

  const toggleCard = (cid: string) => {
    setExpandedCards(prev => { const n = new Set(prev); n.has(cid) ? n.delete(cid) : n.add(cid); return n })
  }

  const toggleProductSection = (saleId: string) => {
    setExpandedProducts(prev => { const n = new Set(prev); n.has(saleId) ? n.delete(saleId) : n.add(saleId); return n })
  }

  // Toggle individual item paid status
  const toggleItemPaid = (saleId: string, itemIdx: number) => {
    const before = sales.find(s => s.id === saleId)
    guard('Marcar item como pago', () => {
      setSales(prev => prev.map(s => {
        if (s.id !== saleId) return s
        const target = s.items[itemIdx]
        if (!target) return s
        const items = s.items.map((item, i) => i === itemIdx ? { ...item, paid: !item.paid } : item)
        const delta = target.unitPrice * target.qty * (target.paid ? -1 : 1)
        const paidAmount = Math.min(s.total, Math.max(0, (s.paidAmount || 0) + delta))
        const allPaid = paidAmount >= s.total || items.every(i => i.paid)
        return { ...s, items, paidAmount: allPaid ? s.total : paidAmount, status: allPaid ? 'Pago' as const : 'Pendente' as const }
      }))
      logAction('cobranca', `Atualizou um item da venda ${saleId.slice(0, 8)}`, before ? () => setSales(prev => prev.map(s => s.id === before.id ? before : s)) : undefined)
      pushToast('Item atualizado!', 'success')
    })
  }

  // Partial payment
  const applyPartialPayment = (saleId: string) => {
    const amount = Number((partialAmounts[saleId] || '0').replace(',', '.'))
    if (!amount || amount <= 0) { pushToast('Valor inválido', 'error'); return }
    const sale = sales.find(s => s.id === saleId)
    if (!sale || amount > saleOutstanding(sale) + 0.001) { pushToast('O valor supera o saldo pendente.', 'error'); return }
    guard('Aplicar pagamento parcial', () => {
      setSales(prev => prev.map(s => {
        if (s.id !== saleId) return s
        const paidAmount = Math.min(s.total, (s.paidAmount || 0) + amount)
        const allPaid = paidAmount >= s.total
        return {
          ...s,
          paidAmount,
          items: allPaid ? s.items.map(item => ({ ...item, paid: true })) : s.items,
          status: allPaid ? 'Pago' as const : 'Pendente' as const,
        }
      }))
      setPartialAmounts(prev => ({ ...prev, [saleId]: '' }))
      logAction('cobranca', `Registrou pagamento parcial de ${fmtBRL(amount)} na venda ${saleId.slice(0, 8)}`, () => setSales(prev => prev.map(s => s.id === sale.id ? sale : s)))
      pushToast(`${fmtBRL(amount)} descontado!`, 'success')
    })
  }

  // Mark all items of a sale as paid
  const markAllPaid = (saleIds: string[]) => {
    const before = sales.filter(s => saleIds.includes(s.id))
    guard('Marcar tudo como pago', () => {
      setSales(prev => prev.map(s =>
        saleIds.includes(s.id) ? { ...s, items: s.items.map(i => ({ ...i, paid: true })), paidAmount: s.total, status: 'Pago' as const } : s
      ))
      logAction('cobranca', `Quitou ${saleIds.length} venda(s)`, () => setSales(prev => prev.map(s => before.find(old => old.id === s.id) || s)))
      pushToast(saleIds.length > 1 ? 'Pendências do cliente quitadas!' : 'Venda quitada!', 'success')
    })
  }

  const totalReceber = groups.reduce((a, g) => a + g.totalPending, 0)
  const pessoasDevendo = groups.length
  const totalPendentes = groups.reduce((a, g) => a + g.totalQty, 0)

  const sortOptions = [
    { value: 'data', label: 'Data (mais recente)' },
    { value: 'total', label: 'Quem deve mais' },
    { value: 'nome', label: 'Nome A-Z' },
    { value: 'qtd', label: 'Quantidade' },
  ] as const

  if (groups.length === 0) {
    return (
      <>
        <div className="page-row">
          <div className="page-title">
            <h2>Cobrança</h2>
            <p>Gerencie pendências de clientes e envie lembretes via WhatsApp</p>
          </div>
        </div>
        <div className="card empty-state" style={{ textAlign: 'center', padding: 'var(--sp-12)' }}>
          <CheckCircle2 className="icon" size={48} color="var(--ok-500)" />
          <p style={{ marginTop: 'var(--sp-4)', fontSize: '1.1rem' }}>Nenhuma pendência! 🎉</p>
          <p style={{ color: 'var(--tx-3)', marginTop: 'var(--sp-2)' }}>Todas as vendas estão quitadas.</p>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="page-row">
        <div className="page-title">
          <h2>Cobrança</h2>
          <p>Gerencie pendências de clientes e envie lembretes via WhatsApp</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-stats" style={{ marginBottom: 'var(--sp-6)' }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, var(--cz-500), var(--cz-600))' }}>
              <DollarSign size={22} />
            </div>
            <div>
              <div className="stat-label">Total a receber</div>
              <div className="stat-value" style={{ color: 'var(--cz-600)' }}><MaskedMoney value={totalReceber} /></div>
            </div>
          </div>
        </div>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, var(--warn-500), var(--warn-600))' }}>
              <Users size={22} />
            </div>
            <div>
              <div className="stat-label">Pessoas devendo</div>
              <div className="stat-value">{pessoasDevendo}</div>
            </div>
          </div>
        </div>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, var(--info-500), #2563eb)' }}>
              <AlertCircle size={22} />
            </div>
            <div>
              <div className="stat-label">Falta cobrar (unid.)</div>
              <div className="stat-value">{totalPendentes}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros/ordenação */}
      <div className="card" style={{ marginBottom: 'var(--sp-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, color: 'var(--tx-2)' }}>Ordenar:</span>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}
            style={{
              padding: 'var(--sp-2) var(--sp-3)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)',
              background: 'var(--card)',
              color: 'var(--tx-1)',
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            {sortOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setSortDesc(d => !d)}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-1)' }}
          >
            {sortDesc ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            <span>{sortDesc ? 'Maior primeiro' : 'Menor primeiro'}</span>
          </button>
        </div>
      </div>

      {/* Cards por pessoa */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        {sortedGroups.map(g => {
          const cid = g.customerId
          const isExpanded = expandedCards.has(cid)
          const unpaidTotal = g.sales.reduce((a, s) => a + saleOutstanding(s), 0)
          const initials = (g.customer?.name || 'SC').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

          return (
              <article key={cid} className="card billing-card">
              {/* Card header */}
              <div className="billing-card-header" onClick={() => toggleCard(cid)} role="button" tabIndex={0} aria-expanded={isExpanded} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleCard(cid) } }}>
                {/* Avatar */}
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--cz-500), var(--cz-700))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 700, fontSize: '1rem', flexShrink: 0,
                }}>
                  {initials}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--tx-1)' }}>{g.customer?.name}</div>
                  <div style={{ display: 'flex', gap: 'var(--sp-3)', fontSize: '0.82rem', color: 'var(--tx-3)', marginTop: 2, flexWrap: 'wrap' }}>
                    <span>{g.sales.length} {g.sales.length === 1 ? 'compra' : 'compras'} pendente{g.sales.length !== 1 ? 's' : ''}</span>
                    <span>•</span>
                    <span>{g.totalQty} {g.totalQty === 1 ? 'unidade' : 'unidades'}</span>
                    {g.customer?.contact && (
                                          <>
                                            <span>•</span>
                                            <span className="billing-phone"><MaskedPII value={g.customer.contact} type="phone" /></span>
                                          </>
                                        )}
                  </div>
                </div>

                {/* Valor pendente */}
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                  <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--cz-600)', fontFamily: 'var(--font-display)' }}>
                                    <MaskedMoney value={unpaidTotal} />
                                  </div>
                                  <div className="badge badge-warning" style={{ fontSize: '0.7rem' }}>Pendente</div>
                                </div>

                {/* Chevron */}
                <div style={{ color: 'var(--tx-3)', flexShrink: 0 }}>
                  {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                </div>
              </div>

              {/* Ações rápidas (sempre visíveis) */}
              <div className="billing-quick-actions">
                <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); openWhatsApp(g) }} disabled={!g.customer?.contact} title="WhatsApp">
                  <MessageSquare size={14} /> WhatsApp
                </button>
                <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); copyMessage(g) }} title="Copiar mensagem">
                  <Copy size={14} /> Copiar
                </button>
                <button className="btn btn-success btn-sm" onClick={(e) => { e.stopPropagation(); markAllPaid(g.sales.map(s => s.id)) }} title="Marcar todas as compras como pagas">
                  <CheckCircle2 size={14} /> Quitar tudo
                </button>
              </div>

              {/* Conteúdo expandido: lista de vendas + pagamento parcial */}
              {isExpanded && (
                <div style={{ borderTop: '1px solid var(--border)', padding: 'var(--sp-4)' }}>
                  {/* Pagamento parcial */}
                  <div className="partial-payment-row">
                    <DollarSign size={16} color="var(--cz-500)" />
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--tx-2)' }}>Pagamento parcial:</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      placeholder="Ex: 6,00"
                      aria-label={`Valor parcial para ${g.customer?.name || 'cliente'}`}
                      value={partialAmounts[g.sales[0]?.id] || ''}
                      onChange={e => setPartialAmounts(prev => ({ ...prev, [g.sales[0]?.id]: e.target.value }))}
                      style={{
                        width: 120, padding: 'var(--sp-2) var(--sp-3)',
                        border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
                        background: 'var(--card)', color: 'var(--tx-1)', fontSize: '0.9rem',
                        textAlign: 'right',
                      }}
                      onClick={e => e.stopPropagation()}
                    />
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={(e) => { e.stopPropagation(); applyPartialPayment(g.sales[0]?.id) }}
                    >
                      <Minus size={14} /> Descontar
                    </button>
                  </div>

                  {/* Lista de vendas */}
                  {g.sales.map(sale => {
                    const saleUnpaid = sale.items.filter(i => !i.paid)
                    const salePaid = sale.items.filter(i => i.paid)
                    const isProdExpanded = expandedProducts.has(sale.id)

                    return (
                      <div key={sale.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', marginBottom: 'var(--sp-3)', overflow: 'hidden' }}>
                        {/* Sale header */}
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: 'var(--sp-3)', cursor: 'pointer', background: 'var(--bg-2)' }}
                          onClick={() => toggleProductSection(sale.id)}
                        >
                          <Calendar size={14} color="var(--tx-3)" />
                                                    <span style={{ fontSize: '0.85rem', color: 'var(--tx-2)' }}>
                                                      {new Date(sale.date).toLocaleDateString('pt-BR')}
                                                    </span>
                                                    <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>{sale.payment}</span>
                                                    <span style={{ flex: 1 }} />
                                                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--cz-600)' }}><MaskedMoney value={saleOutstanding(sale)} /></span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--tx-3)' }}>
                            {saleUnpaid.length} pendente{saleUnpaid.length !== 1 ? 's' : ''}
                            {salePaid.length > 0 && ` • ${salePaid.length} pago${salePaid.length !== 1 ? 's' : ''}`}
                          </span>
                          {isProdExpanded ? <ChevronUp size={16} color="var(--tx-3)" /> : <ChevronDown size={16} color="var(--tx-3)" />}
                        </div>

                        {/* Produtos expandidos */}
                        {isProdExpanded && (
                          <div style={{ padding: 'var(--sp-3)', borderTop: '1px solid var(--border)' }}>
                            {sale.items.map((item, idx) => {
                              const itemTotal = item.unitPrice * item.qty
                              return (
                                <div
                                  key={idx}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
                                    padding: 'var(--sp-2) var(--sp-3)', marginBottom: 'var(--sp-1)',
                                    borderRadius: 'var(--r-sm)',
                                    background: item.paid ? 'rgba(34,197,94,0.08)' : 'transparent',
                                    opacity: item.paid ? 0.6 : 1,
                                  }}
                                >
                                  {/* Checkbox */}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); toggleItemPaid(sale.id, idx) }}
                                    style={{
                                      width: 24, height: 24, borderRadius: 6, border: '2px solid',
                                      borderColor: item.paid ? 'var(--ok-500)' : 'var(--border)',
                                      background: item.paid ? 'var(--ok-500)' : 'transparent',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s',
                                    }}
                                  >
                                    {item.paid && <Check size={14} color="#fff" />}
                                  </button>

                                  {/* Cookie icon */}
                                  <CookieArt name={item.name} size={26} />

                                  {/* Item info */}
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.88rem', textDecoration: item.paid ? 'line-through' : 'none', color: 'var(--tx-1)' }}>
                                      {item.qty}x {item.name}
                                    </div>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--tx-3)', display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
                                                                          <span><MaskedMoney value={item.unitPrice} /> un.</span>
                                                                          <span>•</span>
                                                                          <span><MaskedMoney value={itemTotal} /></span>
                                      {item.paid && (
                                        <>
                                          <span>•</span>
                                          <span style={{ color: 'var(--ok-500)', fontWeight: 600 }}>Pago</span>
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  {/* Unit price */}
                                                                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--tx-2)', flexShrink: 0 }}>
                                                                      <MaskedMoney value={itemTotal} />
                                                                    </span>
                                </div>
                              )
                            })}
                             <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 'var(--sp-2)', borderTop: '1px solid var(--border)', marginTop: 'var(--sp-2)' }}>
                               <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--tx-2)' }}>Saldo desta compra:</span>
                               <span style={{ fontWeight: 700, color: 'var(--cz-600)' }}>{fmtBRL(saleOutstanding(sale))}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </article>
          )
        })}
      </div>
    </>
  )
}
