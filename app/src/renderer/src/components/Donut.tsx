import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { ACTIVITY_META } from '@shared/colors'
import { fmtDuration } from '@shared/format'
import { ACTIVITIES, type Activity } from '@shared/types'

export default function Donut({ totals, focusPct }: { totals: Record<Activity, number>; focusPct: number }): JSX.Element {
  const data = ACTIVITIES.filter((a) => totals[a] > 0).map((a) => ({ key: a, name: ACTIVITY_META[a].label, value: totals[a] }))
  return (
    <div className="relative h-56 w-56 shrink-0">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius="68%" outerRadius="100%" paddingAngle={data.length > 1 ? 2 : 0} stroke="none" startAngle={90} endAngle={-270} isAnimationActive>
            {data.map((d) => (
              <Cell key={d.key} fill={ACTIVITY_META[d.key].color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v: number, n: string) => [fmtDuration(v), n]}
            contentStyle={{ borderRadius: 12, border: '1px solid #e8e8e4', fontSize: 12, boxShadow: '0 4px 16px rgba(16,24,40,.08)' }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-4xl font-semibold tracking-tight">{focusPct}%</div>
        <div className="text-xs text-ink-soft">focused</div>
      </div>
    </div>
  )
}
