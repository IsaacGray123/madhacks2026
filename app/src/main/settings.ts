import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { withDefaults } from '@shared/defaults'
import type { Settings } from '@shared/types'

const file = (): string => join(app.getPath('userData'), 'settings.json')

let cache: Settings | null = null

export function getSettings(): Settings {
  if (cache) return cache
  try {
    cache = withDefaults(existsSync(file()) ? JSON.parse(readFileSync(file(), 'utf8')) : undefined)
  } catch {
    cache = withDefaults(undefined)
  }
  return cache
}

export function saveSettings(patch: Partial<Settings>): Settings {
  cache = withDefaults({ ...getSettings(), ...patch })
  writeFileSync(file(), JSON.stringify(cache, null, 2))
  return cache
}
