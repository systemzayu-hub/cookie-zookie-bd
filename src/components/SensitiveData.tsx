import { useState, useCallback, type ReactNode } from 'react'
import { Lock, Eye, EyeOff } from 'lucide-react'
import { useAuth, grant, HASHES, type Level } from '../auth'

async function hashPw(pw: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Esconde conteúdo financeiro sensível. Botão de desbloquear aparece NO TOPO da seção (sticky).
 * Ao digitar a senha do nível correto, revela o conteúdo até a página ser recarregada.
 *
 * @param level 'audit' = ver dados financeiros (senha CoZooAdm0406); 'admin' = ver+editar (senha CookiZo0406)
 */
export function SensitiveData({ children, label, level = 'audit' }: { children: ReactNode; label?: string; level?: Level }) {
  const hash = HASHES[level]
  const unlocked = useAuth(level)
  const [showInput, setShowInput] = useState(false)
  const [input, setInput] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState(false)

  const unlock = useCallback(async () => {
    if ((await hashPw(input)) === hash) {
      grant(level)
      setShowInput(false)
      setError(false)
    } else {
      setError(true)
    }
  }, [input, hash, level])

  if (unlocked) return <>{children}</>

  return (
    <div style={{ position: 'relative' }}>
      {/* Botão sticky — PRIMEIRO no DOM, gruda no topo ao rolar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        marginBottom: 'var(--sp-3)', pointerEvents: 'auto',
      }}>
        <button
          className="btn btn-cz"
          onClick={() => { setShowInput(true); setInput(''); setError(false) }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            width: '100%', minHeight: '52px', fontSize: '1rem', fontWeight: 700,
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          }}
        >
          <Lock size={20} /> {label || 'Desbloquear preços'}
        </button>
      </div>

      {/* Conteúdo borrado — DEPOIS do botão, aparece abaixo */}
      <div style={{ filter: 'blur(6px)', pointerEvents: 'none', userSelect: 'none', opacity: 0.4 }}>
        {children}
      </div>

      {/* Modal de senha */}
      {showInput && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 'var(--sp-4)',
        }}>
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: 'var(--sp-6) var(--sp-5)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)', maxWidth: '360px', width: '100%',
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.95rem', color: 'var(--tx-1)' }}>
              <Lock size={18} style={{ color: 'var(--cz-500)', flexShrink: 0 }} />
              {label || 'Desbloquear dados financeiros'}
            </label>
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                type={show ? 'text' : 'password'}
                className={`pw-input ${error ? 'pw-error' : ''}`}
                placeholder="Senha"
                value={input}
                onChange={e => { setInput(e.target.value); setError(false) }}
                onKeyDown={e => e.key === 'Enter' && unlock()}
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
            {error && (
              <div style={{ width: '100%', color: 'var(--err-500)', fontSize: '0.8rem', textAlign: 'center' }}>
                Senha incorreta
              </div>
            )}
            <div style={{ display: 'flex', gap: 'var(--sp-2)', width: '100%' }}>
              <button className="btn btn-cz btn-sm" onClick={unlock} style={{ flex: 1 }}>
                Desbloquear
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => { setShowInput(false); setError(false); setShow(false) }}
              >Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
