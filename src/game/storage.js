/**
 * Guarded, versioned persistence.
 *
 * Every read is sanitised, not just migrated ones. The old code did
 * `parseInt(localStorage.getItem(key) || '0')` with no radix and no guard,
 * which had a nasty failure mode: a corrupt value produced `NaN`, and since
 * `NaN < 20` and `NaN < 50` are both false, the difficulty ramp silently
 * jumped to its hardest tier. A child with a bad storage entry got the
 * hardest questions in the game, forever, with no way to tell why.
 *
 * Storage can also simply throw — Safari private browsing, "Block All
 * Cookies", some home-screen webviews. That must degrade to an in-memory
 * session, never a white screen.
 */
import {
  emptyState, emptyRivalry, emptyGates, STATE_VERSION, OP_KEYS, COMPETITIONS,
  TIE_TARGET, GATES, GATE_SIZE,
} from './mastery'
import { RIVAL_IDS } from './rivals'

const KEY = 'mc_state'
const LEGACY_CORRECT = 'mc_correct'
const LEGACY_GOALS = 'mc_goals'

/* ── BACKING STORE ─────────────────────────────────────────── */

function probe() {
  try {
    const k = '__mc_probe__'
    localStorage.setItem(k, '1')
    localStorage.removeItem(k)
    return localStorage
  } catch {
    return null
  }
}

let backing = null
let memory = new Map()

/** Real localStorage when usable, an in-memory shim otherwise */
function store() {
  if (backing === null) {
    backing = probe() ?? {
      getItem: k => (memory.has(k) ? memory.get(k) : null),
      setItem: (k, v) => memory.set(k, String(v)),
      removeItem: k => memory.delete(k),
    }
  }
  return backing
}

export const isPersistent = () => store() === probe()

/* ── SANITISE ──────────────────────────────────────────────── */

const int = (v, min, max, fallback = 0) => {
  const n = typeof v === 'number' ? v : Number.parseInt(v, 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(n)))
}

/** A Leitner record is always exactly [box, dueAt, streak, misses] */
function cleanRecord(rec) {
  if (!Array.isArray(rec)) return null
  return [
    int(rec[0], 0, 5),
    int(rec[1], 0, Number.MAX_SAFE_INTEGER),
    int(rec[2], 0, 9999),
    int(rec[3], 0, 9999),
  ]
}

function cleanBucket(obj, maxEntries) {
  const out = {}
  if (!obj || typeof obj !== 'object') return out
  let n = 0
  for (const [k, v] of Object.entries(obj)) {
    if (n >= maxEntries) break
    if (typeof k !== 'string' || k.length > 12) continue
    const rec = cleanRecord(v)
    if (!rec) continue
    out[k] = rec
    n++
  }
  return out
}

/**
 * Runs on every load, not just migrations. This is what stops a corrupt
 * value from propagating into the difficulty engine.
 */
export function sanitize(raw) {
  const base = emptyState()
  if (!raw || typeof raw !== 'object') return base

  return {
    v: STATE_VERSION,
    n: int(raw.n, 0, Number.MAX_SAFE_INTEGER),
    // Bounded by the fact space (~250 records), never by how long the child plays
    f: cleanBucket(raw.f, 400),
    s: cleanBucket(raw.s, 60),
    e: Array.isArray(raw.e) ? raw.e.filter(x => typeof x === 'string').slice(-20) : [],
    r: Object.fromEntries(OP_KEYS.map(op => [
      op,
      Array.isArray(raw.r?.[op]) ? raw.r[op].map(x => (x ? 1 : 0)).slice(-20) : [],
    ])),
    agg: {
      correct:    int(raw.agg?.correct, 0, 1e9),
      goals:      int(raw.agg?.goals, 0, 1e9),
      seen:       int(raw.agg?.seen, 0, 1e9),
      rounds:     int(raw.agg?.rounds, 0, 1e9),
      bestStreak: int(raw.agg?.bestStreak, 0, 9999),
    },
    l: Array.isArray(raw.l) ? raw.l.map(x => int(x, 0, 60000)).slice(-30) : [],
    rivalry: cleanRivalry(raw.rivalry),
    gates: cleanGates(raw.gates),
  }
}

