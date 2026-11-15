import type { ReactNode } from 'react'
import { ACTIVITY_META } from '@shared/colors'
import type { Activity } from '@shared/types'

export function Dot({ color, className = '' }: { color: string; className?: string }): JSX.Element {
  return <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${className}`} style={{ background: color }} />
}

export function ActivityPill({ activity, size = 'md' }: { activity: Activity; size?: 'sm' | 'md' | 'lg' }): JSX.Element {
  const m = ACTIVITY_META[activity]
  const cls = size === 'lg' ? 'px-4 py-1.5 text-base' : size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full bg-[var(--pill)] font-medium dark:bg-[var(--pill-dark)] ${cls}`}
      style={{ ['--pill' as string]: m.soft, ['--pill-dark' as string]: `${m.color}2e`, color: m.color }}
    >
      <Dot color={m.color} />
      {m.label}
    </span>
  )
}

export function StatCard({ label, value, sub, icon }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode }): JSX.Element {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <span className="label-xs">{label}</span>
        {icon && <span className="text-lg opacity-70">{icon}</span>}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      {sub && <div className="mt-1 text-xs text-ink-soft">{sub}</div>}
    </div>
  )
}

/** Horizontal stacked bar of activity totals. */
export function StackBar({ totals, height = 10 }: { totals: Record<Activity, number>; height?: number }): JSX.Element {
  const sum = Object.values(totals).reduce((a, b) => a + b, 0)
  return (
    <div className="flex w-full overflow-hidden rounded-full bg-paper" style={{ height }}>
      {sum > 0 &&
        (Object.keys(totals) as Activity[]).map((k) =>
          totals[k] > 0 ? <div key={k} style={{ width: `${(totals[k] / sum) * 100}%`, background: ACTIVITY_META[k].color }} /> : null
        )}
    </div>
  )
}

export function Section({ title, subtitle, children, right }: { title: string; subtitle?: string; children: ReactNode; right?: ReactNode }): JSX.Element {
  return (
    <section className="pop-in">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="text-sm text-ink-soft">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  )
}
