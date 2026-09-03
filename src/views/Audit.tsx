import { useState, useMemo, useEffect, useCallback } from 'react'
import { ShieldCheck, Lock, X, RefreshCw, ChevronDown, ChevronRight, Users, Tag, Calendar, Filter, Download } from 'lucide-react'
import { loadAuditRemote, auditHash, AUDIT_PW_HASH, type AuditEntry } from '../audit'
import { onAuditChanges } from '../sync'

const ACTION_ICON: Record<string, string> = {
  venda: '🛒', produto: '📦', estoque: '📊', perda: '⚠️',
  custo: '💰', cliente: '👤', cobranca: '💳', login: '🔐',
}

const ACTION_LABEL: Record<string, string> = {
  venda: 'Venda', produto: 'Produto', estoque: 'Estoque', perda: 'Perda',
  custo: 'Custo', cliente: 'Cliente', cobranca: 'Cobrança', login: 'Login',
}

const ACTION_COLOR: Record<string, string> = {
  venda: '#E8923F',      // caramelo
  produto: '#8E6747',    // chocolate
  estoque: '#3B82F6',    // azul
  perda: '#E11D48',      // vermelho
  custo: '#22C55E',      // verde
  cliente: '#A855F7',    // roxo
  cobranca: '#F59E0B',   // âmbar
  login: '#06B6D4',      // cyan
}

type PeriodOption = 'hoje' | '7d' | 'tudo'
type FilterState = { member: string; action: string; period: PeriodOption; date: string }

