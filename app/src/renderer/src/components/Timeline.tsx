import { useEffect, useMemo, useRef, useState } from 'react'
import { ACTIVITY_META } from '@shared/colors'
import { fmtDuration, fmtTime } from '@shared/format'
import { ACTIVITIES, type Activity, type Segment } from '@shared/types'

interface Block {
  seg: Segment
  left: number // % of active time
  width: number
}

/**
 * Color-coded session timeline laid out on *active* time, so pauses don't leave holes.
 * Hover shows details; click opens a relabel menu.
 */
export default function Timeline({ segments, onRelabel }: { segments: Segment[]; onRelabel: (seg: Segment, state: Activity) => void }): JSX.Element {
  const [hover, setHover] = useState<{ b: Block; x: number } | null>(null)
  const [menu, setMenu] = useState<{ b: Block; x: number } | null>(null)
  const wrap = useRef<HTMLDivElement>(null)

  const { blocks, ticks } = useMemo(() => {
    const segs = segments.filter((s) => s.end > s.start)
    const total = segs.reduce((a, s) => a + (s.end - s.start), 0) || 1
    let acc = 0
    const blocks: Block[] = segs.map((seg) => {
      const b = { seg, left: (acc / total) * 100, width: ((seg.end - seg.start) / total) * 100 }
      acc += seg.end - seg.start
      return b
    })
    // ~6 time ticks mapped back to wall-clock times.
    const ticks: { pct: number; label: string }[] = []
    for (let i = 0; i <= 5; i++) {
      const pct = (i / 5) * 100
      const b = blocks.find((x) => pct >= x.left && pct <= x.left + x.width) ?? blocks[blocks.length - 1]
      if (!b) break
      const frac = b.width ? (pct - b.left) / b.width : 0
      const label = fmtTime(b.seg.start + frac * (b.seg.end - b.seg.start))
      if (ticks[ticks.length - 1]?.label !== label) ticks.push({ pct, label })
    }
    return { blocks, ticks }
  }, [segments])

  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent): void => {
      if (!(e.target as HTMLElement).closest('[data-relabel-menu]')) setMenu(null)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [menu])

  const xOf = (e: React.MouseEvent): number => {
    const r = wrap.current!.getBoundingClientRect()
    return Math.min(Math.max(e.clientX - r.left, 120), r.width - 120)
  }

  return (
    <div ref={wrap} className="relative select-none">
      <div className="flex h-14 w-full overflow-hidden rounded-xl bg-paper" onMouseLeave={() => setHover(null)}>
        {blocks.map((b) => (
          <div
            key={b.seg.id}
            className="h-full cursor-pointer transition-[filter] hover:brightness-110"
            style={{
              width: `${b.width}%`,
              background: ACTIVITY_META[b.seg.state].color,
              backgroundImage: b.seg.originalState ? 'repeating-linear-gradient(45deg, rgba(255,255,255,.28) 0 4px, transparent 4px 9px)' : undefined
            }}
            onMouseMove={(e) => setHover({ b, x: xOf(e) })}
            onClick={(e) => {
              setMenu({ b, x: xOf(e) })
              setHover(null)
            }}
          />
        ))}
      </div>
      <div className="relative mt-2 h-4 text-[11px] text-ink-faint">
        {ticks.map((t, i) => (
          <span key={i} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${t.pct}%`, transform: i === 0 ? 'none' : i === ticks.length - 1 ? 'translateX(-100%)' : undefined }}>
            {t.label}
          </span>
        ))}
      </div>

      {hover && !menu && (
        <div className="pointer-events-none absolute bottom-full z-10 mb-2 w-60 -translate-x-1/2 rounded-xl border border-paper-line bg-white p-3 text-xs shadow-card" style={{ left: hover.x }}>
          <div className="flex items-center gap-2 font-semibold" style={{ color: ACTIVITY_META[hover.b.seg.state].color }}>
            {ACTIVITY_META[hover.b.seg.state].label}
            {hover.b.seg.tag && <span className="font-normal text-ink-soft">· {hover.b.seg.tag}</span>}
          </div>
          <div className="mt-1 text-ink-soft">
            {fmtTime(hover.b.seg.start)} – {fmtTime(hover.b.seg.end)} · {fmtDuration(hover.b.seg.end - hover.b.seg.start)}
          </div>
          {hover.b.seg.title && <div className="mt-1 truncate text-ink-faint">{hover.b.seg.title}</div>}
          {hover.b.seg.originalState && <div className="mt-1 text-ink-faint">Relabeled from {ACTIVITY_META[hover.b.seg.originalState].label}</div>}
          <div className="mt-2 text-[10px] uppercase tracking-wider text-accent">Click to relabel</div>
        </div>
      )}

      {menu && (
        <div data-relabel-menu className="absolute bottom-full z-20 mb-2 w-56 -translate-x-1/2 rounded-xl border border-paper-line bg-white p-1.5 shadow-card pop-in" style={{ left: menu.x }}>
          <div className="px-2.5 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Actually, I was…</div>
          {ACTIVITIES.map((a) => (
            <button
              key={a}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-paper ${menu.b.seg.state === a ? 'font-semibold' : ''}`}
              onClick={() => {
                onRelabel(menu.b.seg, a)
                setMenu(null)
              }}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: ACTIVITY_META[a].color }} />
              {ACTIVITY_META[a].label}
              {menu.b.seg.state === a && <span className="ml-auto text-xs text-ink-faint">current</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
