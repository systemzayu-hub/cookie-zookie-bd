const { app, BrowserWindow } = require('electron')
const createWindow = () => { const window = new BrowserWindow({ width: 1280, height: 820, minWidth: 960, minHeight: 640, autoHideMenuBar: true }); window.loadURL('https://systemzayu-hub.github.io/cookie-zookie-bd/') }
app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
