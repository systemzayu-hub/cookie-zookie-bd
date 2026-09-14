const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('cookieZookieDesktop', {
  minimize: () => ipcRenderer.send('window:minimize'),
  reload: () => ipcRenderer.send('window:reload'),
  toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
  close: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  onMaximizedChange: (listener) => {
    const receive = (_event, maximized) => listener(Boolean(maximized))
    ipcRenderer.on('window:maximized-change', receive)
    return () => ipcRenderer.removeListener('window:maximized-change', receive)
  },
})
