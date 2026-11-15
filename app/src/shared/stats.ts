import { ACTIVITY_META } from './colors'
import { fmtDuration, fmtTime } from './format'
import { ACTIVITIES, emptyTotals, type Activity, type EventRecord, type Segment, type SessionDetail } from './types'

const MIN = 60_000

export interface Run {
  state: Activity
  start: number
  end: number
  tag?: string
}

export interface SessionSummary {
  totalMs: number
  totals: Record<Activity, number>
  focusMs: number
  focusPct: number
  longestStreak: Run | null
  phonePickups: number
  distractions: number
  topDistractions: { label: string; ms: number; activity: Activity }[]
  reminders: { fired: number; done: number; dismissed: number }
  drinks: number
  meals: number
  insights: string[]
}

/** Merge back-to-back segments with the same state (gaps under 3s) into runs. */
export function toRuns(segments: Segment[]): Run[] {
  const sorted = [...segments].sort((a, b) => a.start - b.start)
  const runs: Run[] = []
  for (const s of sorted) {
    const last = runs[runs.length - 1]
    if (last && last.state === s.state && s.start - last.end < 3000) {
      last.end = Math.max(last.end, s.end)
    } else {
      runs.push({ state: s.state, start: s.start, end: s.end, tag: s.tag })
    }
  }
  return runs
}

const dur = (r: { start: number; end: number }): number => Math.max(0, r.end - r.start)

export function summarize(segments: Segment[], events: EventRecord[]): SessionSummary {
  const totals = emptyTotals()
  for (const s of segments) totals[s.state] += dur(s)
  const totalMs = ACTIVITIES.reduce((a, k) => a + totals[k], 0)
  const focusMs = totals.studying
  const focusPct = totalMs ? Math.round((focusMs / totalMs) * 100) : 0

  const runs = toRuns(segments)
  let longestStreak: Run | null = null
  for (const r of runs) if (r.state === 'studying' && (!longestStreak || dur(r) > dur(longestStreak))) longestStreak = r

  const phoneRuns = runs.filter((r) => r.state === 'phone')
  const distractionRuns = runs.filter((r) => r.state === 'phone' || r.state === 'distracted')

  const byLabel = new Map<string, { ms: number; activity: Activity }>()
  for (const s of segments) {
    if (s.state !== 'phone' && s.state !== 'distracted') continue
    const label = s.state === 'phone' ? 'Phone' : s.tag || s.app || 'Other sites'
    const cur = byLabel.get(label) ?? { ms: 0, activity: s.state }
    cur.ms += dur(s)
    byLabel.set(label, cur)
  }
  const topDistractions = [...byLabel.entries()]
    .map(([label, v]) => ({ label, ...v }))
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 5)

  const count = (t: EventRecord['type']): number => events.filter((e) => e.type === t).length
  const reminders = { fired: count('reminder_fired'), done: count('reminder_done'), dismissed: count('reminder_dismissed') }

  const summary: SessionSummary = {
    totalMs,
    totals,
    focusMs,
    focusPct,
    longestStreak,
    phonePickups: phoneRuns.length,
    distractions: distractionRuns.length,
    topDistractions,
    reminders,
    drinks: count('drank'),
    meals: count('ate'),
    insights: []
  }
  summary.insights = buildInsights(summary, runs, segments)
  return summary
}

function buildInsights(s: SessionSummary, runs: Run[], segments: Segment[]): string[] {
  const out: string[] = []
  if (!s.totalMs || !runs.length) return out
  const distractRuns = runs.filter((r) => r.state === 'phone' || r.state === 'distracted')

  // Where in the session distractions cluster (by active time position).
  if (distractRuns.length >= 3) {
    const activeOffset = activeOffsets(segments)
    const thirds = [0, 0, 0]
    for (const r of distractRuns) {
      const pos = activeOffset(r.start) / s.totalMs
      thirds[Math.min(2, Math.floor(pos * 3))] += dur(r)
    }
    const max = Math.max(...thirds)
    const idx = thirds.indexOf(max)
    const share = Math.round((max / thirds.reduce((a, b) => a + b, 0)) * 100)
    if (share >= 45) {
      const when = ['in the first third', 'in the middle', 'in the final third'][idx]
      const mark = idx === 0 ? '' : ` (after the ${fmtDuration((s.totalMs * idx) / 3)} mark)`
      out.push(`${share}% of your distraction time happened ${when} of the session${mark}.`)
    }
  }

  // Typical focus run before a distraction.
  const studyRuns = runs.filter((r) => r.state === 'studying' && dur(r) >= MIN)
  if (studyRuns.length >= 2) {
    const sorted = studyRuns.map(dur).sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    out.push(`You usually stayed focused for about ${fmtDuration(median)} before switching to something else.`)
  }

  if (s.longestStreak && dur(s.longestStreak) >= 5 * MIN) {
    out.push(`Your best stretch was ${fmtDuration(dur(s.longestStreak))} of focus, starting at ${fmtTime(s.longestStreak.start)}.`)
  }

  const top = s.topDistractions[0]
  if (top && top.ms >= MIN) {
    out.push(`${top.label} took ${fmtDuration(top.ms)}, which is ${Math.round((top.ms / s.totalMs) * 100)}% of your session.`)
  }

  const hours = s.totalMs / (60 * MIN)
  if (s.phonePickups >= 3 && hours >= 0.5) {
    out.push(`You picked up your phone ${s.phonePickups} times, about ${(s.phonePickups / hours).toFixed(1)} times per hour.`)
  }

  if (hours >= 1 && s.drinks === 0) out.push(`No drinks were detected in ${fmtDuration(s.totalMs)}. Keep a water bottle on your desk.`)
  else if (s.drinks > 0) out.push(`You drank water ${s.drinks} time${s.drinks === 1 ? '' : 's'}.`)

  if (s.totals.sleeping >= 2 * MIN) {
    out.push(`You dozed off for ${fmtDuration(s.totals.sleeping)}. Studying earlier in the day might help.`)
  }

  if (s.focusPct >= 75) out.push(`Great session: ${s.focusPct}% of your time was real studying.`)
  return out
}

