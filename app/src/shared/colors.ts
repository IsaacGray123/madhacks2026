import type { Activity, ReminderType } from './types'

/** Semantic activity palette, used by charts, timeline, edge bar, popups and the TFT (RGB565 mirror in sketch.ino). */
export const ACTIVITY_META: Record<Activity, { label: string; color: string; soft: string; focus: boolean }> = {
  studying: { label: 'Studying', color: '#22a06b', soft: '#e3f5ec', focus: true },
  phone: { label: 'Phone', color: '#e5484d', soft: '#fde8e8', focus: false },
  distracted: { label: 'Screen distraction', color: '#f0a020', soft: '#fdf1dc', focus: false },
  away: { label: 'Away', color: '#9aa5b1', soft: '#eef0f2', focus: false },
  eating: { label: 'Eating / drinking', color: '#3b82f6', soft: '#e3edfd', focus: false },
  sleeping: { label: 'Sleeping', color: '#8e6cdb', soft: '#efe9fb', focus: false }
}

export const REMINDER_COPY: Record<ReminderType, { icon: string; title: string; message: string }> = {
  water: { icon: '💧', title: 'Time for some water', message: "You haven't had a drink in a while." },
  eat: { icon: '🍎', title: 'Grab a snack', message: 'Your brain runs on fuel — time to eat something.' },
  break: { icon: '🧘', title: 'Stretch break', message: "You've been sitting a long time. Stand up for a few minutes." },
  posture: { icon: '🪑', title: 'Check your posture', message: "You've been slouching — sit back and roll your shoulders." },
  eye: { icon: '👀', title: '20-20-20 eye rest', message: 'Look at something 20 feet away for 20 seconds.' },
  pomodoro_break: { icon: '🍅', title: 'Pomodoro break', message: 'Work block done. Take a break.' },
  pomodoro_work: { icon: '🍅', title: 'Back to work', message: 'Break is over — start your next focus block.' }
}
