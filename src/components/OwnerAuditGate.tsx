import { useState, type ReactNode } from 'react'
import { useRole } from '../auth'
export function OwnerAuditGate({ children }: { children: ReactNode }) {
  const role = useRole()
  const [unlocked, setUnlocked] = useState(false)
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (role !== 'owner') return <p>A Auditoria é exclusiva do dono.</p>
  if (unlocked) return <><div className="page-row"><span className="badge badge-brand">Dono</span><button className="btn btn-secondary" onClick={() => setUnlocked(false)}>Trancar auditoria</button></div>{children}</>
  const submit = async () => {
    if (busy) return
    setBusy(true); setError('')
    try {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('cookie-zookie-v2:admin:' + key))
      const actual = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,'0')).join('')
      setKey('')
      if (actual === '2e1d2b3621b2511d082ffe8f0ff30ab3001bb55dd0a851e1716dcd920638faf7') setUnlocked(true)
      else setError('Chave incorreta.')
    } catch { setError('Não foi possível verificar a chave.') }
    finally { setBusy(false) }
  }
  return <section className="card">
    <span className="badge badge-brand">Dono</span><h1>Acessar Auditoria</h1>
    <form className="checkout-fields" onSubmit={e => { e.preventDefault(); void submit() }}>
      <label htmlFor="owner-audit-key">Chave de acesso<input autoFocus id="owner-audit-key" className="input" type="password" autoComplete="current-password" required maxLength={128} value={key} disabled={busy} onChange={e => setKey(e.target.value)}/></label>
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Verificando…' : 'Abrir auditoria'}</button>
    </form>
    {error && <p role="alert">{error}</p>}
  </section>
}
