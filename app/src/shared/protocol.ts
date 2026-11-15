// WebSocket contract between the UNO Q (server, port 8765) and the laptop app (client).
// Mirrored in board/python/protocol.py — keep the two in sync.

import type { Activity, CameraState, ReminderType, SessionStatus, TimerKey } from './types'

export const PROTOCOL_VERSION = 1
export const DEFAULT_PORT = 8765

// ---------- board → laptop ----------
export interface HelloMsg {
  type: 'hello'
  device: string
  version: number
}
export interface VisionMsg {
  type: 'vision'
  ts: number
  state: CameraState
  conf: number
  face: boolean
  /** 0 = baseline posture, 1 = badly slouched; null if pose not visible. */
  slouch: number | null
}
export interface BoardEventMsg {
  type: 'event'
  ts: number
  event: 'drank' | 'ate'
}
export interface TouchMsg {
  type: 'touch'
  action: 'start' | 'pause' | 'resume' | 'stop' | 'reminder_done' | 'reminder_dismiss'
  reminder?: ReminderType
}
/** Live camera preview frame; sent only to clients that asked with `preview {on:true}`. */
export interface FrameMsg {
  type: 'frame'
  ts: number
  /** Base64-encoded JPEG (about 320×240). */
  jpeg: string
}
export type BoardMessage = HelloMsg | VisionMsg | BoardEventMsg | TouchMsg | FrameMsg

// ---------- laptop → board ----------
export interface SessionMsg {
  type: 'session'
  status: SessionStatus
}
export interface StatsMsg {
  type: 'stats'
  status: SessionStatus
  elapsedMs: number
  current: Activity | null
  focusPct: number
  totals: Record<Activity, number>
  timers: Record<TimerKey, number | null>
}
export interface ReminderMsg {
  type: 'reminder'
  reminder: ReminderType
  title: string
  message: string
}
export interface ReminderClearMsg {
  type: 'reminder_clear'
}
export interface BaselineMsg {
  type: 'baseline'
}
/** Start/stop the live camera preview stream for this connection. */
export interface PreviewMsg {
  type: 'preview'
  on: boolean
}
export type LaptopMessage = SessionMsg | StatsMsg | ReminderMsg | ReminderClearMsg | BaselineMsg | PreviewMsg

const BOARD_TYPES = new Set(['hello', 'vision', 'event', 'touch', 'frame'])

export function parseBoardMessage(raw: string): BoardMessage | null {
  try {
    const msg = JSON.parse(raw)
    if (msg && typeof msg === 'object' && BOARD_TYPES.has(msg.type)) return msg as BoardMessage
  } catch {
    /* ignore malformed frames */
  }
  return null
}
