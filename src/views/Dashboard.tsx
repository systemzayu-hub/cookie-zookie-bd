import { SensitiveData } from '../components/SensitiveData'
import { Plus } from 'lucide-react'
import { type Product, type Sale, type Customer, type Tab, fmtBRL, salePaidAmount, saleOutstanding } from '../types'
import { Operations } from '../components/Operations'
import { MetricBars } from '../components/MetricBars'
import { dayKey } from '../analytics'
export function StatusBadge({ status }: { status?: string }) {
  const colors: Record<string, string> = { Pago: 'badge-success', Pendente: 'badge-info', Debitado: 'badge-danger', Presente: 'badge-brand' }
  return <span className={`badge ${colors[status || 'Pago'] || 'badge-neutral'}`}>{status || 'Pago'}</span>
}
export function Dashboard({ sales, products, customers, onNewSale, onNavigate }: { sales: Sale[]; products: Product[]; customers: Customer[]; onNewSale: () => void; onNavigate: (tab: Tab) => void }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(Date.now() - (6 - i) * 86400000)
    return { label: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' }), value: sales.filter(s => dayKey(s.date) === dayKey(date) && s.status !== 'Presente').length }
  })
  const recent = [...sales].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, 6)
  return <>
    <div className="page-row"><div className="page-title"><h1>Dashboard</h1></div><button className="btn btn-primary" onClick={onNewSale}><Plus size={18}/> Registrar venda</button></div>
    <Operations products={products} sales={sales} navigate={onNavigate}/>
    <div className="dashboard-details">
      <section className="card"><h2 className="card-title">Vendas nos Últimos 7 dias</h2><MetricBars items={days}/></section>
      <SensitiveData label="Acumulado da loja"><section className="card"><h2 className="card-title">Acumulado da loja</h2><dl className="summary-list">
        <div><dt>Recebido</dt><dd>{fmtBRL(sales.reduce((n, s) => n + salePaidAmount(s), 0))}</dd></div>
        <div><dt>A receber</dt><dd>{fmtBRL(sales.filter(s => s.status === 'Pendente').reduce((n, s) => n + saleOutstanding(s), 0))}</dd></div>
        <div><dt>Clientes cadastrados</dt><dd>{customers.length}</dd></div>
      </dl></section></SensitiveData>
    </div>
    <section className="card"><div className="page-row"><h2 className="card-title">Últimas vendas</h2><button className="btn btn-ghost" onClick={() => onNavigate('vendas')}>Ver todas</button></div>
      {!recent.length ? <p>Nenhuma venda registrada.</p> : <div className="table-wrap"><table className="table"><thead><tr><th>Data</th><th>Cliente</th><th>Itens</th><th>Status</th></tr></thead><tbody>{recent.map(s => <tr key={s.id}><td>{new Date(s.date).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td><td>{customers.find(c => c.id === s.customerId)?.name || '—'}</td><td>{s.items.map(i => `${i.qty}× ${i.name}`).join(', ')}</td><td><StatusBadge status={s.status}/></td></tr>)}</tbody></table></div>}
    </section>
  </>
}
