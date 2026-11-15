import { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeImage, nativeTheme, Tray } from 'electron'
import { generateDemoSessions } from '@shared/demo'
import type { Activity, ReminderType, Settings } from '@shared/types'
import * as db from './db'
import { DeviceLink, testConnection } from './deviceLink'
import { SessionManager } from './session'
import { getSettings, saveSettings } from './settings'
import { WindowWatcher } from './windowWatcher'
import { allWindows, createMainWindow, hideReminderPopup, iconPath, showReminderPopup, syncEdgeBar } from './windows'

app.setAppUserModelId('com.madhacks.studylens')
if (!app.requestSingleInstanceLock()) app.quit()

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let quitting = false

const device = new DeviceLink()
const watcher = new WindowWatcher()
let session: SessionManager

function showMain(route?: { page: string; id?: number }): void {
  if (!mainWindow || mainWindow.isDestroyed()) mainWindow = createMainWindowWithGuards()
  mainWindow.setSkipTaskbar(false)
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
  if (route) {
    const send = (): void => mainWindow?.webContents.send('navigate', route)
    if (mainWindow.webContents.isLoading()) mainWindow.webContents.once('did-finish-load', send)
    else send()
  }
}

function createMainWindowWithGuards(): BrowserWindow {
  const win = createMainWindow()
  // Closing the window mid-session keeps tracking in the background (tray gives a way back).
  win.on('close', (e) => {
    if (!quitting && session?.isActive) {
      e.preventDefault()
      win.hide()
      ensureTray()
    }
  })
  return win
}

// ---------- Tray ----------

function ensureTray(): void {
  if (tray) return updateTrayMenu()
  const img = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  tray = new Tray(img)
  tray.setToolTip('StudyLens — session in progress')
  tray.on('click', () => showMain())
  updateTrayMenu()
}

function updateTrayMenu(): void {
  if (!tray) return
  const s = session.getStatus().status
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open StudyLens', click: () => showMain() },
      { type: 'separator' },
      { label: s === 'paused' ? 'Resume session' : 'Pause session', enabled: s !== 'idle', click: () => session.togglePause() },
      { label: 'Stop session', enabled: s !== 'idle', click: () => session.stop() },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ])
  )
}

function destroyTray(): void {
  tray?.destroy()
  tray = null
}

// ---------- Hotkey ----------

function registerHotkey(accel: string): void {
  globalShortcut.unregisterAll()
  try {
    globalShortcut.register(accel, () => {
      if (session.isActive) session.stop()
      else showMain()
    })
  } catch {
    /* invalid accelerator — Settings shows the default */
  }
}

// ---------- Window behavior when a session starts ----------

function applyStartBehavior(settings: Settings): void {
  const win = mainWindow
  if (!win) return
  switch (settings.windowBehavior) {
    case 'minimize':
      win.minimize()
      break
    case 'tray':
      win.hide()
      ensureTray()
      break
    case 'close':
      win.hide()
      win.setSkipTaskbar(true)
      break
  }
}

function wireSession(): void {
  session.on('status', (s) => {
    for (const w of allWindows()) w.webContents.send('status', s)
  })
  session.on('started', () => {
    const settings = getSettings()
    syncEdgeBar(settings, true)
    applyStartBehavior(settings)
    updateTrayMenu()
  })
  session.on('ended', (id) => {
    syncEdgeBar(getSettings(), false)
    hideReminderPopup()
    destroyTray()
    showMain({ page: 'report', id })
  })
  session.on('reminder', (r) => showReminderPopup(r))
  session.on('reminder-cleared', () => hideReminderPopup())
  session.on('touch-start', () => {
    device.send({ type: 'baseline' })
    session.start(false)
  })
  // Pause/resume from anywhere keeps the tray label right.
  session.on('status', () => updateTrayMenu())
}

// ---------- Camera preview ----------

// Frames go straight to the main window; they are never stored.
function wirePreview(): void {
  device.on('message', (m) => {
    if (m.type !== 'frame') return
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible() && !mainWindow.isMinimized()) {
      mainWindow.webContents.send('camera:frame', m.jpeg)
    }
  })
}

// ---------- Theme ----------

function applyTheme(settings: Settings): void {
  // Drives prefers-color-scheme in every window (main, popup, edge bar) and the native title bar.
  nativeTheme.themeSource = settings.theme
}

// ---------- IPC ----------

function registerIpc(): void {
  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:save', (_e, patch: Partial<Settings>) => {
    const s = saveSettings(patch)
    applyTheme(s)
    session.updateSettings(s)
    device.connect(s.deviceAddress)
    registerHotkey(s.hotkey)
    syncEdgeBar(s, session.isActive)
    return s
  })
  ipcMain.handle('status:get', () => session.getStatus())
  ipcMain.handle('session:baseline', () => device.send({ type: 'baseline' }))
  ipcMain.handle('session:start', (_e, screenOnly: boolean) => session.start(screenOnly))
  ipcMain.handle('session:pause', () => session.pause())
  ipcMain.handle('session:resume', () => session.resume())
  ipcMain.handle('session:stop', () => session.stop())
  ipcMain.handle('sessions:list', () => db.listDetails())
  ipcMain.handle('sessions:get', (_e, id: number) => db.getDetail(id))
  ipcMain.handle('sessions:delete', (_e, id: number) => db.deleteSession(id))
  ipcMain.handle('segments:relabel', (_e, id: number, state: Activity) => db.relabelSegment(id, state))
  ipcMain.handle('data:deleteAll', () => db.deleteAll())
  ipcMain.handle('data:loadDemo', () => db.importDetails(generateDemoSessions(Date.now(), 14, Math.floor(Math.random() * 1e6))))
  ipcMain.handle('device:test', (_e, address: string) => testConnection(address))
  ipcMain.handle('camera:preview', (_e, on: boolean) => device.setPreview(on))
  ipcMain.handle('reminder:action', (_e, type: ReminderType, action: 'done' | 'dismiss') => {
    session.reminderAction(type, action)
    hideReminderPopup()
  })
  ipcMain.handle('popup:hide', () => hideReminderPopup())
}

// ---------- Lifecycle ----------

app.on('second-instance', () => showMain())

app.whenReady().then(() => {
  const settings = getSettings()
  applyTheme(settings)
  session = new SessionManager(settings, device, watcher)
  wireSession()
  wirePreview()
  registerIpc()
  device.connect(settings.deviceAddress)
  registerHotkey(settings.hotkey)
  mainWindow = createMainWindowWithGuards()
})

app.on('window-all-closed', () => {
  if (!session?.isActive) app.quit()
})

app.on('before-quit', () => {
  quitting = true
  session?.stop()
  db.flush()
  globalShortcut.unregisterAll()
  device.close()
  watcher.stop()
})
