/**
 * The trick behind the fact.
 *
 * Telling a child the answer is knowledge-of-result and teaches almost
 * nothing. Naming the *strategy* is what carries to the next fact — so the
 * strategy gets the headline and the worked line is the supporting detail.
 *
 * The diagnosis, when there is one, describes where the number went. It never
 * describes the child.
 */
export default function HintCard({ hint, diagnosis }) {
  if (!hint) return null

  return (
    <div className="hint-card" role="note">
      {diagnosis?.message && <p className="hint-diagnosis">{diagnosis.message}</p>}
      <p className="hint-label">🧠 {hint.label}</p>
      <p className="hint-steps">{hint.steps}</p>
    </div>
  )
}
