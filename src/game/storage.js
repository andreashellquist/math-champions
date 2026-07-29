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
import { emptyState, STATE_VERSION, OP_KEYS } from './mastery'

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
  }
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
}

/* ── PUBLIC API ────────────────────────────────────────────── */

export function load() {
  try {
    const raw = store().getItem(KEY)
    if (!raw) return sanitize(migrateFromLegacy() ?? emptyState())

    let parsed = JSON.parse(raw)
    // Forward-version data means a newer build wrote this — don't guess at it
    if (int(parsed?.v, 0, 99) > STATE_VERSION) return emptyState()
    while (int(parsed?.v, 0, 99) < STATE_VERSION && MIGRATIONS[parsed.v]) {
      parsed = MIGRATIONS[parsed.v](parsed)
    }
    return sanitize(parsed)
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

/** Test seam — resets the memoised backing store */
export function __resetStorage() {
  backing = null
  memory = new Map()
  pending = null
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
}
