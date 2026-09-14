import { useEffect, useState } from 'react'
import { getAppShell } from '../app-environment'

const desktop = () => window.cookieZookieDesktop

export function isDesktopApp() {
  return getAppShell() === 'desktop'
}

export function DesktopWindowFrame() {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    const api = desktop()
    if (!api) return
    void api.isMaximized().then(setMaximized)
    const unsubscribe = api.onMaximizedChange(setMaximized)
    return unsubscribe
  }, [])

  const api = desktop()
  if (!api) return null

  return <header className="desktop-window-frame" aria-label="Barra da janela">
    <div className="desktop-window-brand">
      <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" />
      <span>Cookie Zookie</span>
      <small>Banco de Dados</small>
    </div>
    <div className="desktop-window-drag" aria-hidden="true" />
    <div className="desktop-window-controls">
      <button type="button" onClick={api.reload} aria-label="Atualizar aplicativo" title="Buscar atualização">
        <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M9.8 4A4.3 4.3 0 1 0 10 7.4M9.8 1v3H6.9" /></svg>
      </button>
      <button type="button" onClick={api.minimize} aria-label="Minimizar janela" title="Minimizar">
        <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1 5h8" /></svg>
      </button>
      <button type="button" onClick={api.toggleMaximize} aria-label={maximized ? 'Restaurar janela' : 'Maximizar janela'} title={maximized ? 'Restaurar' : 'Maximizar'}>
        {maximized ? <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M3 1h6v6M1 3h6v6H1z" /></svg> : <svg viewBox="0 0 10 10" aria-hidden="true"><rect x="1.5" y="1.5" width="7" height="7" /></svg>}
      </button>
      <button type="button" className="desktop-window-close" onClick={api.close} aria-label="Fechar janela" title="Fechar">
        <svg viewBox="0 0 10 10" aria-hidden="true"><path d="m1.5 1.5 7 7m0-7-7 7" /></svg>
      </button>
    </div>
  </header>
}
