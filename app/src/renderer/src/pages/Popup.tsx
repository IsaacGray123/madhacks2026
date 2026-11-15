import { useEffect, useRef, useState } from 'react'
import { REMINDER_COPY } from '@shared/colors'
import type { ReminderPayload } from '@shared/types'

const AUTO_HIDE_MS = 15_000

/** Custom reminder popup (frameless window, bottom-right). Fades out on its own after 15s. */
export default function Popup(): JSX.Element {
  const [r, setR] = useState<ReminderPayload | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [nonce, setNonce] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(
    () =>
      window.api.onReminder((p) => {
        setR(p)
        setLeaving(false)
        setNonce((n) => n + 1)
      }),
    []
  )

  const act = (action: 'done' | 'dismiss'): void => {
    if (!r) return
    clearTimeout(timer.current)
    setLeaving(true)
    setTimeout(() => {
      void window.api.reminderAction(r.type, action)
      setR(null)
    }, 220)
  }

  useEffect(() => {
    if (!r) return
    clearTimeout(timer.current)
    timer.current = setTimeout(() => act('dismiss'), AUTO_HIDE_MS)
    return () => clearTimeout(timer.current)
  }, [nonce])

  if (!r) return <div />
  const icon = REMINDER_COPY[r.type].icon
  const doneLabel = r.type === 'pomodoro_work' ? "I'm back" : r.type === 'pomodoro_break' || r.type === 'break' ? 'Taking it' : 'Done'

  return (
    <div className="flex h-full items-end justify-end p-2">
      <div
        key={nonce}
        className={`relative w-full overflow-hidden rounded-2xl border border-paper-line bg-paper-card shadow-[0_8px_30px_rgba(16,24,40,.16)] transition-all duration-200 ${leaving ? 'translate-y-2 opacity-0' : 'pop-in'}`}
      >
        <div className="flex gap-3 p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-2xl">{icon}</div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-ink">{r.title}</div>
              <span className="text-[10px] font-medium uppercase tracking-wider text-ink-faint">StudyLens</span>
            </div>
            <div className="mt-0.5 text-xs leading-snug text-ink-soft">{r.message}</div>
            <div className="mt-3 flex gap-2">
              <button className="btn-primary h-8 px-4 text-xs" onClick={() => act('done')}>
                {doneLabel}
              </button>
              <button className="btn-ghost h-8 px-3 text-xs" onClick={() => act('dismiss')}>
                Dismiss
              </button>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 h-0.5 w-full origin-left bg-accent/60" style={{ animation: `shrink ${AUTO_HIDE_MS}ms linear forwards` }} />
      </div>
    </div>
  )
}
