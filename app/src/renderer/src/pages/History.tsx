import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ACTIVITY_META } from '@shared/colors'
import { fmtDate, fmtDuration, fmtTime } from '@shared/format'
import { computeTrends, startOfWeek, toListItem, weekBuckets, type SessionListItem } from '@shared/stats'
import { Section, StackBar, StatCard } from '../components/ui'
import { useChartColors } from '../lib/hooks'

const WEEK = 7 * 24 * 3600 * 1000

export default function History({ onOpen }: { onOpen: (id: number) => void }): JSX.Element {
  const [items, setItems] = useState<SessionListItem[] | null>(null)
  const [weekStart, setWeekStart] = useState(() => startOfWeek(Date.now()))
  const chart = useChartColors()

  const load = (): void => void window.api.listSessions().then((l) => setItems(l.map(toListItem)))
  useEffect(load, [])

  const week = useMemo(() => (items ? weekBuckets(items, weekStart) : []), [items, weekStart])
  const trends = useMemo(() => (items ? computeTrends(items) : null), [items])
  const weekFocus = week.reduce((a, d) => a + d.focusMin, 0)
  // Whole-hour gridlines (half hours for light weeks).
  const yTicks = useMemo(() => {
    const max = Math.max(60, ...week.map((d) => d.focusMin + d.otherMin))
    const step = max <= 120 ? 30 : 60
    return Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => i * step)
  }, [week])
  const weekItems = (items ?? []).filter((it) => it.startedAt >= weekStart && it.startedAt < weekStart + WEEK)
  const weekTotal = weekItems.reduce((a, it) => a + it.totalMs, 0)
  const weekPct = weekTotal ? Math.round((weekItems.reduce((a, it) => a + it.focusMs, 0) / weekTotal) * 100) : 0

  if (!items) return <div />
  if (items.length === 0)
    return (
      <div className="card mx-auto mt-10 max-w-lg p-10 text-center">
        <h2 className="text-xl font-semibold">No study sessions yet</h2>
        <p className="mt-2 text-sm text-ink-soft">Finish a session to see your trends here, or load sample data to explore.</p>
        <button className="btn-primary mt-6" onClick={() => void window.api.loadDemoData().then(load)}>
          Load demo data
        </button>
      </div>
    )

  const thisWeek = startOfWeek(Date.now())
  const weekLabel =
    weekStart === thisWeek
      ? 'This week'
      : weekStart === thisWeek - WEEK
        ? 'Last week'
        : `Week of ${new Date(weekStart).toLocaleDateString([], { month: 'short', day: 'numeric' })}`

  return (
    <div className="space-y-10 pb-16">
      <div className="pop-in">
        <h1 className="text-3xl font-semibold tracking-tight">History</h1>
        <p className="mt-1 text-sm text-ink-soft">How your real study time adds up over time.</p>
      </div>

      <Section
        title={weekLabel}
        subtitle={`${fmtDuration(weekFocus * 60_000)} focused · ${weekPct}% focus`}
        right={
          <div className="flex gap-1">
            <button className="btn-outline px-3" onClick={() => setWeekStart(weekStart - WEEK)} aria-label="Previous week">
              ←
            </button>
            <button className="btn-outline px-3" disabled={weekStart >= thisWeek} onClick={() => setWeekStart(weekStart + WEEK)} aria-label="Next week">
              →
            </button>
          </div>
        }
      >
        <div className="card h-72 p-6">
          <ResponsiveContainer>
            <BarChart data={week} barCategoryGap="28%">
              <CartesianGrid vertical={false} stroke={chart.grid} />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: chart.tick, fontSize: 12 }} />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: chart.tick, fontSize: 12 }}
                width={44}
                ticks={yTicks}
                domain={[0, yTicks[yTicks.length - 1]]}
                tickFormatter={(v: number) => (v % 60 ? `${Math.floor(v / 60)}h30` : `${v / 60}h`)}
              />
              <Tooltip
                cursor={{ fill: 'rgba(15,157,138,.06)' }}
                formatter={(v: number, n: string) => [fmtDuration(v * 60_000), n === 'focusMin' ? 'Focused' : 'Other']}
                contentStyle={chart.tooltip}
                labelStyle={{ color: chart.tooltip.color }}
              />
              <Bar dataKey="focusMin" stackId="a" fill={ACTIVITY_META.studying.color} radius={[0, 0, 4, 4]} />
              <Bar dataKey="otherMin" stackId="a" fill={chart.muted} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>

      {trends && (
        <Section title="Trends & streaks" subtitle={`Across all ${items.length} sessions`}>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Average focus" icon="📈" value={`${trends.avgFocusPct}%`} sub={`${fmtDuration(trends.totalFocusMs)} total studied`} />
            <StatCard label="Day streak" icon="🔥" value={`${trends.dayStreak} day${trends.dayStreak === 1 ? '' : 's'}`} sub="Days in a row with a session" />
            <StatCard
              label="Best time"
              icon="⏰"
              value={trends.bestHour === null ? '—' : fmtTime(new Date().setHours(trends.bestHour, 0, 0, 0))}
              sub="Start time with the highest focus"
            />
            <StatCard
              label="Biggest drain"
              icon="🌀"
              value={<span style={{ color: trends.topDistraction ? ACTIVITY_META[trends.topDistraction.activity].color : undefined }}>{trends.topDistraction?.label ?? '—'}</span>}
              sub="Where non-study time goes most"
            />
          </div>
        </Section>
      )}

      <Section title="Sessions">
        <div className="space-y-3">
          {items.map((it) => (
            <button key={it.id} onClick={() => onOpen(it.id)} className="card flex w-full items-center gap-6 p-5 text-left transition-shadow hover:shadow-lg">
              <div className="w-40 shrink-0">
                <div className="text-sm font-medium">{fmtDate(it.startedAt)}</div>
                <div className="text-xs text-ink-faint">
                  {fmtTime(it.startedAt)} · {fmtDuration(it.totalMs)}
                </div>
              </div>
              <div className="flex-1">
                <StackBar totals={it.totals} />
              </div>
              <div className="w-28 shrink-0 text-right">
                <div className="text-lg font-semibold">{it.focusPct}%</div>
                <div className="text-xs text-ink-faint">{fmtDuration(it.focusMs)} focused</div>
              </div>
              <span className="text-ink-faint">›</span>
            </button>
          ))}
        </div>
      </Section>
    </div>
  )
}
