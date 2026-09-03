import { useState, useMemo, useEffect } from 'react'
import { MessageSquare, CheckCircle2, Phone, Copy, ChevronDown, ChevronUp, DollarSign, Users, AlertCircle, CreditCard } from 'lucide-react'
import { Sale, Customer, SaleItemFull } from '../types'
import { fmtBRL } from '../types'
import { authCurrentUser, syncPull, syncPush } from '../sync'
import { load } from '../data'

interface CobrancaViewProps {
  sales: Sale[]
  setSales: React.Dispatch<React.SetStateAction<Sale[]>>
  customers: Customer[]
  pushToast: (msg: string, type?: 'success' | 'error') => void
}

type PendenciaRow = {
  sale: Sale
  customer: Customer | undefined
  productsStr: string
  totalQty: number
  telefone: string
}

export function CobrancaView({ sales, setSales, customers, pushToast }: CobrancaViewProps) {
  const [sortBy, setSortBy] = useState<'total' | 'nome' | 'qtd' | 'data'>('data')
  const [sortDesc, setSortDesc] = useState(false)
  const [filter, setFilter] = useState<'all' | 'pending'>('pending')

  // Derive pendentes from sales with status 'Pendente'
  const pendentes = useMemo(() => {
    return sales.filter(s => s.status === 'Pendente')
  }, [sales])

  // Build display rows with customer info
  const rows = useMemo(() => {
    return pendentes.map(sale => {
      const customer = customers.find(c => c.id === sale.customerId)
      const productsStr = sale.items.map((i: SaleItemFull) => `${i.qty}x ${i.name}`).join(' + ')
      const totalQty = sale.items.reduce((acc, i) => acc + i.qty, 0)
      return {
        sale,
        customer,
        productsStr,
        totalQty,
        telefone: customer?.contact || '',
      }
    })
  }, [pendentes, customers])

  // Sincronizar com Firebase quando vendas mudarem
  useEffect(() => {
    if (!authCurrentUser()) return
    const products = load('cc_products', [])
    syncPush(products, sales, customers, [])
  }, [sales])

  const buildMessage = (row: PendenciaRow) => {
    const { sale, customer, productsStr, totalQty, telefone } = row
    return `Oi, ${customer?.name || 'cliente'}! Passando aqui pra lembrar da pendência dos cookies 🍪\n${totalQty} unidade(s) pendente(s) (${productsStr})\nTotal: ${fmtBRL(sale.total)}\nQuando puder acertar, me avisa 😊`
  }

  const normalizeWhats = (raw: string): string => {
    let n = raw.normalize('NFKC').replace(/[^0-9]/g, '')
    if (n && !n.startsWith('55')) n = '55' + n
    return n
  }

  const openWhatsApp = (row: PendenciaRow) => {
    const telefone = normalizeWhats(row.telefone)
    if (!telefone) {
      pushToast('Telefone não informado', 'error')
      return
    }
    const msg = encodeURIComponent(buildMessage(row))
    window.open(`https://wa.me/${telefone}?text=${msg}`, '_blank')
  }

  const copyMessage = (row: PendenciaRow) => {
    navigator.clipboard.writeText(buildMessage(row))
    pushToast('Mensagem copiada!')
  }

  const togglePago = (saleId: string) => {
    setSales(prev => prev.map(s => 
      s.id === saleId ? { ...s, status: 'Pago' as const } : s
    ))
    pushToast('Venda marcada como paga!')
  }

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      let comparison = 0
      if (sortBy === 'total') comparison = a.sale.total - b.sale.total
      else if (sortBy === 'nome') comparison = (a.customer?.name || '').localeCompare(b.customer?.name || '')
      else if (sortBy === 'qtd') comparison = a.totalQty - b.totalQty
      else if (sortBy === 'data') comparison = new Date(a.sale.date).getTime() - new Date(b.sale.date).getTime()
      return sortDesc ? -comparison : comparison
    })
  }, [rows, sortBy, sortDesc])

  const filteredRows = useMemo(() => {
    if (filter === 'pending') return sortedRows
    return sortedRows
  }, [sortedRows, filter])

  const totalReceber = rows.reduce((acc, r) => acc + r.sale.total, 0)
  const pessoasDevendo = new Set(rows.map(r => r.sale.customerId).filter(Boolean)).size
  const totalPendentes = rows.reduce((acc, r) => acc + r.totalQty, 0)

  const sortOptions = [
    { value: 'data', label: 'Data (mais antiga)' },
    { value: 'total', label: 'Quem deve mais' },
    { value: 'nome', label: 'Nome A-Z' },
    { value: 'qtd', label: 'Quantidade' },
  ] as const

  if (rows.length === 0) {
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

      <div className="grid grid-stats" style={{ marginBottom: 'var(--sp-6)' }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, var(--cz-500), var(--cz-600))' }}>
              <DollarSign size={22} />
            </div>
            <div>
              <div className="stat-label">Total a receber</div>
              <div className="stat-value" style={{ color: 'var(--cz-600)' }}>{fmtBRL(totalReceber)}</div>
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

      <div className="card" style={{ marginBottom: 'var(--sp-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, color: 'var(--tx-2)' }}>Filtrar:</span>
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as typeof filter)}
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
            <option value="pending">Pendentes</option>
            <option value="all">Todas</option>
          </select>
          <span style={{ fontWeight: 600, color: 'var(--tx-2)', marginLeft: 'var(--sp-6)' }}>Ordenar por:</span>
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

      <div className="card" style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-2)', textAlign: 'left' }}>
              <th style={{ padding: 'var(--sp-3)', borderBottom: '1px solid var(--border)' }}>Cliente</th>
              <th style={{ padding: 'var(--sp-3)', borderBottom: '1px solid var(--border)' }}>Produtos</th>
              <th style={{ padding: 'var(--sp-3)', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>Qtd</th>
              <th style={{ padding: 'var(--sp-3)', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>Total</th>
              <th style={{ padding: 'var(--sp-3)', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>Data</th>
              <th style={{ padding: 'var(--sp-3)', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>Status</th>
              <th style={{ padding: 'var(--sp-3)', borderBottom: '1px solid var(--border)', textAlign: 'center', width: '140px' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map(row => (
              <tr key={row.sale.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}>
                <td style={{ padding: 'var(--sp-3)', fontWeight: 600, color: 'var(--tx-1)' }}>
                  {row.customer?.name || 'Sem cliente'}
                </td>
                <td style={{ padding: 'var(--sp-3)', color: 'var(--tx-2)', maxWidth: 280, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {row.productsStr}
                </td>
                <td style={{ padding: 'var(--sp-3)', textAlign: 'center', fontWeight: 600, color: 'var(--cz-600)' }}>
                  {row.totalQty} un.
                </td>
                <td style={{ padding: 'var(--sp-3)', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--cz-600)' }}>
                  {fmtBRL(row.sale.total)}
                </td>
                <td style={{ padding: 'var(--sp-3)', textAlign: 'center', color: 'var(--tx-3)', fontSize: '0.8rem' }}>
                  {new Date(row.sale.date).toLocaleDateString('pt-BR')}
                </td>
                <td style={{ padding: 'var(--sp-3)', textAlign: 'center' }}>
                  <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>Pendente</span>
                </td>
                <td style={{ padding: 'var(--sp-2)', textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: 'var(--sp-2)', justifyContent: 'center' }}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => openWhatsApp(row)}
                      disabled={!row.telefone}
                      title={row.telefone ? 'Abrir WhatsApp' : 'Sem telefone'}
                      style={{ minWidth: '36px', padding: 'var(--sp-1) var(--sp-2)' }}
                    >
                      <MessageSquare size={14} />
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => copyMessage(row)}
                      title="Copiar mensagem de cobrança"
                      style={{ minWidth: '36px', padding: 'var(--sp-1) var(--sp-2)' }}
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => togglePago(row.sale.id)}
                      title="Marcar como pago"
                      style={{ minWidth: '36px', padding: 'var(--sp-1) var(--sp-2)' }}
                    >
                      <CheckCircle2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
          </>
        )
      }