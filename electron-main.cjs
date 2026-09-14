const { app, BrowserWindow, ipcMain, Menu, nativeImage, Tray } = require('electron')
const path = require('path')

const APP_URL = 'https://systemzayu-hub.github.io/cookie-zookie-bd/?source=desktop-app'
let mainWindow
let tray

const showWindow = () => {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

const refreshApp = () => {
  showWindow()
  mainWindow?.webContents.reloadIgnoringCache()
}

const createTray = () => {
  const trayIcon = nativeImage.createFromPath(path.join(__dirname, 'public', 'icon-512.png')).resize({ width: 20, height: 20 })
  tray = new Tray(trayIcon)
  tray.setToolTip('Cookie Zookie')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir Cookie Zookie', click: showWindow },
    { label: 'Atualizar agora', click: refreshApp },
    { type: 'separator' },
    { label: 'Sair', click: () => app.quit() },
  ]))
  tray.on('click', showWindow)
}

const sendMaximizedState = () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('window:maximized-change', mainWindow.isMaximized())
}

const createWindow = async () => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: 'Cookie Zookie',
    frame: false,
    show: false,
    backgroundColor: '#140e0a',
    icon: path.join(__dirname, 'public', 'icon-512.png'),
    webPreferences: {
      preload: path.join(__dirname, 'electron-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  mainWindow.on('maximize', sendMaximizedState)
  mainWindow.on('unmaximize', sendMaximizedState)
  mainWindow.on('closed', () => { mainWindow = undefined })
  mainWindow.once('ready-to-show', () => mainWindow?.show())

  // O shell sempre usa a versão publicada. O cache HTTP é renovado, mas o cache
  // offline do service worker é preservado para o app ainda abrir sem conexão.
  await mainWindow.webContents.session.clearCache()
  await mainWindow.loadURL(APP_URL, { extraHeaders: 'Cache-Control: no-cache\n' })
}

ipcMain.on('window:minimize', event => BrowserWindow.fromWebContents(event.sender)?.minimize())
ipcMain.on('window:reload', event => BrowserWindow.fromWebContents(event.sender)?.webContents.reloadIgnoringCache())
ipcMain.on('window:toggle-maximize', event => {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (!window) return
  if (window.isMaximized()) window.unmaximize()
  else window.maximize()
})
ipcMain.on('window:close', event => BrowserWindow.fromWebContents(event.sender)?.close())
ipcMain.handle('window:is-maximized', event => Boolean(BrowserWindow.fromWebContents(event.sender)?.isMaximized()))

app.setAppUserModelId('com.cookiezookie.gestao')
app.whenReady().then(async () => { await createWindow(); createTray() })
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
