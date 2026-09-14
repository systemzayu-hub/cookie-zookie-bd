export type AppShell = 'browser' | 'desktop' | 'mobile'

export function getAppShell(): AppShell {
  if (window.cookieZookieDesktop) return 'desktop'
  const source = new URLSearchParams(window.location.search).get('source')
  if (source === 'desktop-app') return 'desktop'
  if (source === 'mobile-app') return 'mobile'
  const iosStandalone = Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || iosStandalone
  return standalone ? 'mobile' : 'browser'
}

export function isInstalledApp() {
  return getAppShell() !== 'browser'
}
