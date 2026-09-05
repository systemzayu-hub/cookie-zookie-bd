import { ArrowUpRight, Clock3 } from 'lucide-react'
import type { Product, Sale, Tab } from '../types'
import { periodSales, salesSummary } from '../analytics'
export function Operations({ sales, navigate }: { products: Product[]; sales: Sale[]; navigate: (tab: Tab) => void }) {
  const today = salesSummary(periodSales(sales, 1))
  const waiting = sales.filter(sale => sale.status === 'Pendente').length
  return <section className="daily-overview" aria-label="Resumo de hoje">
    <div className="card daily-count"><span className="eyebrow">HOJE NA COOKIE ZOOKIE</span><strong>{today.units} <span>cookies vendidos</span></strong><small>{today.count} vendas · {today.gifts} presentes</small></div>
    <button className="card daily-pending" onClick={() => navigate('clientes')}><Clock3 size={24}/><span><strong>{waiting}</strong><span>vendas aguardando pagamento</span></span><ArrowUpRight size={18}/></button>
  </section>
}
