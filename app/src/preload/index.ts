import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { Activity, BoardConnectionStatus, BoardSshSettings, LiveStatus, ReminderPayload, ReminderType, SessionDetail, Settings } from '@shared/types'

function subscribe<T>(channel: string, cb: (v: T) => void): () => void {
  const h = (_e: IpcRendererEvent, v: T): void => cb(v)
  ipcRenderer.on(channel, h)
  return () => ipcRenderer.removeListener(channel, h)
}

const api = {
  onSettings: (cb: (settings: Settings) => void) => subscribe('settings:changed', cb),
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('settings:get'),
  saveSettings: (patch: Partial<Settings>): Promise<Settings> => ipcRenderer.invoke('settings:save', patch),
  getStatus: (): Promise<LiveStatus> => ipcRenderer.invoke('status:get'),
  onStatus: (cb: (s: LiveStatus) => void) => subscribe('status', cb),
  captureBaseline: (): Promise<void> => ipcRenderer.invoke('session:baseline'),
  startSession: (screenOnly: boolean): Promise<void> => ipcRenderer.invoke('session:start', screenOnly),
  pauseSession: (): Promise<void> => ipcRenderer.invoke('session:pause'),
  resumeSession: (): Promise<void> => ipcRenderer.invoke('session:resume'),
  stopSession: (): Promise<number | null> => ipcRenderer.invoke('session:stop'),
  listSessions: (): Promise<SessionDetail[]> => ipcRenderer.invoke('sessions:list'),
  getSession: (id: number): Promise<SessionDetail | null> => ipcRenderer.invoke('sessions:get', id),
  deleteSession: (id: number): Promise<void> => ipcRenderer.invoke('sessions:delete', id),
  relabelSegment: (id: number, state: Activity): Promise<void> => ipcRenderer.invoke('segments:relabel', id, state),
  deleteAllData: (): Promise<void> => ipcRenderer.invoke('data:deleteAll'),
  loadDemoData: (): Promise<void> => ipcRenderer.invoke('data:loadDemo'),
  testConnection: (address: string): Promise<boolean> => ipcRenderer.invoke('device:test', address),
  getBoardConnectionStatus: (): Promise<BoardConnectionStatus> => ipcRenderer.invoke('device:connection-status'),
  testManagedConnection: (): Promise<boolean> => ipcRenderer.invoke('device:test-managed'),
  forgetBoardLogin: (): Promise<void> => ipcRenderer.invoke('device:forget-login'),
  saveBoardLogin: (config: BoardSshSettings, password: string): Promise<{ ok: boolean; message: string }> => ipcRenderer.invoke('device:save-login', config, password),
  setCameraPreview: (on: boolean): Promise<void> => ipcRenderer.invoke('camera:preview', on),
  onCameraFrame: (cb: (jpegBase64: string) => void) => subscribe('camera:frame', cb),
  onNavigate: (cb: (r: { page: string; id?: number; countdown?: boolean }) => void) => subscribe('navigate', cb),
  countdownCanceled: (): Promise<void> => ipcRenderer.invoke('session:countdownCanceled'),
  onReminder: (cb: (r: ReminderPayload) => void) => subscribe('reminder', cb),
  reminderAction: (type: ReminderType, action: 'done' | 'dismiss'): Promise<void> => ipcRenderer.invoke('reminder:action', type, action),
  hidePopup: (): Promise<void> => ipcRenderer.invoke('popup:hide')
}

export type Api = typeof api
contextBridge.exposeInMainWorld('api', api)
