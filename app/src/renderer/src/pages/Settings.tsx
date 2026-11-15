import { useEffect, useState, type ReactNode } from 'react'
import { DEFAULT_SETTINGS } from '@shared/defaults'
import type { Settings, WindowBehavior } from '@shared/types'
import { useSettings } from '../lib/hooks'
import { Segmented } from './Home'

export default function SettingsPage(): JSX.Element {
  const [s, save] = useSettings()
  if (!s) return <div />

  const iv = (k: keyof Settings['intervals'], v: number): void => void save({ intervals: { ...s.intervals, [k]: v } })
  const pomo = (k: keyof Settings['pomodoro'], v: number): void => void save({ pomodoro: { ...s.pomodoro, [k]: v } })
  const notifOff = !s.notificationsEnabled

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-20">
      <div className="pop-in">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-ink-soft">Changes save automatically and apply to the next session (most apply right away).</p>
      </div>

      <Group title="Notifications">
        <Row label="Reminders" desc="Turn self-care popups on or off. Your session is tracked either way.">
          <Toggle checked={s.notificationsEnabled} onChange={(v) => void save({ notificationsEnabled: v })} />
        </Row>
        <Row label="Reminder style" desc="Custom lets you set each interval. Pomodoro runs 25-minute work blocks with short breaks, plus water and food reminders." disabled={notifOff}>
          <Segmented value={s.notificationMode} onChange={(v) => void save({ notificationMode: v })} options={[['custom', 'Custom'], ['pomodoro', 'Pomodoro']]} />
        </Row>
        <Row label="💧 Water" desc="Reminds you to drink if no drink is detected for this long." disabled={notifOff}>
          <Num value={s.intervals.water} onChange={(v) => iv('water', v)} unit="min" />
        </Row>
        <Row label="🍎 Food" desc="Reminds you to eat if no eating is detected for this long." disabled={notifOff}>
          <Num value={s.intervals.eat} onChange={(v) => iv('eat', v)} unit="min" />
        </Row>
        {s.notificationMode === 'custom' ? (
          <Row label="🧘 Stretch break" desc="After this much continuous sitting. Leaving your desk for 3+ minutes resets it." disabled={notifOff}>
            <Num value={s.intervals.break} onChange={(v) => iv('break', v)} unit="min" />
          </Row>
        ) : (
          <>
            <Row label="🍅 Work block" desc="Length of each Pomodoro focus block." disabled={notifOff}>
              <Num value={s.pomodoro.work} onChange={(v) => pomo('work', v)} unit="min" />
            </Row>
            <Row label="Short break" desc="Break after each work block." disabled={notifOff}>
              <Num value={s.pomodoro.shortBreak} onChange={(v) => pomo('shortBreak', v)} unit="min" />
            </Row>
            <Row label="Long break" desc={`Longer break after every ${s.pomodoro.cyclesBeforeLong} work blocks.`} disabled={notifOff}>
              <Num value={s.pomodoro.longBreak} onChange={(v) => pomo('longBreak', v)} unit="min" />
            </Row>
          </>
        )}
        <Row label="👀 Eye rest (20-20-20)" desc="Every N minutes of screen time, look 20 feet away for 20 seconds." disabled={notifOff}>
          <Num value={s.intervals.eye} onChange={(v) => iv('eye', v)} unit="min" />
        </Row>
        <Row label="🪑 Posture" desc="Alerts when the camera sees you slouching for this long. Waits at least 10 minutes between alerts." disabled={notifOff}>
          <Num value={s.intervals.postureSeconds} onChange={(v) => iv('postureSeconds', v)} unit="sec" />
        </Row>
      </Group>

      <Group title="During a session">
        <Row label="App window" desc="What the StudyLens window does once tracking starts.">
          <div className="flex flex-col gap-2">
            {(
              [
                ['minimize', 'Minimize to taskbar', 'Stays in the taskbar. Click it to see your timer, Pause and Stop.'],
                ['tray', 'Hide to system tray', 'Leaves the taskbar. Right-click the tray icon near the clock to pause or stop.'],
                ['close', 'Close completely', 'Nothing on screen. Use the UNO Q touchscreen or the hotkey to stop.']
              ] as [WindowBehavior, string, string][]
            ).map(([v, label, desc]) => (
              <label key={v} className={`flex cursor-pointer gap-3 rounded-xl border p-3 text-sm transition-colors ${s.windowBehavior === v ? 'border-accent bg-accent-soft/50' : 'border-paper-line hover:bg-paper'}`}>
                <input type="radio" className="mt-0.5 accent-[#0f9d8a]" checked={s.windowBehavior === v} onChange={() => void save({ windowBehavior: v })} />
                <span>
                  <span className="font-medium">{label}</span>
                  {v === 'minimize' && <span className="ml-2 text-[10px] uppercase tracking-wider text-ink-faint">default</span>}
                  <span className="block text-xs text-ink-soft">{desc}</span>
                </span>
              </label>
            ))}
          </div>
        </Row>
        <Row label="Stop hotkey" desc="A global shortcut that ends the session from any app, or opens StudyLens when idle.">
          <TextField value={s.hotkey} onCommit={(v) => void save({ hotkey: v || DEFAULT_SETTINGS.hotkey })} className="w-56 font-mono text-xs" />
        </Row>
      </Group>

      <Group title="On-screen indicator">
        <Row label="Edge bar" desc="A thin strip along the edge of your screen, colored by what you're doing now, with a small timer. Clicks pass through it.">
          <Toggle checked={s.edgeBar.enabled} onChange={(v) => void save({ edgeBar: { ...s.edgeBar, enabled: v } })} />
        </Row>
        <Row label="Position" desc="Top or bottom edge of your main display." disabled={!s.edgeBar.enabled}>
          <Segmented value={s.edgeBar.position} onChange={(v) => void save({ edgeBar: { ...s.edgeBar, position: v } })} options={[['top', 'Top'], ['bottom', 'Bottom']]} />
        </Row>
        <Row label="Opacity" desc="Lower it to make the bar less noticeable." disabled={!s.edgeBar.enabled}>
          <input
            type="range"
            min={0.2}
            max={1}
            step={0.05}
            value={s.edgeBar.opacity}
            onChange={(e) => void save({ edgeBar: { ...s.edgeBar, opacity: Number(e.target.value) } })}
            className="w-40 accent-[#0f9d8a]"
          />
        </Row>
      </Group>

      <Group title="Distraction list">
        <Row label="Distracting apps & sites" desc="If the active window's app or title contains one of these words while you're looking at the screen, that time counts as a screen distraction. Separate entries with commas.">
          <TextArea value={s.distractionKeywords.join(', ')} onCommit={(v) => void save({ distractionKeywords: v.split(',').map((x) => x.trim()).filter(Boolean) })} />
        </Row>
      </Group>

      <Group title="Device">
        <DeviceRow address={s.deviceAddress} onSave={(v) => void save({ deviceAddress: v })} />
      </Group>

      <Group title="Data">
        <Row label="Demo data" desc="Adds two weeks of sample sessions so you can explore Reports and History.">
          <button className="btn-outline" onClick={() => void window.api.loadDemoData()}>
            Load demo data
          </button>
        </Row>
        <Row label="Delete all data" desc="Permanently removes every session from this computer. Settings are kept.">
          <button
            className="btn border border-red-200 bg-white text-red-600 hover:bg-red-50"
            onClick={() => {
              if (confirm('Delete all study sessions? This cannot be undone.')) void window.api.deleteAllData()
            }}
          >
            Delete all
          </button>
        </Row>
      </Group>
    </div>
  )
}

