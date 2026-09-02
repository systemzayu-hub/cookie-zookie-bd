import { useMemo, useState } from 'react'
import { DollarSign, ShoppingBag, TrendingUp, Download } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import { Sale, CHANNELS, PAYMENTS, fmtBRL, fmtDate } from '../types'
import { StatusBadge } from './Dashboard'

function StatCard({ icon, color, label, value }: { icon: React.ReactNode; color: string; label: string; value: string }) {
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

  const exportCSV = () => {
    const rows = filtered.map(s => `${fmtDate(s.date)};${s.items.map(i => `${i.name} x${i.qty}`).join('; ')};${s.payment};${s.channel};${s.total.toFixed(2).replace('.', ',')}`)
    const csv = '\uFEFFData;Itens;Pagamento;Canal;Total\n' + rows.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'relatorio-vendas.csv'; a.click()
    URL.revokeObjectURL(url)
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
          <button className="btn btn-secondary btn-sm" onClick={exportCSV}><Download size={14} /> CSV</button>
        </div>
      </div>

      <div className="grid grid-stats" style={{ marginBottom: 'var(--space-6)' }}>
        <StatCard icon={<DollarSign size={20} />} color="var(--ok-500)" label="Faturamento" value={fmtBRL(revenue)} />
        <StatCard icon={<ShoppingBag size={20} />} color="var(--cz-500)" label="Vendas" value={String(count)} />
        <StatCard icon={<TrendingUp size={20} />} color="var(--info-500)" label="Ticket médio" value={fmtBRL(avg)} />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3 className="card-title">Vendas por dia</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={dayData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="dia" stroke="var(--tx-3)" fontSize={11} />
              <YAxis stroke="var(--tx-3)" fontSize={11} />
              <Tooltip formatter={(v: number) => fmtBRL(v)} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8 }} />
              <Bar dataKey="total" fill="var(--cz-500)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="card-title">Produtos por faturamento</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={prodData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" stroke="var(--tx-3)" fontSize={11} />
              <YAxis type="category" dataKey="name" stroke="var(--tx-3)" fontSize={11} width={90} />
              <Tooltip formatter={(v: number) => fmtBRL(v)} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8 }} />
              <Bar dataKey="total" fill="var(--cz-400)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="card-title">Por canal de venda</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={byChannel} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={3}>
                {byChannel.map((_, i) => <Cell key={i} fill={['var(--cz-400)', 'var(--cz-600)', 'var(--cz-300)'][i % 3]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => fmtBRL(v)} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8 }} />
              <Legend wrapperStyle={{ color: 'var(--tx-1)' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="card-title">Por forma de pagamento</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={byPay} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={3}>
                {byPay.map((_, i) => <Cell key={i} fill={['var(--ok-500)', 'var(--cz-500)', 'var(--cz-300)'][i % 3]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => fmtBRL(v)} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8 }} />
              <Legend wrapperStyle={{ color: 'var(--tx-1)' }} />
            </PieChart>
          </ResponsiveContainer>
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
                    <td className="text-right" style={{ fontWeight: 700 }}>{fmtBRL(s.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
