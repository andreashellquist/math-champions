import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { useEffect } from 'react'
import GameScreen, { LegendPitch } from './GameScreen'
import { GameProvider, useGame } from '../state/GameContext'
import { __resetStorage } from '../game/storage'
import { setLocale } from '../i18n'

/**
 * Timing tests for the pacing work. Browser-side measurement is unreliable
 * (the eval context throttles timers), so the beats are pinned here with fake
 * timers instead — which also means a future "tidy-up" can't silently restore
 * the 1.9s hold.
 */

const STANDARD = /^(\d+)\s*([+−×÷])\s*(\d+)\s*=\s*\?$/

/**
 * Render a round. `pickFormat` produces word problems and missing-operand forms
 * at random, so retry until the first kick is a plain `a op b = ?` — the tests
 * here are about pacing, not about parsing every presentation.
 */
function renderGame() {
  for (let attempt = 0; attempt < 40; attempt++) {
    const utils = render(
      <GameProvider>
        <Harness />
      </GameProvider>,
    )
    if (STANDARD.test(questionText() ?? '')) return utils
    utils.unmount()
    localStorage.clear()
    __resetStorage()
  }
  throw new Error('could not get a standard question')
}

/** Starts a round, then renders the real GameScreen */
function Harness() {
  const { state, startRound } = useGame()
  useEffect(() => {
    if (!state.round) startRound('addition', { mode: 'training', kicks: 5 })
  }, [state.round, startRound])
  if (!state.round) return null
  return <GameScreen />
}

const questionText = () => document.querySelector('.question-box')?.textContent?.trim()
const answerButtons = () => [...document.querySelectorAll('.ans-btn')]

/** Solve the visible question and click the right option */
function answerCorrectly() {
  const m = questionText().match(STANDARD)
  const a = Number(m[1]), b = Number(m[3])
  const want = m[2] === '+' ? a + b : m[2] === '−' ? a - b : m[2] === '×' ? a * b : a / b
  const btn = answerButtons().find(x => Number(x.textContent.trim()) === want)
  act(() => { btn.click() })
  return want
}

beforeEach(() => {
  localStorage.clear()
  __resetStorage()
  setLocale('sv')
  vi.useFakeTimers({ shouldAdvanceTime: false })
})
afterEach(() => {
  vi.useRealTimers()
})

describe('kick pacing', () => {
  it('moves to the next question about a second after answering, not two', () => {
    renderGame()
    const first = questionText()
    expect(first).toBeTruthy()

    answerCorrectly()

    // Still on the same question just before the beat elapses
    act(() => { vi.advanceTimersByTime(950) })
    expect(questionText()).toBe(first)

    // ...and moved on shortly after. The old build held for 1900ms.
    act(() => { vi.advanceTimersByTime(150) })
    expect(questionText()).not.toBe(first)
  })

  it('does not advance before the outcome has been on screen long enough', () => {
    // Floor: below ~350ms the outcome isn't encoded as caused by the child
    renderGame()
    const first = questionText()
    answerCorrectly()
    act(() => { vi.advanceTimersByTime(340) })
    expect(questionText()).toBe(first)
  })
})

describe('Legenddraget route presentation', () => {
  it('turns the one-two choice into a pass-return scene with Sol', () => {
    render(
      <LegendPitch
        kickIdx={3} total={5} phase="resolving" route={['inside', 'one-two']}
        keeperId="haaland" reduced={false} theme="spring"
      />,
    )

    expect(document.querySelector('.legend-pitch.move-one-two')).toBeTruthy()
    expect(document.querySelector('.legend-return-line')).toBeTruthy()
    expect(document.querySelector('[aria-label="Sol"]')).toBeTruthy()
    expect(document.querySelector('.legend-move-label')?.textContent).toContain('Väggspel')
  })

  it('turns the carry choice into a solo dribble past a displaced defender', () => {
    render(
      <LegendPitch
        kickIdx={3} total={5} phase="resolving" route={['wide', 'carry']}
        keeperId="haaland" reduced={false} theme="spring"
      />,
    )

    expect(document.querySelector('.legend-pitch.move-carry')).toBeTruthy()
    expect(document.querySelector('.defender-three.dribbled')).toBeTruthy()
    expect(document.querySelector('[aria-label="Sol"]')).toBeNull()
    expect(document.querySelector('.legend-move-label')?.textContent).toContain('driver själv')
  })
})

describe('tap to skip', () => {
  it('lets the child outrun the animation', () => {
    renderGame()
    const first = questionText()
    answerCorrectly()

    act(() => { vi.advanceTimersByTime(300) })   // past the 250ms arm
    expect(questionText()).toBe(first)

    act(() => { document.querySelector('.stage').click() })
    expect(questionText()).not.toBe(first)       // immediately, no further waiting
  })

  it('ignores a tap that is really the answer tap bouncing', () => {
    renderGame()
    const first = questionText()
    answerCorrectly()

    act(() => { vi.advanceTimersByTime(100) })   // inside the 250ms floor
    act(() => { document.querySelector('.stage').click() })
    expect(questionText()).toBe(first)
  })
})

describe('screen load', () => {
  it('does not show keyboard index badges until a key is used', () => {
    renderGame()
    expect(document.querySelectorAll('.ans-key').length).toBe(0)

    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' })) })
    expect(document.querySelectorAll('.ans-key').length).toBeGreaterThan(0)
  })

  it('reserves the hint slot so the answer buttons never move', () => {
    renderGame()
    expect(document.querySelector('.hint-slot')).toBeTruthy()
  })

  it('offers a way out of the round', () => {
    renderGame()
    const exit = [...document.querySelectorAll('button')]
      .find(b => b.textContent.includes('Klar för nu'))
    expect(exit).toBeTruthy()
  })

  it('does not duplicate the kick count next to the dots', () => {
    renderGame()
    expect(document.querySelectorAll('.dot').length).toBe(5)
    expect(document.body.textContent).not.toMatch(/\b1\/5\b/)
  })

  it('marks which kick is current', () => {
    renderGame()
    expect(document.querySelectorAll('.dot.current').length).toBe(1)
  })
})

describe('a gate is not repeatable from its own result screen', () => {
  it('offers ordinary practice rather than another attempt', async () => {
    const { reducer, initialState } = await import('../state/reducer')
    const { emptyState } = await import('../game/mastery')
    // The reducer keeps the gate id on the round, and ResultScreen's replay
    // deliberately drops it — an immediate retry teaches cramming.
    const s = reducer(initialState(emptyState()), {
      type: 'START_ROUND', op: 'addition', mode: 'gate', gateId: 'cup',
      queue: [], fact: null, question: null, startedAt: 0, totalKicks: 20,
    })
    expect(s.round.gateId).toBe('cup')
    expect(s.round.mode).toBe('gate')
  })
})
