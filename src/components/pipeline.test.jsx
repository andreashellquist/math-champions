import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, fireEvent } from '@testing-library/react'
import App from '../App'
import { __resetStorage, load, loadSettings } from '../game/storage'
import { setLocale } from '../i18n'
import { masteredCount } from '../game/mastery'

/**
 * End-to-end through the real component tree: menu → round → result, driving
 * only the things a child can actually touch.
 *
 * This is the test that would have caught the double-tap scoring bug, the
 * confetti firing on alternate goals, and the `sessionRounds` ref being read
 * during render — none of which are visible from a unit test of the reducer.
 */

const q = () => document.querySelector('.question-box')?.textContent?.trim()
const options = () => [...document.querySelectorAll('.ans-btn')]
const live = () => [...document.querySelectorAll('.ans-btn:not(:disabled)')]
const feedback = () => document.querySelector('.feedback')?.textContent?.trim()
const onResult = () => !!document.querySelector('.result-card')
const button = text =>
  [...document.querySelectorAll('button')].find(b => b.textContent.includes(text))

const STANDARD = /^(\d+)\s*([+−×÷])\s*(\d+)\s*=\s*\?$/

function solve() {
  const m = q()?.match(STANDARD)
  if (!m) return null
  const a = Number(m[1]), b = Number(m[3])
  return m[2] === '+' ? a + b : m[2] === '−' ? a - b : m[2] === '×' ? a * b : a / b
}

const click = el => act(() => { el.click() })
const tick = ms => act(() => { vi.advanceTimersByTime(ms) })

/** Start a round and keep retrying until the first kick is a plain sum */
function startRound() {
  for (let attempt = 0; attempt < 40; attempt++) {
    const utils = render(<App />)
    click(button('Kör igång'))
    if (STANDARD.test(q() ?? '')) return utils
    utils.unmount()
    localStorage.clear()
    __resetStorage()
  }
  throw new Error('could not reach a standard question')
}

beforeEach(() => {
  localStorage.clear()
  __resetStorage()
  setLocale('sv')
  vi.useFakeTimers({ shouldAdvanceTime: false })
})
afterEach(() => { vi.useRealTimers() })

describe('a whole kick, through the real tree', () => {
  it('gives the season rival a real accessible name', () => {
    render(<App />)
    const seasonKeeper = document.querySelector('.season-strip [role="img"]')
    expect(seasonKeeper?.getAttribute('aria-label')).not.toMatch(/undefined/)
    expect(seasonKeeper?.getAttribute('aria-label')).toMatch(/målvakt/)
  })

  it('goes menu → question → goal → next question', () => {
    startRound()
    const first = q()
    expect(options().length).toBeGreaterThanOrEqual(3)

    click(options().find(b => Number(b.textContent.trim()) === solve()))
    expect(feedback()).toMatch(/MÅL|OSTOPPBART/)

    tick(1100)
    expect(q()).not.toBe(first)
  })

  it('scores once when the same option is tapped twice in the same frame', () => {
    // The original bug: `locked` was state, so two taps dispatched before React
    // committed both saw it as false, scored twice and queued two advances.
    startRound()
    const answer = options().find(b => Number(b.textContent.trim()) === solve())

    act(() => { answer.click(); answer.click(); answer.click() })
    tick(1100)

    // Three taps, one kick consumed: two dots would mean it scored twice
    expect(document.querySelectorAll('.dot.goal').length).toBe(1)
  })

  it('parries a wrong answer instead of ending the kick', () => {
    startRound()
    const first = q()
    const correct = solve()
    click(options().find(b => Number(b.textContent.trim()) !== correct))

    expect(feedback()).toMatch(/Retur/)
    expect(q()).toBe(first)                       // same question, still live
    expect(document.querySelector('.hint-card')).toBeTruthy()

    // Nothing auto-advances past a mistake
    tick(3000)
    expect(q()).toBe(first)
  })

  it('takes the rebound and scores', () => {
    startRound()
    const correct = solve()
    click(options().find(b => Number(b.textContent.trim()) !== correct))
    act(() => { vi.advanceTimersByTime(300) })     // past the re-tap lockout
    click(live().find(b => Number(b.textContent.trim()) === correct))

    expect(feedback()).toMatch(/RETURMÅL/)
    tick(1500)
    expect(document.querySelectorAll('.dot.rebound').length).toBe(1)
  })
})

describe('a whole round', () => {
  /** Play every kick correctly until the result screen appears */
  function playOut(maxKicks = 30) {
    for (let i = 0; i < maxKicks && !onResult(); i++) {
      const want = solve()
      const btns = live()
      if (!btns.length) break
      click(btns.find(b => Number(b.textContent.trim()) === want) ?? btns[0])
      tick(1500)
    }
  }

  it('reaches the result screen and persists what was earned', () => {
    startRound()
    playOut()

    expect(onResult()).toBe(true)
    expect(document.querySelector('.result-score')?.textContent).toMatch(/\d+\/\d+/)

    // Flush the debounced write, then read it back the way a reload would
    act(() => { vi.advanceTimersByTime(500) })
    const saved = load()
    expect(saved.agg.rounds).toBeGreaterThan(0)
    expect(saved.agg.goals).toBeGreaterThan(0)
    expect(Object.keys(saved.f).length).toBeGreaterThan(0)
  })

  it('offers another round, and starting it works', () => {
    startRound()
    playOut()

    const again = button('Nästa omgång')
    expect(again).toBeTruthy()
    click(again)
    expect(q()).toBeTruthy()
    expect(onResult()).toBe(false)
  })

  it('lets the child leave mid-round without it counting against them', () => {
    startRound()
    const before = load()

    click(button('Klar för nu'))
    expect(onResult()).toBe(true)

    act(() => { vi.advanceTimersByTime(500) })
    const after = load()
    // Nothing earned was lost by stopping
    expect(masteredCount(after)).toBeGreaterThanOrEqual(masteredCount(before))
    expect(after.rivalry).toEqual(before.rivalry)
  })
})