export function AuditView() {
  const [unlocked, setUnlocked] = useState(false)
  const [pw, setPw] = useState('')
  const [err, setErr] = useState(false)
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(false)

  // Filtros
  const [filters, setFilters] = useState<FilterState>({
    member: 'todos',
    action: 'todos',
    period: 'tudo',
    date: '',
  })
  // Expansão por pessoa / por tipo
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(new Set())
  const [expandedActions, setExpandedActions] = useState<Set<string>>(new Set())

  const refresh = useCallback(async () => {
    setLoading(true)
    try { setEntries(await loadAuditRemote()) } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (!unlocked) return
    refresh()
    const unsub = onAuditChanges((remote) => {
      setEntries(prev => {
        const byId = new Map<string, AuditEntry>()
        for (const e of remote) byId.set(e.id, e)
        for (const e of prev) if (!byId.has(e.id)) byId.set(e.id, e)
        return Array.from(byId.values()).sort((a, b) => (b.ts || 0) - (a.ts || 0))
      })
    })
    return () => unsub()
  }, [unlocked, refresh])

  const doUnlock = async () => {
    if ((await auditHash(pw)) === AUDIT_PW_HASH) { setUnlocked(true); setErr(false) }
    else setErr(true)
  }

  // --- Helpers ---
  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  const hashColor = (str: string) => {
    let h = 0
    for (let i = 0; i < str.length; i++) h = ((h << 5) - h) + str.charCodeAt(i)
    h |= 0
    return `hsl(${Math.abs(h) % 360}, 52%, 45%)`
  }
  const formatRelative = (ts: number) => {
    const diff = Date.now() - ts
    const sec = Math.floor(diff / 1000)
    if (sec < 60) return 'agora mesmo'
    const min = Math.floor(sec / 60)
    if (min < 60) return `${min}m atrás`
    const hr = Math.floor(min / 60)
    if (hr < 24) return `${hr}h atrás`
    const day = Math.floor(hr / 24)
    if (day < 7) return `${day}d atrás`
    return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
  }
  const formatFull = (ts: number) => new Date(ts).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })

  const exportCSV = () => {
    // Escapa campos para CSV (vírgulas, aspas, quebras de linha)
    const csvEsc = (s: string) => `"${(s ?? '').replace(/"/g, '""')}"`
    const head = ['Data/Hora', 'Pessoa', 'Email', 'Tipo', 'Detalhe']
    const rows = filtered.map(e => [
      formatFull(e.ts),
      e.actor === 'desconhecido' ? 'Desconhecido' : e.actor,
      e.email || '',
      e.action,
      e.detail || '',
    ].map(csvEsc).join(';'))
    const csv = '\uFEFF' + [head.join(';'), ...rows].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `auditoria-cookie-zookie-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const filterEntries = useCallback((list: AuditEntry[]) => {
    let out = list
    if (filters.member !== 'todos') out = out.filter(e => e.actor === filters.member)
    if (filters.action !== 'todos') out = out.filter(e => e.action === filters.action)
    if (filters.period !== 'tudo') {
      const now = Date.now()
      const cutoff = filters.period === 'hoje' ? now - 24*60*60*1000 : now - 7*24*60*60*1000
      out = out.filter(e => e.ts >= cutoff)
    }
    if (filters.date) {
      const dayStart = new Date(`${filters.date}T00:00:00`).getTime()
      const dayEnd = dayStart + 24*60*60*1000 - 1
      out = out.filter(e => e.ts >= dayStart && e.ts <= dayEnd)
    }
    return out
  }, [filters])

  // --- Memos ---
  const filtered = useMemo(() => filterEntries(entries), [entries, filters])

  const members = useMemo(() => {
    const m = new Map<string, { n: number; email?: string }>()
    filtered.forEach(e => {
      const cur = m.get(e.actor) || { n: 0, email: e.email }
      cur.n += 1
      if (e.email) cur.email = e.email
      m.set(e.actor, cur)
    })
    return Array.from(m.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.n - a.n)
  }, [filtered])

  const actionTypes = useMemo(() => {
    const m = new Map<string, number>()
    filtered.forEach(e => m.set(e.action, (m.get(e.action) || 0) + 1))
    return Array.from(m.entries()).map(([action, count]) => ({ action, count })).sort((a, b) => b.count - a.count)
  }, [filtered])

  // Para contadores do header
  const allMembersCount = useMemo(() => new Set(entries.map(e => e.actor)).size, [entries])
  const periodLabel = useMemo(() => {
    if (filters.period === 'hoje') return 'Últimas 24h'
    if (filters.period === '7d') return 'Últimos 7 dias'
    return 'Todo o histórico'
  }, [filters.period])

  if (!unlocked) {
    return (
      <div className="card" style={{ maxWidth: 460, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', padding: 'var(--sp-8) 0' }}>
          <ShieldCheck size={44} style={{ color: 'var(--cz-500)' }} />
          <h2 style={{ margin: 'var(--sp-3) 0' }}>Auditoria da equipe</h2>
          <p style={{ color: 'var(--tx-2)', marginBottom: 'var(--sp-6)' }}>
            Área restrita ao administrador. Informe a senha para ver o histórico de ações de cada pessoa.
          </p>
          <input
            type="password"
            className={`pw-input ${err ? 'pw-error' : ''}`}
            placeholder="Senha de administrador"
            style={{ maxWidth: 320, margin: '0 auto var(--sp-4)' }}
            value={pw}
            onChange={e => { setPw(e.target.value); setErr(false) }}
            onKeyDown={e => e.key === 'Enter' && doUnlock()}
            autoFocus
          />
          {err && <div className="pw-error-msg">Senha incorreta</div>}
          <div>
            <button className="btn btn-cz" onClick={doUnlock}><Lock size={16} /> Acessar auditoria</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="audit-view">
      {/* Header */}
      <div className="page-row">
        <div className="page-title">
          <h2>Auditoria da equipe</h2>
          <p>Linha do tempo de ações • agrupada por pessoa e por tipo</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center', flexWrap: 'wrap' }}>
          {loading && <span style={{ color: 'var(--tx-3)', fontSize: '0.85rem' }}>sincronizando…</span>}
          <button className="btn btn-secondary" onClick={exportCSV}><Download size={16} /> Exportar CSV</button>
          <button className="btn btn-secondary" onClick={refresh}><RefreshCw size={16} /> Atualizar</button>
          <button className="btn btn-secondary" onClick={() => setUnlocked(false)}><Lock size={16} /> Travar</button>
        </div>
      </div>

      {/* Contadores + Filtros */}
      <div className="audit-header-bar">
        <div className="audit-counters">
          <div className="audit-counter">
            <span className="audit-counter-value">{filtered.length}</span>
            <span className="audit-counter-label">ações</span>
          </div>
          <div className="audit-counter">
            <span className="audit-counter-value">{members.length}</span>
            <span className="audit-counter-label">membros ativos</span>
          </div>
          <div className="audit-counter">
            <span className="audit-counter-value" style={{ fontSize: '0.85rem' }}>{periodLabel}</span>
            <span className="audit-counter-label">janela</span>
          </div>
        </div>

        <div className="audit-filters">
          <div className="audit-filter-group">
            <label htmlFor="filter-member" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', fontSize: '0.78rem', color: 'var(--tx-2)', marginBottom: 'var(--sp-1)' }}>
              <Users size={14} /> Membro
            </label>
            <select
              id="filter-member"
              className="audit-filter-select"
              value={filters.member}
              onChange={e => setFilters(f => ({ ...f, member: e.target.value }))}
            >
              <option value="todos">Todos os membros</option>
              {members.map(m => (
                <option key={m.name} value={m.name}>{m.name} ({m.n})</option>
              ))}
            </select>
          </div>
          <div className="audit-filter-group">
            <label htmlFor="filter-action" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', fontSize: '0.78rem', color: 'var(--tx-2)', marginBottom: 'var(--sp-1)' }}>
              <Tag size={14} /> Tipo
            </label>
            <select
              id="filter-action"
              className="audit-filter-select"
              value={filters.action}
              onChange={e => setFilters(f => ({ ...f, action: e.target.value }))}
            >
              <option value="todos">Todos os tipos</option>
              {actionTypes.map(a => (
                <option key={a.action} value={a.action}>{ACTION_ICON[a.action] || '•'} {ACTION_LABEL[a.action] || a.action} ({a.count})</option>
              ))}
            </select>
          </div>
          <div className="audit-filter-group">
            <label htmlFor="filter-period" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', fontSize: '0.78rem', color: 'var(--tx-2)', marginBottom: 'var(--sp-1)' }}>
              <Calendar size={14} /> Período
            </label>
            <select
              id="filter-period"
              className="audit-filter-select"
              value={filters.period}
              onChange={e => setFilters(f => ({ ...f, period: e.target.value as PeriodOption }))}
            >
              <option value="hoje">Hoje</option>
              <option value="7d">Últimos 7 dias</option>
              <option value="tudo">Todo o histórico</option>
            </select>
          </div>
          <div className="audit-filter-group">
            <label htmlFor="filter-date" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', fontSize: '0.78rem', color: 'var(--tx-2)', marginBottom: 'var(--sp-1)' }}>
              <Calendar size={14} /> Data
            </label>
            <input
              id="filter-date"
              type="date"
              className="audit-filter-select"
              value={filters.date}
              onChange={e => setFilters(f => ({ ...f, date: e.target.value }))}
            />
          </div>
          {(filters.member !== 'todos' || filters.action !== 'todos' || filters.period !== 'tudo' || filters.date) && (
            <button className="btn btn-ghost btn-sm audit-clear-filters" onClick={() => setFilters({ member: 'todos', action: 'todos', period: 'tudo', date: '' })}>
              <X size={14} /> Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Grid: Por pessoa + Por tipo + Timeline */}
      <div className="audit-grid">
        {/* Por pessoa */}
        <section className="audit-group-card card" aria-label="Por pessoa">
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            <Users size={18} /> Por pessoa <span className="badge badge-brand">{members.length}</span>
          </h3>
          {members.length === 0 ? (
            <div className="empty-state" style={{ padding: 'var(--sp-6)' }}><p>Sem registros no período.</p></div>
          ) : (
            <div className="audit-group-list">
              {members.map(m => (
                <div key={m.name} className="audit-group-item">
                  <button
                    className="audit-group-toggle"
                    onClick={() => setExpandedMembers(prev => {
                      const next = new Set(prev)
                      next.has(m.name) ? next.delete(m.name) : next.add(m.name)
                      return next
                    })}
                    aria-expanded={expandedMembers.has(m.name)}
                    aria-controls={`member-${m.name}`}
                  >
                    <ChevronDown size={16} className={expandedMembers.has(m.name) ? 'expanded' : ''} />
                    <div className="audit-group-avatar" style={{ background: hashColor(m.name === 'desconhecido' ? 'Desconhecido' : m.name) }}>
                      {getInitials(m.name === 'desconhecido' ? 'Desconhecido' : m.name)}
                    </div>
                    <div className="audit-group-info">
                      <strong style={{ color: 'var(--cz-600)' }}>{m.name === 'desconhecido' ? 'Desconhecido' : m.name}</strong>
                      {m.email && <span style={{ fontSize: '0.75rem', color: 'var(--tx-3)' }}>{m.email}</span>}
                    </div>
                    <span className="badge badge-neutral">{m.n} ações</span>
                  </button>
                  <div id={`member-${m.name}`} className="audit-group-content" style={{ display: expandedMembers.has(m.name) ? 'block' : 'none' }}>
                    {filtered.filter(e => e.actor === m.name).map(e => (
                      <div key={e.id} className="audit-row audit-row-compact">
                        <div className="audit-icon" style={{ background: ACTION_COLOR[e.action] }}>{ACTION_ICON[e.action] || '•'}</div>
                        <div className="audit-row-main">
                          <div className="audit-row-header">
                            <span className="audit-action-badge" style={{ background: ACTION_COLOR[e.action] + '20', color: ACTION_COLOR[e.action], borderColor: ACTION_COLOR[e.action] + '60' }}>
                              {ACTION_LABEL[e.action] || e.action}
                            </span>
                            <time className="audit-time" dateTime={new Date(e.ts).toISOString()}>{formatRelative(e.ts)}</time>
                          </div>
                          <div className="audit-detail">{e.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Por tipo */}
        <section className="audit-group-card card" aria-label="Por tipo">
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            <Tag size={18} /> Por tipo <span className="badge badge-brand">{actionTypes.length}</span>
          </h3>
          {actionTypes.length === 0 ? (
            <div className="empty-state" style={{ padding: 'var(--sp-6)' }}><p>Sem ações no período.</p></div>
          ) : (
            <div className="audit-group-list">
              {actionTypes.map(a => (
                <div key={a.action} className="audit-group-item">
                  <button
                    className="audit-group-toggle"
                    onClick={() => setExpandedActions(prev => {
                      const next = new Set(prev)
                      next.has(a.action) ? next.delete(a.action) : next.add(a.action)
                      return next
                    })}
                    aria-expanded={expandedActions.has(a.action)}
                    aria-controls={`action-${a.action}`}
                  >
                    <ChevronDown size={16} className={expandedActions.has(a.action) ? 'expanded' : ''} />
                    <div className="audit-group-icon" style={{ background: ACTION_COLOR[a.action] }}>{ACTION_ICON[a.action] || '•'}</div>
                    <div className="audit-group-info">
                      <strong style={{ color: ACTION_COLOR[a.action] }}>{ACTION_LABEL[a.action] || a.action}</strong>
                    </div>
                    <span className="badge badge-neutral">{a.count} ações</span>
                  </button>
                  <div id={`action-${a.action}`} className="audit-group-content" style={{ display: expandedActions.has(a.action) ? 'block' : 'none' }}>
                    {filtered.filter(e => e.action === a.action).map(e => (
                      <div key={e.id} className="audit-row audit-row-compact">
                        <div className="audit-icon" style={{ background: ACTION_COLOR[e.action] }}>{ACTION_ICON[e.action] || '•'}</div>
                        <div className="audit-row-main">
                          <div className="audit-row-header">
                            <span className="audit-actor" style={{ color: ACTION_COLOR[e.action] }}>{e.actor === 'desconhecido' ? 'Desconhecido' : e.actor}</span>
                            <time className="audit-time" dateTime={new Date(e.ts).toISOString()}>{formatRelative(e.ts)}</time>
                          </div>
                          <div className="audit-detail">{e.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Timeline principal */}
        <section className="audit-timeline card">
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            <ShieldCheck size={18} /> Linha do tempo <span className="badge badge-brand">{filtered.length}</span>
          </h3>
          {filtered.length === 0 ? (
            <div className="empty-state"><p>Nenhuma ação registrada com os filtros atuais.</p></div>
          ) : (
            <div className="audit-log" role="list" aria-label="Log de auditoria">
              {filtered.slice(0, 500).map(e => (
                <article key={e.id} className="audit-row" role="listitem">
                  <div className="audit-icon" style={{ background: ACTION_COLOR[e.action] }} title={ACTION_LABEL[e.action] || e.action}>
                    {ACTION_ICON[e.action] || '•'}
                  </div>
                  <div className="audit-row-main">
                    <div className="audit-row-header">
                      <div className="audit-actor-wrap">
                        <div className="audit-avatar" style={{ background: ACTION_COLOR[e.action] }}>
                          {getInitials(e.actor === 'desconhecido' ? 'Desconhecido' : e.actor)}
                        </div>
                        <strong className="audit-actor">{e.actor === 'desconhecido' ? 'Desconhecido' : e.actor}</strong>
                        {e.email && <span className="audit-actor-email">{e.email}</span>}
                      </div>
                      <div className="audit-meta">
                        <span className="audit-action-badge" style={{ background: ACTION_COLOR[e.action] + '20', color: ACTION_COLOR[e.action], borderColor: ACTION_COLOR[e.action] + '60' }}>
                          {ACTION_ICON[e.action] || ''} {ACTION_LABEL[e.action] || e.action}
                        </span>
                        <time className="audit-time" dateTime={new Date(e.ts).toISOString()} title={formatFull(e.ts)}>
                          {formatRelative(e.ts)}
                        </time>
                      </div>
                    </div>
                    <div className="audit-detail">{e.detail}</div>
                  </div>
                </article>
              ))}
              {filtered.length > 500 && (
                <div className="audit-more-notice">
                  Mostrando 500 de {filtered.length} registros. Refine os filtros para ver mais.
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}