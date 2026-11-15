// Core domain types shared by main, preload and renderer.

export const ACTIVITIES = ['studying', 'phone', 'distracted', 'away', 'eating', 'sleeping'] as const
export type Activity = (typeof ACTIVITIES)[number]

/** What the UNO Q camera can tell on its own. The laptop refines `present` into studying/distracted. */
export type CameraState = 'present' | 'phone' | 'away' | 'eating' | 'sleeping'

export interface WindowInfo {
  app: string
  title: string
}

export type ReminderType = 'water' | 'eat' | 'break' | 'posture' | 'eye' | 'pomodoro_break' | 'pomodoro_work'
export type TimerKey = 'water' | 'eat' | 'break' | 'eye'

export interface SessionRecord {
  id: number
  startedAt: number
  endedAt: number | null
  /** True when started without the UNO Q (screen + idle tracking only). */
  screenOnly: boolean
}

export interface Segment {
  id: number
  sessionId: number
  state: Activity
  start: number
  end: number
  app?: string
  title?: string
  /** Matched distraction keyword (e.g. "YouTube") for distracted segments. */
  tag?: string
  /** Set when the user relabeled this segment in the report; holds the original state. */
  originalState?: Activity
}

export type EventType =
  | 'reminder_fired'
  | 'reminder_done'
  | 'reminder_dismissed'
  | 'drank'
  | 'ate'
  | 'pause'
  | 'resume'

export interface EventRecord {
  id: number
  sessionId: number
  ts: number
  type: EventType
  reminder?: ReminderType
}

export type WindowBehavior = 'minimize' | 'tray' | 'close'
export type NotificationMode = 'custom' | 'pomodoro'

export interface Settings {
  notificationsEnabled: boolean
  notificationMode: NotificationMode
  /** Minutes, except postureSeconds. */
  intervals: { water: number; eat: number; break: number; eye: number; postureSeconds: number }
  pomodoro: { work: number; shortBreak: number; longBreak: number; cyclesBeforeLong: number }
  windowBehavior: WindowBehavior
  hotkey: string
  edgeBar: { enabled: boolean; position: 'top' | 'bottom'; opacity: number }
  distractionKeywords: string[]
  deviceAddress: string
}

export interface DeviceStatus {
  connected: boolean
  faceDetected: boolean
  cameraState: CameraState | null
  lastSeen: number | null
}

export type SessionStatus = 'idle' | 'running' | 'paused'

export interface LiveStatus {
  status: SessionStatus
  sessionId: number | null
  startedAt: number | null
  /** Active (unpaused) time in ms. */
  elapsedMs: number
  current: Activity | null
  totals: Record<Activity, number>
  focusPct: number
  /** Ms remaining per timer, or null when that reminder is off. */
  timers: Record<TimerKey, number | null>
  pomodoroPhase: 'work' | 'break' | null
  device: DeviceStatus
  window: WindowInfo | null
}

export interface ReminderPayload {
  type: ReminderType
  title: string
  message: string
}

export interface SessionDetail {
  session: SessionRecord
  segments: Segment[]
  events: EventRecord[]
}

export const emptyTotals = (): Record<Activity, number> => ({
  studying: 0,
  phone: 0,
  distracted: 0,
  away: 0,
  eating: 0,
  sleeping: 0
})
