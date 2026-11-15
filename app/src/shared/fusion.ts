import type { Activity, CameraState, WindowInfo } from './types'

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
 */
export function fuse(camera: CameraState, win: WindowInfo | null, keywords: string[]): FusionResult {
  if (camera !== 'present') {
    const map: Record<Exclude<CameraState, 'present'>, Activity> = {
      phone: 'phone',
      away: 'away',
      eating: 'eating',
      sleeping: 'sleeping'
    }
    return { activity: map[camera] }
  }
  const tag = matchDistraction(win, keywords)
  return tag ? { activity: 'distracted', tag } : { activity: 'studying' }
}
