/**
 * Seedable RNG — so question generation is reproducible in tests.
 * mulberry32: small, fast, good enough for picking numbers out of a hat.
 */
export function makeRng(seed = (Math.random() * 2 ** 32) >>> 0) {
  let s = seed >>> 0
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** Integer in [a, b] inclusive */
  next.int = (a, b) => a + Math.floor(next() * (b - a + 1))
  /** Random element */
  next.pick = arr => arr[next.int(0, arr.length - 1)]
  /** Fisher–Yates, returns a new array */
  next.shuffle = arr => {
    const out = [...arr]
    for (let i = out.length - 1; i > 0; i--) {
      const j = next.int(0, i)
      ;[out[i], out[j]] = [out[j], out[i]]
    }
    return out
  }
  /** true with probability p */
  next.chance = p => next() < p

  return next
}

/** Shared default instance for normal gameplay */
export const rng = makeRng()
