import { BrowserWindow, screen, shell } from 'electron'
import { join } from 'path'
import type { ReminderPayload, Settings } from '@shared/types'

const preload = join(__dirname, '../preload/index.js')
export const iconPath = join(__dirname, '../../resources/icon.png')

function load(win: BrowserWindow, route = ''): void {
  if (process.env['ELECTRON_RENDERER_URL']) void win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/${route}`)
  else void win.loadFile(join(__dirname, '../renderer/index.html'), { hash: `/${route}` })
}

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1120,
    height: 780,
    minWidth: 900,
    minHeight: 640,
    show: false,
    backgroundColor: '#f7f7f5',
    title: 'StudyLens',
    icon: iconPath,
    autoHideMenuBar: true,
    webPreferences: { preload, sandbox: false }
  })
  win.on('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
  load(win)
  return win
}

// ---------- Reminder popup (custom, bottom-right, not a native toast) ----------

let popup: BrowserWindow | null = null
let pending: ReminderPayload | null = null
const POPUP_W = 380
const POPUP_H = 148

export function showReminderPopup(r: ReminderPayload): void {
  const { workArea } = screen.getPrimaryDisplay()
  const x = workArea.x + workArea.width - POPUP_W - 16
  const y = workArea.y + workArea.height - POPUP_H - 16
  if (!popup || popup.isDestroyed()) {
    popup = new BrowserWindow({
      width: POPUP_W,
      height: POPUP_H,
      x,
      y,
      frame: false,
      transparent: true,
      resizable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      focusable: false,
      show: false,
      hasShadow: false,
      webPreferences: { preload, sandbox: false }
    })
    popup.setAlwaysOnTop(true, 'screen-saver')
    pending = r
    popup.webContents.on('did-finish-load', () => {
      if (pending) popup?.webContents.send('reminder', pending)
      popup?.showInactive()
    })
    popup.on('closed', () => (popup = null))
    load(popup, 'popup')
  } else {
    popup.setPosition(x, y)
    popup.webContents.send('reminder', r)
    popup.showInactive()
  }
}

export function hideReminderPopup(): void {
  popup?.hide()
}

// ---------- Edge bar indicator ----------

let edge: BrowserWindow | null = null
const EDGE_H = 22

export function syncEdgeBar(settings: Settings, sessionActive: boolean): void {
  const want = settings.edgeBar.enabled && sessionActive
  if (!want) {
    edge?.destroy()
    edge = null
    return
  }
  const { bounds } = screen.getPrimaryDisplay()
  const y = settings.edgeBar.position === 'top' ? bounds.y : bounds.y + bounds.height - EDGE_H
  if (!edge || edge.isDestroyed()) {
    edge = new BrowserWindow({
      x: bounds.x,
      y,
      width: bounds.width,
      height: EDGE_H,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      skipTaskbar: true,
      focusable: false,
      alwaysOnTop: true,
      hasShadow: false,
      show: false,
      webPreferences: { preload, sandbox: false }
    })
    edge.setAlwaysOnTop(true, 'screen-saver')
    edge.setIgnoreMouseEvents(true)
    edge.once('ready-to-show', () => edge?.showInactive())
    edge.on('closed', () => (edge = null))
    load(edge, 'edgebar')
  } else {
    edge.setBounds({ x: bounds.x, y, width: bounds.width, height: EDGE_H })
  }
  edge.setOpacity(Math.min(1, Math.max(0.2, settings.edgeBar.opacity)))
}

export function allWindows(): BrowserWindow[] {
  return BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed())
}
