import type { Activity, ReminderType, Settings, TimerKey } from './types'

const MIN = 60_000
const BREAK_RESET_AWAY_MS = 3 * MIN
const EYE_RESET_AWAY_MS = 20_000
const POSTURE_COOLDOWN_MS = 10 * MIN
const SLOUCH_THRESHOLD = 0.35

/**
 * Pure reminder engine. Time `t` is the session's *active* clock (ms, paused time excluded),
 * so pausing a session freezes every timer for free.
 *
 * Reminders fire once: firing resets that timer, so the next one comes a full interval later.
 * Done also resets it; dismiss only logs.
 */
export class ReminderEngine {
  private lastWater = 0
  private lastEat = 0
  private presenceStart = 0
  private awaySince: number | null = null
  private eyeStart = 0
  private slouchSince: number | null = null
  private lastPostureAlert = -Infinity
  private pomoPhase: 'work' | 'break' = 'work'
  private pomoPhaseStart = 0
  private pomoCycle = 0

  constructor(private settings: Settings) {}

  updateSettings(s: Settings): void {
    this.settings = s
  }

  get enabled(): boolean {
    return this.settings.notificationsEnabled
  }

  get pomodoroPhase(): 'work' | 'break' | null {
    return this.enabled && this.settings.notificationMode === 'pomodoro' ? this.pomoPhase : null
  }

  /** Break length (min) of the current pomodoro break, used in the reminder copy. */
  get pomodoroBreakMinutes(): number {
    const p = this.settings.pomodoro
    return this.pomoCycle > 0 && this.pomoCycle % p.cyclesBeforeLong === 0 ? p.longBreak : p.shortBreak
  }

  /** Feed one tick. Returns reminders that should fire now. */
  tick(t: number, activity: Activity | null, slouch: number | null): ReminderType[] {
    const fired: ReminderType[] = []
    const away = activity === 'away' || activity === 'sleeping'

    // Away tracking resets presence-based timers.
    if (away) {
      this.awaySince ??= t
      if (t - this.awaySince >= BREAK_RESET_AWAY_MS) this.presenceStart = t
      if (t - this.awaySince >= EYE_RESET_AWAY_MS) this.eyeStart = t
    } else {
      this.awaySince = null
    }
    if (!this.enabled) return fired
    const iv = this.settings.intervals

    if (t - this.lastWater >= iv.water * MIN) {
      fired.push('water')
      this.lastWater = t
    }
    if (t - this.lastEat >= iv.eat * MIN) {
      fired.push('eat')
      this.lastEat = t
    }

    if (this.settings.notificationMode === 'pomodoro') {
      const p = this.settings.pomodoro
      if (this.pomoPhase === 'work' && t - this.pomoPhaseStart >= p.work * MIN) {
        this.pomoCycle++
        this.pomoPhase = 'break'
        this.pomoPhaseStart = t
        this.presenceStart = t
        fired.push('pomodoro_break')
      } else if (this.pomoPhase === 'break' && t - this.pomoPhaseStart >= this.pomodoroBreakMinutes * MIN) {
        this.pomoPhase = 'work'
        this.pomoPhaseStart = t
        fired.push('pomodoro_work')
      }
    } else if (!away && t - this.presenceStart >= iv.break * MIN) {
      fired.push('break')
      this.presenceStart = t
    }

    if (!away && t - this.eyeStart >= iv.eye * MIN) {
      fired.push('eye')
      this.eyeStart = t
    }

    if (slouch !== null && slouch > SLOUCH_THRESHOLD && !away) {
      this.slouchSince ??= t
      if (t - this.slouchSince >= iv.postureSeconds * 1000 && t - this.lastPostureAlert >= POSTURE_COOLDOWN_MS) {
        fired.push('posture')
        this.lastPostureAlert = t
        this.slouchSince = null
      }
    } else {
      this.slouchSince = null
    }

    return fired
  }

  /** Detected drink/meal from the camera. */
  onDetected(kind: 'drank' | 'ate', t: number): void {
    if (kind === 'drank') this.lastWater = t
    else this.lastEat = t
  }

  /** User tapped Done on a reminder. */
  done(type: ReminderType, t: number): void {
    switch (type) {
      case 'water':
        this.lastWater = t
        break
      case 'eat':
        this.lastEat = t
        break
      case 'break':
        this.presenceStart = t
        break
      case 'eye':
        this.eyeStart = t
        break
      case 'posture':
        this.slouchSince = null
        break
      default:
        break
    }
  }

  /** Ms remaining on each countdown (null = off). */
  timers(t: number): Record<TimerKey, number | null> {
    if (!this.enabled) return { water: null, eat: null, break: null, eye: null }
    const iv = this.settings.intervals
    const left = (since: number, minutes: number): number => Math.max(0, since + minutes * MIN - t)
    let brk: number
    if (this.settings.notificationMode === 'pomodoro') {
      const len = this.pomoPhase === 'work' ? this.settings.pomodoro.work : this.pomodoroBreakMinutes
      brk = left(this.pomoPhaseStart, len)
    } else {
      brk = left(this.presenceStart, iv.break)
    }
    return {
      water: left(this.lastWater, iv.water),
      eat: left(this.lastEat, iv.eat),
      break: brk,
      eye: left(this.eyeStart, iv.eye)
    }
  }
}
