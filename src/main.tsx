import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import { DesktopWindowFrame, isDesktopApp } from './components/DesktopWindowFrame'
import { getAppShell } from './app-environment'

const appShell = getAppShell()
if (appShell !== 'browser') document.documentElement.classList.add('installed-app', `${appShell}-app`)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .catch(() => console.warn('O modo offline não pôde ser preparado neste navegador.'))
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isDesktopApp() && <DesktopWindowFrame />}
    <App />
  </StrictMode>
)
