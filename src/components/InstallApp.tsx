import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null)
  const [showIosHelp, setShowIosHelp] = useState(false)
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
  useEffect(() => {
    const capture = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt) }
    window.addEventListener('beforeinstallprompt', capture)
    return () => window.removeEventListener('beforeinstallprompt', capture)
  }, [])
  const install = async () => {
    if (ios) { setShowIosHelp(value => !value); return }
    if (!prompt) return
    await prompt.prompt(); await prompt.userChoice; setPrompt(null)
  }
  return <div className="install-app"><button className="install-app-button" onClick={() => void install()}><Download size={17} /> Instalar aplicativo</button>{ios && showIosHelp && <p className="install-app-help">No Safari, toque em Compartilhar e depois em <strong>“Adicionar à Tela de Início”</strong>.</p>}{!ios && !prompt && <p className="install-app-help">No celular ou computador, use o ícone de instalar na barra do navegador.</p>}</div>
}
