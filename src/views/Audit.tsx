import { useState, useMemo } from 'react'
import { ShieldCheck, Lock, X } from 'lucide-react'
import { loadAudit, auditHash, AUDIT_PW_HASH, type AuditEntry } from '../audit'

const ACTION_ICON: Record<string, string> = {
  venda: '🛒', produto: '📦', estoque: '📊', perda: '⚠️',
  custo: '💰', cliente: '👤', cobranca: '💳', login: '🔐',
}

export function AuditView() {
  const [unlocked, setUnlocked] = useState(false)
  const [pw, setPw] = useState('')
  const [err, setErr] = useState(false)
  const [entries, setEntries] = useState<AuditEntry[]>(() => loadAudit())
  const [filter, setFilter] = useState('todos')

  const doUnlock = async () => {
    if ((await auditHash(pw)) === AUDIT_PW_HASH) { setUnlocked(true); setErr(false) }
    else setErr(true)
  }

  const actors = useMemo(() => {
    const m = new Map<string, number>()
    entries.forEach(e => m.set(e.actor, (m.get(e.actor) || 0) + 1))
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1])
  }, [entries])

  const filtered = useMemo(() =>
    filter === 'todos' ? entries : entries.filter(e => e.actor === filter)
  , [entries, filter])

  const byAction = useMemo(() => {
    const m = new Map<string, number>()
    entries.forEach(e => m.set(e.action, (m.get(e.action) || 0) + 1))
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1])
  }, [entries])

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
    <>
      <div className="page-row">
        <div className="page-title">
          <h2>Auditoria da equipe</h2>
          <p>O que cada pessoa fez no sistema</p>
        </div>
        <button className="btn btn-secondary" onClick={() => setUnlocked(false)}><Lock size={16} /> Travar</button>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 'var(--sp-6)' }}>
        <div className="card">
          <h3 className="card-title">Pessoas (por atividade)</h3>
          {actors.length === 0 ? <div className="empty-state"><p>Sem registros ainda.</p></div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              {actors.map(([name, n]) => (
                <button key={name} onClick={() => setFilter(name === filter ? 'todos' : name)}
                  style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', opacity: filter === name ? 1 : 0.7 }}>
                  <strong style={{ flex: 1, color: 'var(--cz-600)' }}>{name === 'desconhecido' ? 'Desconhecido' : name}</strong>
                  <span className="badge badge-brand">{n} ações</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <h3 className="card-title">Tipos de ação</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {byAction.map(([a, n]) => (
              <div key={a} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                <span>{ACTION_ICON[a] || '•'}</span>
                <span style={{ flex: 1, textTransform: 'capitalize' }}>{a}</span>
                <strong>{n}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h3 className="card-title">Total de registros</h3>
          <span className="stat-value">{entries.length}</span>
          <span className="stat-label">ações registradas</span>
        </div>
      </div>

      {(filter !== 'todos') && (
        <div style={{ marginBottom: 'var(--sp-4)' }}>
          <span className="badge badge-neutral">Filtrando por: {filter}</span>{' '}
          <button className="btn btn-ghost btn-sm" onClick={() => setFilter('todos')}><X size={14} /> Limpar</button>
        </div>
      )}

      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty-state"><p>Nenhuma ação registrada.</p></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Quando</th><th>Pessoa</th><th>Ação</th><th>Detalhe</th></tr></thead>
              <tbody>
                {filtered.slice(0, 300).map(e => (
                  <tr key={e.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(e.ts).toLocaleDateString('pt-BR')} {new Date(e.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td style={{ fontWeight: 600 }}>{e.actor === 'desconhecido' ? 'Desconhecido' : e.actor}</td>
                    <td><span className="badge badge-neutral" style={{ textTransform: 'capitalize' }}>{ACTION_ICON[e.action] || ''} {e.action}</span></td>
                    <td>{e.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
