import { useState } from 'react'
import type { Sale } from '../types'
import { dailySales } from '../analytics'

export function DailySalesChart({ sales }: { sales: Sale[] }) {
  const [metric, setMetric] = useState<'units' | 'count'>('units')
  const days = dailySales(sales)
  const unit = metric === 'units' ? 'cookies' : 'vendas'
  const total = days.reduce((sum, day) => sum + day[metric], 0)
  const max = Math.max(1, ...days.map(day => day[metric]))
  const magnitude = 10 ** Math.floor(Math.log10(max))
  const tick = Math.max(1, Math.ceil(max / magnitude / 4) * magnitude)
  const ceiling = tick * 4
  return <section className="card daily-sales-card">
    <div className="daily-chart-heading"><h2 className="card-title">Últimos 7 dias</h2>
      <div className="daily-chart-switch" role="group" aria-label="Medida do gráfico">
        <button className={`btn btn-sm ${metric === 'units' ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={metric === 'units'} onClick={() => setMetric('units')}>Cookies</button>
        <button className={`btn btn-sm ${metric === 'count' ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={metric === 'count'} onClick={() => setMetric('count')}>Vendas</button>
      </div>
    </div>
    <p className="daily-chart-total"><strong>{total.toLocaleString('pt-BR')}</strong> {unit} no período</p>
    <div className="daily-chart-frame">
      <div className="daily-chart-axis" aria-hidden="true">{[4, 3, 2, 1, 0].map(value => <span key={value} style={{ top: `${(4 - value) * 25}%` }}>{(value * tick).toLocaleString('pt-BR')}</span>)}</div>
      <ul className="daily-chart-columns" aria-label={`${unit} por dia nos últimos 7 dias`}>
        {days.map((day, index) => <li key={day.date} aria-label={`${day.label}: ${day[metric]} ${unit}`}>
          <div className="daily-chart-plot"><div className={`daily-chart-column ${index === days.length - 1 ? 'is-today' : ''}`} style={{ height: `${day[metric] / ceiling * 100}%` }} title={`${day.label}: ${day[metric]} ${unit}`} /><strong className="daily-chart-value" style={{ bottom: `calc(${day[metric] / ceiling * 100}% + 6px)` }}>{day[metric]}</strong></div>
          <span className="daily-chart-date">{day.label}<small>{index === days.length - 1 ? 'Hoje' : '\u00a0'}</small></span>
        </li>)}
      </ul>
    </div>
    <p className="hint daily-chart-note">{total === 0 ? 'Nenhuma venda neste período. ' : ''}{metric === 'units' ? 'Quantidade de cookies vendidos.' : 'Cada venda registrada conta uma vez, mesmo com vários cookies.'} Presentes não entram na contagem.</p>
  </section>
}
