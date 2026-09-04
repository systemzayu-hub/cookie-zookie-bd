type MetricItem = { label: string; value: number; secondary?: number }

export function MetricBars({ items, format = String, secondaryLabel }: {
  items: MetricItem[]
  format?: (value: number) => string
  secondaryLabel?: string
}) {
  const max = Math.max(1, ...items.flatMap(item => [item.value, item.secondary || 0]))
  if (items.length === 0) return <div className="empty-state"><p>Sem dados no período.</p></div>

  return (
    <ul className="metric-bars" aria-label="Gráfico de valores">
      {items.map(item => (
        <li key={item.label} className="metric-bar-row">
          <div className="metric-bar-label"><span>{item.label}</span><strong>{format(item.value)}</strong></div>
          <div className="metric-bar-track" aria-hidden="true">
            <span className="metric-bar-fill" style={{ width: `${Math.max(3, item.value / max * 100)}%` }} />
          </div>
          {typeof item.secondary === 'number' && (
            <>
              <div className="metric-bar-label metric-bar-secondary-label"><span>{secondaryLabel || 'Comparativo'}</span><strong>{format(item.secondary)}</strong></div>
              <div className="metric-bar-track metric-bar-secondary" aria-hidden="true">
                <span className="metric-bar-fill" style={{ width: `${Math.max(3, item.secondary / max * 100)}%` }} />
              </div>
            </>
          )}
        </li>
      ))}
    </ul>
  )
}