/** Maps a wall-clock timestamp to "active ms since session start" (pauses excluded). */
function activeOffsets(segments: Segment[]): (ts: number) => number {
  const sorted = [...segments].sort((a, b) => a.start - b.start)
  return (ts: number) => {
    let acc = 0
    for (const s of sorted) {
      if (ts >= s.end) acc += dur(s)
      else {
        if (ts > s.start) acc += ts - s.start
        break
      }
    }
    return acc
  }
}

// ---------- History ----------

export interface SessionListItem {
  id: number
  startedAt: number
  endedAt: number | null
  totalMs: number
  focusMs: number
  focusPct: number
  totals: Record<Activity, number>
}

export function toListItem(d: SessionDetail): SessionListItem {
  const totals = emptyTotals()
  for (const s of d.segments) totals[s.state] += dur(s)
  const totalMs = ACTIVITIES.reduce((a, k) => a + totals[k], 0)
  return {
    id: d.session.id,
    startedAt: d.session.startedAt,
    endedAt: d.session.endedAt,
    totalMs,
    focusMs: totals.studying,
    focusPct: totalMs ? Math.round((totals.studying / totalMs) * 100) : 0,
    totals
  }
}

export const dayKey = (ts: number): string => {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function startOfWeek(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  const dow = (d.getDay() + 6) % 7 // Monday = 0
  d.setDate(d.getDate() - dow)
  return d.getTime()
}

export function weekBuckets(items: SessionListItem[], weekStart: number): { day: string; date: number; focusMin: number; otherMin: number }[] {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d.getTime()
  })
  return days.map((date) => {
    const key = dayKey(date)
    const mine = items.filter((it) => dayKey(it.startedAt) === key)
    const focus = mine.reduce((a, it) => a + it.focusMs, 0)
    const total = mine.reduce((a, it) => a + it.totalMs, 0)
    return {
      day: new Date(date).toLocaleDateString([], { weekday: 'short' }),
      date,
      focusMin: Math.round(focus / MIN),
      otherMin: Math.round((total - focus) / MIN)
    }
  })
}

export interface Trends {
  avgFocusPct: number
  totalFocusMs: number
  dayStreak: number
  bestHour: number | null
  topDistraction: { activity: Activity; label: string } | null
}

export function computeTrends(items: SessionListItem[], now = Date.now()): Trends {
  const totalMs = items.reduce((a, it) => a + it.totalMs, 0)
  const totalFocusMs = items.reduce((a, it) => a + it.focusMs, 0)
  const avgFocusPct = totalMs ? Math.round((totalFocusMs / totalMs) * 100) : 0

  const days = new Set(items.map((it) => dayKey(it.startedAt)))
  let dayStreak = 0
  const d = new Date(now)
  if (!days.has(dayKey(d.getTime()))) d.setDate(d.getDate() - 1) // streak survives until end of today
  while (days.has(dayKey(d.getTime()))) {
    dayStreak++
    d.setDate(d.getDate() - 1)
  }

  // Best starting hour by focus %, ignoring hours with < 30 min of data.
  const byHour = new Map<number, { f: number; t: number }>()
  for (const it of items) {
    const h = new Date(it.startedAt).getHours()
    const cur = byHour.get(h) ?? { f: 0, t: 0 }
    cur.f += it.focusMs
    cur.t += it.totalMs
    byHour.set(h, cur)
  }
  let bestHour: number | null = null
  let bestPct = -1
  for (const [h, v] of byHour) {
    if (v.t < 30 * MIN) continue
    const pct = v.f / v.t
    if (pct > bestPct) {
      bestPct = pct
      bestHour = h
    }
  }

  const distractTotals = emptyTotals()
  for (const it of items) for (const k of ACTIVITIES) distractTotals[k] += it.totals[k]
  const candidates: Activity[] = ['phone', 'distracted', 'away', 'sleeping']
  const top = candidates.sort((a, b) => distractTotals[b] - distractTotals[a])[0]
  const topDistraction = distractTotals[top] > 0 ? { activity: top, label: ACTIVITY_META[top].label } : null

  return { avgFocusPct, totalFocusMs, dayStreak, bestHour, topDistraction }
}
