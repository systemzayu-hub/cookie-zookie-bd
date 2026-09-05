import { ConfirmDialog } from '../components/ConfirmDialog'
import { useEffect, useState } from 'react'
import { Undo2 } from 'lucide-react'
import { useRole } from '../auth'
import { can } from '../roles'
import { canUndoAction, loadAudit, loadAuditRemote, undoAuditAction, type AuditEntry } from '../audit'
import { callBackend, onAuditChanges } from '../sync'
import { previewUndo, undoStatus } from '../undo'
import { TeamView } from './Team'
const names: Record<string, string> = { products: 'produtos', sales: 'vendas', customers: 'clientes', custos: 'custos', perdas: 'perdas' }
export function AuditView() {
  const role = useRole()
  const [tab, setTab] = useState('history')
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [search, setSearch] = useState('')
  const [action, setAction] = useState('')
  const [days, setDays] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<AuditEntry | null>(null)
  const [preview, setPreview] = useState('')
  useEffect(() => {
    if (!can(role, 'audit')) return
    let active = true
    void loadAuditRemote().then(data => { if (active) setEntries(data) }).catch(() => { if (active) setError('Não foi possível carregar o histórico.') })
    const stop = onAuditChanges(remote => {
      if (!active) return
      setEntries(previous => [...new Map([...previous, ...remote, ...loadAudit()].map(entry => [entry.id, entry])).values()].sort((a,b) => b.ts - a.ts))
    }, () => { if (active) setError('A conexão com a auditoria foi interrompida.') })
    return () => { active = false; stop() }
  }, [role])
  if (!can(role, 'audit')) return <p>Seu cargo não permite acessar a auditoria.</p>
  const undone = new Set(entries.map(e => e.undoOf).filter(Boolean))
  const select = (entry: AuditEntry) => {
    setError('')
    try {
      const counts = entry.local ? previewUndo(entry.id) : Object.keys(names).map(source => ({ source, count: entry.undo?.filter(p => p.source === source).length || 0 })).filter(p => p.count)
      setPreview(counts.map(p => `${p.count} ${names[p.source]}`).join(' · '))
      setPending(entry)
    } catch (e) { setError((e as Error).message) }
  }
  const confirm = async () => {
    if (!pending || busy) return
    setBusy(true); setError('')
    try {
      if (pending.local) await undoAuditAction(pending)
      else await callBackend('undoAction', { id: pending.id })
      setPending(null); setEntries(await loadAuditRemote())
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  const filtered = entries.filter(e => (!action || e.action === action) && (!days || e.ts >= Date.now() - days * 86400000) && `${e.actor} ${e.email || ''} ${e.detail}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')))
  const exportCsv = () => {
    if (!can(role, 'audit')) return
    const cell = (value: string) => '"' + (/^[=+@\-\t\r]/.test(value) ? "'" + value : value).replace(/"/g, '""') + '"'
    const csv = [['Data', 'Pessoa', 'Ação', 'Detalhes'], ...filtered.map(e => [new Date(e.ts).toISOString(), e.actor, e.action, e.detail])].map(row => row.map(cell).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = 'auditoria.csv'; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <>
    <div className="page-row"><div className="page-title"><h1>Auditoria</h1></div><div className="audit-tabs"><button className="btn btn-secondary" onClick={exportCsv}>Exportar histórico</button><button className={`btn ${tab === 'history' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('history')}>Histórico</button>{can(role, 'team') && <button className={`btn ${tab === 'team' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('team')}>Equipe e acessos</button>}</div></div>
    {tab === 'team' && can(role, 'team') ? <TeamView/> : <>
      <div className="card checkout-fields"><label>Buscar<input className="input" placeholder="Pessoa ou ação" value={search} onChange={e => setSearch(e.target.value)}/></label><label>Tipo<select className="input" value={action} onChange={e => setAction(e.target.value)}><option value="">Todos</option>{[...new Set(entries.map(e => e.action))].sort().map(a => <option key={a}>{a}</option>)}</select></label><label>Período<select className="input" value={days} onChange={e => setDays(Number(e.target.value))}><option value={0}>Todo o histórico carregado</option><option value={1}>Últimas 24 horas</option><option value={7}>Últimos 7 dias</option><option value={30}>Últimos 30 dias</option></select></label></div>
      {error && <p role="alert" className="card">{error}</p>}
      <div className="card audit-history">{!filtered.length && <p>Nenhuma ação encontrada.</p>}{filtered.map(entry => {
        const reversed = undone.has(entry.id) || entry.local && undoStatus(entry.id) === 'undone'
        const available = !reversed && (entry.local ? canUndoAction(entry.id) : !!entry.undo?.length)
        return <article className="audit-event" key={entry.id}><div><div className="audit-event-meta"><strong>{entry.actor}</strong><time dateTime={new Date(entry.ts).toISOString()}>{new Date(entry.ts).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</time><span className="badge badge-neutral">{entry.local ? 'Neste aparelho' : entry.action}</span></div><p>{entry.detail}</p></div>{available ? <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => select(entry)}><Undo2 size={15}/> Desfazer</button> : <small>{reversed ? 'Desfeita' : entry.action === 'equipe' ? 'Gerencie pela equipe' : 'Sem reversão disponível'}</small>}</article>
      })}</div>
    </>}
    {pending && <ConfirmDialog titleId="undo-confirm" busy={busy} onCancel={() => setPending(null)}><h2 id="undo-confirm">Desfazer esta ação?</h2><p>{pending.detail}</p><p>{preview}</p><p>Alterações posteriores serão preservadas. Se houver conflito, a reversão será recusada.</p>{error && <p role="alert">{error}</p>}<div className="pw-buttons"><button autoFocus className="btn btn-secondary" disabled={busy} onClick={() => setPending(null)}>Cancelar</button><button className="btn btn-primary" disabled={busy} onClick={() => void confirm()}>{busy ? 'Desfazendo…' : 'Confirmar reversão'}</button></div></ConfirmDialog>}
  </>
}
