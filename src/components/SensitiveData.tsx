import { useCallback, useState, type ReactNode } from 'react'
import { Eye, Lock, ShieldCheck } from 'lucide-react'
import { grant, useAuth, verifyAccessPassword, type Level } from '../auth'
import { startSessionLock } from '../useSessionLock'
import { MoneyVisibilityProvider } from './MaskedMoney'

export function SensitiveData({ children, label, level = 'financial' }: { children: ReactNode; label?: string; level?: Level }) {
  const unlocked = useAuth(level)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const unlock = useCallback(async () => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      if (!await verifyAccessPassword(level, password)) {
        setError('Senha incorreta.')
        return
      }
      grant(level)
      startSessionLock(level)
      setPassword('')
    } catch {
      setError('Não foi possível validar a senha.')
    } finally {
      setBusy(false)
    }
  }, [busy, level, password])

  if (unlocked) return <MoneyVisibilityProvider>{children}</MoneyVisibilityProvider>

  return (
    <section className="sensitive-locked" aria-label={label || 'Dados protegidos'}>
      <div className="sensitive-lock-card">
        <div className="sensitive-lock-icon"><Lock size={24} aria-hidden="true" /></div>
        <div>
          <strong>{label || 'Dados financeiros protegidos'}</strong>
          <p>Ao desbloquear, os valores ficam visíveis no site inteiro até atualizar a página (F5).</p>
        </div>
        <form onSubmit={event => { event.preventDefault(); void unlock() }} className="sensitive-unlock-form">
          <label className="sr-only" htmlFor={`sensitive-password-${level}`}>Senha de acesso</label>
          <input id={`sensitive-password-${level}`} className="pw-input" type="password" value={password} maxLength={128} autoComplete="current-password" placeholder="Senha de acesso" onChange={event => setPassword(event.target.value)} />
          <button className="btn btn-cz" disabled={busy || !password} type="submit">
            {busy ? <ShieldCheck size={18} /> : <Eye size={18} />}
            {busy ? 'Validando…' : 'Desbloquear'}
          </button>
        </form>
      </div>
      {error && <div className="pw-error-msg" role="alert">{error}</div>}
    </section>
  )
}
