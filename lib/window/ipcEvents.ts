import { type BrowserWindow, ipcMain, shell } from 'electron'
import os from 'os'

const handleIPC = (channel: string, handler: (...args: any[]) => void) => {
  ipcMain.removeHandler(channel);
  ipcMain.handle(channel, handler);
}

export const registerWindowIPC = (mainWindow: BrowserWindow) => {
  // Hide the menu bar
  mainWindow.setMenuBarVisibility(false)

  // Register window IPC
  handleIPC('init-window', () => {
    const { width, height } = mainWindow.getBounds()
    const minimizable = mainWindow.isMinimizable()
    const maximizable = mainWindow.isMaximizable()
    const platform = os.platform()

    return { width, height, minimizable, maximizable, platform }
  })

  handleIPC('is-window-minimizable', () => mainWindow.isMinimizable())
  handleIPC('is-window-maximizable', () => mainWindow.isMaximizable())
  handleIPC('window-minimize', () => mainWindow.minimize())
  handleIPC('window-maximize', () => mainWindow.maximize())
  handleIPC('window-close', () => mainWindow.close())
  handleIPC('window-maximize-toggle', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  })

  const webContents = mainWindow.webContents
  handleIPC('web-undo', () => webContents.undo())
  handleIPC('web-redo', () => webContents.redo())
  handleIPC('web-cut', () => webContents.cut())
  handleIPC('web-copy', () => webContents.copy())
  handleIPC('web-paste', () => webContents.paste())
  handleIPC('web-delete', () => webContents.delete())
  handleIPC('web-select-all', () => webContents.selectAll())
  handleIPC('web-reload', () => webContents.reload())
  handleIPC('web-force-reload', () => webContents.reloadIgnoringCache())
  handleIPC('web-toggle-devtools', () => webContents.toggleDevTools())
  handleIPC('web-actual-size', () => webContents.setZoomLevel(0))
  handleIPC('web-zoom-in', () => webContents.setZoomLevel(webContents.zoomLevel + 0.5))
  handleIPC('web-zoom-out', () => webContents.setZoomLevel(webContents.zoomLevel - 0.5))
  handleIPC('web-toggle-fullscreen', () => mainWindow.setFullScreen(!mainWindow.fullScreen))
  handleIPC('web-open-url', (_e, url) => shell.openExternal(url))
}

export const registerChatWindowIPC = (chatWindow: BrowserWindow) => {
  const webContents = chatWindow.webContents
  // Register window IPC
  handleIPC('chat-init-window', () => {
    const { width, height } = chatWindow.getBounds()
    const minimizable = chatWindow.isMinimizable()
    const maximizable = chatWindow.isMaximizable()
    const platform = os.platform()

    return { width, height, minimizable, maximizable, platform }
  })
  handleIPC('chat-undo', () => webContents.undo())
  handleIPC('chat-redo', () => webContents.redo())
  handleIPC('chat-cut', () => webContents.cut())
  handleIPC('chat-copy', () => webContents.copy())
  handleIPC('chat-paste', () => webContents.paste())
  handleIPC('chat-delete', () => webContents.delete())
  handleIPC('chat-select-all', () => webContents.selectAll())

  // When the chat window is shown, instruct renderer to focus the input field
  chatWindow.on('show', () => {
    if (!chatWindow.isDestroyed()) {
      chatWindow.webContents.send('chat-focus-input');
    }
  });
}