import { describe, it, expect } from 'vitest'
import { ARCADE_SETS, arcadeSetsFor, arcadeSet } from './arcadeSets'
import { OP_ORDER } from './config'
import { answerOf } from './facts'

describe('Snabbskott fixed fact sets', () => {
  it('gives every operation at least one set', () => {
    for (const op of OP_ORDER) {
      expect(arcadeSetsFor(op).length, op).toBeGreaterThan(0)
    }
  })

  it('never defines an empty set', () => {
    for (const set of ARCADE_SETS) {
      expect(set.facts.length, set.id).toBeGreaterThan(0)
    }
  })

  it('never repeats a fact within one set', () => {
    for (const set of ARCADE_SETS) {
      const keys = set.facts.map(f => f.key)
      expect(new Set(keys).size, set.id).toBe(keys.length)
    }
  })

  it('only contains facts that actually belong to the set\'s operation', () => {
    for (const set of ARCADE_SETS) {
      expect(set.facts.every(f => f.op === set.op), set.id).toBe(true)
    }
  })

  it('is a small, comfortably countable set — not the whole fact space', () => {
    // A 30-second arcade run should be able to plausibly see most of a set;
    // the "core" tier in particular must stay well under a full table.
    for (const set of ARCADE_SETS) {
      expect(set.facts.length, set.id).toBeLessThan(120)
    }
  })

  it('resolves every fact to a valid, non-negative integer answer', () => {
    for (const set of ARCADE_SETS) {
      for (const f of set.facts) {
        const ans = answerOf(f)
        expect(Number.isInteger(ans), `${set.id}: ${f.key}`).toBe(true)
        expect(ans, `${set.id}: ${f.key}`).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('looks sets up by id, or returns undefined for an unknown one', () => {
    expect(arcadeSet('addition.core')).toBeTruthy()
    expect(arcadeSet('nonsense.core')).toBeUndefined()
  })

  it('ids are stable and unique — they are the storage key for a personal best', () => {
    const ids = ARCADE_SETS.map(s => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
