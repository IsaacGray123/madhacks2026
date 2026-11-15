import { useEffect, useRef, useState } from 'react'

export default function Countdown({ onDone, onCancel, baseline }: { onDone: () => void; onCancel: () => void; baseline: boolean }): JSX.Element {
  const [n, setN] = useState(3)
  // Parent re-renders every second (live status), so keep the callback out of the effect deps.
  const done = useRef(onDone)
  done.current = onDone
  useEffect(() => {
    if (n === 0) {
      done.current()
      return
    }
    const t = setTimeout(() => setN(n - 1), 1000)
    return () => clearTimeout(t)
  }, [n])

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-paper/95 backdrop-blur">
      <div key={n} className="count-pop text-[9rem] font-semibold leading-none tracking-tighter text-accent">
        {n || '•'}
      </div>
      <p className="mt-6 text-lg font-medium">{baseline ? 'Sit naturally. Capturing your posture baseline.' : 'Starting screen-only tracking…'}</p>
      <p className="mt-1 text-sm text-ink-soft">The app gets out of your way once the session starts.</p>
      <button className="btn-ghost mt-8" onClick={onCancel}>
        Cancel
      </button>
    </div>
  )
}
