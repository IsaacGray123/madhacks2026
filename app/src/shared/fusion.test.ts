import { describe, expect, it } from 'vitest'
import { fuse } from './fusion'

const kw = ['YouTube', 'Reddit']

describe('fuse', () => {
  it('refines present into studying when the window is not distracting', () => {
    expect(fuse('present', { app: 'Code', title: 'main.py - VS Code' }, kw)).toEqual({ activity: 'studying' })
  })
  it('flags distracting windows case-insensitively and keeps the keyword as tag', () => {
    expect(fuse('present', { app: 'chrome', title: 'cats - youtube - Google Chrome' }, kw)).toEqual({ activity: 'distracted', tag: 'YouTube' })
  })
  it('passes non-present camera states through untouched', () => {
    expect(fuse('phone', { app: 'chrome', title: 'YouTube' }, kw).activity).toBe('phone')
    expect(fuse('away', null, kw).activity).toBe('away')
    expect(fuse('sleeping', null, kw).activity).toBe('sleeping')
    expect(fuse('eating', null, kw).activity).toBe('eating')
  })
  it('treats missing window info as studying', () => {
    expect(fuse('present', null, kw).activity).toBe('studying')
  })
})
