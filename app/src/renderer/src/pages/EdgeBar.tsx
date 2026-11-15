import { useEffect, useState } from 'react'
import { ACTIVITY_META } from '@shared/colors'
import { fmtClock } from '@shared/format'
import type { Settings } from '@shared/types'
import { useStatus } from '../lib/hooks'

/** Thin click-through strip on the screen edge, colored by the current activity. */
export default function EdgeBar(): JSX.Element {
  const status = useStatus()
  const [pos, setPos] = useState<Settings['edgeBar']['position']>('top')
  useEffect(() => {
    void window.api.getSettings().then((s) => setPos(s.edgeBar.position))
  }, [status?.status])

  if (!status || status.status === 'idle') return <div />
  const paused = status.status === 'paused'
  const meta = status.current ? ACTIVITY_META[status.current] : null
  const color = paused || !meta ? '#9aa5b1' : meta.color

  return (
    <div className={`flex h-full w-full ${pos === 'top' ? 'flex-col' : 'flex-col-reverse'}`}>
      <div
        className="h-1 w-full transition-colors duration-700"
        style={{
          background: color,
          backgroundImage: paused ? 'repeating-linear-gradient(90deg, rgba(255,255,255,.5) 0 10px, transparent 10px 20px)' : undefined
        }}
      />
      <div className={`flex justify-end pr-3 ${pos === 'top' ? '' : 'items-end'}`}>
        <span
          className="rounded-b-md px-2 py-[1px] text-[11px] font-semibold tabular-nums text-white transition-colors duration-700"
          style={{ background: color, borderRadius: pos === 'top' ? '0 0 6px 6px' : '6px 6px 0 0' }}
        >
          {paused ? 'Paused' : meta?.label} · {fmtClock(status.elapsedMs)}
        </span>
      </div>
    </div>
  )
}