describe('Snabbskott (arcade), through the real component tree', () => {
  // Regression: `ModeSelect`'s arcade chip never passed `kicks` to
  // `startRound`, so `totalKicks` silently defaulted to 5 — a round
  // advertised as "30 seconds" actually ended after exactly 5 answers, in
  // about 1.6 real seconds, regardless of the clock. This only shows up by
  // driving the real menu → chip → round path; a reducer test that hand-built
  // the round object never exercised the buggy default at all.
  it('does not end after five answers — the clock is what ends an arcade round', () => {
    render(<App />)                          // fresh profile lands on the menu
    click(button('Välj själv') ?? button('Pick myself'))
    // Addition is unlocked from a fresh profile, so its arcade entry is reachable
    click(button('Snabbskott'))
    click(button('30 sek'))
    expect(q()).toBeTruthy()
    const timer = document.querySelector('[role="timer"]')
    expect(timer?.getAttribute('aria-label')).toMatch(/sekunder kvar/)
    expect(timer?.getAttribute('aria-valuemax')).toBe('30')

    for (let i = 0; i < 8; i++) {
      const before = q()
      expect(onResult(), `still an active round after ${i} answers`).toBe(false)
      const btn = options().find(b => Number(b.textContent.trim()) === solve()) ?? options()[0]
      click(btn)
      tick(700)                              // past both the hit and miss beats
      expect(q(), `question changed after answer ${i + 1}`).not.toBe(before)
    }
    // Eight items answered, well past the old hidden 5-item cap, clock still running
    expect(onResult()).toBe(false)
  })

  it('publishes the duration on the chip before the child commits', () => {
    render(<App />)
    click(button('Välj själv') ?? button('Pick myself'))
    click(button('Snabbskott'))
    const chip = button('30 sek')
    expect(chip.textContent).toMatch(/\d+\s*sek/)   // e.g. "30 sek" — not just a fact count
  })

  it('exposes the full set when the catalog defines one', () => {
    render(<App />)
    click(button('Välj själv'))
    click(button('Snabbskott'))
    expect(document.body.textContent).toContain('Hela tabellen')
  })
})

describe('Legenddraget prototype, through the real component tree', () => {
  it('starts as an untimed five-touch move with the fictional player', () => {
    render(<App />)
    click(button('Välj själv'))
    click(button('Starta draget'))

    expect(document.querySelector('.legend-pitch')).toBeTruthy()
    expect(document.querySelectorAll('.dot')).toHaveLength(5)
    expect(document.querySelector('[role="timer"]')).toBeNull()
    expect(document.querySelector('.legend-pitch [aria-label="Nova"]')).toBeTruthy()
  })
})

describe('create-a-player, through the real component tree', () => {
  it('names, saves and immediately plays as your own player', () => {
    render(<App />)
    click(button('Byt spelare'))
    click(button('Skapa din egen'))

    const name = document.querySelector('.name-input')
    fireEvent.change(name, { target: { value: 'Robin' } })
    click(button('Spara'))

    // Saved to the settings a reload would read back...
    expect(loadSettings().customPlayer.name).toBe('Robin')
    expect(loadSettings().character).toBe('custom')

    // ...and selected immediately, no extra tap needed
    expect(document.querySelector('.roster-card.selected .roster-name')?.textContent).toBe('Robin')

    click(button('Klar'))
    expect(document.querySelector('.char-label')?.textContent).toMatch(/Robin/)
  })

  it('refuses to save with no name, so a child can never end up an unlabelled figure', () => {
    render(<App />)
    click(button('Byt spelare'))
    click(button('Skapa din egen'))

    expect(button('Spara').disabled).toBe(true)
  })

  it('offers to edit, and to remove, a player that already exists', () => {
    render(<App />)
    click(button('Byt spelare'))
    click(button('Skapa din egen'))
    fireEvent.change(document.querySelector('.name-input'), { target: { value: 'Robin' } })
    click(button('Spara'))

    click(button('Ändra din spelare'))
    expect(document.querySelector('.name-input').value).toBe('Robin')

    click(button('Ta bort min spelare'))
    expect(loadSettings().customPlayer).toBeNull()
    // Falls back rather than leaving the child on a character that no longer exists
    expect(loadSettings().character).not.toBe('custom')
  })
})

describe('the first round of a session is the short one', () => {
  it('opens with three kicks, not five', () => {
    // Task initiation is priced by the size of the commitment, so the round
    // that carries the initiation cost is the cheap one.
    startRound()
    expect(document.querySelectorAll('.dot').length).toBe(3)
  })
})
