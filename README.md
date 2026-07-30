# ⚽ Mattemästarna / Math Champions

A soccer-themed maths game for ages 7–10. Answer a question, take a penalty.
Swedish by default, English available.

```bash
npm install
npm run dev
```

| | |
|---|---|
| `npm run dev` | dev server |
| `npm run build` | production build (PWA, installable, works offline) |
| `npm test` | Vitest |
| `npm run icons` | regenerate PWA icons from `public/icon.svg` |
| `?sheet=1` | dev-only character contact sheet |

---

## The design in one page

Three ideas do most of the work.

**A wrong answer is a parry, not a save.** The ball stays live. The child gets a
strategy hint and a second attempt on the same question — and if they miss
again, they must tap the correct answer before play continues. Nothing
auto-advances past a mistake, because knowledge-of-result with no retrieval
attempt teaches close to nothing. The opponent never gloats.

**Every wrong option is a real mistake.** Distractors are generated from a table
of misconceptions — the smaller-from-larger subtraction bug (`43 − 17 → 34`), a
dropped carry, the square next door to `7 × 8`. Two consequences: you can't pick
the answer without actually computing, and a wrong answer is *diagnostic*, so
feedback names the specific slip instead of reciting the answer.

**Difficulty is per-fact, not global.** A 6-box Leitner system with a latency
gate — a slow-but-correct answer doesn't promote, because fluency means
retrieval, not reconstruction.

---

## Architecture

```
src/
├── i18n/            sv (default) + en; `t()` walks dotted keys
├── game/
│   ├── facts.js       the ladder: strands per operation, canonical fact keys
│   ├── distractors.js misconception rules + guards + classifyChoice
│   ├── questions.js   dresses a fact as standard / missing-operand / word problem
│   ├── hints.js       strategy selection (language-independent) → translated copy
│   ├── mastery.js     Leitner boxes, strand opening, round composition
│   ├── round.js       round assembly
│   ├── storage.js     guarded, versioned, sanitised persistence
│   └── characters.js  the roster
├── state/
│   ├── reducer.js     the whole game as one pure reducer
│   └── GameContext.jsx
├── hooks/useDeadline.js   the Shootout clock
├── audio/sfx.js           synthesised WebAudio — no asset files
└── components/
    ├── Player.jsx     one skeleton, all characters, all poses
    └── Goal.jsx       the net (scenery, not a character)
```

### The fact ladder

Strands are ordered by difficulty; assignment is first-match, so every canonical
fact belongs to exactly one. Single-digit strands track mastery **per fact**;
multi-digit strands track it **per strand** — otherwise `73 + 48` would mint a
new record forever and localStorage would grow without bound.

Addition and multiplication collapse commutatively (`7×8` and `8×7` are one
record, presented in random order), which halves the table.

A strand opens when the previous one is 70% solid — or 40% if the child is
answering at ≥90% accuracy, so a competent ten-year-old isn't held in
"sums within 10" for sixty questions.

### Distractor guards

Rules propose candidates; guards decide which survive.

- non-negative, distinct, never the answer
- plausible magnitude (with a tighter ratio bound for small sums/differences)
- at most one option differing in digit count
- **no shortcut**: the answer must never be the only even number, nor — for ×
  and ÷ — the only multiple of an operand

Guards relax in a fixed order when a fact has too few candidates, pedagogical
ones surviving longest. Measured leak rate: parity 0.1%, multiples 7%.

### Shootout

Optional timed mode, offered only once a child already has the facts, and always
reachable rather than hidden. The rule that governs it:

> **A correct answer always scores. 100% of the time.**

The variability the owner asked for lives in the *spectacle* — a screamer, a
fingertip deflection, a scuffed retake — never in the outcome. A right answer
punished by chance is the textbook way to teach a child that effort doesn't
matter.

A timeout is not evidence of not knowing: the kick is still taken, untimed, and
the clock may **promote** a mastery box but never demote one. The clock derives
from the child's own median latency and may only tighten 10% per session.

---

## The rivalry

Each striker's club supplies an opponent — Haaland faces the Red Devil, Yamal
the White Wall, Bellingham the Blaugrana. The mechanic is one sentence:

> **The rival picks the questions. He never picks the outcome.**

