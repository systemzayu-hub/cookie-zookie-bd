import { SearchInput } from '../components/SearchInput'
import { matchesSearch } from '../search'
import { isDebitAudit } from '../debit-change'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Undo2 } from 'lucide-react'
import { useRole } from '../auth'
import { can } from '../roles'
import { canUndoAction, loadAudit, loadAuditRemote, loadAuditRemotePage, undoAuditAction, type AuditEntry } from '../audit'
import { callBackend, onAuditChanges, type AuditDetails, type AuditPageCursor } from '../sync'
import { auditFieldLabel, changesFromPatches, formatAuditValue, type AuditChange } from '../audit-changes'
import { auditActionLabel, auditAuthor, mergeAuditEntries } from '../audit-presentation'
import { OWNER_KEY_EMAIL } from '../owner-access'
import { auditUndoPatches, previewUndo, undoStatus } from '../undo'
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
  const [loading, setLoading] = useState(true)
  const [pageCursor, setPageCursor] = useState<AuditPageCursor | undefined>()
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState(false)
  const [previewing, setPreviewing] = useState<string | null>(null)
  const [pending, setPending] = useState<AuditEntry | null>(null)
  const [preview, setPreview] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [details, setDetails] = useState<Record<string, AuditDetails>>({})
  const [detailsErrors, setDetailsErrors] = useState<Record<string, string>>({})
  const [detailsLoading, setDetailsLoading] = useState<Record<string, boolean>>({})
  const [reversedIds, setReversedIds] = useState<Set<string>>(new Set())
  const detailRequests = useRef(new Set<string>())
  const pageGeneration = useRef(0)
  const loadMoreLock = useRef(false)
  const selectTab = (next: string) => {
    setTab(next)
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    document.getElementById('main-content')?.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }
  useEffect(() => {
    if (!can(role, 'audit')) return
    let active = true
    const generation = ++pageGeneration.current
    loadMoreLock.current = false
    setLoading(true); setLoadingMore(false); setError(''); setPageCursor(undefined); setHasMore(false); setMoreError('')
    void loadAuditRemotePage().then(page => {
      if (active) {
        setEntries(previous => mergeAuditEntries(previous, page.entries))
        setPageCursor(page.cursor); setHasMore(page.hasMore)
      }
    }).catch(() => {
      if (active) setError('Não foi possível carregar o histórico completo da consulta. Tente novamente.')
    }).finally(() => { if (active) setLoading(false) })
    const stop = onAuditChanges(remote => {
      if (!active) return
      setEntries(previous => mergeAuditEntries(previous, remote, loadAudit()))
    }, () => { if (active) setError('A conexão com a auditoria foi interrompida. Os registros exibidos podem estar desatualizados.') })
    return () => {
      active = false
      if (pageGeneration.current === generation) pageGeneration.current++
      loadMoreLock.current = false
      stop()
    }
  }, [role, attempt])
  if (!can(role, 'audit')) return <p>Seu cargo não permite acessar a auditoria.</p>
  const undone = new Set([...reversedIds, ...entries.map(e => e.undoOf).filter(Boolean)])
  const select = async (entry: AuditEntry) => {
    if (busy || previewing) return
    setError(''); setPreviewing(entry.id)
    try {
      const counts = entry.local ? previewUndo(entry.id) : await callBackend<{ source: string; count: number }[]>('previewUndo', { id: entry.id })
      setPreview(counts.map(p => `${p.count} ${names[p.source] || p.source}`).join(' · '))
      setPending(entry)
    } catch (e) { setError((e as Error).message) }
    finally { setPreviewing(null) }
  }
  const confirm = async () => {
    if (!pending || busy) return
    const entry = pending
    setBusy(true); setError('')
    try {
      if (entry.local) await undoAuditAction(entry)
      else await callBackend('undoAction', { id: entry.id })
      setReversedIds(previous => new Set([...previous, entry.id]))
      setPending(null)
      try { setEntries(previous => mergeAuditEntries(previous, loadAudit())); const data = await loadAuditRemote(); setEntries(previous => mergeAuditEntries(previous, data)) }
      catch { setError('A reversão foi concluída, mas não foi possível atualizar o histórico. Tente recarregar os registros.') }
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  const loadMore = async () => {
    if (loadMoreLock.current || !hasMore) return
    const generation = pageGeneration.current
    loadMoreLock.current = true
    setLoadingMore(true); setMoreError('')
    try {
      const page = await loadAuditRemotePage(pageCursor)
      if (generation !== pageGeneration.current) return
      setEntries(previous => mergeAuditEntries(previous, page.entries, loadAudit()))
      setPageCursor(page.cursor); setHasMore(page.hasMore)
    } catch {
      if (generation === pageGeneration.current) setMoreError('Não foi possível carregar mais registros. Tente novamente.')
    } finally {
      if (generation === pageGeneration.current) {
        loadMoreLock.current = false
        setLoadingMore(false)
      }
    }
  }
  const fetchDetails = async (entry: AuditEntry) => {
    if (details[entry.id] || detailRequests.current.has(entry.id)) return
    detailRequests.current.add(entry.id)
    setDetailsLoading(previous => ({ ...previous, [entry.id]: true }))
    setDetailsErrors(previous => ({ ...previous, [entry.id]: '' }))
    try {
      const changes = entry.local ? changesFromPatches(auditUndoPatches(entry.id)) : null
      const result = changes ? { changes, unavailable: !changes.length } : await callBackend<AuditDetails>('auditDetails', { id: entry.id })
      setDetails(previous => ({ ...previous, [entry.id]: result }))
    } catch {
      setDetailsErrors(previous => ({ ...previous, [entry.id]: 'Não foi possível consultar as mudanças. Verifique a conexão e tente novamente.' }))
    } finally {
      detailRequests.current.delete(entry.id)
      setDetailsLoading(previous => ({ ...previous, [entry.id]: false }))
    }
  }
  const toggleDetails = (entry: AuditEntry) => {
    if (expanded === entry.id) { setExpanded(null); return }
    setExpanded(entry.id)
    void fetchDetails(entry)
  }
  const filtered = entries.filter(e => (!action || e.action === action) && (!days || e.ts >= Date.now() - days * 86400000)
    && matchesSearch(search, auditAuthor(e), e.email, e.detail, e.action, auditActionLabel(e.action), e.id, e.targetEmail))
  const exportCsv = () => {
    if (!can(role, 'audit')) return
    const cell = (value: string) => '"' + (/^[=+@\-\t\r]/.test(value) ? "'" + value : value).replace(/"/g, '""') + '"'
    const csv = [['Data (UTC)', 'Pessoa ou acesso', 'Conta', 'Ação', 'O que aconteceu', 'Origem', 'ID do registro'],
      ...filtered.map(e => [new Date(e.ts).toISOString(), auditAuthor(e), e.email || '', auditActionLabel(e.action), e.detail, e.local ? 'Neste aparelho' : 'Compartilhado', e.id])]
      .map(row => row.map(cell).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = 'auditoria.csv'; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <>
    <div className="page-row"><div className="page-title"><h1>Auditoria</h1></div><div className="audit-tabs">
      {tab === 'history' && <button className="btn btn-secondary" disabled={!filtered.length} onClick={exportCsv}>Exportar histórico</button>}
      <button className={`btn ${tab === 'history' ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={tab === 'history'} onClick={() => selectTab('history')}>Histórico</button>
      {can(role, 'team') && <button className={`btn ${tab === 'team' ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={tab === 'team'} onClick={() => selectTab('team')}>Equipe e acessos</button>}
    </div></div>
    {tab === 'team' && can(role, 'team') ? <TeamView/> : <>
      <div className="card checkout-fields">
        <SearchInput label="Buscar na auditoria" placeholder="Pessoa, e-mail, ação ou registro…" value={search} onChange={setSearch}/>
        <label>Tipo<select className="input" value={action} onChange={e => setAction(e.target.value)}><option value="">Todos</option>{[...new Set(entries.map(e => e.action))].sort().map(a => <option key={a} value={a}>{auditActionLabel(a)}</option>)}</select></label>
        <label>Período<select className="input" value={days} onChange={e => setDays(Number(e.target.value))}><option value={0}>Todo o histórico carregado</option><option value={1}>Últimas 24 horas</option><option value={7}>Últimos 7 dias</option><option value={30}>Últimos 30 dias</option></select></label>
      </div>
      <p className="audit-history-hint">{filtered.length} de {entries.length} registro(s) carregado(s) correspondem à consulta. Busca, filtros e exportação abrangem apenas os registros carregados. Horários de Brasília.</p>
      {loading && <p role="status" className="card">Carregando histórico…</p>}
      {error && <div className="card"><p role="alert">{error}</p><button className="btn btn-secondary" disabled={loading || busy} onClick={() => setAttempt(n => n + 1)}>Recarregar histórico</button></div>}
      <div className="card audit-history">
        {!loading && !error && !filtered.length && <p>Nenhuma ação encontrada.</p>}
        {filtered.map(entry => {
          const reversed = undone.has(entry.id) || entry.local && undoStatus(entry.id) === 'undone'
          const available = !reversed && !isDebitAudit(entry.detail) && (entry.local ? canUndoAction(entry.id) : !!entry.hasUndo)
          const open = expanded === entry.id, detail = details[entry.id]
          const sharedKey = entry.email === OWNER_KEY_EMAIL
          return <article className={`audit-event${open ? ' is-expanded' : ''}`} key={entry.id}>
            <button type="button" className="audit-event-summary" aria-expanded={open} aria-controls={`audit-details-${entry.id}`} onClick={() => toggleDetails(entry)}>
              <span className="audit-event-summary-copy">
                <span className="audit-event-meta"><strong>{auditAuthor(entry)}</strong><time dateTime={new Date(entry.ts).toISOString()}>{new Date(entry.ts).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</time><span className="badge badge-neutral">{auditActionLabel(entry.action)}</span></span>
                <span className="audit-event-account">{sharedKey ? 'Identidade compartilhada: este acesso não identifica a pessoa que usou a chave.' : entry.email || 'Conta não informada neste registro'} · {entry.local ? 'Neste aparelho' : 'Compartilhado'}</span>
                <span className="audit-event-description">{entry.detail}</span>
              </span>
              <span className="audit-event-expand">{open ? 'Ocultar detalhes' : 'Ver detalhes'}<ChevronDown size={17}/></span>
            </button>
            {available ? <button className="btn btn-secondary btn-sm" disabled={busy || !!previewing} onClick={() => void select(entry)}><Undo2 size={15}/>{previewing === entry.id ? 'Conferindo…' : 'Desfazer'}</button>
              : <small>{reversed ? 'Desfeita' : entry.action === 'equipe' ? 'Gerencie pela equipe' : isDebitAudit(entry.detail) ? <a href="#pagamentos">Reverter em Pagamentos</a> : 'Sem reversão disponível'}</small>}
            {open && <div className="audit-event-changes" id={`audit-details-${entry.id}`} aria-busy={!!detailsLoading[entry.id]}>
              <dl className="audit-record-info"><div><dt>Registro</dt><dd>{entry.id}</dd></div>{entry.undoOf && <div><dt>Reversão do registro</dt><dd>{entry.undoOf}</dd></div>}</dl>
              {detailsLoading[entry.id] ? <small className="audit-details-message" role="status">Carregando mudanças…</small>
                : detailsErrors[entry.id] ? <div><p role="alert">{detailsErrors[entry.id]}</p><button className="btn btn-secondary btn-sm" onClick={() => void fetchDetails(entry)}>Tentar novamente</button></div>
                : detail?.changes.length ? <div className="audit-change-list">{detail.changes.map((change: AuditChange, index) => <div className="audit-change" key={`${change.entity}-${change.field}-${index}`}>
                  <div className="audit-change-heading"><strong>{change.entity}</strong><span>{auditFieldLabel(change.field)}</span></div>
                  <div className="audit-change-values"><div><small>Antes</small><span>{formatAuditValue(change.before, change.field)}</span></div><div><small>Depois</small><span>{formatAuditValue(change.after, change.field)}</span></div></div>
                </div>)}</div>
                : <small className="audit-details-message">{detail?.unavailable ? 'Este registro não contém dados suficientes para mostrar a comparação completa.' : 'Este evento não alterou dados cadastrados.'}</small>}
            </div>}
          </article>
        })}
      </div>
      {hasMore && <div className="audit-load-more">
        {moreError && <p role="alert">{moreError}</p>}
        <button className="btn btn-secondary" disabled={loadingMore || loading} onClick={() => void loadMore()}>{loadingMore ? 'Carregando registros…' : moreError ? 'Tentar carregar novamente' : 'Carregar mais registros'}</button>
      </div>}
    </>}
    {pending && <ConfirmDialog titleId="undo-confirm" busy={busy} onCancel={() => setPending(null)}>
      <h2 id="undo-confirm">Desfazer esta ação?</h2><p>{pending.detail}</p><p>Registrada por {auditAuthor(pending)}{pending.email !== OWNER_KEY_EMAIL && pending.email ? ` (${pending.email})` : ''}.</p><p>{preview}</p>
      <p>Alterações posteriores serão preservadas. Se houver conflito, a reversão será recusada.</p>{error && <p role="alert">{error}</p>}
      <div className="pw-buttons"><button autoFocus className="btn btn-secondary" disabled={busy} onClick={() => setPending(null)}>Cancelar</button><button className="btn btn-primary" disabled={busy} onClick={() => void confirm()}>{busy ? 'Desfazendo…' : 'Confirmar reversão'}</button></div>
    </ConfirmDialog>}
  </>
}
