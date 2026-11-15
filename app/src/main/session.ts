// Owns the study session: the single source of truth for status, segments and reminders.
import { EventEmitter } from 'events'
import { powerMonitor } from 'electron'
import { REMINDER_COPY } from '@shared/colors'
import { fuse } from '@shared/fusion'
import { ReminderEngine } from '@shared/reminders'
import type { VisionMsg } from '@shared/protocol'
import {
  emptyTotals,
  type Activity,
  type CameraState,
  type DeviceStatus,
  type LiveStatus,
  type ReminderPayload,
  type ReminderType,
  type Segment,
  type SessionStatus,
  type Settings
} from '@shared/types'
import * as db from './db'
import type { DeviceLink } from './deviceLink'
import type { WindowWatcher } from './windowWatcher'

const VISION_STALE_MS = 5000
/** Screen-only mode: no keyboard/mouse for this long counts as away. */
const IDLE_AWAY_SECONDS = 180

export declare interface SessionManager {
  on(event: 'status', fn: (s: LiveStatus) => void): this
  on(event: 'reminder', fn: (r: ReminderPayload) => void): this
  on(event: 'started', fn: (id: number) => void): this
  on(event: 'ended', fn: (id: number) => void): this
  on(event: 'reminder-cleared', fn: (type: ReminderType) => void): this
  on(event: 'touch-start', fn: () => void): this
}

export class SessionManager extends EventEmitter {
  private status: SessionStatus = 'idle'
  private sessionId: number | null = null
  private startedAt: number | null = null
  private screenOnly = false
  private activeMs = 0
  private lastTick = 0
  private seg: Segment | null = null
  private totals = emptyTotals()
  private engine: ReminderEngine
  private timer: NodeJS.Timeout | null = null
  private vision: VisionMsg | null = null
  private lastCurrent: Activity | null = null
  private activeReminder: ReminderType | null = null

  constructor(
    private settings: Settings,
    private device: DeviceLink,
    private watcher: WindowWatcher
  ) {
    super()
    this.engine = new ReminderEngine(settings)
    device.on('message', (m) => {
      if (m.type === 'vision') this.vision = m
      else if (m.type === 'event') this.onDetected(m.event)
      else if (m.type === 'touch') this.onTouch(m.action, m.reminder)
    })
    device.on('status', (connected) => {
      // A (re)connected board needs to know what screen to show.
      if (connected) this.device.send({ type: 'session', status: this.status })
      this.emitStatus()
    })
    // Keep the idle status (device checklist) fresh even before a session starts.
    setInterval(() => this.status === 'idle' && this.emitStatus(), 1000)
  }

  updateSettings(s: Settings): void {
    this.settings = s
    this.engine.updateSettings(s)
  }

  get isActive(): boolean {
    return this.status !== 'idle'
  }

  start(screenOnly = false): void {
    if (this.status !== 'idle') return
    const now = Date.now()
    const s = db.createSession(now, screenOnly)
    this.sessionId = s.id
    this.startedAt = now
    this.screenOnly = screenOnly
    this.activeMs = 0
    this.lastTick = now
    this.totals = emptyTotals()
    this.seg = null
    this.lastCurrent = null
    this.engine = new ReminderEngine(this.settings)
    this.status = 'running'
    this.watcher.start()
    this.timer = setInterval(() => this.tick(), 1000)
    this.device.send({ type: 'session', status: 'running' })
    this.emit('started', s.id)
    this.tick()
  }

  pause(): void {
    if (this.status !== 'running' || this.sessionId === null) return
    this.tick()
    this.closeSegment()
    this.status = 'paused'
    db.addEvent(this.sessionId, 'pause', Date.now())
    this.device.send({ type: 'session', status: 'paused' })
    this.emitStatus()
  }

  resume(): void {
    if (this.status !== 'paused' || this.sessionId === null) return
    this.status = 'running'
    this.lastTick = Date.now()
    db.addEvent(this.sessionId, 'resume', Date.now())
    this.device.send({ type: 'session', status: 'running' })
    this.emitStatus()
  }

  togglePause(): void {
    if (this.status === 'running') this.pause()
    else if (this.status === 'paused') this.resume()
  }

  stop(): number | null {
    if (this.status === 'idle' || this.sessionId === null) return null
    if (this.status === 'running') this.tick()
    this.closeSegment()
    const id = this.sessionId
    db.endSession(id, Date.now())
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.watcher.stop()
    this.status = 'idle'
    this.sessionId = null
    this.startedAt = null
    this.activeReminder = null
    this.device.send({ type: 'session', status: 'idle' })
    this.emitStatus()
    this.emit('ended', id)
    return id
  }

  /** Called by the popup window or the TFT. */
  reminderAction(type: ReminderType, action: 'done' | 'dismiss'): void {
    if (this.sessionId === null) return
    if (action === 'done') this.engine.done(type, this.activeMs)
    db.addEvent(this.sessionId, action === 'done' ? 'reminder_done' : 'reminder_dismissed', Date.now(), type)
    if (this.activeReminder === type) this.activeReminder = null
    this.device.send({ type: 'reminder_clear' })
    this.emit('reminder-cleared', type)
  }

