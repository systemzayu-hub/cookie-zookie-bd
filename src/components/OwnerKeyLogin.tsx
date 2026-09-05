import { useState } from 'react'
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
  return <details className="card" open={expanded || undefined}>
    <summary>Entrar com chave do dono</summary>
    <form className="checkout-fields" onSubmit={e => { e.preventDefault(); void submit() }}>
      <label>Chave de acesso<input className="input" type="password" autoComplete="off" required maxLength={128} value={key} disabled={busy} onChange={e => setKey(e.target.value)}/></label>
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Entrando…' : 'Acessar como dono'}</button>
    </form>
    <small>Acesso temporário neste navegador.</small>
    {error && <p role="alert">{error}</p>}
  </details>
}
