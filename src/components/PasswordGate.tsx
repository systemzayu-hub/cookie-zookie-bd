import { createContext, useContext, useState, type ReactNode } from 'react'
import { isUnlocked, type Level } from '../auth'
interface GuardContext { guard: (label: string, action: () => void, level?: Level) => void }
const Guard = createContext<GuardContext>({ guard: () => { throw new Error('Controle de acesso indisponível.') } })
export function usePasswordGuard() { return useContext(Guard) }
export function PasswordProvider({ children }: { children: ReactNode }) {
  const [error, setError] = useState('')
  return <Guard.Provider value={{ guard: (_, action, level = 'admin') => {
    if (!isUnlocked(level)) { setError('Seu cargo não permite esta ação.'); return }
    action()
  } }}>
    {children}
    {error && <div className="toast-container"><div className="toast toast-error" role="alert">{error}<button onClick={() => setError('')} aria-label="Fechar aviso">×</button></div></div>}
  </Guard.Provider>
}
