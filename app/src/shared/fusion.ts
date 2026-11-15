import type { Activity, Attention, CameraState, WindowInfo } from './types'

/** Distraction tag used when the camera sees the user looking away from the screen. */
export const LOOKING_AWAY_TAG = 'Looking away'
/** Distraction tag when the camera saw a long look down it couldn't classify as phone or sleep. */
export const LOOKING_DOWN_TAG = 'Looking down'

export interface FusionResult {
  activity: Activity
  tag?: string
}

/** Returns the distraction keyword that matches the window, preserving the user's capitalization. */
export function matchDistraction(win: WindowInfo | null, keywords: string[]): string | undefined {
  if (!win) return undefined
  const hay = `${win.app} ${win.title}`.toLowerCase()
  return keywords.find((k) => k.trim() && hay.includes(k.trim().toLowerCase()))?.trim()
}

/**
 * Combine what the camera sees with what is on screen.
 * Only `present` is refined; every other camera state already describes the user.
 * A distracting window wins over looking away, since it names the distraction.
 */
export function fuse(camera: CameraState, win: WindowInfo | null, keywords: string[], attention?: Attention | null): FusionResult {
  if (camera === 'distracted') return { activity: 'distracted', tag: LOOKING_DOWN_TAG }
  if (camera !== 'present') {
    const map: Record<Exclude<CameraState, 'present' | 'distracted'>, Activity> = {
      phone: 'phone',
      away: 'away',
      eating: 'eating',
      sleeping: 'sleeping'
    }
    return { activity: map[camera] }
  }
  const tag = matchDistraction(win, keywords)
  if (tag) return { activity: 'distracted', tag }
  if (attention === 'away') return { activity: 'distracted', tag: LOOKING_AWAY_TAG }
  return { activity: 'studying' }
}
