// Generates realistic-looking past sessions so the Report and History pages look good in a demo.
import type { Activity, EventRecord, ReminderType, Segment, SessionRecord } from './types'

const MIN = 60_000

function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

const SITES: { tag: string; app: string; title: string }[] = [
  { tag: 'YouTube', app: 'chrome', title: 'lofi hip hop radio - YouTube - Google Chrome' },
  { tag: 'YouTube', app: 'chrome', title: 'I tried studying 12 hours a day - YouTube - Google Chrome' },
  { tag: 'Reddit', app: 'chrome', title: 'r/college - Reddit - Google Chrome' },
  { tag: 'Instagram', app: 'chrome', title: 'Instagram - Google Chrome' },
  { tag: 'Discord', app: 'Discord', title: '#general | study-group - Discord' },
  { tag: 'Netflix', app: 'msedge', title: 'Netflix - Microsoft Edge' }
]
const STUDY_WINDOWS: { app: string; title: string }[] = [
  { app: 'chrome', title: 'Canvas - CS 400 Week 9 Notes - Google Chrome' },
  { app: 'Code', title: 'linked_list.py - project3 - Visual Studio Code' },
  { app: 'WINWORD', title: 'Lab Report Draft.docx - Word' },
  { app: 'AcroRd32', title: 'Chapter 7 - Thermodynamics.pdf - Adobe Acrobat' },
  { app: 'chrome', title: 'Quizlet - Organic Chemistry Flashcards - Google Chrome' }
]

type Gen = { session: Omit<SessionRecord, 'id'>; segments: Omit<Segment, 'id' | 'sessionId'>[]; events: Omit<EventRecord, 'id' | 'sessionId'>[] }

export function generateDemoSessions(now = Date.now(), count = 14, seed = 42): Gen[] {
  const r = rng(seed)
  const pick = <T,>(xs: T[]): T => xs[Math.floor(r() * xs.length)]
  const out: Gen[] = []
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  let dayOffset = 0
  for (let i = 0; i < count; i++) {
    dayOffset += r() < 0.75 ? 1 : 2
    if (i === 0) dayOffset = 0 // one session today so the streak is alive
    const day = new Date(today)
    day.setDate(day.getDate() - dayOffset)
    const startHour = pick([10, 13, 14, 15, 16, 19, 20, 21])
    const startedAt = day.getTime() + startHour * 60 * MIN + Math.floor(r() * 50) * MIN
    const lengthMin = 55 + Math.floor(r() * 150)
    // Discipline varies per session; late-night sessions are sloppier.
    const discipline = Math.min(0.92, Math.max(0.45, 0.8 - (startHour >= 20 ? 0.18 : 0) + (r() - 0.5) * 0.3))

    const segments: Gen['segments'] = []
    const events: Gen['events'] = []
    let t = startedAt
    const end = startedAt + lengthMin * MIN
    let lastWater = t
    let sinceStart = 0
    const studyWin = pick(STUDY_WINDOWS)

    const push = (state: Activity, minutes: number, extra: Partial<Segment> = {}): void => {
      const len = Math.max(0.3, minutes) * MIN
      const e = Math.min(end, t + len)
      if (e <= t) return
      segments.push({ state, start: t, end: e, ...extra })
      t = e
    }

    while (t < end) {
      sinceStart = (t - startedAt) / (lengthMin * MIN)
      // Focus runs get shorter as the session wears on.
      const focusLen = (6 + r() * 28) * discipline * (1.15 - sinceStart * 0.5)
      push('studying', focusLen, { app: studyWin.app, title: studyWin.title })
      if (t >= end) break

      const roll = r()
      const fatigue = sinceStart * 0.25
      if (roll < 0.34 + fatigue) {
        push('phone', 0.5 + r() * 4 * (1.3 - discipline))
      } else if (roll < 0.62 + fatigue / 2) {
        const site = pick(SITES)
        push('distracted', 1 + r() * 9 * (1.3 - discipline), { app: site.app, title: site.title, tag: site.tag })
      } else if (roll < 0.74) {
        push('eating', 1 + r() * 4)
        const drank = r() < 0.6
        events.push({ ts: t - 30_000, type: drank ? 'drank' : 'ate' })
        if (drank) lastWater = t
      } else if (roll < 0.94) {
        push('away', 2 + r() * 8)
      } else if (startHour >= 19 && sinceStart > 0.5) {
        push('sleeping', 2 + r() * 8)
      }

      if (t - lastWater > 40 * MIN) {
        const type: ReminderType = 'water'
        events.push({ ts: t, type: 'reminder_fired', reminder: type })
        events.push({ ts: t + 5000, type: r() < 0.65 ? 'reminder_done' : 'reminder_dismissed', reminder: type })
        lastWater = t
      }
      if (r() < 0.12) {
        const type = pick<ReminderType>(['break', 'eye', 'posture'])
        events.push({ ts: t, type: 'reminder_fired', reminder: type })
        events.push({ ts: t + 4000, type: r() < 0.5 ? 'reminder_done' : 'reminder_dismissed', reminder: type })
      }
    }
    out.push({ session: { startedAt, endedAt: t, screenOnly: false }, segments, events })
  }
  return out
}
