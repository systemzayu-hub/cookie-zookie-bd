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
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })

    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .then(registration => {
        const activateWaitingVersion = () => registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
        activateWaitingVersion()
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) activateWaitingVersion()
          })
        })

        const checkForUpdate = () => {
          if (navigator.onLine) void registration.update().catch(() => undefined)
        }
        window.addEventListener('online', checkForUpdate)
        window.addEventListener('focus', checkForUpdate)
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') checkForUpdate()
        })
        window.setInterval(checkForUpdate, 5 * 60 * 1000)
      })
      .catch(() => console.warn('O modo offline não pôde ser preparado neste navegador.'))
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isDesktopApp() && <DesktopWindowFrame />}
    <App />
  </StrictMode>
)
