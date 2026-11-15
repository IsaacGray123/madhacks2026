/** 2h 14m · 14m · 45s */
export function fmtDuration(ms: number): string {
  const totalMin = Math.round(ms / 60_000)
  if (ms < 60_000) return `${Math.max(0, Math.round(ms / 1000))}s`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`
}

/** 1:12:05 */
export function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(sec).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}

export function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}
