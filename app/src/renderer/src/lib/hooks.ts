import { useCallback, useEffect, useState } from 'react'
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
