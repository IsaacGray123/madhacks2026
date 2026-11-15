import { useEffect, useState } from 'react'
import { fmtDate, fmtDuration, fmtTime } from '@shared/format'
import { toListItem, type SessionListItem } from '@shared/stats'
import type { LiveStatus, NotificationMode, Settings } from '@shared/types'
import type { Route } from '../App'
import { useSettings } from '../lib/hooks'
import { StackBar } from '../components/ui'
import Countdown from '../components/Countdown'
import CameraPreview from '../components/CameraPreview'
import SessionLive from './SessionLive'
import Companion from '../components/Companion'

const BEHAVIOR_LABEL: Record<Settings['windowBehavior'], string> = {
  minimize: 'Minimize to taskbar',
  tray: 'Hide to system tray',
  close: 'Close completely'
}

export default function Home({
  status,
  onOpenReport,
  onNavigate,
  touchStart = false,
  onTouchStartHandled
}: {
  status: LiveStatus | null
  onOpenReport: (id: number) => void
  onNavigate: (r: Route) => void
  /** Start was tapped on the UNO Q touchscreen: run the countdown as if Start were clicked here. */
  touchStart?: boolean
  onTouchStartHandled?: () => void
}): JSX.Element {
  const [settings, save] = useSettings()
  const [last, setLast] = useState<SessionListItem | null | undefined>(undefined)
  const [counting, setCounting] = useState<null | { screenOnly: boolean }>(null)

  const loadLast = (): void => {
    void window.api.listSessions().then((list) => setLast(list[0] ? toListItem(list[0]) : null))
  }
  useEffect(loadLast, [status?.status])

  const idle = status?.status === 'idle'
  useEffect(() => {
    if (!touchStart || !idle || !settings) return
    setCounting({ screenOnly: false })
    onTouchStartHandled?.()
  }, [touchStart, idle, settings, onTouchStartHandled])

  if (status && status.status !== 'idle') return <SessionLive status={status} />
  if (!status || !settings) return <div />

  const dev = status.device
  const mode: 'off' | NotificationMode = settings.notificationsEnabled ? settings.notificationMode : 'off'
  const setMode = (m: 'off' | NotificationMode): void =>
    void save(m === 'off' ? { notificationsEnabled: false } : { notificationsEnabled: true, notificationMode: m })

  // The eye/head/posture baseline is captured when the countdown ends, after the user has spent
  // 3 s looking at their study screen as the countdown asks.
  const begin = (screenOnly: boolean): void => setCounting({ screenOnly })

  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="space-y-8">
      {counting && (
        <Countdown
          onDone={() => {
            if (!counting.screenOnly) void window.api.captureBaseline()
            void window.api.startSession(counting.screenOnly)
            setCounting(null)
          }}
          onCancel={() => {
            setCounting(null)
            void window.api.countdownCanceled()
          }}
          baseline={!counting.screenOnly}
        />
      )}

      <div className="pop-in">
        <p className="text-sm text-ink-faint">{new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{greet}. Ready to study?</h1>
      </div>

      <Companion intro settings={settings.companion} mood="welcome" />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="card pop-in p-7 lg:col-span-3">
          <div className="label-xs mb-4">Pre-flight checklist</div>
          <ul className="space-y-4">
            <Check
              ok={dev.connected}
              title="UNO Q connected"
              detail={dev.connected ? 'Receiving camera data over Wi-Fi.' : `Looking for ${settings.deviceAddress}…`}
              action={!dev.connected ? <button className="text-xs font-medium text-accent hover:underline" onClick={() => onNavigate({ page: 'settings' })}>Device settings</button> : null}
            />
            <Check
              ok={dev.faceDetected}
              pending={!dev.connected}
              title="Camera sees you"
              detail={!dev.connected ? 'Connect the UNO Q first.' : dev.faceDetected ? 'Face detected — you are in frame.' : 'Move into view of the camera.'}
            />
            <li className="flex items-start gap-3">
              <Icon state="info" />
              <div className="flex-1">
                <div className="text-sm font-medium">Look at your study screen when you start</div>
                <div className="text-xs leading-relaxed text-ink-soft">
                  For the best results, sit as you normally study and look at the screen you'll be studying from during the 3-2-1 countdown.
                  StudyLens uses that starting eye position to learn where your screen is and tell whether you're studying or looking away.
                </div>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <Icon state="info" />
              <div className="flex-1">
                <div className="text-sm font-medium">Reminders</div>
                <div className="text-xs text-ink-soft">
                  {mode === 'off'
                    ? 'No popups. The session is still tracked.'
                    : mode === 'pomodoro'
                      ? `Pomodoro: ${settings.pomodoro.work}/${settings.pomodoro.shortBreak} min, plus water & food.`
                      : `Water every ${settings.intervals.water}m, break every ${settings.intervals.break}m, and more.`}
                </div>
              </div>
              <Segmented value={mode} onChange={setMode} options={[['off', 'Off'], ['custom', 'Custom'], ['pomodoro', 'Pomodoro']]} />
            </li>
            <li className="flex items-start gap-3">
              <Icon state="info" />
              <div className="flex-1">
                <div className="text-sm font-medium">While you study</div>
                <div className="text-xs text-ink-soft">
                  {BEHAVIOR_LABEL[settings.windowBehavior]} · Edge bar {settings.edgeBar.enabled ? 'on' : 'off'}
                </div>
              </div>
              <button className="text-xs font-medium text-accent hover:underline" onClick={() => onNavigate({ page: 'settings' })}>
                Change
              </button>
            </li>
          </ul>

          <div className="mt-8 flex flex-col items-center gap-3">
            <button
              className="btn-primary h-14 w-full max-w-sm rounded-2xl text-base shadow-card"
              disabled={!dev.connected}
              onClick={() => begin(false)}
            >
              Start study session
            </button>
            <button className="text-xs text-ink-soft hover:text-ink hover:underline" onClick={() => begin(true)}>
              {dev.connected ? 'Start without the camera (screen-only tracking)' : 'Start anyway with screen-only tracking'}
            </button>
          </div>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <CameraPreview device={dev} enabled={settings.cameraPreview} onToggle={(v) => void save({ cameraPreview: v })} />
          <div className="card pop-in p-7">
            <div className="label-xs mb-4">Last session</div>
            {last === undefined ? null : last ? (
              <button className="block w-full text-left" onClick={() => onOpenReport(last.id)}>
                <div className="text-3xl font-semibold tracking-tight">
                  {fmtDuration(last.focusMs)} <span className="text-base font-normal text-ink-soft">studied</span>
                </div>
                <div className="mt-1 text-sm text-ink-soft">
                  of {fmtDuration(last.totalMs)} · <span className="font-medium text-ink">{last.focusPct}% focus</span>
                </div>
                <div className="mt-5">
                  <StackBar totals={last.totals} />
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-ink-faint">
                  <span>
                    {fmtDate(last.startedAt)} · {fmtTime(last.startedAt)}
                  </span>
                  <span className="font-medium text-accent">View report →</span>
                </div>
              </button>
            ) : (
              <div className="text-sm text-ink-soft">
                No sessions yet. Start one, or{' '}
                <button className="font-medium text-accent hover:underline" onClick={() => void window.api.loadDemoData().then(loadLast)}>
                  load demo data
                </button>{' '}
                to explore the reports.
              </div>
            )}
          </div>
          <div className="card pop-in p-6 text-sm text-ink-soft">
            <div className="label-xs mb-2">Privacy</div>
            Video is analyzed on the UNO Q. The camera preview streams to this laptop only while it's on screen and is never saved. Session history keeps only activity labels like "studying" or "phone".
          </div>
        </div>
      </div>
    </div>
  )
}

function Icon({ state }: { state: 'ok' | 'bad' | 'pending' | 'info' }): JSX.Element {
  const map = {
    ok: ['bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400', '✓'],
    bad: ['bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400', '!'],
    pending: ['bg-paper text-ink-faint', '·'],
    info: ['bg-accent-soft text-accent', '•']
  } as const
  const [cls, ch] = map[state]
  return <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${cls}`}>{ch}</span>
}

function Check({ ok, pending, title, detail, action }: { ok: boolean; pending?: boolean; title: string; detail: string; action?: React.ReactNode }): JSX.Element {
  return (
    <li className="flex items-start gap-3">
      <Icon state={ok ? 'ok' : pending ? 'pending' : 'bad'} />
      <div className="flex-1">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-ink-soft">{detail}</div>
      </div>
      {action}
    </li>
  )
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }): JSX.Element {
  return (
    <div className="inline-flex shrink-0 rounded-lg bg-paper p-0.5">
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${value === v ? 'bg-paper-card text-ink shadow-card' : 'text-ink-soft hover:text-ink'}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
