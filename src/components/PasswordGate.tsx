import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { Lock, Eye, EyeOff } from 'lucide-react'
import { useAuth, grant } from '../auth'

/** SHA-256 hash da senha de edição — nunca armazenar em texto plano */
const PW_HASH = '70e58a3aeb9d8ade3ca32d518e28de7f9c889b50b82c667d344eb062234f6215'

interface Ctx { guard: (label: string, fn: () => void) => void }
const C = createContext<Ctx>({ guard: (_, fn) => fn() })

export function usePasswordGuard() { return useContext(C) }

async function hashPw(pw: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export function PasswordProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<{ label: string; fn: () => void } | null>(null)
  const [input, setInput] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState(false)
  // Em memória apenas — recarregar a página volta a pedir a senha
  const unlocked = useAuth('admin')

  const guard = useCallback((label: string, fn: () => void) => {
    if (unlocked) { fn(); return }
    setPending({ label, fn }); setInput(''); setShow(false); setError(false)
  }, [unlocked])

  const verify = async () => {
    if ((await hashPw(input)) === PW_HASH) {
      grant('admin')
      pending?.fn()
      setPending(null)
    } else { setError(true) }
  }

  return (
    <C.Provider value={{ guard }}>
      {children}
      {pending && (
        <div className="pw-overlay" onClick={() => setPending(null)}>
          <div className="pw-modal" onClick={e => e.stopPropagation()}>
            <Lock size={32} style={{ color: 'var(--cz-500)' }} />
            <h3 style={{ margin: '8px 0 4px' }}>Senha necessária</h3>
            <p className="pw-action">{pending.label}</p>
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                type={show ? 'text' : 'password'}
                className={`pw-input ${error ? 'pw-error' : ''}`}
                placeholder="Digite a senha"
                value={input}
                onChange={e => { setInput(e.target.value); setError(false) }}
                onKeyDown={e => e.key === 'Enter' && verify()}
                autoFocus
                style={{ width: '100%', paddingRight: '44px', textAlign: 'left' }}
              />
              <button
                type="button"
                onClick={() => setShow(s => !s)}
                aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
                style={{
                  position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--tx-3)', padding: '8px', display: 'flex',
                }}
              >
                {show ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {error && <div className="pw-error-msg">Senha incorreta</div>}
            <div className="pw-buttons">
              <button className="btn btn-ghost" onClick={() => setPending(null)}>Cancelar</button>
              <button className="btn btn-cz" onClick={verify}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </C.Provider>
  )
}
