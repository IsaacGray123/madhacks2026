import { useCallback, useEffect, useMemo, useState } from 'react'
import { ACTIVITY_META } from '@shared/colors'
import { fmtDate, fmtDuration, fmtTime } from '@shared/format'
import { summarize } from '@shared/stats'
import { ACTIVITIES, type Activity, type Segment, type SessionDetail } from '@shared/types'
import Donut from '../components/Donut'
import Timeline from '../components/Timeline'
import { Dot, Section, StatCard } from '../components/ui'

export default function Report({ id, onBack }: { id: number; onBack: () => void }): JSX.Element {
  const [detail, setDetail] = useState<SessionDetail | null | undefined>(undefined)
  const reload = useCallback(() => void window.api.getSession(id).then(setDetail), [id])
  useEffect(reload, [reload])

  const summary = useMemo(() => (detail ? summarize(detail.segments, detail.events) : null), [detail])

  if (detail === undefined) return <div />
  if (!detail || !summary) return <div className="text-ink-soft">Session not found.</div>

  const relabel = async (seg: Segment, state: Activity): Promise<void> => {
    if (seg.state === state) return
    await window.api.relabelSegment(seg.id, state)
    reload()
  }

  const { session } = detail
  const s = summary
  const topMax = s.topDistractions[0]?.ms ?? 1
  const relabeledCount = detail.segments.filter((x) => x.originalState).length

  return (
    <div className="space-y-10 pb-16">
      <div>
        <button className="btn-ghost -ml-3 mb-4 px-3" onClick={onBack}>
          ← All sessions
        </button>
        <p className="text-sm text-ink-faint">
          {fmtDate(session.startedAt)} · {fmtTime(session.startedAt)} – {session.endedAt ? fmtTime(session.endedAt) : 'now'}
          {session.screenOnly && ' · screen-only'}
        </p>
        <h1 className="pop-in mt-2 text-4xl font-semibold leading-tight tracking-tight">
          You studied <span style={{ color: ACTIVITY_META.studying.color }}>{fmtDuration(s.focusMs)}</span>
          <span className="text-ink-soft"> of {fmtDuration(s.totalMs)}</span>
        </h1>
        <p className="mt-2 text-lg text-ink-soft">
          That's <span className="font-semibold text-ink">{s.focusPct}%</span> of your session.{' '}
          {s.focusPct >= 75 ? 'Excellent focus.' : s.focusPct >= 55 ? 'Solid, with room to tighten up.' : 'A lot of the time went somewhere else.'}
        </p>
      </div>

      {/* Donut + stat cards */}
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="card pop-in flex flex-col items-center gap-6 p-7 sm:flex-row lg:col-span-3">
          <Donut totals={s.totals} focusPct={s.focusPct} />
          <ul className="w-full space-y-2.5">
            {ACTIVITIES.filter((a) => s.totals[a] > 0).map((a) => (
              <li key={a} className="flex items-center gap-3 text-sm">
                <Dot color={ACTIVITY_META[a].color} />
                <span className="flex-1">{ACTIVITY_META[a].label}</span>
                <span className="tabular-nums font-medium">{fmtDuration(s.totals[a])}</span>
                <span className="w-10 text-right tabular-nums text-ink-faint">{Math.round((s.totals[a] / s.totalMs) * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:col-span-2">
          <StatCard
            label="Longest focus"
            icon="🎯"
            value={s.longestStreak ? fmtDuration(s.longestStreak.end - s.longestStreak.start) : '—'}
            sub={s.longestStreak ? `from ${fmtTime(s.longestStreak.start)}` : 'No focus streak yet'}
          />
          <StatCard label="Phone pickups" icon="📱" value={s.phonePickups} sub={`${fmtDuration(s.totals.phone)} on your phone`} />
          <StatCard label="Distractions" icon="🌀" value={s.distractions} sub={`${fmtDuration(s.totals.phone + s.totals.distracted)} off task`} />
          <StatCard
            label="Reminders"
            icon="🔔"
            value={
              <>
                {s.reminders.done}
                <span className="text-base font-normal text-ink-faint"> / {s.reminders.fired}</span>
              </>
            }
            sub={`done · ${s.reminders.dismissed} dismissed`}
          />
        </div>
      </div>

      <Section
        title="Timeline"
        subtitle="Hover to see what was on screen. Click a block to fix a wrong label."
        right={relabeledCount ? <span className="text-xs text-ink-faint">{relabeledCount} relabeled (striped)</span> : null}
      >
        <div className="card p-6 pt-14">
          <Timeline segments={detail.segments} onRelabel={(seg, st) => void relabel(seg, st)} />
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
            {ACTIVITIES.map((a) => (
              <span key={a} className="flex items-center gap-1.5 text-xs text-ink-soft">
                <Dot color={ACTIVITY_META[a].color} />
                {ACTIVITY_META[a].label}
              </span>
            ))}
          </div>
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Section title="Insights">
            <div className="card divide-y divide-paper-line">
              {s.insights.length === 0 && <p className="p-5 text-sm text-ink-soft">Study a little longer to unlock insights.</p>}
              {s.insights.map((t, i) => (
                <div key={i} className="flex gap-3 p-5 text-sm leading-relaxed">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  {t}
                </div>
              ))}
            </div>
          </Section>
        </div>
        <div className="lg:col-span-2">
          <Section title="Top distractions">
            <div className="card space-y-4 p-6">
              {s.topDistractions.length === 0 && <p className="text-sm text-ink-soft">No distractions detected. 🎉</p>}
              {s.topDistractions.map((d) => (
                <div key={d.label}>
                  <div className="mb-1.5 flex justify-between text-sm">
                    <span className="font-medium">{d.label}</span>
                    <span className="tabular-nums text-ink-soft">{fmtDuration(d.ms)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-paper">
                    <div className="h-full rounded-full" style={{ width: `${(d.ms / topMax) * 100}%`, background: ACTIVITY_META[d.activity].color }} />
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          className="text-xs text-ink-faint hover:text-red-600"
          onClick={async () => {
            if (confirm('Delete this session permanently?')) {
              await window.api.deleteSession(id)
              onBack()
            }
          }}
        >
          Delete this session
        </button>
      </div>
    </div>
  )
}
