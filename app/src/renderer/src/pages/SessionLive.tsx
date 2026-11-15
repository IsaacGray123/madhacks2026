import { ACTIVITY_META } from '@shared/colors'
import { fmtClock, fmtDuration } from '@shared/format'
import { ACTIVITIES, type LiveStatus, type TimerKey } from '@shared/types'
import { ActivityPill, Dot, StackBar } from '../components/ui'
import CameraPreview from '../components/CameraPreview'
import Companion from '../components/Companion'
import { companionMood } from '@shared/companion'
import { useSettings } from '../lib/hooks'

const TIMER_LABEL: Record<TimerKey, string> = { water: '💧 Water', eat: '🍎 Food', break: '🧘 Break', eye: '👀 Eye rest' }

export default function SessionLive({ status }: { status: LiveStatus }): JSX.Element {
  const [settings, save] = useSettings()
  const showCamera = !!settings?.cameraPreview
  const paused = status.status === 'paused'
  const timerKeys = (Object.keys(status.timers) as TimerKey[]).filter((k) => status.timers[k] !== null)
  const breakLabel = status.pomodoroPhase === 'break' ? '🍅 Back to work' : status.pomodoroPhase === 'work' ? '🍅 Pomodoro' : TIMER_LABEL.break

  return (
    <div className={`mx-auto space-y-6 ${showCamera ? 'max-w-5xl' : 'max-w-3xl'}`}>
      <div className={showCamera ? 'grid gap-6 md:grid-cols-5' : ''}>
        <div className={`card pop-in flex flex-col justify-center p-6 text-center ${showCamera ? 'md:col-span-3' : ''}`}>
          <div className="label-xs">{paused ? 'Paused' : 'Session in progress'}</div>
          <div className={`mt-3 font-semibold tabular-nums tracking-tight ${paused ? 'text-ink-faint' : ''}`} style={{ fontSize: '3.25rem', lineHeight: 1 }}>
            {fmtClock(status.elapsedMs)}
          </div>
          <div className="mt-5 flex items-center justify-center gap-3">
            {status.current && !paused && <ActivityPill activity={status.current} size="lg" />}
            <span className="text-sm text-ink-soft">
              <span className="font-semibold text-ink">{status.focusPct}%</span> focus so far
            </span>
          </div>
          {status.window && !paused && <div className="mx-auto mt-3 max-w-md truncate text-xs text-ink-faint">On screen: {status.window.title || status.window.app}</div>}
          {settings && <Companion compact settings={settings.companion} mood={companionMood(status.status, status.current, !status.device.connected || (status.device.lastSeen !== null && Date.now() - status.device.lastSeen < 5000))} />}
          <div className="mt-4 flex justify-center gap-3">
            <button className="btn-outline w-32" onClick={() => void (paused ? window.api.resumeSession() : window.api.pauseSession())}>
              {paused ? 'Resume' : 'Pause'}
            </button>
            <button className="btn-primary w-40" onClick={() => void window.api.stopSession()}>
              End session
            </button>
          </div>
        </div>
        {showCamera && <CameraPreview className="md:col-span-2" device={status.device} enabled onToggle={(v) => void save({ cameraPreview: v })} />}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="card pop-in p-6">
          <div className="label-xs mb-4">Where your time is going</div>
          <StackBar totals={status.totals} height={12} />
          <ul className="mt-4 space-y-2">
            {ACTIVITIES.map((a) => (
              <li key={a} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Dot color={ACTIVITY_META[a].color} />
                  {ACTIVITY_META[a].label}
                </span>
                <span className="tabular-nums text-ink-soft">{fmtClock(status.totals[a])}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card pop-in p-6">
          <div className="label-xs mb-4">Next reminders</div>
          {timerKeys.length === 0 ? (
            <p className="text-sm text-ink-soft">Reminders are off for this session.</p>
          ) : (
            <ul className="space-y-3">
              {timerKeys.map((k) => (
                <li key={k} className="flex items-center justify-between text-sm">
                  <span>{k === 'break' ? breakLabel : TIMER_LABEL[k]}</span>
                  <span className="tabular-nums text-ink-soft">in {fmtDuration(status.timers[k]!)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-6 text-xs text-ink-faint">You can also pause or stop the session from the UNO Q touchscreen or with the global hotkey.</p>
          {settings && !showCamera && (
            <button className="mt-3 text-xs font-medium text-accent hover:underline" onClick={() => void save({ cameraPreview: true })}>
              Show camera preview
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
