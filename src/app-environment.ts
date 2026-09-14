export type AppShell = 'browser' | 'desktop' | 'mobile'

export function getAppShell(): AppShell {
  if (window.cookieZookieDesktop) return 'desktop'
  const source = new URLSearchParams(window.location.search).get('source')
  if (source === 'desktop-app') return 'desktop'
  return source === 'mobile-app' ? 'mobile' : 'browser'
}

export function isInstalledApp() {
  return getAppShell() !== 'browser'
}
