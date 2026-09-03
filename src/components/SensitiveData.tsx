import { useState, useCallback, type ReactNode } from 'react'
import { Lock, Eye } from 'lucide-react'

const PW_HASH = '70e58a3aeb9d8ade3ca32d518e28de7f9c889b50b82c667d344eb062234f6215'
const STORAGE_KEY = 'cz_fin_unlocked'

async function hashPw(pw: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Esconde conteúdo financeiro sensível. Mostra um overlay com blur + candado.
 * Ao digitar a senha admin, revela o conteúdo para toda a sessão.
 * Wraps children — se desbloqueado, renderiza normalmente.
 */
export function SensitiveData({ children, label }: { children: ReactNode; label?: string }) {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(STORAGE_KEY) === PW_HASH)
  const [showInput, setShowInput] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)

  const unlock = useCallback(async () => {
    if ((await hashPw(input)) === PW_HASH) {
      sessionStorage.setItem(STORAGE_KEY, PW_HASH)
      setUnlocked(true)
      setShowInput(false)
    } else {
      setError(true)
    }
  }, [input])

  if (unlocked) return <>{children}</>

  return (
    <div style={{ position: 'relative' }}>
      {/* Conteúdo borrado por baixo */}
      <div style={{ filter: 'blur(6px)', pointerEvents: 'none', userSelect: 'none', opacity: 0.4 }}>
        {children}
      </div>

      {/* Overlay de bloqueio */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 'var(--sp-3)',
      }}>
        {!showInput ? (
          <button
            className="btn btn-ghost"
            onClick={() => { setShowInput(true); setInput(''); setError(false) }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: 'var(--sp-3) var(--sp-5)',
              fontWeight: 600, fontSize: '0.9rem',
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            }}
          >
            <Lock size={18} /> {label || 'Desbloquear dados financeiros'}
          </button>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--sp-2)',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: 'var(--sp-3) var(--sp-4)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)', maxWidth: '360px', width: '90%',
          }}>
            <Lock size={16} style={{ color: 'var(--cz-500)', flexShrink: 0 }} />
            <input
              type="password"
              className={`pw-input ${error ? 'pw-error' : ''}`}
              placeholder="Senha admin"
              value={input}
              onChange={e => { setInput(e.target.value); setError(false) }}
              onKeyDown={e => e.key === 'Enter' && unlock()}
              autoFocus
              style={{ flex: 1, minWidth: 0 }}
            />
            <button className="btn btn-cz btn-sm" onClick={unlock}>
              <Eye size={14} />
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => { setShowInput(false); setError(false) }}
            >✕</button>
            {error && (
              <div style={{ width: '100%', color: 'var(--err-500)', fontSize: '0.8rem', textAlign: 'center' }}>
                Senha incorreta
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
