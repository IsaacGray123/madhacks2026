import { describe, expect, it } from 'vitest'
import { generateDemoSessions } from './demo'
import { computeTrends, summarize, toListItem, toRuns } from './stats'
import type { Activity, Segment } from './types'

const MIN = 60_000
let id = 1
const seg = (state: Activity, startMin: number, endMin: number, tag?: string): Segment => ({
  id: id++, sessionId: 1, state, start: startMin * MIN, end: endMin * MIN, ...(tag ? { tag } : {})
})

describe('summarize', () => {
  const segments = [
    seg('studying', 0, 20),
    seg('studying', 20, 30), // contiguous → one 30-min streak
    seg('phone', 30, 33),
    seg('studying', 33, 50),
    seg('distracted', 50, 60, 'YouTube'),
    seg('phone', 60, 62),
    seg('away', 62, 70)
  ]
  const s = summarize(segments, [{ id: 1, sessionId: 1, ts: 0, type: 'drank' }])

  it('totals and focus %', () => {
    expect(s.totalMs).toBe(70 * MIN)
    expect(s.focusMs).toBe(47 * MIN)
    expect(s.focusPct).toBe(67)
  })
  it('merges adjacent segments for streaks and pickups', () => {
    expect(toRuns(segments)).toHaveLength(6)
    expect(s.longestStreak!.end - s.longestStreak!.start).toBe(30 * MIN)
    expect(s.phonePickups).toBe(2)
    expect(s.distractions).toBe(3)
  })
  it('ranks distractions', () => {
    expect(s.topDistractions[0]).toMatchObject({ label: 'YouTube', ms: 10 * MIN })
    expect(s.topDistractions[1]).toMatchObject({ label: 'Phone', ms: 5 * MIN })
  })
  it('produces insights', () => {
    expect(s.insights.length).toBeGreaterThan(2)
    expect(s.insights.join(' ')).toContain('YouTube took 10m')
  })
})

describe('demo data + trends', () => {
  it('generates sessions that summarize cleanly', () => {
    const now = new Date(2026, 10, 14, 22, 0).getTime()
    const demo = generateDemoSessions(now, 14, 7)
    expect(demo).toHaveLength(14)
    const items = demo.map((d, i) =>
      toListItem({
        session: { ...d.session, id: i + 1 },
        segments: d.segments.map((s, j) => ({ ...s, id: j, sessionId: i + 1 })),
        events: []
      })
    )
    for (const it of items) {
      expect(it.totalMs).toBeGreaterThan(30 * MIN)
      expect(it.focusPct).toBeGreaterThan(10)
      expect(it.focusPct).toBeLessThan(100)
    }
    const t = computeTrends(items, now)
    expect(t.dayStreak).toBeGreaterThanOrEqual(1)
    expect(t.bestHour).not.toBeNull()
  })
})