/** Season state. Bounded by the rival roster, so it can't grow with play time. */
function cleanRivalry(raw) {
  const base = emptyRivalry()
  if (!raw || typeof raw !== 'object') return base

  const wins = {}, h2h = {}
  for (const id of RIVAL_IDS) {
    const w = int(raw.wins?.[id], 0, TIE_TARGET)
    if (w) wins[id] = w
    const pair = Array.isArray(raw.h2h?.[id]) ? raw.h2h[id] : null
    if (pair) {
      const won = int(pair[0], 0, 1e6)
      // `played` can never be less than `won` — a corrupt pair must not
      // produce a negative loss count anywhere downstream
      h2h[id] = [won, Math.max(won, int(pair[1], 0, 1e6))]
    }
  }

  return {
    season: int(raw.season, 1, 9999, 1),
    stage: int(raw.stage, 0, COMPETITIONS.length),
    wins,
    h2h,
    cups: Array.isArray(raw.cups)
      ? raw.cups
          .filter(c => c && typeof c === 'object')
          .slice(0, 200)
          .map(c => ({ season: int(c.season, 1, 9999, 1), at: int(c.at, 0, Number.MAX_SAFE_INTEGER) }))
      : [],
  }
}

/** Gate insignia. Bounded by the gate list, so it cannot grow with play. */
function cleanGates(raw) {
  const out = emptyGates()
  if (!raw || typeof raw !== 'object') return out
  for (const g of GATES) {
    const rec = raw[g.id]
    if (!rec || typeof rec !== 'object') continue
    out[g.id] = {
      passed: rec.passed === true,
      best: int(rec.best, 0, GATE_SIZE),
      attempts: int(rec.attempts, 0, 9999),
      atRound: int(rec.atRound, 0, 1e9),
      at: int(rec.at, 0, Number.MAX_SAFE_INTEGER),
    }
  }
  return out
}

/* ── MIGRATIONS ────────────────────────────────────────────── */

/** The original two flat keys. Preserve the child's totals; mastery starts fresh. */
function migrateFromLegacy() {
  const s = store()
  const correct = int(s.getItem(LEGACY_CORRECT), 0, 1e9)
  const goals = int(s.getItem(LEGACY_GOALS), 0, 1e9)
  if (!correct && !goals) return null

  return { ...emptyState(), agg: { ...emptyState().agg, correct, goals, seen: correct } }
}

const MIGRATIONS = {
  1: prev => ({ ...emptyState(), ...prev, v: 2 }),
  // v3 adds the season. Mastery is untouched — a child mid-ladder keeps every
  // fact and simply starts the first competition.
  2: prev => ({ ...prev, v: 3, rivalry: emptyRivalry() }),
  // v4 starts recording first-attempt latencies. Empty is correct: the clock
  // falls back to the generous defaults until there is real evidence.
  3: prev => ({ ...prev, v: 4, l: [] }),
  // v5 adds the gate ledger. Empty is correct — no gate has been sat yet.
  4: prev => ({ ...prev, v: 5, gates: emptyGates() }),
}

/* ── PUBLIC API ────────────────────────────────────────────── */

/** Run the migration chain up to the current version */
function migrateForward(parsed) {
  let s = parsed
  while (int(s?.v, 0, 99) < STATE_VERSION && MIGRATIONS[s.v]) s = MIGRATIONS[s.v](s)
  return s
}

export function load() {
  try {
    const raw = store().getItem(KEY)
    if (!raw) return sanitize(migrateFromLegacy() ?? emptyState())

    const parsed = JSON.parse(raw)
    // Forward-version data means a newer build wrote this — don't guess at it
    if (int(parsed?.v, 0, 99) > STATE_VERSION) return emptyState()
    return sanitize(migrateForward(parsed))
  } catch {
    return emptyState()
  }
}

let flushTimer = null
let pending = null

/** Debounced — five kicks shouldn't mean five synchronous JSON serialisations */
export function save(state, { immediate = false } = {}) {
  pending = state
  if (flushTimer) clearTimeout(flushTimer)
  if (immediate) return flush()
  flushTimer = setTimeout(flush, 300)
}

export function flush() {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
  if (!pending) return
  try {
    store().setItem(KEY, JSON.stringify(pending))
    store().removeItem(LEGACY_CORRECT)
    store().removeItem(LEGACY_GOALS)
  } catch {
    // Quota exceeded or storage blocked mid-session — the game keeps working,
    // this round just won't survive a reload.
  }
  pending = null
}

