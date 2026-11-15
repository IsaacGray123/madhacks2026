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
      {baseline ? (
        <>
          <p className="mt-6 text-lg font-medium">Look at the screen you'll be studying from.</p>
          <p className="mt-2 max-w-md text-center text-sm leading-relaxed text-ink-soft">
            Sit the way you normally study and keep your eyes on that screen until the countdown ends. StudyLens uses this starting eye and
            head position to learn where your screen is, so it can tell when you're studying and when you look away. It also sets your posture
            baseline.
          </p>
        </>
      ) : (
        <>
          <p className="mt-6 text-lg font-medium">Starting screen-only tracking…</p>
          <p className="mt-1 text-sm text-ink-soft">The app gets out of your way once the session starts.</p>
        </>
      )}
      <button className="btn-ghost mt-8" onClick={onCancel}>
        Cancel
      </button>
    </div>
  )
}
