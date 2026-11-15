import { useCallback, useEffect, useState } from 'react'
import type React from 'react'
import type { LiveStatus, Settings } from '@shared/types'

export function useStatus(): LiveStatus | null {
  const [s, setS] = useState<LiveStatus | null>(null)
  useEffect(() => {
    void window.api.getStatus().then(setS)
    return window.api.onStatus(setS)
  }, [])
  return s
}

export function useSettings(): [Settings | null, (patch: Partial<Settings>) => Promise<void>] {
  const [s, setS] = useState<Settings | null>(null)
  useEffect(() => {
    void window.api.getSettings().then(setS)
  }, [])
  const save = useCallback(async (patch: Partial<Settings>) => {
    setS((cur) => (cur ? { ...cur, ...patch } : cur))
    setS(await window.api.saveSettings(patch))
  }, [])
  return [s, save]
}

/** True while the app is rendering in dark mode (Settings > Appearance, or the OS when set to System). */
export function useDarkMode(): boolean {
  const [dark, setDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const h = (e: MediaQueryListEvent): void => setDark(e.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])
  return dark
}

/** Colors for Recharts, whose SVG attributes can't read CSS variables. */
export function useChartColors(): { grid: string; tick: string; muted: string; tooltip: React.CSSProperties } {
  const dark = useDarkMode()
  return dark
    ? {
        grid: '#2a3137',
        tick: '#6e7984',
        muted: '#38414a',
        tooltip: { borderRadius: 12, border: '1px solid #2e353c', background: '#1d2227', color: '#e6e9ec', fontSize: 12 }
      }
    : {
        grid: '#efefeb',
        tick: '#9aa5b1',
        muted: '#dfe3e6',
        tooltip: { borderRadius: 12, border: '1px solid #e8e8e4', background: '#ffffff', fontSize: 12 }
      }
}

export interface CameraFrame {
  src: string
  at: number
}

/**
 * Subscribes to the UNO Q's live camera preview while `enabled`. The board only streams
 * while some view has asked for it, and pauses while this window is hidden.
 */
export function useCameraFrame(enabled: boolean): CameraFrame | null {
  const [frame, setFrame] = useState<CameraFrame | null>(null)
  useEffect(() => {
    if (!enabled) {
      setFrame(null)
      return
    }
    const sync = (): void => void window.api.setCameraPreview(!document.hidden)
    sync()
    document.addEventListener('visibilitychange', sync)
    const off = window.api.onCameraFrame((jpeg) => setFrame({ src: `data:image/jpeg;base64,${jpeg}`, at: Date.now() }))
    return () => {
      off()
      document.removeEventListener('visibilitychange', sync)
      void window.api.setCameraPreview(false)
    }
  }, [enabled])
  return frame
}
