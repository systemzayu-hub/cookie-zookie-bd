export type AppShell = 'browser' | 'desktop' | 'mobile'

export function getAppShell(): AppShell {
  if (window.cookieZookieDesktop) return 'desktop'
  return new URLSearchParams(window.location.search).get('source') === 'mobile-app' ? 'mobile' : 'browser'
}

export function isInstalledApp() {
  return getAppShell() !== 'browser'
}
