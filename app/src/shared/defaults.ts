import type { Settings } from './types'
import { normalizeCompanion } from './companion'

export const DEFAULT_SETTINGS: Settings = {
  companion: { name: 'Moss', color: 'green', glasses: true },
  notificationsEnabled: true,
  notificationMode: 'custom',
  intervals: { water: 40, eat: 150, break: 60, eye: 20, postureSeconds: 60 },
  pomodoro: { work: 25, shortBreak: 5, longBreak: 15, cyclesBeforeLong: 4 },
  windowBehavior: 'minimize',
  hotkey: 'CommandOrControl+Shift+S',
  edgeBar: { enabled: false, position: 'top', opacity: 0.9 },
  distractionKeywords: [
    'YouTube',
    'Netflix',
    'TikTok',
    'Instagram',
    'Reddit',
    'Discord',
    'Twitter',
    'X.com',
    'Facebook',
    'Twitch',
    'Steam',
    'Spotify',
    'Hulu',
    'Disney+'
  ],
  deviceAddress: 'unoq.local:8765',
  boardSsh: { enabled: false, host: '', port: 22, username: 'arduino', remotePort: 8765 },
  theme: 'system',
  cameraPreview: true
}

/** Deep-ish merge so new settings keys get defaults when loading an older file. */
export function withDefaults(partial: Partial<Settings> | undefined): Settings {
  const p = partial ?? {}
  return {
    ...DEFAULT_SETTINGS,
    ...p,
    companion: normalizeCompanion(p.companion),
    intervals: { ...DEFAULT_SETTINGS.intervals, ...(p.intervals ?? {}) },
    pomodoro: { ...DEFAULT_SETTINGS.pomodoro, ...(p.pomodoro ?? {}) },
    edgeBar: { ...DEFAULT_SETTINGS.edgeBar, ...(p.edgeBar ?? {}) },
    boardSsh: { ...DEFAULT_SETTINGS.boardSsh, ...(p.boardSsh ?? {}) },
    distractionKeywords: p.distractionKeywords ?? DEFAULT_SETTINGS.distractionKeywords
  }
}
