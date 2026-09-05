import { useMemo, useState } from 'react'
import { Download, Search, Wallet, TrendingUp, Clock3, ShoppingBag } from 'lucide-react'
import { Sale, CHANNELS, PAYMENTS, fmtBRL, fmtDate, salePaidAmount } from '../types'
import { StatusBadge } from './Dashboard'
import { SensitiveData } from '../components/SensitiveData'
import { MaskedMoney } from '../components/MaskedMoney'
import { MetricBars } from '../components/MetricBars'
import { authReauthenticateGoogle } from '../sync'
import { dayKey, periodSales, salesSummary } from '../analytics'

export function ReportsView({ sales }: { sales: Sale[] }) {
  const [period, setPeriod] = useState<7 | 30 | 90 | 'all'>(30)
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const filtered = useMemo(() => periodSales(sales, period).filter(sale =>
    (status === 'all' || sale.status === status) && sale.items.some(item => item.name.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR')))
  ), [sales, period, status, search])
  const summary = salesSummary(filtered)
  const commercial = filtered.filter(sale => sale.status !== 'Presente')
  const byDay = new Map<string, number>()
  commercial.forEach(sale => byDay.set(dayKey(sale.date), (byDay.get(dayKey(sale.date)) || 0) + sale.total))
  const dayData = [...byDay].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ label: date.split('-').reverse().join('/'), value }))
  const byProduct = new Map<string, number>()
  commercial.forEach(sale => sale.items.forEach(item => byProduct.set(item.name, (byProduct.get(item.name) || 0) + item.qty * item.unitPrice)))
  const productData = [...byProduct].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value }))
  const pageCount = Math.max(1, Math.ceil(filtered.length / 25))
  const currentPage = Math.min(page, pageCount - 1)

  const exportCSV = async () => {
    if (exporting) return
    setExporting(true); setError('')
    try {
      await authReauthenticateGoogle()
      const cell = (value: string) => `"${(/^[=+\-@]/.test(value.trimStart()) ? `'${value}` : value).replace(/"/g, '""')}"`
      const rows = filtered.map(sale => [fmtDate(sale.date), sale.items.map(item => `${item.name} x${item.qty}`).join(', '), sale.payment, sale.status || 'Não informado', sale.channel, sale.total.toFixed(2).replace('.', ','), salePaidAmount(sale).toFixed(2).replace('.', ',')].map(cell).join(';'))
      const blob = new Blob(['\uFEFFData;Itens;Pagamento;Status;Canal;Total;Recebido\r\n' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = `vendas-${dayKey(Date.now())}.csv`; document.body.appendChild(link); link.click(); link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch { setError('Exportação não concluída. Confirme o acesso Google e tente novamente.') }
    finally { setExporting(false) }
  }

  return <>
    <div className="page-row"><div className="page-title"><span className="eyebrow">ENTENDA SEU NEGÓCIO</span><h2>Relatórios</h2><p>Números claros para decidir os próximos passos.</p></div></div>
    <SensitiveData label="Desbloquear relatórios financeiros">
      <div className="report-toolbar card">
        <div className="period-options" aria-label="Período do relatório">{([7, 30, 90, 'all'] as const).map(value => <button key={value} aria-pressed={period === value} className={`btn btn-sm ${period === value ? 'btn-primary' : 'btn-ghost'}`} onClick={() => { setPeriod(value); setPage(0) }}>{value === 'all' ? 'Tudo' : `${value} dias`}</button>)}</div>
        <label className="search-field"><Search size={17} aria-hidden="true" /><input aria-label="Buscar produto no relatório" placeholder="Buscar produto…" value={search} onChange={event => { setSearch(event.target.value); setPage(0) }} /></label>
        <select aria-label="Filtrar por status" value={status} onChange={event => { setStatus(event.target.value); setPage(0) }}><option value="all">Todos os status</option>{['Pago', 'Pendente', 'Debitado', 'Presente'].map(value => <option key={value}>{value}</option>)}</select>
        <button className="btn btn-secondary btn-sm" disabled={exporting || !filtered.length} onClick={() => void exportCSV()}><Download size={15} /> {exporting ? 'Exportando…' : 'Exportar CSV'}</button>
      </div>
      {error && <p role="alert" className="login-error">{error}</p>}
      <div className="grid grid-stats report-stats">
        {[{ label: 'Vendas no período', value: summary.revenue, icon: <TrendingUp size={20} />, detail: `${summary.count} vendas · presentes excluídos` }, { label: 'Recebido destas vendas', value: summary.received, icon: <Wallet size={20} />, detail: 'Inclui pagamentos parciais' }, { label: 'Saldo pendente', value: summary.pending, icon: <Clock3 size={20} />, detail: 'Vendas com status Pendente' }, { label: 'Ticket médio', value: summary.average, icon: <ShoppingBag size={20} />, detail: `${summary.units} cookies vendidos` }].map(item => <div className="card stat-card" key={item.label}><div className="stat-icon" style={{ background: 'var(--cz-700)' }}>{item.icon}</div><span className="stat-label">{item.label}</span><strong className="stat-value"><MaskedMoney value={item.value} /></strong><small>{item.detail}</small></div>)}
      </div>
      <div className="grid grid-2">
        <div className="card"><h3 className="card-title">Vendas por dia</h3><div className="report-chart-scroll"><MetricBars items={dayData} format={fmtBRL} /></div></div>
        <div className="card"><h3 className="card-title">Sabores por valor vendido</h3><MetricBars items={productData} format={fmtBRL} /></div>
        <div className="card"><h3 className="card-title">Por canal de venda</h3><MetricBars items={CHANNELS.map(label => ({ label, value: commercial.filter(sale => sale.channel === label).reduce((sum, sale) => sum + sale.total, 0) }))} format={fmtBRL} /></div>
        <div className="card"><h3 className="card-title">Recebido por forma de pagamento</h3><MetricBars items={PAYMENTS.map(label => ({ label, value: commercial.filter(sale => sale.payment === label).reduce((sum, sale) => sum + salePaidAmount(sale), 0) }))} format={fmtBRL} /></div>
      </div>
      <div className="card report-table">
        <div className="section-heading"><h3>Detalhamento de vendas</h3><span className="badge badge-neutral">{filtered.length} registros</span></div>
        {!filtered.length ? <div className="empty-state"><Search size={28} /><p>Nenhuma venda corresponde aos filtros.</p><button className="btn btn-secondary" onClick={() => { setPeriod('all'); setStatus('all'); setSearch(''); setPage(0) }}>Limpar filtros</button></div> : <>
          <div className="table-wrap"><table className="table"><thead><tr><th>Data</th><th>Itens</th><th>Pagamento</th><th>Status</th><th className="text-right">Total</th><th className="text-right">Recebido</th></tr></thead><tbody>{filtered.slice(currentPage * 25, (currentPage + 1) * 25).map(sale => <tr key={sale.id}><td>{fmtDate(sale.date)}</td><td>{sale.items.map(item => `${item.name} ×${item.qty}`).join(', ')}</td><td>{sale.payment}</td><td><StatusBadge status={sale.status} /></td><td className="text-right">{fmtBRL(sale.total)}</td><td className="text-right">{fmtBRL(salePaidAmount(sale))}</td></tr>)}</tbody></table></div>
          <div className="pagination"><span>Página {currentPage + 1} de {pageCount}</span><button className="btn btn-secondary btn-sm" disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Anterior</button><button className="btn btn-secondary btn-sm" disabled={currentPage === pageCount - 1} onClick={() => setPage(currentPage + 1)}>Próxima</button></div>
        </>}
      </div>
      <p className="report-note">Datas no horário de Brasília. Os recebimentos correspondem às vendas selecionadas, não à data em que cada pagamento foi feito.</p>
    </SensitiveData>
  </>
}
