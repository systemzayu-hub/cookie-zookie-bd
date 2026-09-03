import { DollarSign, TrendingUp, ShoppingBag, Users, AlertTriangle, CheckCircle2, Plus, Wallet, Clock3 } from 'lucide-react'
import { ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import { Product, Sale, Customer, LOW_STOCK_THRESHOLD, fmtBRL, CHANNELS } from '../types'
import { CookieArt } from '../components/CookieArt'
import { SensitiveData } from '../components/SensitiveData'

export function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, string> = {
    Pago: 'badge-success', Pendente: 'badge-info', Debitado: 'badge-danger', Presente: 'badge-brand'
  }
  return <span className={`badge ${map[status || 'Pago'] || 'badge-neutral'}`}>{status || 'Pago'}</span>
}

function StatCard({ icon, color, label, value, sub }: { icon: React.ReactNode; color: string; label: string; value: string; sub?: string }) {
  return (
    <div className="card stat-card">
      <div className="stat-icon" style={{ background: color }}>{icon}</div>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {sub && <span style={{ fontSize: '0.8rem', color: 'var(--tx-3)' }}>{sub}</span>}
    </div>
  )
}

export function Dashboard({ sales, products, customers, onNewSale }: {
  sales: Sale[]; products: Product[]; customers: Customer[]; onNewSale: () => void
}) {
  const paid = sales.filter(s => s.status !== 'Debitado')
  const revenue = sales.reduce((a, s) => a + s.total, 0)
  const pending = sales.filter(s => s.status === 'Pendente').reduce((a, s) => a + s.total, 0)
  const lowStock = products.filter(p => p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD)
  const totalSold = sales.reduce((a, s) => a + s.items.reduce((x, i) => x + i.qty, 0), 0)
  const paidCount = sales.filter(s => s.status === 'Pago').length

  const byProd = new Map<string, number>()
  sales.forEach(s => s.items.forEach(i => byProd.set(i.name, (byProd.get(i.name) || 0) + i.qty)))
  const topProducts = [...byProd.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)

  const byChannel = CHANNELS.map(c => ({ name: c, value: sales.filter(s => s.channel === c).reduce((a, s) => a + s.total, 0) })).filter(x => x.value > 0)

  const last7: { dia: string; total: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000)
    const key = d.toDateString()
    const total = sales.filter(s => new Date(s.date).toDateString() === key && s.status !== 'Debitado').reduce((a, s) => a + s.total, 0)
    last7.push({ dia: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), total })
  }

  const recent = [...sales].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6)

  return (
    <>
      <div className="page-row">
        <div className="page-title">
          <h2>Dashboard</h2>
          <p>Resumo das vendas da Cookie Zookie 🍪</p>
        </div>
        <button className="btn btn-primary" onClick={onNewSale}><Plus size={16} /> Registrar Venda</button>
      </div>

      {/* Galeria de sabores */}
      {products.length > 0 && (
        <div className="product-grid" style={{ marginBottom: 'var(--sp-6)' }}>
          {products.slice(0, 4).map(p => (
            <div key={p.id} className="product-card" style={{ textAlign: 'center', padding: 'var(--sp-4)' }}>
              <CookieArt name={p.name} size={64} />
              <div className="p-name">{p.name}</div>
              <div className="p-price">{fmtBRL(p.price)}</div>
              <span className={`badge ${p.stock <= LOW_STOCK_THRESHOLD ? 'badge-warning' : 'badge-brand'}`}>Estoque: {p.stock}</span>
            </div>
          ))}
        </div>
      )}

      <SensitiveData label="Desbloquear faturamento">
      <div className="grid grid-stats" style={{ marginBottom: 'var(--sp-6)' }}>
        <StatCard icon={<DollarSign size={20} />} color="linear-gradient(135deg,#22C55E,#16A34A)" label="Faturamento total" value={fmtBRL(revenue)} sub={`${sales.length} vendas registradas`} />
        <StatCard icon={<Wallet size={20} />} color="linear-gradient(135deg,#3B82F6,#2563EB)" label="Pago" value={fmtBRL(sales.filter(s => s.status === 'Pago').reduce((a, s) => a + s.total, 0))} sub={`${paidCount} vendas pagas`} />
        <StatCard icon={<Clock3 size={20} />} color="linear-gradient(135deg,#F59E0B,#D97706)" label="Pendente" value={fmtBRL(pending)} sub={`${sales.filter(s => s.status === 'Pendente').length} a receber`} />
        <StatCard icon={<ShoppingBag size={20} />} color="linear-gradient(135deg,#E8923F,#D47A27)" label="Cookies vendidos" value={String(totalSold)} sub={`${customers.length} clientes`} />
      </div>
      </SensitiveData>

      <SensitiveData label="Desbloquear gráficos financeiros">
      <div className="grid grid-2">
        <div className="card">
          <h3 className="card-title">Faturamento (últimos 7 dias)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={last7}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="dia" stroke="var(--chart-axis)" fontSize={12} />
              <YAxis stroke="var(--chart-axis)" fontSize={12} />
              <Tooltip formatter={(v: number) => [fmtBRL(v), 'Total']} contentStyle={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: 12 }} />
              <Line type="monotone" dataKey="total" stroke="var(--chart-1)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--chart-1)' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="card-title">Vendas por canal</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={byChannel} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={3}>
                {byChannel.map((_, i) => (
                  <Cell key={i} fill={`var(--chart-${i + 1})`} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => fmtBRL(v)} contentStyle={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: 12 }} />
              <Legend wrapperStyle={{ color: 'var(--tx-1)' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      </SensitiveData>

      <div className="grid grid-2">
        <div className="card">
          <h3 className="card-title">Sabores mais vendidos</h3>
          {topProducts.length === 0 ? <p style={{ color: 'var(--tx-3)' }}>Sem vendas ainda.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              {topProducts.map(([name, qty], i) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                  <span style={{ fontWeight: 700, color: 'var(--cz-600)', width: 22 }}>{['🥇','🥈','🥉','4º'][i]}</span>
                  <CookieArt name={name} size={32} />
                  <span style={{ flex: 1 }}>{name}</span>
                  <span className="badge badge-brand">{qty} un</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="card-title">Estoque baixo</h3>
          {lowStock.length === 0
            ? <p style={{ color: 'var(--ok-600)' }}><CheckCircle2 size={16} style={{ verticalAlign: 'middle' }} /> Estoque em dia</p>
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                {lowStock.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                    <AlertTriangle size={16} color="var(--warn-500)" />
                    <CookieArt name={p.name} size={26} />
                    <span style={{ flex: 1 }}>{p.name}</span>
                    <span className={`badge ${p.stock === 0 ? 'badge-danger' : 'badge-warning'}`}>{p.stock} restantes</span>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 'var(--sp-6)' }}>
        <h3 className="card-title">Últimas vendas</h3>
        {recent.length === 0 ? (
          <div className="empty-state"><p>Nenhuma venda registrada ainda.</p></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Data</th><th>Cliente</th><th>Itens</th><th>Pagamento</th><th>Status</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {recent.map(s => (
                  <tr key={s.id}>
                    <td>{new Date(s.date).toLocaleDateString('pt-BR')}</td>
                    <td style={{ fontWeight: 600 }}>{s.customerId ? customers.find(c => c.id === s.customerId)?.name || '—' : '—'}</td>
                    <td>{s.items.map(i => `${i.name} x${i.qty}`).join(', ')}</td>
                    <td><span className="badge badge-neutral">{s.payment}</span></td>
                    <td><StatusBadge status={s.status} /></td>
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
