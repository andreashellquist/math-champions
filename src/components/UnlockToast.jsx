import { useEffect, useState } from 'react'

/**
 * Slides down from the top when something unlocks.
 *
 * It has to mount *without* `.show` and gain it a frame later — the previous
 * version mounted with the class already applied, so there was no start frame
 * and the CSS transition never ran. It just popped in.
 */
export default function UnlockToast({ message }) {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (!message) return
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)))
    return () => cancelAnimationFrame(id)
  }, [message])

  if (!message) return null

  return (
    <div className={`unlock-toast${shown ? ' show' : ''}`} role="status" aria-live="assertive">
      {message}
    </div>
  )
}
