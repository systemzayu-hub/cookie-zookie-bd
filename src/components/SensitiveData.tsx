import { useCallback, useState, type ReactNode } from 'react'
import { Eye, Lock, ShieldCheck } from 'lucide-react'
import { grant, useAuth, type Level } from '../auth'
import { authReauthenticateGoogle } from '../sync'
import { startSessionLock } from '../useSessionLock'

export function SensitiveData({ children, label, level = 'audit' }: { children: ReactNode; label?: string; level?: Level }) {
  const unlocked = useAuth(level)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const unlock = useCallback(async () => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await authReauthenticateGoogle()
      grant(level)
      startSessionLock(level)
    } catch {
      setError('Confirmação Google cancelada ou indisponível.')
    } finally {
      setBusy(false)
    }
  }, [busy, level])

  if (unlocked) return <>{children}</>

  return (
    <section className="sensitive-locked" aria-label={label || 'Dados protegidos'}>
      <div className="sensitive-lock-card">
        <div className="sensitive-lock-icon"><Lock size={24} aria-hidden="true" /></div>
        <div>
          <strong>{label || 'Dados financeiros protegidos'}</strong>
          <p>O conteúdo não é renderizado enquanto estiver bloqueado. A liberação expira após 5 minutos sem atividade.</p>
        </div>
        <button className="btn btn-cz" disabled={busy} onClick={unlock}>
          {busy ? <ShieldCheck size={18} /> : <Eye size={18} />}
          {busy ? 'Confirmando…' : 'Ver com Google'}
        </button>
      </div>
      {error && <div className="pw-error-msg" role="alert">{error}</div>}
    </section>
  )
}