  // ---------------------------------------------------------------------------

  private cameraState(): CameraState {
    const fresh = this.vision && Date.now() - this.vision.ts < VISION_STALE_MS && this.device.connected
    if (!this.screenOnly && fresh) return this.vision!.state
    // Fallback (screen-only or device dropped): keyboard/mouse idle time as presence.
    return powerMonitor.getSystemIdleTime() >= IDLE_AWAY_SECONDS ? 'away' : 'present'
  }

  private tick(): void {
    if (this.status !== 'running' || this.sessionId === null) return
    const now = Date.now()
    const dt = Math.max(0, now - this.lastTick)
    this.lastTick = now
    this.activeMs += dt

    const win = this.watcher.current
    const { activity, tag } = fuse(this.cameraState(), win, this.settings.distractionKeywords)

    // Extend or start a segment.
    if (this.seg && this.seg.state === activity && this.seg.tag === tag) {
      this.totals[activity] += now - this.seg.end
      this.seg.end = now
      db.touch()
    } else {
      if (this.seg) {
        this.totals[this.seg.state] += now - this.seg.end
        this.seg.end = now
      }
      this.seg = db.addSegment({
        sessionId: this.sessionId,
        state: activity,
        start: now,
        end: now,
        ...(win ? { app: win.app, title: win.title } : {}),
        ...(tag ? { tag } : {})
      })
    }
    this.lastCurrent = activity

    const slouch = this.vision && !this.screenOnly ? this.vision.slouch : null
    for (const r of this.engine.tick(this.activeMs, activity, slouch)) this.fire(r)
    this.emitStatus()
  }

  private closeSegment(): void {
    if (this.seg) {
      const now = Date.now()
      this.totals[this.seg.state] += now - this.seg.end
      this.seg.end = now
      db.touch()
    }
    this.seg = null
  }

  private fire(type: ReminderType): void {
    if (this.sessionId === null) return
    const copy = REMINDER_COPY[type]
    let message = copy.message
    if (type === 'pomodoro_break') message = `Work block done. Take a ${this.engine.pomodoroBreakMinutes}-minute break.`
    const payload: ReminderPayload = { type, title: copy.title, message }
    db.addEvent(this.sessionId, 'reminder_fired', Date.now(), type)
    this.activeReminder = type
    this.device.send({ type: 'reminder', reminder: type, title: payload.title, message })
    this.emit('reminder', payload)
  }

  private onDetected(kind: 'drank' | 'ate'): void {
    if (this.status !== 'running' || this.sessionId === null) return
    this.engine.onDetected(kind, this.activeMs)
    db.addEvent(this.sessionId, kind, Date.now())
  }

  private onTouch(action: string, reminder?: ReminderType): void {
    switch (action) {
      case 'start':
        if (this.status === 'idle') this.emit('touch-start')
        else this.resume()
        break
      case 'pause':
        this.pause()
        break
      case 'resume':
        this.resume()
        break
      case 'stop':
        this.stop()
        break
      case 'reminder_done':
      case 'reminder_dismiss': {
        const type = reminder ?? this.activeReminder
        if (type) this.reminderAction(type, action === 'reminder_done' ? 'done' : 'dismiss')
        break
      }
    }
  }

  deviceStatus(): DeviceStatus {
    const fresh = !!this.vision && Date.now() - this.vision.ts < VISION_STALE_MS
    return {
      connected: this.device.connected,
      faceDetected: this.device.connected && fresh && this.vision!.face,
      cameraState: this.device.connected && fresh ? this.vision!.state : null,
      lastSeen: this.vision?.ts ?? null
    }
  }

  getStatus(): LiveStatus {
    const total = Object.values(this.totals).reduce((a, b) => a + b, 0)
    return {
      status: this.status,
      sessionId: this.sessionId,
      startedAt: this.startedAt,
      elapsedMs: this.activeMs,
      current: this.status === 'idle' ? null : this.lastCurrent,
      totals: { ...this.totals },
      focusPct: total ? Math.round((this.totals.studying / total) * 100) : 0,
      timers: this.status === 'idle' ? { water: null, eat: null, break: null, eye: null } : this.engine.timers(this.activeMs),
      pomodoroPhase: this.status === 'idle' ? null : this.engine.pomodoroPhase,
      device: this.deviceStatus(),
      window: this.watcher.current
    }
  }

  private emitStatus(): void {
    const s = this.getStatus()
    this.emit('status', s)
    if (s.status !== 'idle') {
      this.device.send({
        type: 'stats',
        status: s.status,
        elapsedMs: s.elapsedMs,
        current: s.current,
        focusPct: s.focusPct,
        totals: s.totals,
        timers: s.timers
      })
    }
  }
}
