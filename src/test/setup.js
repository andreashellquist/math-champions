/**
 * Test environment setup.
 *
 * jsdom's localStorage isn't exposed under this Node/vitest combination, so
 * tests that exercise persistence get a minimal spec-compliant stand-in.
 * Only installed when one is genuinely missing — a real implementation always
 * wins.
 */
if (typeof globalThis.localStorage === 'undefined') {
  const makeStorage = () => {
    let map = new Map()
    return {
      get length() { return map.size },
      key: i => [...map.keys()][i] ?? null,
      getItem: k => (map.has(String(k)) ? map.get(String(k)) : null),
      setItem: (k, v) => { map.set(String(k), String(v)) },
      removeItem: k => { map.delete(String(k)) },
      clear: () => { map = new Map() },
    }
  }

  const storage = makeStorage()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true, writable: true, value: storage,
  })
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', {
      configurable: true, writable: true, value: storage,
    })
  }
}
