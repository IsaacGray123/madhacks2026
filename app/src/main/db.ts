// Local data store. A single JSON file in %APPDATA%/StudyLens — no native modules,
// so the app builds and packages for Windows without a node-gyp toolchain.
import { app } from 'electron'
import { existsSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { Activity, EventRecord, EventType, ReminderType, Segment, SessionDetail, SessionRecord } from '@shared/types'

interface DataFile {
  nextId: number
  sessions: SessionRecord[]
  segments: Segment[]
  events: EventRecord[]
}

const file = (): string => join(app.getPath('userData'), 'studylens-data.json')
const empty = (): DataFile => ({ nextId: 1, sessions: [], segments: [], events: [] })

let data: DataFile | null = null
let saveTimer: NodeJS.Timeout | null = null

function db(): DataFile {
  if (data) return data
  try {
    data = existsSync(file()) ? (JSON.parse(readFileSync(file(), 'utf8')) as DataFile) : empty()
  } catch {
    data = empty()
  }
  return data
}

/** Write atomically (tmp + rename) so a crash mid-write can't corrupt history. */
export function flush(): void {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  const tmp = file() + '.tmp'
  writeFileSync(tmp, JSON.stringify(db()))
  renameSync(tmp, file())
}

function scheduleSave(): void {
  if (!saveTimer) saveTimer = setTimeout(flush, 5000)
}

const id = (): number => db().nextId++

export function createSession(startedAt: number, screenOnly: boolean): SessionRecord {
  const s: SessionRecord = { id: id(), startedAt, endedAt: null, screenOnly }
  db().sessions.push(s)
  flush()
  return s
}

export function endSession(sessionId: number, endedAt: number): void {
  const s = db().sessions.find((x) => x.id === sessionId)
  if (s) s.endedAt = endedAt
  flush()
}

export function addSegment(seg: Omit<Segment, 'id'>): Segment {
  const s = { ...seg, id: id() }
  db().segments.push(s)
  scheduleSave()
  return s
}

/** Segments are mutated in place by the session manager as they grow. */
export function touch(): void {
  scheduleSave()
}

export function addEvent(sessionId: number, type: EventType, ts: number, reminder?: ReminderType): void {
  db().events.push({ id: id(), sessionId, ts, type, ...(reminder ? { reminder } : {}) })
  scheduleSave()
}

export function listDetails(): SessionDetail[] {
  const d = db()
  return d.sessions
    .filter((s) => s.endedAt !== null)
    .sort((a, b) => b.startedAt - a.startedAt)
    .map((session) => ({
      session,
      segments: d.segments.filter((x) => x.sessionId === session.id),
      events: d.events.filter((x) => x.sessionId === session.id)
    }))
}

export function getDetail(sessionId: number): SessionDetail | null {
  const d = db()
  const session = d.sessions.find((s) => s.id === sessionId)
  if (!session) return null
  return {
    session,
    segments: d.segments.filter((x) => x.sessionId === sessionId).sort((a, b) => a.start - b.start),
    events: d.events.filter((x) => x.sessionId === sessionId)
  }
}

export function relabelSegment(segmentId: number, state: Activity): void {
  const seg = db().segments.find((s) => s.id === segmentId)
  if (!seg) return
  if (seg.originalState === undefined) seg.originalState = seg.state
  if (seg.originalState === state) delete seg.originalState
  seg.state = state
  flush()
}

export function deleteSession(sessionId: number): void {
  const d = db()
  d.sessions = d.sessions.filter((s) => s.id !== sessionId)
  d.segments = d.segments.filter((s) => s.sessionId !== sessionId)
  d.events = d.events.filter((s) => s.sessionId !== sessionId)
  flush()
}

export function deleteAll(): void {
  data = empty()
  flush()
}

/** Bulk insert used by the demo seeder. */
export function importDetails(details: { session: Omit<SessionRecord, 'id'>; segments: Omit<Segment, 'id' | 'sessionId'>[]; events: Omit<EventRecord, 'id' | 'sessionId'>[] }[]): void {
  for (const d of details) {
    const session: SessionRecord = { ...d.session, id: id() }
    db().sessions.push(session)
    for (const s of d.segments) db().segments.push({ ...s, id: id(), sessionId: session.id })
    for (const e of d.events) db().events.push({ ...e, id: id(), sessionId: session.id })
  }
  flush()
}
