import { describe, expect, it } from 'vitest'
import { companionMood, normalizeCompanion } from './companion'
import { withDefaults } from './defaults'

describe('companion preferences and truthful state', () => {
  it('upgrades old settings without disturbing connection preferences', () => {
    const s = withDefaults({ deviceAddress: '127.0.0.1:8766' })
    expect(s.companion).toEqual({ name: 'Moss', color: 'green', glasses: true })
    expect(s.deviceAddress).toBe('127.0.0.1:8766')
  })
  it('keeps names safe for the board delimiter and caps their display length', () => {
    expect(normalizeCompanion({ name: '  Fern|\n  ' }).name).toBe('Fern')
    expect(normalizeCompanion({ name: 'a'.repeat(50) }).name).toHaveLength(18)
    expect(normalizeCompanion({ name: '   ' }).name).toBe('Moss')
  })
  it('preserves customized preferences and repairs an unknown palette', () => {
    expect(normalizeCompanion({ name: 'Bean', color: 'blue', glasses: false })).toEqual({ name: 'Bean', color: 'blue', glasses: false })
    expect(normalizeCompanion({ color: 'invalid' as 'green' }).color).toBe('green')
  })
  it('prioritizes pauses and missing data over a studying animation', () => {
    expect(companionMood('paused', 'studying')).toBe('paused')
    expect(companionMood('running', 'studying', false)).toBe('waiting')
    expect(companionMood('running', null)).toBe('waiting')
    expect(companionMood('idle', null)).toBe('welcome')
    for (const mood of ['studying', 'phone', 'distracted', 'away', 'eating', 'sleeping'] as const) expect(companionMood('running', mood)).toBe(mood)
  })
})
