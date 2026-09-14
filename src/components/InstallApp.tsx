import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
let deferredPrompt: InstallPrompt | null = null
const listeners = new Set<(prompt: InstallPrompt | null) => void>()
if (typeof window !== 'undefined') window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferredPrompt = event as InstallPrompt; listeners.forEach(listener => listener(deferredPrompt)) })

export function InstallApp({ floating = false }: { floating?: boolean }) {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(deferredPrompt)
  const [showIosHelp, setShowIosHelp] = useState(false)
  const [showBrowserHelp, setShowBrowserHelp] = useState(false)
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
  useEffect(() => { listeners.add(setPrompt); return () => { listeners.delete(setPrompt) } }, [])
  const install = async () => {
    if (ios) { setShowIosHelp(value => !value); return }
    if (!prompt) { setShowBrowserHelp(true); return }
    await prompt.prompt(); await prompt.userChoice; deferredPrompt = null; listeners.forEach(listener => listener(null))
  }
  return <div className={`install-app ${floating ? 'install-app-floating' : ''}`}><button className="install-app-button" onClick={() => void install()}><Download size={17} /> Instalar aplicativo</button>{ios && showIosHelp && <p className="install-app-help">No Safari, toque em Compartilhar e depois em <strong>“Adicionar à Tela de Início”</strong>.</p>}{!ios && showBrowserHelp && <p className="install-app-help">Use o ícone de instalar na barra do navegador.</p>}</div>
}
