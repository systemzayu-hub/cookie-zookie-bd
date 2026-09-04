import { useMemo, useState } from 'react'
import { DollarSign, ShoppingBag, TrendingUp, Download } from 'lucide-react'
import { Sale, CHANNELS, PAYMENTS, fmtBRL, fmtDate } from '../types'
import { StatusBadge } from './Dashboard'
import { SensitiveData } from '../components/SensitiveData'
import { MaskedMoney } from '../components/MaskedMoney'
import { MetricBars } from '../components/MetricBars'
import { authReauthenticateGoogle } from '../sync'

function StatCard({ icon, color, label, value }: { icon: React.ReactNode; color: string; label: string; value: React.ReactNode }) {
  return (
    <div className="card stat-card">
      <div className="stat-icon" style={{ background: color }}>{icon}</div>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  )
}

export function ReportsView({ sales }: { sales: Sale[] }) {
  const [period, setPeriod] = useState<7 | 30 | 90 | 'all'>(30)

  const filtered = useMemo(() => {
    if (period === 'all') return sales
    return sales.filter(s => Date.now() - new Date(s.date).getTime() <= period * 86400000)
  }, [sales, period])

  const revenue = filtered.reduce((a, s) => a + s.total, 0)
  const count = filtered.length
  const avg = count ? revenue / count : 0

  const dayMap = new Map<string, number>()
  filtered.forEach(s => {
    const d = new Date(s.date).toLocaleDateString('pt-BR')
    dayMap.set(d, (dayMap.get(d) || 0) + s.total)
  })
  const dayData = [...dayMap.entries()].map(([dia, total]) => ({ dia, total }))

  const prodMap = new Map<string, number>()
  filtered.forEach(s => s.items.forEach(i => prodMap.set(i.name, (prodMap.get(i.name) || 0) + i.unitPrice * i.qty)))
  const prodData = [...prodMap.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total).slice(0, 6)

  const byChannel = CHANNELS.map(c => ({ name: c, value: filtered.filter(s => s.channel === c).reduce((a, s) => a + s.total, 0) })).filter(x => x.value > 0)
  const byPay = PAYMENTS.map(p => ({ name: p, value: filtered.filter(s => s.payment === p).reduce((a, s) => a + s.total, 0) })).filter(x => x.value > 0)

  const exportCSV = async () => {
    try { await authReauthenticateGoogle() } catch { return }
    const csvCell = (value: string) => {
      const safe = /^[=+\-@]/.test(value.trimStart()) ? `'${value}` : value
      return `"${safe.replace(/"/g, '""')}"`
    }
    const rows = filtered.map(s => [
      fmtDate(s.date),
      s.items.map(i => `${i.name} x${i.qty}`).join(', '),
      s.payment,
      s.channel,
      s.total.toFixed(2).replace('.', ','),
    ].map(csvCell).join(';'))
    const csv = '\uFEFFData;Itens;Pagamento;Canal;Total\r\n' + rows.join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'relatorio-vendas.csv'; document.body.appendChild(a); a.click(); a.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
  }

  return (
    <>
      <div className="page-row">
        <div className="page-title"><h2>Relatórios</h2><p>Análise de vendas armazenadas</p></div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          {([7, 30, 90, 'all'] as const).map(p => (
            <button key={String(p)} className={`btn btn-sm ${period === p ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPeriod(p)}>
              {p === 'all' ? 'Tudo' : p + ' dias'}
            </button>
          ))}
          <button className="btn btn-secondary btn-sm" onClick={() => void exportCSV()}><Download size={14} /> CSV</button>
        </div>
      </div>

      <SensitiveData label="Desbloquear dados financeiros">
            <div className="grid grid-stats" style={{ marginBottom: 'var(--space-6)' }}>
              <StatCard icon={<DollarSign size={20} />} color="var(--ok-500)" label="Faturamento" value={<MaskedMoney value={revenue} />} />
              <StatCard icon={<ShoppingBag size={20} />} color="var(--cz-500)" label="Vendas" value={String(count)} />
              <StatCard icon={<TrendingUp size={20} />} color="var(--info-500)" label="Ticket médio" value={<MaskedMoney value={avg} />} />
            </div>

      <div className="grid grid-2">
        <div className="card">
          <h3 className="card-title">Vendas por dia</h3>
          <MetricBars items={dayData.map(item => ({ label: item.dia, value: item.total }))} format={fmtBRL} />
        </div>

        <div className="card">
          <h3 className="card-title">Produtos por faturamento</h3>
          <MetricBars items={prodData.map(item => ({ label: item.name, value: item.total }))} format={fmtBRL} />
        </div>

        <div className="card">
          <h3 className="card-title">Por canal de venda</h3>
          <MetricBars items={byChannel.map(item => ({ label: item.name, value: item.value }))} format={fmtBRL} />
        </div>

        <div className="card">
          <h3 className="card-title">Por forma de pagamento</h3>
          <MetricBars items={byPay.map(item => ({ label: item.name, value: item.value }))} format={fmtBRL} />
        </div>
      </div>

      <div className="card" style={{ marginTop: 'var(--space-6)' }}>
        <h3 className="card-title">Tabela de vendas (período selecionado)</h3>
        {filtered.length === 0 ? (
          <div className="empty-state"><p>Nenhuma venda no período.</p></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Data</th><th>Itens</th><th>Pagamento</th><th>Status</th><th>Canal</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                              {filtered.map(s => (
                                <tr key={s.id}>
                                  <td>{fmtDate(s.date)}</td>
                                  <td>{s.items.map(i => `${i.name} x${i.qty}`).join(', ')}</td>
                                  <td><span className="badge badge-neutral">{s.payment}</span></td>
                                  <td><StatusBadge status={s.status} /></td>
                                  <td><span className="badge badge-brand">{s.channel}</span></td>
                                  <td className="text-right" style={{ fontWeight: 700 }}><MaskedMoney value={s.total} /></td>
                                </tr>
                              ))}
                            </tbody>
            </table>
          </div>
        )}
      </div>
      </SensitiveData>
    </>
  )
}
