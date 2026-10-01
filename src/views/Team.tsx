import { SearchInput } from '../components/SearchInput'
import { matchesSearch } from '../search'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useEffect, useState } from 'react'
import { authCurrentUser, callBackend, watchTeam, type TeamMember } from '../sync'
import { useRole } from '../auth'
import { can, canChangeRole, ROLE_LABEL, type Role } from '../roles'
export function TeamView() {
  const role = useRole()
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [search, setSearch] = useState('')
  const [email, setEmail] = useState('')
  const [nextRole, setNextRole] = useState<Role>('employee')
  const [pending, setPending] = useState<{ email: string; role: Role } | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => {
    if (!can(role, 'team')) return
    setLoadError(false)
    return watchTeam(rows => {setMembers(rows); setReady(true); setLoadError(false)}, () => {setReady(true); setLoadError(true); setMessage('Não foi possível atualizar a equipe. Os cargos exibidos podem estar desatualizados.')})
  }, [role, attempt])
  if (!can(role, 'team')) return <p>Apenas o dono pode gerenciar a equipe.</p>
  const confirm = async () => {
    if (!pending || busy) return
    setBusy(true); setMessage('')
    try { await callBackend('changeTeamAccess', pending); setPending(null); setEmail(''); setMessage('Acesso atualizado.') }
    catch (error) { setMessage((error as Error).message) }
    finally { setBusy(false) }
  }
  return <div className="team-section">
    <div className="table-wrap card"><table className="table"><caption className="card-title">Permissões por cargo</caption><thead><tr><th>Ação</th><th>Funcionário</th><th>Administrador</th><th>Dono</th></tr></thead><tbody>
      <tr><td>Consultar catálogo e registrar venda paga ou pendente</td><td>Sim</td><td>Sim</td><td>Sim</td></tr>
      <tr><td>Editar estoque, preços, clientes e pagamentos</td><td>Não</td><td>Sim</td><td>Sim</td></tr>
      <tr><td>Financeiro, relatórios e backup</td><td>Não</td><td>Sim</td><td>Sim</td></tr>
      <tr><td>Auditoria e reversões</td><td>Não</td><td>Não</td><td>Sim</td></tr><tr><td>Convidar, bloquear e alterar cargos</td><td>Não</td><td>Não</td><td>Sim</td></tr>
      <tr><td>Remover um dono ou alterar o próprio cargo</td><td>Não</td><td>Não</td><td>Não</td></tr>
    </tbody></table></div>
    <details className="card"><summary>Adicionar por e-mail</summary><form className="checkout-fields" onSubmit={e => { e.preventDefault(); setPending({ email: email.trim().toLowerCase(), role: nextRole }) }}>
      <label>E-mail da conta Google<input className="input" type="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)}/></label>
      <label>Cargo<select className="input" value={nextRole} onChange={e => setNextRole(e.target.value as Role)}><option value="owner">Dono</option><option value="employee">Funcionário</option><option value="admin">Administrador</option><option value="viewer">Sem cargo · somente leitura</option><option value="blocked">Bloqueado</option></select></label>
      <button className="btn btn-primary" disabled={busy}>Definir acesso</button>
    </form></details>
    {message && <p className="card" role="status">{message}</p>}
    <div className="card"><h2 className="card-title">Pessoas que entraram no site</h2><SearchInput label="Buscar por nome ou e-mail" value={search} onChange={setSearch} />{loadError && <button className="btn btn-secondary" onClick={() => setAttempt(n => n + 1)}>Tentar novamente</button>}{!ready ? <p role="status">Carregando equipe…</p> : !members.some(m => matchesSearch(search, m.name, m.email)) ? <p role="status">{members.length ? "Nenhuma pessoa corresponde à busca." : "Nenhum membro carregado."}</p> : members.filter(m => matchesSearch(search, m.name, m.email)).map(member => {
      const self = member.email === authCurrentUser()?.email?.toLowerCase()
      return <div className="team-member" key={member.email}><div><strong>{member.name || member.email}</strong><small>{member.name ? member.email + ' · ' : ''}{member.invited ? 'Aguardando primeiro acesso' : ROLE_LABEL[member.role]}</small></div>
        {canChangeRole(role!, member.role, 'employee', self) ? <select className="input" aria-label={`Cargo de ${member.email}`} value={member.role} disabled={busy} onChange={e => setPending({ email: member.email, role: e.target.value as Role })}><option value="owner">Dono</option><option value="employee">Funcionário</option><option value="admin">Administrador</option><option value="viewer">Sem cargo · somente leitura</option><option value="blocked">Bloqueado</option></select> : <span className="badge badge-brand">{ROLE_LABEL[member.role]}{self ? ' · você' : ''}</span>}
      </div>
    })}</div>
    {pending && <ConfirmDialog titleId="team-confirm" busy={busy} onCancel={() => setPending(null)}><h2 id="team-confirm">Confirmar acesso</h2><p>{pending.email}</p><p>Novo cargo: <strong>{ROLE_LABEL[pending.role]}</strong></p>{pending.role === 'blocked' && <p>Esta conta perderá o acesso à loja.</p>}<div className="pw-buttons"><button autoFocus className="btn btn-secondary" disabled={busy} onClick={() => setPending(null)}>Cancelar</button><button className="btn btn-primary" disabled={busy} onClick={() => void confirm()}>{busy ? 'Salvando…' : 'Confirmar'}</button></div></ConfirmDialog>}
  </div>
}
