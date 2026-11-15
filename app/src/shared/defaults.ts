import type { Settings } from './types'

export const DEFAULT_SETTINGS: Settings = {
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
  deviceAddress: 'unoq.local:8765'
}

/** Deep-ish merge so new settings keys get defaults when loading an older file. */
export function withDefaults(partial: Partial<Settings> | undefined): Settings {
  const p = partial ?? {}
  return {
    ...DEFAULT_SETTINGS,
    ...p,
    intervals: { ...DEFAULT_SETTINGS.intervals, ...(p.intervals ?? {}) },
    pomodoro: { ...DEFAULT_SETTINGS.pomodoro, ...(p.pomodoro ?? {}) },
    edgeBar: { ...DEFAULT_SETTINGS.edgeBar, ...(p.edgeBar ?? {}) },
    distractionKeywords: p.distractionKeywords ?? DEFAULT_SETTINGS.distractionKeywords
  }
}
