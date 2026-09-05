import { ArrowUpRight, ClipboardList, PackageCheck, Sparkles, Clock3 } from 'lucide-react'
import type { Product, Sale, Tab } from '../types'
import { dayKey, periodSales, productionPlan, salesSummary } from '../analytics'
import { CookieArt } from './CookieArt'

export function Operations({ products, sales, navigate }: { products: Product[]; sales: Sale[]; navigate: (tab: Tab) => void }) {
  const today = salesSummary(periodSales(sales, 1))
  const plan = productionPlan(products, sales)
  const empty = products.filter(product => product.stock === 0).length
  const waiting = sales.filter(sale => sale.status === 'Pendente').length
  const old = sales.filter(sale => sale.status === 'Pendente' && dayKey(sale.date) < dayKey(Date.now() - 7 * 86400000)).length
  return <>
    <section className="operations-hero" aria-labelledby="operations-title">
      <div className="operations-copy">
        <span className="eyebrow"><Sparkles size={14} /> SEU DIA, BEM ORGANIZADO</span>
        <h2 id="operations-title">Mais cookies.<br /><em>Menos complicação.</em></h2>
        <p>Vendas, estoque e próximos passos. Tudo o que sua loja precisa para seguir em frente.</p>
        <button className="btn btn-primary" onClick={() => navigate('vendas')}>Registrar uma venda <ArrowUpRight size={17} /></button>
      </div>
      <div className="today-summary">
        <span className="eyebrow">HOJE NA COOKIE ZOOKIE</span>
        <strong>{today.units}<span>cookies vendidos</span></strong>
        <div><span>{today.count} vendas</span><span>{today.gifts} presentes</span></div>
        <small>{new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</small>
      </div>
    </section>
    <div className="operations-actions">
      <button className="operation-action" onClick={() => navigate('produtos')}><PackageCheck size={22} /><span><strong>{empty ? `${empty} sabores sem estoque` : 'Confira seu estoque'}</strong><small>{empty ? 'Priorize a reposição para continuar vendendo' : 'Atualize a produção e as quantidades disponíveis'}</small></span><ArrowUpRight size={18} /></button>
      <button className="operation-action" onClick={() => navigate('clientes')}><Clock3 size={22} /><span><strong>{waiting ? `${waiting} vendas aguardando pagamento` : 'Cobranças em dia'}</strong><small>{old ? `${old} pendentes há mais de 7 dias` : 'Acompanhe pagamentos e clientes em um só lugar'}</small></span><ArrowUpRight size={18} /></button>
    </div>
    <section className="card production-card">
      <div className="section-heading"><div><span className="eyebrow">PLANEJAMENTO AUTOMÁTICO</span><h3><ClipboardList size={19} /> O que preparar a seguir</h3></div><span className="badge badge-neutral">Próximos 3 dias</span></div>
      <p className="section-description">Sugestão pela média de saídas dos últimos 7 dias. Você decide quanto produzir.</p>
      {!plan.length ? <p>Cadastre seus sabores para começar.</p> : <div className="production-grid">{plan.map(product => <div className="production-item" key={product.id}>
        <CookieArt name={product.name} size={44} /><div><strong>{product.name}</strong><small>{product.stock} em estoque · {product.weekly} saídas na semana</small></div>
        <span className={`badge ${product.suggested ? 'badge-warning' : 'badge-neutral'}`}>{product.suggested ? `Preparar ${product.suggested}` : product.weekly ? 'Estoque suficiente' : 'Sem histórico recente'}</span>
      </div>)}</div>}
    </section>
  </>
}
