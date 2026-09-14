import { useState } from 'react'
import { ChevronDown, KeyRound } from 'lucide-react'
import { authLoginOwnerKey } from '../sync'
export function OwnerKeyLogin({ expanded = false }: { expanded?: boolean }) {
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async () => {
    if (busy) return
    setBusy(true); setError('')
    try {
      await authLoginOwnerKey(key)
      setKey('')
      window.location.hash = 'audit'
    } catch (e) {
      setKey('')
      const code = (e as { code?: string }).code || ''
      setError(code.includes('too-many-requests') ? 'Muitas tentativas. Aguarde antes de tentar novamente.' : code.includes('network') ? 'Verifique sua conexão.' : 'Chave incorreta ou acesso indisponível.')
    } finally { setBusy(false) }
  }
  return <details className="card interactive-disclosure owner-key-login" open={expanded || undefined}>
    <summary><span className="disclosure-icon"><KeyRound size={19} /></span><span><strong>Entrar com chave do dono</strong><small>Acesso administrativo temporário</small></span><ChevronDown className="disclosure-chevron" size={18} /></summary>
    <div className="owner-key-panel">
      <form className="owner-key-form" onSubmit={e => { e.preventDefault(); void submit() }}>
        <label htmlFor="owner-access-key">Chave de acesso</label>
        <div className="owner-key-input-row"><input id="owner-access-key" className="input" type="password" inputMode="text" autoComplete="off" placeholder="Digite a chave do dono" required maxLength={128} value={key} disabled={busy} onChange={e => setKey(e.target.value)}/><button className="btn btn-primary" disabled={busy}>{busy ? 'Verificando…' : 'Acessar'}</button></div>
      </form>
      <p className="owner-key-hint">A chave não fica salva. O acesso vale somente para esta sessão.</p>
      {error && <p className="owner-key-error" role="alert">{error}</p>}
    </div>
  </details>
}
