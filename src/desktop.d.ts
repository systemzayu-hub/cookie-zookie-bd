interface Window {
  cookieZookieDesktop?: {
    minimize: () => void
    reload: () => void
    toggleMaximize: () => void
    close: () => void
    isMaximized: () => Promise<boolean>
    onMaximizedChange: (listener: (maximized: boolean) => void) => () => void
  }
}
