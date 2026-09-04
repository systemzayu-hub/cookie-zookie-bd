import { DollarSign, TrendingUp, ShoppingBag, Users, AlertTriangle, CheckCircle2, Plus, Wallet, Clock3, BarChart3, Package, Truck, Store, Award } from 'lucide-react'
import { Product, Sale, Customer, LOW_STOCK_THRESHOLD, fmtBRL, CHANNELS, saleOutstanding, salePaidAmount } from '../types'
import { CookieArt } from '../components/CookieArt'
import { SensitiveData } from '../components/SensitiveData'
import { MaskedMoney } from '../components/MaskedMoney'
import { MetricBars } from '../components/MetricBars'

export function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, string> = {
    Pago: 'badge-success', Pendente: 'badge-info', Debitado: 'badge-danger', Presente: 'badge-brand'
  }
  return <span className={`badge ${map[status || 'Pago'] || 'badge-neutral'}`}>{status || 'Pago'}</span>
}

function StatCard({ icon, color, label, value, sub }: { icon: React.ReactNode; color: string; label: string; value: React.ReactNode; sub?: string }) {
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
  const pending = sales.filter(s => s.status === 'Pendente')
  const lowStock = products.filter(p => p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD)
  const totalSold = sales.reduce((a, s) => a + s.items.reduce((x, i) => x + i.qty, 0), 0)
  const paidCount = sales.filter(s => s.status === 'Pago').length

  const byProd = new Map<string, number>()
  sales.forEach(s => s.items.forEach(i => byProd.set(i.name, (byProd.get(i.name) || 0) + i.qty)))
  const topProducts = [...byProd.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)

  // Vendas por canal (contagem, sem R$)
  const byChannel = CHANNELS.map(c => ({ name: c, vendas: sales.filter(s => s.channel === c).length })).filter(x => x.vendas > 0)

  // Vendas por dia (contagem) — últimos 7 dias
  const last7: { dia: string; vendas: number; unidades: number; total: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000)
    const key = d.toDateString()
    const daySales = sales.filter(s => new Date(s.date).toDateString() === key && s.status !== 'Debitado')
    last7.push({
      dia: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      vendas: daySales.length,
      unidades: daySales.reduce((a, s) => a + s.items.reduce((x, i) => x + i.qty, 0), 0),
      total: daySales.reduce((sum, sale) => sum + salePaidAmount(sale), 0),
    })
  }

  const recent = [...sales].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6)

  // Clientes que mais compraram
  const byCustomer = new Map<string, number>()
  sales.forEach(s => { if (s.customerId) byCustomer.set(s.customerId, (byCustomer.get(s.customerId) || 0) + 1) })
  const topCustomers = [...byCustomer.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, n]) => ({
    name: customers.find(c => c.id === id)?.name || 'Desconhecido',
    vendas: n
  }))

  return (
    <>
      <div className="page-row">
        <div className="page-title">
          <h2>Dashboard</h2>
          <p>Resumo da Cookie Zookie 🍪</p>
        </div>
        <button className="btn btn-primary" onClick={onNewSale}><Plus size={16} /> Registrar Venda</button>
      </div>

      {/* Galeria de sabores (sem preço) */}
      {products.length > 0 && (
        <div className="product-grid" style={{ marginBottom: 'var(--sp-6)' }}>
          {products.slice(0, 4).map(p => (
            <div key={p.id} className="product-card" style={{ textAlign: 'center', padding: 'var(--sp-4)' }}>
              <CookieArt name={p.name} size={64} />
              <div className="p-name">{p.name}</div>
              <span className={`badge ${p.stock <= LOW_STOCK_THRESHOLD ? 'badge-warning' : 'badge-brand'}`}>Estoque: {p.stock}</span>
            </div>
          ))}
        </div>
      )}

      {/* Stats — sem senha, sem R$ */}
      <div className="grid grid-stats" style={{ marginBottom: 'var(--sp-6)' }}>
        <StatCard icon={<ShoppingBag size={20} />} color="linear-gradient(135deg,#E8923F,#D47A27)" label="Vendas realizadas" value={String(sales.length)} sub={`${paidCount} pagas`} />
        <StatCard icon={<Package size={20} />} color="linear-gradient(135deg,#22C55E,#16A34A)" label="Cookies vendidos" value={String(totalSold)} />
        <StatCard icon={<Clock3 size={20} />} color="linear-gradient(135deg,#F59E0B,#D97706)" label="Pedidos pendentes" value={String(pending.length)} sub={`${pending.reduce((a, s) => a + s.items.reduce((x, i) => x + i.qty, 0), 0)} unidades`} />
        <StatCard icon={<Users size={20} />} color="linear-gradient(135deg,#3B82F6,#2563EB)" label="Clientes" value={String(customers.length)} />
      </div>

      {/* Gráficos — sem senha, contagens */}
      <div className="grid grid-2">
        <div className="card">
          <h3 className="card-title"><BarChart3 size={16} /> Vendas por dia (últimos 7)</h3>
          <MetricBars items={last7.map(day => ({ label: day.dia, value: day.vendas, secondary: day.unidades }))} secondaryLabel="Unidades" />
        </div>

        <div className="card">
          <h3 className="card-title"><Store size={16} /> Vendas por canal</h3>
          <MetricBars items={byChannel.map(item => ({ label: item.name, value: item.vendas }))} />
        </div>
      </div>

      <div className="grid grid-2" style={{ marginTop: 'var(--sp-6)' }}>
        <div className="card">
          <h3 className="card-title"><Award size={16} /> Sabores mais vendidos</h3>
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
          <h3 className="card-title"><AlertTriangle size={16} /> Estoque baixo</h3>
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
            )
          }
        </div>
      </div>

      {/* Faturamento financeiro — protegido por senha de auditoria */}
      <SensitiveData label="Dados financeiros" level="financial">
              <div className="grid grid-stats" style={{ marginTop: 'var(--sp-6)', marginBottom: 'var(--sp-4)' }}>
                <StatCard icon={<DollarSign size={20} />} color="linear-gradient(135deg,#22C55E,#16A34A)" label="Faturamento total" value={<MaskedMoney value={sales.reduce((a, s) => a + s.total, 0)} />} sub={`${sales.length} vendas`} />
                <StatCard icon={<Wallet size={20} />} color="linear-gradient(135deg,#3B82F6,#2563EB)" label="Recebido" value={<MaskedMoney value={sales.reduce((a, s) => a + salePaidAmount(s), 0)} />} sub={`${paidCount} quitadas`} />
                <StatCard icon={<Clock3 size={20} />} color="linear-gradient(135deg,#F59E0B,#D97706)" label="Pendente" value={<MaskedMoney value={pending.reduce((a, s) => a + saleOutstanding(s), 0)} />} sub={`${pending.length} a receber`} />
              </div>
        <div className="card" style={{ marginBottom: 'var(--sp-6)' }}>
          <h3 className="card-title"><TrendingUp size={16} /> Faturamento (últimos 7 dias)</h3>
          <MetricBars items={last7.map(day => ({ label: day.dia, value: day.total }))} format={fmtBRL} />
        </div>
      </SensitiveData>

      {/* Clientes que mais compram */}
      {topCustomers.length > 0 && (
        <div className="card" style={{ marginTop: 'var(--sp-6)', marginBottom: 'var(--sp-6)' }}>
          <h3 className="card-title"><Users size={16} /> Clientes mais frequentes</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {topCustomers.map((c, i) => (
              <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                <span style={{ fontWeight: 700, color: 'var(--cz-600)', width: 22 }}>{['🥇','🥈','🥉','4º','5º'][i]}</span>
                <div className="audit-avatar" style={{ background: 'var(--cz-500)', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.75rem', fontWeight: 700 }}>
                  {c.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <span style={{ flex: 1, fontWeight: 600 }}>{c.name}</span>
                <span className="badge badge-brand">{c.vendas} {c.vendas === 1 ? 'compra' : 'compras'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Últimas vendas */}
      <div className="card" style={{ marginTop: 'var(--sp-6)' }}>
        <h3 className="card-title"><ShoppingBag size={16} /> Últimas vendas</h3>
        {recent.length === 0 ? (
          <div className="empty-state"><p>Nenhuma venda registrada ainda.</p></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Data</th><th>Cliente</th><th>Itens</th><th>Pagamento</th><th>Status</th></tr></thead>
              <tbody>
                {recent.map(s => (
                  <tr key={s.id}>
                    <td>{new Date(s.date).toLocaleDateString('pt-BR')}</td>
                    <td style={{ fontWeight: 600 }}>{s.customerId ? customers.find(c => c.id === s.customerId)?.name || '—' : '—'}</td>
                    <td>{s.items.map(i => `${i.name} x${i.qty}`).join(', ')}</td>
                    <td><span className="badge badge-neutral">{s.payment}</span></td>
                    <td><StatusBadge status={s.status} /></td>
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
