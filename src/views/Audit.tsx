import './Audit.css'
import { SearchInput } from '../components/SearchInput'
import { matchesSearch } from '../search'
import { isDebitAudit } from '../debit-change'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Undo2 } from 'lucide-react'
import { useRole } from '../auth'
import { can } from '../roles'
import { canUndoAction, loadAudit, loadAuditRemote, loadAuditRemotePage, undoAuditAction, type AuditEntry } from '../audit'
import { callBackend, onAuditChanges, type AuditDetails, type AuditPageCursor } from '../sync'
import { auditFieldLabel, changesFromPatches, formatAuditValue, type AuditChange } from '../audit-changes'
import { auditActionLabel, auditAuthor, auditCompactTitle, auditDayLabel, auditEventPresentation, mergeAuditEntries } from '../audit-presentation'
import { OWNER_KEY_EMAIL } from '../owner-access'
import { auditUndoPatches, previewUndo, undoStatus } from '../undo'
import { TeamView } from './Team'

const names: Record<string, string> = { products: 'produtos', sales: 'vendas', customers: 'clientes', custos: 'custos', perdas: 'perdas' }
const unknownCategory = 'Outras alterações'

type PresentedAuditEntry = {
  entry: AuditEntry
  presentation: ReturnType<typeof auditEventPresentation>
}

type ChangeWithIdentity = AuditChange & { entityId?: string; source?: string }
type ChangeGroup = { key: string; label: string; source?: string; entityId?: string; changes: ChangeWithIdentity[] }

const hasRealTimestamp = (ts: number) => Number.isFinite(ts) && ts > 0 && !Number.isNaN(new Date(ts).getTime())
const timestampLabel = (ts: number) => hasRealTimestamp(ts)
  ? new Date(ts).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  : 'Data não informada'
const timeLabel = (ts: number) => hasRealTimestamp(ts)
  ? new Date(ts).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
  : 'Data não informada'

function groupChanges(changes: AuditChange[]): ChangeGroup[] {
  const typed = changes as ChangeWithIdentity[]
  const legacyCounts = new Map<string, number>()
  typed.forEach(change => {
    if (!change.entityId) legacyCounts.set(change.entity, (legacyCounts.get(change.entity) || 0) + 1)
  })
  const groups: ChangeGroup[] = []
  const byKey = new Map<string, ChangeGroup>()
  typed.forEach((change, index) => {
    const identity = change.entityId
      ? (change.source || 'objeto') + ':' + change.entityId
      : legacyCounts.get(change.entity) === 1 ? 'legacy:' + change.entity : 'legacy:' + change.entity + ':' + index
    let group = byKey.get(identity)
    if (!group) {
      group = { key: identity, label: change.entity, source: change.source, entityId: change.entityId, changes: [] }
      byKey.set(identity, group)
      groups.push(group)
    }
    group.changes.push(change)
  })
  return groups
}

function groupByDay(items: PresentedAuditEntry[]) {
  const groups: { label: string; items: PresentedAuditEntry[] }[] = []
  const byLabel = new Map<string, { label: string; items: PresentedAuditEntry[] }>()
  for (const item of items) {
    const label = hasRealTimestamp(item.entry.ts) ? auditDayLabel(item.entry.ts) : 'Data não informada'
    let group = byLabel.get(label)
    if (!group) {
      group = { label, items: [] }
      byLabel.set(label, group)
      groups.push(group)
    }
    group.items.push(item)
  }
  return groups
}