export function clear() {
  try {
    store().removeItem(KEY)
    store().removeItem(LEGACY_CORRECT)
    store().removeItem(LEGACY_GOALS)
  } catch { /* nothing to do */ }
  pending = null
}

/* ── SETTINGS (small, separate, survives a progress reset) ── */

const SETTINGS_KEY = 'mc_settings'
const DEFAULT_SETTINGS = { sound: true, character: 'haaland', shootoutOptIn: false, locale: null }

export function loadSettings() {
  try {
    const raw = store().getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw)
    return {
      sound: parsed?.sound !== false,
      character: typeof parsed?.character === 'string' ? parsed.character : DEFAULT_SETTINGS.character,
      shootoutOptIn: parsed?.shootoutOptIn === true,
      locale: typeof parsed?.locale === 'string' ? parsed.locale : null,
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings) {
  try {
    store().setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch { /* non-fatal */ }
}

/* ── WEEKLY SNAPSHOT ───────────────────────────────────────────
   Separate from progress so a reset doesn't wipe it and vice versa. Holds one
   number and one week id — deliberately not a history, because a history is a
   streak waiting to be built, and a breakable streak is a loss-aversion device.
   ─────────────────────────────────────────────────────────── */

const WEEK_KEY = 'mc_week'

/** ISO-ish week id. Monday-based, which is what a Swedish school week is. */
export function weekId(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d - start) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-w${week}`
}

export function loadWeek() {
  try {
    const raw = store().getItem(WEEK_KEY)
    if (!raw) return null
    const p = JSON.parse(raw)
    if (typeof p?.id !== 'string') return null
    return { id: p.id, mastered: int(p.mastered, 0, 1e6), shown: p.shown === true }
  } catch {
    return null
  }
}

export function saveWeek(week) {
  try { store().setItem(WEEK_KEY, JSON.stringify(week)) } catch { /* non-fatal */ }
}

/* ── BACKUP ────────────────────────────────────────────────────
   localStorage is per-device and per-browser: there is no sync, and clearing
   site data loses everything. A backend would fix that properly, but it means
   accounts and a server holding a child's learning record, which is a
   different product decision.

   This is the middle path — an export the grown-up can move by hand. Nothing
   leaves the device unless someone chooses to move it.
   ─────────────────────────────────────────────────────────── */

export const BACKUP_VERSION = 1

export function exportBackup() {
  return JSON.stringify({
    kind: 'math-champions-backup',
    v: BACKUP_VERSION,
    at: Date.now(),
    state: load(),
    settings: loadSettings(),
  }, null, 2)
}

/**
 * Restore from an exported backup.
 *
 * Runs the same sanitiser and migration chain as a normal load, so a backup
 * taken from an older build is upgraded rather than trusted.
 *
 * @returns {{ ok: boolean, reason?: string }}
 */
export function importBackup(text) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, reason: 'unreadable' }
  }
  if (parsed?.kind !== 'math-champions-backup') return { ok: false, reason: 'notBackup' }

  try {
    const state = sanitize(
      Number(parsed.state?.v) > STATE_VERSION ? emptyState() : migrateForward(parsed.state),
    )
    store().setItem(KEY, JSON.stringify(state))
    if (parsed.settings) saveSettings(loadSettingsShape(parsed.settings))
    return { ok: true }
  } catch {
    return { ok: false, reason: 'unreadable' }
  }
}

/** Shape-check imported settings the same way a normal load would */
function loadSettingsShape(raw) {
  return {
    sound: raw?.sound !== false,
    character: typeof raw?.character === 'string' ? raw.character : DEFAULT_SETTINGS.character,
    shootoutOptIn: raw?.shootoutOptIn === true,
    locale: typeof raw?.locale === 'string' ? raw.locale : null,
    extraTime: Number.isFinite(raw?.extraTime) ? Math.min(2, Math.max(1, raw.extraTime)) : 1,
    rival: typeof raw?.rival === 'string' ? raw.rival : null,
  }
}

/** Test seam — resets the memoised backing store */
export function __resetStorage() {
  backing = null
  memory = new Map()
  pending = null
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
}
