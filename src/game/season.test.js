import { describe, it, expect } from 'vitest'
import {
  emptyState, emptyRivalry, applyFixtureResult, currentCompetition, seasonComplete,
  tieWins, headToHead, COMPETITIONS, TIE_TARGET, ROUND_WIN_GOALS, STATE_VERSION,
} from './mastery'
import { sanitize, load, save, __resetStorage } from './storage'

/** Play a tie to completion against the active rival */
function winTie(state, rivalId, goals = 5) {
  for (let i = 0; i < TIE_TARGET; i++) {
    state = applyFixtureResult(state, { rivalId, goals })
  }
  return state
}

describe('season shape', () => {
  it('starts on the first competition', () => {
    const s = emptyState()
    expect(s.rivalry.season).toBe(1)
    expect(currentCompetition(s).id).toBe(COMPETITIONS[0].id)
    expect(seasonComplete(s)).toBe(false)
  })

  it('pairs each competition with an operation and a rival', () => {
    expect(COMPETITIONS).toHaveLength(4)
    const ops = COMPETITIONS.map(c => c.op)
    expect(new Set(ops).size).toBe(4)
    expect(new Set(COMPETITIONS.map(c => c.rival)).size).toBe(4)
  })

  it('advances only when the tie is actually taken', () => {
    let s = emptyState()
    const rival = COMPETITIONS[0].rival

    s = applyFixtureResult(s, { rivalId: rival, goals: 5 })
    expect(tieWins(s, rival)).toBe(1)
    expect(s.rivalry.stage).toBe(0)          // still the same competition

    s = applyFixtureResult(s, { rivalId: rival, goals: 5 })
    s = applyFixtureResult(s, { rivalId: rival, goals: 5 })
    expect(s.rivalry.stage).toBe(1)
    expect(s.justWonTie).toBe(rival)
  })

  it('treats four goals as a round-win and three as not yet', () => {
    let s = applyFixtureResult(emptyState(), { rivalId: 'red_devil', goals: ROUND_WIN_GOALS })
    expect(tieWins(s, 'red_devil')).toBe(1)

    s = applyFixtureResult(emptyState(), { rivalId: 'red_devil', goals: ROUND_WIN_GOALS - 1 })
    expect(tieWins(s, 'red_devil')).toBe(0)
  })

  it('completes the season and rolls into the next one', () => {
    let s = emptyState()
    for (const comp of COMPETITIONS) s = winTie(s, comp.rival)

    expect(s.justWonSeason).toBe(1)
    expect(s.rivalry.season).toBe(2)
    expect(s.rivalry.stage).toBe(0)                  // back to the first competition
    expect(s.rivalry.cups).toHaveLength(1)
    expect(s.rivalry.cups[0].season).toBe(1)
    // Tie counters reset for the new season; the lifetime ledger does not
    expect(tieWins(s, COMPETITIONS[0].rival)).toBe(0)
    expect(headToHead(s, COMPETITIONS[0].rival)[0]).toBe(TIE_TARGET)
  })
})

describe('nothing the child has earned can go down', () => {
  it('never reduces tie wins on a lost round', () => {
    let s = applyFixtureResult(emptyState(), { rivalId: 'red_devil', goals: 5 })
    expect(tieWins(s, 'red_devil')).toBe(1)

    for (let i = 0; i < 10; i++) {
      s = applyFixtureResult(s, { rivalId: 'red_devil', goals: 0 })
    }
    // Ties have a not-yet state, never a lost state
    expect(tieWins(s, 'red_devil')).toBe(1)
    expect(s.rivalry.stage).toBe(0)
  })

  it('never reduces the lifetime win count', () => {
    let s = emptyState()
    let prevWon = 0
    for (const goals of [5, 0, 4, 1, 5, 2, 0, 5]) {
      s = applyFixtureResult(s, { rivalId: 'red_devil', goals })
      const [won] = headToHead(s, 'red_devil')
      expect(won).toBeGreaterThanOrEqual(prevWon)
      prevWon = won
    }
  })

  it('never revokes a cup', () => {
    let s = emptyState()
    for (const comp of COMPETITIONS) s = winTie(s, comp.rival)
    const cups = s.rivalry.cups.length

    for (let i = 0; i < 20; i++) {
      s = applyFixtureResult(s, { rivalId: COMPETITIONS[0].rival, goals: 0 })
    }
    expect(s.rivalry.cups.length).toBe(cups)
    expect(s.rivalry.season).toBe(2)
  })

  it('counts played rounds but never exposes a negative loss figure', () => {
    let s = emptyState()
    for (const goals of [0, 0, 5, 0]) s = applyFixtureResult(s, { rivalId: 'red_devil', goals })
    const [won, played] = headToHead(s, 'red_devil')
    expect(played).toBe(4)
    expect(won).toBe(1)
    expect(played - won).toBeGreaterThanOrEqual(0)
  })

  it('ignores a fixture against a rival who is not the active one', () => {
    // Beating a later rival out of order must not skip a competition
    const s = winTie(emptyState(), COMPETITIONS[2].rival)
    expect(s.rivalry.stage).toBe(0)
    expect(tieWins(s, COMPETITIONS[2].rival)).toBe(TIE_TARGET)
  })
})

describe('season persistence', () => {
  it('sanitises corrupt season data rather than trusting it', () => {
    const s = sanitize({
      rivalry: {
        season: 'banana', stage: 99, wins: { red_devil: 500, bogus_rival: 3 },
        h2h: { red_devil: [10, 2] },       // played < won
        cups: 'nope',
      },
    })
    expect(s.rivalry.season).toBe(1)
    expect(s.rivalry.stage).toBeLessThanOrEqual(COMPETITIONS.length)
    expect(s.rivalry.wins.red_devil).toBe(TIE_TARGET)
    expect(s.rivalry.wins.bogus_rival).toBeUndefined()
    // played is clamped up to won so no caller can derive a negative
    expect(s.rivalry.h2h.red_devil[1]).toBeGreaterThanOrEqual(s.rivalry.h2h.red_devil[0])
    expect(s.rivalry.cups).toEqual([])
  })

  it('gives a v2 save a season without touching its mastery', () => {
    __resetStorage()
    localStorage.clear()
    localStorage.setItem('mc_state', JSON.stringify({
      v: 2, n: 300, f: { 'm7.8': [4, 10, 2, 1] },
      agg: { correct: 120, goals: 130, seen: 300, rounds: 24, bestStreak: 9 },
    }))

    const s = load()
    expect(s.v).toBe(STATE_VERSION)
    expect(s.f['m7.8']).toEqual([4, 10, 2, 1])       // mastery survives intact
    expect(s.agg.correct).toBe(120)
    expect(s.rivalry).toEqual(emptyRivalry())
  })

  it('round-trips season progress', () => {
    __resetStorage()
    localStorage.clear()
    let s = applyFixtureResult(emptyState(), { rivalId: 'red_devil', goals: 5 })
    delete s.justWonTie; delete s.justWonSeason
    save(s, { immediate: true })

    const back = load()
    expect(tieWins(back, 'red_devil')).toBe(1)
    expect(headToHead(back, 'red_devil')).toEqual([1, 1])
  })
})
