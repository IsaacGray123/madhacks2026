import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from './defaults'
import { ReminderEngine } from './reminders'
import type { Activity, ReminderType, Settings } from './types'

const MIN = 60_000
const cfg = (patch: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...patch })

/** Run the engine second-by-second and collect what fired at which minute. */
function run(e: ReminderEngine, fromMs: number, toMs: number, activity: (t: number) => Activity = () => 'studying', slouch: number | null = null) {
  const fired: { t: number; r: ReminderType }[] = []
  for (let t = fromMs; t <= toMs; t += 1000) for (const r of e.tick(t, activity(t), slouch)) fired.push({ t, r })
  return fired
}

describe('ReminderEngine', () => {
  it('fires water once per interval', () => {
    const e = new ReminderEngine(cfg())
    const water = run(e, 0, 90 * MIN).filter((f) => f.r === 'water')
    expect(water.map((f) => f.t / MIN)).toEqual([40, 80])
  })

  it('a detected drink resets the water timer', () => {
    const e = new ReminderEngine(cfg())
    run(e, 0, 30 * MIN)
    e.onDetected('drank', 30 * MIN)
    const water = run(e, 30 * MIN + 1000, 75 * MIN).filter((f) => f.r === 'water')
    expect(water.map((f) => f.t / MIN)).toEqual([70])
  })

  it('Done resets the timer', () => {
    const e = new ReminderEngine(cfg())
    run(e, 0, 10 * MIN)
    e.done('water', 10 * MIN)
    expect(e.timers(10 * MIN).water).toBe(40 * MIN)
  })

  it('stretch break fires after continuous presence and resets after 3+ min away', () => {
    const e = new ReminderEngine(cfg())
    // 50 min studying, 4 min away, then studying — next break 60 min after returning (54 min)
    const act = (t: number): Activity => (t >= 50 * MIN && t < 54 * MIN ? 'away' : 'studying')
    const br = run(e, 0, 120 * MIN, act).filter((f) => f.r === 'break')
    expect(br.map((f) => Math.round(f.t / MIN))).toEqual([114])
  })

  it('does nothing when notifications are off', () => {
    const e = new ReminderEngine(cfg({ notificationsEnabled: false }))
    expect(run(e, 0, 200 * MIN)).toEqual([])
    expect(e.timers(0).water).toBeNull()
  })

  it('pomodoro alternates work and break, with a long break every 4 cycles', () => {
    const e = new ReminderEngine(cfg({ notificationMode: 'pomodoro', intervals: { ...DEFAULT_SETTINGS.intervals, water: 999, eat: 999, eye: 999 } }))
    const pomo = run(e, 0, 140 * MIN).filter((f) => f.r.startsWith('pomodoro')).map((f) => `${f.r === 'pomodoro_break' ? 'B' : 'W'}${f.t / MIN}`)
    // 25w/5b x3, 4th work ends at 115 → 15-min long break → back at 130
    expect(pomo).toEqual(['B25', 'W30', 'B55', 'W60', 'B85', 'W90', 'B115', 'W130'])
    expect(run(e, 140 * MIN + 1000, 150 * MIN).some((f) => f.r === 'break')).toBe(false)
  })

  it('posture alerts after sustained slouching, with a cooldown', () => {
    const e = new ReminderEngine(cfg({ intervals: { ...DEFAULT_SETTINGS.intervals, water: 999, eat: 999, eye: 999, break: 999 } }))
    const p = run(e, 0, 15 * MIN, () => 'studying', 0.8).filter((f) => f.r === 'posture')
    expect(p.map((f) => f.t / 1000)).toEqual([60, 660])
  })
})
