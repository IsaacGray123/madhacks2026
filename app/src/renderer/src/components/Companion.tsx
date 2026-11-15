import { useEffect, useState, type CSSProperties } from 'react'
import { COMPANION_COLORS, MOOD_COPY, type CompanionMood } from '@shared/companion'
import type { CompanionSettings } from '@shared/types'

/** Vector pieces stay crisp on desktop and mirror the small pixel sprite on the board. */
export function Dino({ settings, mood }: { settings: CompanionSettings; mood: CompanionMood }): JSX.Element {
  const colors = COMPANION_COLORS[settings.color]
  const sleepy = mood === 'sleeping' || mood === 'paused'
  return <svg className="dino" viewBox="0 0 160 160" role="img" aria-label={`${settings.name}, ${mood}`} style={{ '--dino-body': colors.body, '--dino-spine': colors.spine, '--dino-belly': colors.belly } as CSSProperties}>
    <g stroke="#354532" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
      <g className="dino-tail"><path d="M101 100 Q121 123 149 117 Q145 139 99 132Z" fill="var(--dino-body)" />
        <path d="M117 111 l2 -12 11 14 M135 117 l4 -10 7 11" fill="var(--dino-spine)" /></g>
      <path d="M83 32 l9 -13 10 18 10 -5 2 18 12 3 -7 18 11 10 -13 12 9 13 -19 8" fill="var(--dino-spine)" />
      <path d="M91 31 Q72 24 48 37 Q31 44 32 62 Q33 76 59 78 L61 88 Q43 109 55 129 Q68 146 99 135 Q114 131 112 113 L105 62 Q107 38 91 31Z" fill="var(--dino-body)" />
      <path d="M66 86 Q52 114 69 129 Q79 136 91 127 Q82 107 83 85" fill="var(--dino-belly)" stroke="none" />
      <g className="dino-foot back"><path d="M85 123 Q82 137 88 142 L109 142 Q114 130 99 128" fill="var(--dino-body)" /></g>
      <g className="dino-foot front"><path d="M61 123 Q55 133 59 142 L81 142 Q86 130 72 129" fill="var(--dino-body)" /></g>
      <g className="dino-face">
        {sleepy ? <path d="M49 55 q5 5 10 0 M76 55 q5 5 10 0" fill="none" /> : <g className="dino-eyes" fill="#354532" stroke="none"><ellipse cx="54" cy="55" rx="3" ry="4.5" /><ellipse cx="80" cy="55" rx="3" ry="4.5" /></g>}
        {settings.glasses && <g fill="none" strokeWidth="2"><rect x="43" y="46" width="22" height="18" rx="6" /><rect x="69" y="46" width="22" height="18" rx="6" /><path d="M65 52 h4 M91 51 l11 -4" /></g>}
        <path d={mood === 'away' || mood === 'phone' ? 'M61 71 q5 -4 10 0' : 'M61 68 q5 5 10 0'} fill="none" strokeWidth="2" />
        <g stroke="none" fill="#e99b89" opacity=".65"><ellipse cx="45" cy="68" rx="5" ry="2.5" /><ellipse cx="87" cy="68" rx="5" ry="2.5" /></g>
      </g>
      <g className="dino-arm"><path d="M86 89 Q74 96 69 105 Q75 111 83 103 L94 94" fill="var(--dino-body)" /></g>
      <g className="dino-wave"><path d="M56 90 Q40 86 39 72 Q34 68 31 75 Q29 94 49 103" fill="var(--dino-body)" /></g>
      <g className="dino-book"><path d="M40 103 l22 4 22 -4 v24 l-22 5 -22 -5Z" fill="var(--dino-spine)" /><path d="M62 107 v25 M46 111 l10 2 M69 113 l9 -2" stroke="var(--dino-belly)" strokeWidth="2" /></g>
      <path className="dino-tear" d="M88 65 q-8 10 0 10 q8 0 0 -10" fill="#92cbdd" stroke="none" />
      <g className="dino-snack"><path d="M41 103 q3 -12 17 -4 l-3 17 -17 -3Z" fill="#e9bc6b" /><path d="M46 104 h1 M50 110 h1" /></g>
    </g>
    <text className="dino-zzz" x="112" y="40" fill="var(--dino-spine)" fontSize="18" fontFamily="monospace">z z</text>
  </svg>
}

export default function Companion({ settings, mood, compact = false }: { settings: CompanionSettings; mood: CompanionMood; compact?: boolean }): JSX.Element {
  const [arrival, setArrival] = useState(mood === 'welcome')
  useEffect(() => { if (mood !== 'welcome') return; setArrival(true); const t = setTimeout(() => setArrival(false), 4000); return () => clearTimeout(t) }, [mood])
  return <section className={`companion-stage ${compact ? 'companion-compact' : ''}`} aria-label={`${settings.name}, your study companion`} data-mood={mood} data-arrival={arrival}>
    <div className="companion-caption"><span className="label-xs">Your study buddy</span><span className="companion-name">{settings.name}</span></div>
    <div className="companion-meadow" aria-hidden="true">
      <span className="meadow-sun" /><span className="meadow-cloud cloud-one" /><span className="meadow-cloud cloud-two" />
      <span className="meadow-grass grass-one" /><span className="meadow-grass grass-two" />
      <div className="companion-walk"><div className="companion-turn"><div key={mood} className="companion-hop"><div className="companion-bob"><Dino settings={settings} mood={mood} /></div></div></div></div>
      <div className="meadow-floor" />
    </div>
    <p className="companion-message" role="status">{MOOD_COPY[mood]}</p>
  </section>
}