He doesn't save your shots; he *chooses which shots you take*, drawing from
your lowest-box, most-missed facts. That is the spaced-repetition scheduler
wearing a costume — real resistance, hardest content drilled, and a correct
answer still scores every time. His selection rule is fixed and published, so
"he got harder" always has a visible cause: you mastered the easy ones.

Rivals are club-flavoured fictional keepers, never real people cast as
villains. The banter is warm and strictly one-directional: he greets you,
applauds your goals and shakes hands afterwards, and there is **no code path
that lets him say anything when you miss** — an opponent who reacts to failure
turns a knowledge gap into a social loss.

Kit note: the obvious club colours are unusable as a shirt. Man Utd red
measures 1.10:1 against the pitch, near-isoluminant; black fails just as badly
against the dark end. Every rival shirt clears 3:1 against both ends, and club
identity rides on hoops, gloves and trim instead.

## Your pitch

The mastery map (`🌱 Din plan`) shows all 315 tracked facts as turf you have
grown, not a score you have earned — an empty square is unplanted, not wrong.
No completion percentage, no miss counts; it counts what is grown, never what
is missing. The multiplication grid is symmetric across the diagonal, so
commutativity is visible for free.

The colour ramp is monotonic in lightness (surviving protanopia and
deuteranopia) *and* each cell fills from the bottom in proportion to its box,
so the level reads in pure greyscale. The accessibility fix and the
grass-growing metaphor are the same thing.

## Attention and executive function

Attention span is treated as a first-order constraint, not an edge case — and
`.claude/agents/adhd-expert.md` defines a standing reviewer with authority to
push back on shipped code.

The biggest thing that changed: **~14% of every session was time the child could
not act.** Fixed beats held for 1.9s per kick while the informational feedback
was already at 0ms — the button turns green instantly, so everything after that
was reward theatre rather than information. Beats are roughly halved, and a tap
on the pitch skips ahead entirely, which turns dead time into self-pacing.

Also: one-tap start (a Play button that opens another menu trains a child to
expect friction), 3-kick rounds so the entry price is low, a visible way out of
a round, the reveal no longer holds a frustrated child in place when it can't
requeue anything, and a 250ms lockout so a fast re-tap doesn't burn the second
attempt.

**Hyperfocus is not capped.** Interrupting it is what causes the meltdown, and a
cap teaches that engaging deeply gets you cut off. Instead fatigue degrades what
the next round *contains*, and `one more` / `done for today` get equal weight
after a long sitting.

## For grown-ups

`?parent=1` shows what is actually happening: facts known straight away,
first-try accuracy per operation as a count of N, a speed *direction* (never a
figure), which facts are being worked on with the strategy the app teaches
attached, and the dominant error pattern made actionable.

Written assuming the child reads it over a shoulder — no red, no norms, no
comparison to other children, no percentages as headlines, and gaps stated as
what's next rather than what's missing. The Shootout appears as participation
only: publish a timed score to a parent and some will start drilling the timed
mode, which is the exact failure the design avoids.

## Accessibility

Keyboard `1`/`2`/`3` answers, `Escape` menu, `Space` extends the Shootout clock.
Focus moves to the question (not an option) between kicks. Feedback is an
`aria-live` region. 56px minimum tap targets. Contrast fixed throughout — the
old success state was white on `#3cb371`, 2.7:1. `prefers-reduced-motion`
disables animation but keeps poses, which carry meaning. No red anywhere.

---

## Testing

```bash
npm test
```

183 tests. The valuable ones are property-based: every hint is checked for
arithmetic truthfulness across the whole fact space in both languages, every
generated question is checked for guard compliance across ~2000 items, and the
mastery engine is exercised by simulating children of different ability to
verify the ladder paces correctly for both a strong and a struggling child.

Regression tests exist for each fixed bug, named after the bug.

---

## TODO

### Gameplay
- [ ] Season structure: ties vs each rival, cup on clearing all five
- [ ] Challenge gates ("Uttagningen") that certify but never block content
- [ ] Mixed/interleaved rounds once two operations are unlocked
- [ ] Free numeric entry at box ≥4 (certifies recall, not recognition)
- [ ] Sudden death on a 5/5 Shootout

### Content
- [ ] More characters, including women players
- [ ] A custom player the child names and kits themselves
- [ ] Seasonal pitch themes

### Technical
- [ ] ESLint config
- [ ] RTL integration test for the full kick pipeline
