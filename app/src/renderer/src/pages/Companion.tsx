import { useState } from 'react'
import { COMPANION_COLORS, type CompanionMood } from '@shared/companion'
import type { CompanionColor } from '@shared/types'
import Companion from '../components/Companion'
import { useSettings } from '../lib/hooks'

const MOODS: CompanionMood[] = ['welcome', 'studying', 'phone', 'distracted', 'away', 'eating', 'sleeping']
export default function CompanionPage(): JSX.Element {
  const [settings, save] = useSettings()
  const [mood, setMood] = useState<CompanionMood>('welcome')
  const [name, setName] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  if (!settings) return <div />
  const buddy = settings.companion
  const update = async (patch: Partial<typeof buddy>): Promise<void> => {
    try { await save({ companion: { ...buddy, ...patch } }); setMessage('Saved. Your buddy is ready.') }
    catch { setMessage('Could not save. Please try again.') }
  }
  return <div className="mx-auto max-w-6xl space-y-7">
    <div><p className="label-xs text-accent">Small buddy. Big encouragement.</p><h1 className="mt-2 text-3xl font-semibold">Meet your companion</h1><p className="mt-2 text-sm text-ink-soft">A little dinosaur to share the quiet work, the resets, and the small wins.</p></div>
    <div className="space-y-7">
      <div><Companion settings={{ ...buddy, name: name?.trim() || buddy.name }} mood={mood} /><div className="px-2 py-5"><p className="label-xs mb-3">Try an expression</p><div className="flex flex-wrap gap-2">{MOODS.map(m => <button key={m} aria-pressed={mood === m} className={`rounded-lg px-3 py-2 text-xs capitalize ${mood === m ? 'bg-accent-soft text-accent' : 'bg-paper text-ink-soft'}`} onClick={() => setMood(m)}>{m === 'welcome' ? 'Say hello' : m}</button>)}</div><p className="mt-3 text-xs text-ink-faint">Preview only. Your session and camera are unaffected.</p></div></div>
      <div className="card space-y-7 p-7">
        <div><label htmlFor="buddy-name" className="text-sm font-medium">What should we call them?</label><p className="mt-1 text-xs text-ink-soft">Their name appears on the app and the little board screen.</p><form className="mt-3 flex gap-2" onSubmit={e => { e.preventDefault(); void update({ name: name ?? buddy.name }).then(() => setName(null)) }}><input id="buddy-name" className="input min-w-0 flex-1" maxLength={18} value={name ?? buddy.name} onChange={e => setName(e.target.value)} placeholder="Moss" /><button className="btn-primary" type="submit">Save name</button></form></div>
        <fieldset><legend className="text-sm font-medium">A color to grow with</legend><p className="mt-1 text-xs text-ink-soft">Your companion and the app accents share a palette.</p><div className="mt-4 grid grid-cols-2 gap-3">{(Object.keys(COMPANION_COLORS) as CompanionColor[]).map(color => <button key={color} type="button" aria-pressed={buddy.color === color} className={`flex items-center gap-3 rounded-xl border p-3 text-sm ${buddy.color === color ? 'border-accent bg-accent-soft' : 'border-paper-line'}`} onClick={() => void update({ color })}><span className="h-6 w-6 rounded-full border border-ink/10" style={{ background: COMPANION_COLORS[color].body }} />{COMPANION_COLORS[color].label}</button>)}</div></fieldset>
        <label className="flex items-center justify-between gap-4 text-sm"><span>Little reading glasses<span className="mt-1 block text-xs text-ink-soft">A studious touch, just like your sketch.</span></span><input type="checkbox" checked={buddy.glasses} onChange={e => void update({ glasses: e.target.checked })} className="h-5 w-5 accent-[rgb(var(--accent))]" /></label>
        <p className="text-xs text-ink-soft" role="status">{message || 'No scores to feed and no streaks to lose. Just a little company.'}</p>
      </div>
    </div>
  </div>
}
