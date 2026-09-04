import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { ShieldCheck } from 'lucide-react'
import { authReauthenticateGoogle } from '../sync'
import { grant, isUnlocked } from '../auth'
import { startSessionLock } from '../useSessionLock'

interface GuardContext { guard: (label: string, action: () => void) => void }
const Guard = createContext<GuardContext>({ guard: (_, action) => action() })

export function usePasswordGuard() { return useContext(Guard) }

export function PasswordProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<{ label: string; action: () => void } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const guard = useCallback((label: string, action: () => void) => {
    if (isUnlocked('admin')) { action(); return }
    setError('')
    setPending({ label, action })
  }, [])

  const confirm = async () => {
    if (!pending || busy) return
    setBusy(true)
    setError('')
    try {
      await authReauthenticateGoogle()
      grant('admin')
      startSessionLock('admin')
      const action = pending.action
      setPending(null)
      action()
    } catch {
      setError('Não foi possível confirmar sua conta Google. Tente novamente.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Guard.Provider value={{ guard }}>
      {children}
      {pending && (
        <div className="pw-overlay" role="presentation" onClick={() => !busy && setPending(null)}>
          <div className="pw-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onClick={event => event.stopPropagation()}>
            <ShieldCheck size={34} aria-hidden="true" style={{ color: 'var(--cz-500)' }} />
            <h3 id="confirm-title" style={{ margin: '8px 0 4px' }}>Confirmar alteração</h3>
            <p className="pw-action">{pending.label}</p>
            <p style={{ color: 'var(--tx-2)', fontSize: '0.88rem', margin: 0 }}>
              Confirme sua identidade com a conta Google conectada. Nenhuma senha fica no código do site.
            </p>
            {error && <div className="pw-error-msg" role="alert">{error}</div>}
            <div className="pw-buttons">
              <button className="btn btn-ghost" disabled={busy} onClick={() => setPending(null)}>Cancelar</button>
              <button className="btn btn-cz" disabled={busy} onClick={confirm}>{busy ? 'Confirmando…' : 'Confirmar com Google'}</button>
            </div>
          </div>
        </div>
      )}
    </Guard.Provider>
  )
}