function DeviceRow({ address, onSave }: { address: string; onSave: (v: string) => void }): JSX.Element {
  const [test, setTest] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const [draft, setDraft] = useState(address)
  useEffect(() => setDraft(address), [address])
  return (
    <Row label="UNO Q address" desc="Hostname or IP and port of the board on your Wi-Fi, for example 192.168.1.42:8765. The board shows its IP on the touchscreen.">
      <div className="flex flex-col items-end gap-2">
        <div className="flex gap-2">
          <input className="input w-52 font-mono text-xs" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => draft !== address && onSave(draft.trim())} />
          <button
            className="btn-outline"
            onClick={async () => {
              setTest('testing')
              setTest((await window.api.testConnection(draft.trim())) ? 'ok' : 'fail')
            }}
          >
            Test
          </button>
        </div>
        <span className={`text-xs ${test === 'ok' ? 'text-emerald-600' : test === 'fail' ? 'text-red-600' : 'text-ink-faint'}`}>
          {test === 'testing' ? 'Connecting…' : test === 'ok' ? 'Connected ✓' : test === 'fail' ? 'Could not reach the board.' : ' '}
        </span>
      </div>
    </Row>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <section className="pop-in">
      <div className="label-xs mb-2 px-1">{title}</div>
      <div className="card divide-y divide-paper-line">{children}</div>
    </section>
  )
}

function Row({ label, desc, children, disabled }: { label: string; desc: string; children: ReactNode; disabled?: boolean }): JSX.Element {
  return (
    <div className={`flex items-start justify-between gap-8 p-5 ${disabled ? 'pointer-events-none opacity-40' : ''}`}>
      <div className="max-w-sm">
        <div className="text-sm font-medium">{label}</div>
        <div className="mt-0.5 text-xs leading-relaxed text-ink-soft">{desc}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }): JSX.Element {
  return (
    <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`relative h-6 w-11 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-paper-line'}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}

function Num({ value, onChange, unit }: { value: number; onChange: (v: number) => void; unit: string }): JSX.Element {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])
  const commit = (): void => {
    const n = Math.round(Number(draft))
    if (Number.isFinite(n) && n >= 1) onChange(n)
    else setDraft(String(value))
  }
  return (
    <span className="inline-flex items-center gap-2 text-sm text-ink-soft">
      <input className="input w-20 text-right tabular-nums" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()} inputMode="numeric" />
      {unit}
    </span>
  )
}

function TextField({ value, onCommit, className = '' }: { value: string; onCommit: (v: string) => void; className?: string }): JSX.Element {
  const [d, setD] = useState(value)
  useEffect(() => setD(value), [value])
  return <input className={`input ${className}`} value={d} onChange={(e) => setD(e.target.value)} onBlur={() => d !== value && onCommit(d.trim())} />
}

function TextArea({ value, onCommit }: { value: string; onCommit: (v: string) => void }): JSX.Element {
  const [d, setD] = useState(value)
  useEffect(() => setD(value), [value])
  return <textarea className="input h-28 w-72 resize-none leading-relaxed" value={d} onChange={(e) => setD(e.target.value)} onBlur={() => d !== value && onCommit(d)} />
}
