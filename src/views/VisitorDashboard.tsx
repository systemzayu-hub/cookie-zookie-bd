import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { getDb } from '../sync'
import { dayKey } from '../analytics'
import { MetricBars } from '../components/MetricBars'
import type { Sale } from '../types'
export function VisitorDashboard({ name, onLogout }: { name: string; onLogout: () => void }) {
  const [sales, setSales] = useState<Pick<Sale, 'id' | 'date' | 'items' | 'status'>[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const db = getDb()
    if (!db) return
    return onSnapshot(doc(db, 'dashboard', 'public'), snapshot => { setSales(snapshot.data()?.sales || []); setError('') }, () => { setSales(null); setError('Não foi possível carregar a dashboard.') })
  }, [])
  const today = (sales || []).filter(s => dayKey(s.date) === dayKey(new Date()) && s.status !== 'Presente')
  const units = today.reduce((sum,s) => sum + s.items.reduce((n,i) => n + i.qty, 0), 0)
  const days = Array.from({ length:7 }, (_,i) => {
    const date = new Date(Date.now() - (6-i)*86400000)
    return { label: date.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',timeZone:'America/Sao_Paulo'}), value:(sales || []).filter(s => dayKey(s.date) === dayKey(date) && s.status !== 'Presente').length }
  })
  return <main className="employee-workspace">
    <header className="page-row"><div className="page-title"><h1>Dashboard</h1><p>{name} · Somente leitura</p></div><button className="btn btn-secondary" onClick={onLogout}>Sair</button></header>
    {error ? <p role="alert">{error}</p> : sales === null ? <p role="status">Carregando…</p> : <>
      <section className="daily-overview" aria-label="Resumo de hoje">
        <div className="card daily-count"><span className="eyebrow">HOJE NA COOKIE ZOOKIE</span><strong>{units} <span>cookies vendidos</span></strong><small>{today.length} vendas</small></div>
        <div className="card daily-pending"><strong>{sales.filter(s => s.status === 'Pendente').length}</strong><span>vendas aguardando pagamento</span></div>
      </section>
      <section className="card"><h2 className="card-title">Vendas nos últimos 7 dias</h2><MetricBars items={days}/></section>
    </>}
  </main>
}
