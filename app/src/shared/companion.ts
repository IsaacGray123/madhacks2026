import type { Activity, CompanionColor, CompanionSettings, SessionStatus } from './types'

export const COMPANION_COLORS: Record<CompanionColor, { label: string; body: string; spine: string; belly: string }> = {
  green: { label: 'Grass', body: '#82b75b', spine: '#4f783c', belly: '#e5edb5' },
  blue: { label: 'Pond', body: '#79adc6', spine: '#456e96', belly: '#daedf0' },
  peach: { label: 'Peach', body: '#e5aa83', spine: '#a86c51', belly: '#f6e3bd' },
  lavender: { label: 'Lilac', body: '#b69acb', spine: '#7b6298', belly: '#ede2f3' }
}
export type CompanionMood = Activity | 'welcome' | 'paused' | 'waiting'
export const MOOD_COPY: Record<CompanionMood, string> = {
  welcome: "A little company for your next chapter.",
  studying: "One page at a time. We've got this.",
  phone: "Phone down? Let's try one more page.",
  distracted: "A tiny reset. I'm right here.",
  away: "I'll save your spot. Take your time.",
  eating: "A little snack, a little recharge.",
  sleeping: "Rest is part of growing, too.",
  paused: "A little breather, together.",
  waiting: "Getting ready. I'll wait with you."
}
export function companionMood(status: SessionStatus, current: Activity | null, ready = true): CompanionMood {
  if (status === 'idle') return 'welcome'
  if (status === 'paused') return 'paused'
  return ready && current ? current : 'waiting'
}
export function normalizeCompanion(value?: Partial<CompanionSettings>): CompanionSettings {
  const name = typeof value?.name === 'string' ? value.name.replace(/[\x00-\x1f\x7f|]/g, '').trim().slice(0, 18) : ''
  return { name: name || 'Moss', color: value?.color && Object.hasOwn(COMPANION_COLORS, value.color) ? value.color : 'green', glasses: typeof value?.glasses === 'boolean' ? value.glasses : true }
}