export function AuditView() {
  const role = useRole()
  const [tab, setTab] = useState('history')
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [search, setSearch] = useState('')
  const [action, setAction] = useState('')
  const [category, setCategory] = useState('')
  const [days, setDays] = useState(0)
  const [filtersOpen, setFiltersOpen] = useState(false)
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

  const presentedEntries = useMemo<PresentedAuditEntry[]>(() => entries.map(entry => ({
    entry,
    presentation: auditEventPresentation(entry),
  })), [entries])
  const categories = useMemo(() => [...new Set(presentedEntries.map(item => item.presentation.category || unknownCategory))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [presentedEntries])
  const undone = new Set([...reversedIds, ...entries.map(e => e.undoOf).filter(Boolean)])

  if (!can(role, 'audit')) return <p>Seu cargo não permite acessar a auditoria.</p>

  const select = async (entry: AuditEntry) => {
    if (busy || previewing) return
    setError(''); setPreviewing(entry.id)
    try {
      const counts = entry.local ? previewUndo(entry.id) : await callBackend<{ source: string; count: number }[]>('previewUndo', { id: entry.id })
      setPreview(counts.map(p => (p.count + ' ' + (names[p.source] || p.source))).join(' · '))
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
      try {
        setEntries(previous => mergeAuditEntries(previous, loadAudit()))
        const data = await loadAuditRemote()
        setEntries(previous => mergeAuditEntries(previous, data))
      } catch {
        setError('A reversão foi concluída, mas não foi possível atualizar o histórico. Tente recarregar os registros.')
      }
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

  const filtered = presentedEntries.filter(({ entry, presentation }) => {
    const normalizedCategory = presentation.category || unknownCategory
    return (!action || entry.action === action)
      && (!category || normalizedCategory === category)
      && (!days || (hasRealTimestamp(entry.ts) && entry.ts >= Date.now() - days * 86400000))
      && matchesSearch(search, auditAuthor(entry), entry.email, entry.detail, presentation.title, presentation.description, normalizedCategory, entry.id, entry.targetEmail)
  })

  const grouped = groupByDay(filtered)
  const actions = [...new Set(entries.map(entry => entry.action))].sort((a, b) => auditActionLabel(a).localeCompare(auditActionLabel(b), 'pt-BR'))
  const filtersActive = Boolean(search.trim() || action || category || days)

  const exportCsv = () => {
    if (!can(role, 'audit')) return
    const cell = (value: string) => '"' + (/^[=+@\-\t\r]/.test(value) ? "'" + value : value).replace(/"/g, '""') + '"'
    const csv = [['Data (Brasília)', 'Quem', 'Conta', 'Categoria', 'Ação', 'Título', 'O que aconteceu', 'Origem', 'ID do registro'],
      ...filtered.map(({ entry, presentation }) => [
        hasRealTimestamp(entry.ts) ? new Date(entry.ts).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '',
        auditAuthor(entry),
        entry.email || '',
        presentation.category || unknownCategory,
        auditActionLabel(entry.action),
        presentation.title,
        presentation.description,
        entry.local ? 'Somente neste aparelho' : 'Equipe',
        entry.id,
      ])]
      .map(row => row.map(cell).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = 'auditoria.csv'; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return <div className="audit-page">
    <div className="page-row audit-page-header">
      <div className="page-title">
        <h1>Auditoria</h1>
      </div>
      <div className="audit-tabs">
        {tab === 'history' && <button className="btn btn-secondary" disabled={!filtered.length} onClick={exportCsv}>Exportar histórico</button>}
        <button className={'btn ' + (tab === 'history' ? 'btn-primary' : 'btn-secondary')} aria-pressed={tab === 'history'} onClick={() => selectTab('history')}>Histórico</button>
        {can(role, 'team') && <button className={'btn ' + (tab === 'team' ? 'btn-primary' : 'btn-secondary')} aria-pressed={tab === 'team'} onClick={() => selectTab('team')}>Equipe e acessos</button>}
      </div>
    </div>
    {tab === 'team' && can(role, 'team') ? <TeamView/> : <>
      <details className="audit-about">
        <summary>Sobre esta auditoria</summary>
        <div className="audit-about-content">
          <p>Alterações de produtos, vendas, clientes e acessos da equipe são compartilhadas neste histórico. Compras e pagamentos avulsos devem ser conferidos nas telas próprias; custos e perdas ficam neste aparelho.</p>
          <p>Busca e exportação abrangem somente os registros carregados. Horários exibidos neste histórico usam Brasília.</p>
        </div>
      </details>
      <div className="audit-controls">
        <div className="audit-search-row">
          <SearchInput label="Buscar no histórico" placeholder="Pessoa, ação, alteração ou registro…" inputId="audit-search" value={search} onChange={setSearch}/>
          <button type="button" className="btn btn-secondary audit-filter-toggle" aria-expanded={filtersOpen} aria-controls="audit-filters" onClick={() => setFiltersOpen(value => !value)}>
            <span>Filtros</span>{filtersActive && <span className="audit-filter-badge">Filtros ativos</span>}<ChevronDown size={16} aria-hidden="true"/>
          </button>
        </div>
        {filtersOpen && <div id="audit-filters" className="audit-filters-shell">
          <label htmlFor="audit-category">Área<select id="audit-category" className="input" value={category} onChange={event => setCategory(event.target.value)}><option value="">Todas as áreas</option>{categories.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <label htmlFor="audit-action">Tipo de operação<select id="audit-action" className="input" value={action} onChange={event => setAction(event.target.value)}><option value="">Todos os tipos</option>{actions.map(value => <option key={value} value={value}>{auditActionLabel(value)}</option>)}</select></label>
          <label htmlFor="audit-period">Período<select id="audit-period" className="input" value={days} onChange={event => setDays(Number(event.target.value))}><option value={0}>Todo o histórico carregado</option><option value={1}>Últimas 24 horas</option><option value={7}>Últimos 7 dias</option><option value={30}>Últimos 30 dias</option></select></label>
        </div>}
      </div>
      <p className="audit-history-hint" aria-live="polite">
        {filtered.length} {filtered.length === 1 ? 'registro' : 'registros'}
      </p>
      {loading && <p role="status" className="audit-status-card">Carregando histórico…</p>}
      {error && <div className="audit-status-card"><p role="alert">{error}</p><button className="btn btn-secondary" disabled={loading || busy} onClick={() => setAttempt(value => value + 1)}>Recarregar histórico</button></div>}
      {!loading && !error && !filtered.length && <div className="audit-empty-state">
        <strong>{entries.length ? 'Nenhum registro encontrado nos registros já carregados para esta consulta.' : 'Nenhum registro encontrado nos registros já carregados.'}</strong>
        <p>{hasMore ? 'Busque registros mais antigos para ampliar o histórico.' : entries.length ? 'Ajuste a busca ou os filtros para consultar os registros carregados.' : 'Quando houver alterações, elas aparecerão aqui.'}</p>
      </div>}
      {!!filtered.length && <div className="audit-timeline">
        {grouped.map(group => <section className="audit-day-group" key={group.label}>
          <h2 className="audit-day-heading">{group.label}</h2>
          <div className="audit-day-list">
            {group.items.map(({ entry, presentation }) => {
              const reversed = undone.has(entry.id) || !!(entry.local && undoStatus(entry.id) === 'undone')
              const available = !reversed && !isDebitAudit(entry.detail) && (entry.local ? canUndoAction(entry.id) : !!entry.hasUndo)
              const open = expanded === entry.id
              const detail = details[entry.id]
              const changes = detail?.changes || []
              const changeGroups = groupChanges(changes)
              const sharedKey = entry.email === OWNER_KEY_EMAIL
              const author = auditAuthor(entry)
              const dateTime = hasRealTimestamp(entry.ts) ? new Date(entry.ts).toISOString() : undefined
              const compactTitle = auditCompactTitle(entry)
              return <article className={'audit-event' + (open ? ' is-expanded' : '')} key={entry.id}>
                <button type="button" className="audit-event-summary" aria-expanded={open} aria-controls={'audit-details-' + entry.id} onClick={() => toggleDetails(entry)}>
                  <span className="audit-event-summary-copy">
                    <span className="audit-event-title" role="heading" aria-level={3}>{compactTitle}</span>
                    <span className="audit-event-who">
                      <span className="audit-event-author">{author}</span><span aria-hidden="true"> · </span><time dateTime={dateTime}>{timeLabel(entry.ts)}</time>
                    </span>
                    {reversed && <small className="audit-reversal-status audit-reversal-status-closed">Desfeita</small>}
                  </span>
                  <span className="audit-event-expand"><span className="sr-only">{open ? 'Ocultar detalhes' : 'Ver detalhes'}</span><ChevronDown size={16} aria-hidden="true"/></span>
                </button>
                {open && <div className="audit-event-changes" id={'audit-details-' + entry.id} aria-busy={!!detailsLoading[entry.id]}>
                  <div className="audit-event-detail-intro">
                    <p className="audit-event-description audit-event-description-full">{presentation.description}</p>
                    <dl className="audit-event-meta">
                      <div><dt>Quem</dt><dd>{author}</dd></div>
                      <div><dt>Quando</dt><dd><time dateTime={dateTime}>{timestampLabel(entry.ts)}</time></dd></div>
                      <div><dt>Conta</dt><dd>{sharedKey ? 'Identidade compartilhada; a pessoa que usou a chave não é identificada.' : entry.email || 'Não informada neste registro'}</dd></div>
                      <div><dt>Origem</dt><dd>{entry.local ? 'Somente neste aparelho' : 'Equipe'}</dd></div>
                    </dl>
                  </div>
                  {!reversed && <div className="audit-event-actions">
                    {available ? <button className="btn btn-secondary btn-sm audit-undo-button" disabled={busy || !!previewing} onClick={() => void select(entry)}><Undo2 size={15} aria-hidden="true"/>{previewing === entry.id ? 'Conferindo…' : 'Desfazer'}</button>
                      : <small className="audit-reversal-status">{entry.action === 'equipe' ? 'Gerencie pela equipe' : isDebitAudit(entry.detail) ? <a href="#pagamentos">Reverter em Pagamentos</a> : 'Sem reversão disponível'}</small>}
                  </div>}
                  <details className="audit-record-disclosure">
                    <summary>Informações do registro</summary>
                    <dl><div><dt>ID do registro</dt><dd>{entry.id}</dd></div>{entry.undoOf && <div><dt>Reversão do registro</dt><dd>{entry.undoOf}</dd></div>}</dl>
                  </details>
                  {detailsLoading[entry.id] ? <small className="audit-details-message" role="status">Carregando mudanças…</small>
                    : detailsErrors[entry.id] ? <div><p role="alert">{detailsErrors[entry.id]}</p><button className="btn btn-secondary btn-sm" onClick={() => void fetchDetails(entry)}>Tentar novamente</button></div>
                    : changeGroups.length ? <div className="audit-change-groups">{changeGroups.map(group => <section className="audit-change-group" key={group.key}>
                      <div className="audit-change-group-heading"><h3>{group.label}</h3>{group.entityId && <details className="audit-object-disclosure"><summary>Informações técnicas</summary><span>{group.source ? group.source + ' · ' : ''}ID do objeto: {group.entityId}</span></details>}</div>
                      <p className="audit-change-context">Valores nesta alteração</p>
                      <div className="audit-change-table" role="table" aria-label={'Mudanças em ' + group.label}>
                        <div className="audit-change-table-row audit-change-table-head" role="row"><span role="columnheader">Campo</span><span role="columnheader">Antes</span><span role="columnheader">Depois</span></div>
                        {group.changes.map((change, index) => <div className="audit-change-table-row" role="row" key={group.key + '-' + change.field + '-' + index}>
                          <span role="cell" className="audit-change-field">{auditFieldLabel(change.field)}</span>
                          <span role="cell" data-label="Antes">{formatAuditValue(change.before, change.field)}</span>
                          <span role="cell" data-label="Depois">{formatAuditValue(change.after, change.field)}</span>
                        </div>)}
                      </div>
                    </section>)}</div>
                    : <small className="audit-details-message">{detail?.unavailable ? 'Este registro não contém dados suficientes para mostrar a comparação completa.' : 'Não há mudanças disponíveis para este registro.'}</small>}
                </div>}
              </article>
            })}
          </div>
        </section>)}
      </div>}
      {hasMore && <div className="audit-load-more">
        {moreError && <p role="alert">{moreError}</p>}
        <button className="btn btn-secondary" disabled={loadingMore || loading} onClick={() => void loadMore()}>{loadingMore ? 'Carregando registros…' : moreError ? 'Tentar carregar novamente' : 'Buscar registros mais antigos'}</button>
      </div>}
    </>}
    {pending && <ConfirmDialog titleId="undo-confirm" busy={busy} onCancel={() => setPending(null)}>
      <h2 id="undo-confirm">Desfazer esta ação?</h2>
      <p>{auditEventPresentation(pending).description}</p>
      <p>Registrada por {auditAuthor(pending)}{pending.email !== OWNER_KEY_EMAIL && pending.email ? ' (' + pending.email + ')' : ''}.</p>
      <p>{preview}</p>
      <p>Alterações posteriores serão preservadas. Se houver conflito, a reversão será recusada.</p>
      {error && <p role="alert">{error}</p>}
      <div className="pw-buttons"><button autoFocus className="btn btn-secondary" disabled={busy} onClick={() => setPending(null)}>Cancelar</button><button className="btn btn-primary" disabled={busy} onClick={() => void confirm()}>{busy ? 'Desfazendo…' : 'Confirmar reversão'}</button></div>
    </ConfirmDialog>}
  </div>
}
