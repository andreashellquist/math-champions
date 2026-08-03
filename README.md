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
| `npm run lint` | ESLint |
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

## Uttagningen — the challenge gates

Twenty questions, untimed, one per competition. It **certifies and never
filters**: passing awards an insignia, failing awards a list of facts to work
on, and neither outcome changes what the child can reach. A gate that locked an
operation would mean the child who fails then gets *less* variety and more of
what they already find hard, which inverts the whole design.

Three properties make it safe to offer:

- It is only offered when the model expects a comfortable pass, and the
  prediction is shown up front. A gate you are offered is one you are expected
  to pass; surprise assessment is what makes gates feel punitive.
- **Sitting one is free.** A gate may promote a mastery box but never demote
  one — the same asymmetric quarantine the Shootout clock uses. Otherwise
  volunteering for assessment is a gamble, and the rational move is never to
  sit one.
- Failure is a diagnosis, not a verdict: no pass/fail stamp, no stars, no grade.
  The headline is which facts got away, and they go to the front of the queue.

An insignia, once earned, cannot be revoked — later attempts can only raise the
best score.

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

265 tests. The valuable ones are property-based: every hint is checked for
arithmetic truthfulness across the whole fact space in both languages, every
generated question is checked for guard compliance across ~2000 items, and the
mastery engine is exercised by simulating children of different ability to
verify the ladder paces correctly for both a strong and a struggling child.

Regression tests exist for each fixed bug, named after the bug.

---

## Where progress lives

Four keys in `localStorage`. `mc_state` is the save (mastery, season, gates,
latencies) at version 5; `mc_settings` and `mc_week` survive a progress reset.

Three properties are deliberate:

- **Size is bounded by the fact space, not by play time.** Single-digit facts
  get one record each; multi-digit work is tracked per *strand*, or `73 + 48`
  would mint a record forever. Every array is a capped ring buffer.
- **Every read is sanitised**, not just migrated ones — boxes clamped, unknown
  keys dropped, `played` forced ≥ `won`. This exists because the original code
  did `parseInt(raw)` with no guard, and since `NaN < 20` is false, one corrupt
  value pinned a child to the hardest questions forever.
- **Migrations only ever add.** There is a test asserting an old save arrives at
  the current version with its facts and season intact.

`localStorage` is **per-device and per-browser** — there is no account and no
sync, and clearing site data loses everything. A backend would fix that properly
but means holding a child's learning record on a server, which is a different
product decision. The middle path is in the parent view: export a save file and
open it on the other device. Imported saves go through the same sanitiser and
migration chain as a normal load, so an older or tampered backup is upgraded and
clamped rather than trusted.

---

## Seasonal pitch

Four reskins tied to the Swedish calendar (`game/theme.js`), auto-selected
from the current month with a free manual override in the roster screen —
same rule as the character roster: cosmetic, never earned. Every theme keeps
roughly the *lightness* of the spring default; only the hue moves. The whole
app is light text and gold accents over a dark pitch, tuned against that
gradient in one place — a genuinely bright winter-white pitch would mean
re-auditing every light-on-dark string in the app, so winter is a night match
under floodlights with snow falling instead of a literal white field. Every
theme is measured to clear 3:1 contrast against both ends of its gradient.

## Snabbskott (arcade)

A fixed-content, personal-best sprint per operation — built after both the
pedagogy and ADHD reviewers were asked specifically whether a "highscore mode"
belonged in this app at all. Verdict from both: yes, with real changes to the
obvious version.

A later "shouldn't arcade just be endless?" question went back to both
reviewers. Both rejected the literal reading — an unbounded round scored
against a personal best turns "when do I stop" into a live cost-benefit
calculation, and at ~13 items answered per 30 seconds the raw score is noisy
enough (binomial sampling error, SD/mean ≈ 12%) that a longer window measures
skill more honestly than a longer one just measures luck. The verdict that
shipped: keep the external clock (it's what makes the score comparable across
runs at all), raise the default to **60 seconds** — halving the sampling
error to ≈ 8% and landing on "en minut," a duration a 7-year-old already has
an intuition for — keep 30s as the fast option, and add a genuinely separate
**free play** (`Utan klocka`, no timer, no score, no personal best) as the
honest way to satisfy the "endless" impulse without corrupting the scoring
mechanic it sits next to. Personal bests are keyed per `(set, duration)` pair
(`arcadeKey` in `mastery.js`) — a 30s run and a 60s run are different
measurements and must never shadow each other.

That review also caught a shipped bug the design conversation alone would
never have surfaced: the arcade chip never passed an item count to
`startRound`, so every arcade round silently defaulted to a 5-item cap and
ended in ~1.6 real seconds regardless of the clock, while the result screen
still claimed the advertised duration. Only visible by driving the real
menu → chip → round path — `pipeline.test.jsx`'s arcade test exists
specifically to keep that path exercised end to end, not just the reducer in
isolation.

It sits **fully outside the adaptive engine.** It never calls `applyAnswer` —
doing so would leak speed-pressured latencies into the number that sets the
Shootout clock, and would advance the counters that gate operation unlocks and
the Uttagningen cooldown. It has its own namespace (`mastery.arcade`) and
touches nothing else.

The headline is **this run's score, alone** — not a comparison against the
personal best. A monotone best is hit less and less often the more a child
plays; showing "no new record" as the modal outcome of a mode whose only goal
is beating your record would make repeat play mostly say no. A run-history
strip shows trend instead, and a softer "one of your best three" band fires
far more often than an outright record.

Content is a **named, fixed fact set — same facts, reshuffled order every
run.** Same order would mean a well-practised child starts answering from
screen position rather than computing; same content is what makes the score
comparable across attempts at all. Distractor values are seeded per fact (so a
set is never secretly easier or harder some runs) while their position varies
every run (so the layout can't be memorised either) — see `round.test.js`.

The clock finishes whatever item is already showing before it ends the round —
see `ARCADE_EXPIRE` in the reducer — so nothing is ever cut away under the
child mid-question.

---

## The squad, and creating your own

The roster (`characters.js`) started deliberately mixed — five men and two
women, so roughly half the audience had someone to be — and has grown
lopsided as names were added one request at a time (Bonmatí and Rolfö are
still the only women; worth another next time one goes in).

The backstop regardless is **create-a-player** (`CustomPlayerScreen.jsx`):
a name, a hairstyle, a hair colour, a skin tone, a kit and a shirt number, all
picked from swatches rather than a free colour input. A hex wheel can produce
a light number on a light shirt or a shirt that's unreadable against the
pitch; every swatch offered is a value already proven to work by an existing
squad member, so no combination a child can build comes out illegible. The
result is stored as a small, strictly-validated record in settings (never
raw hex or an arbitrary style string — see `cleanCustomPlayer` in
`storage.js`) and rebuilt into a real character at runtime, so a tampered or
hand-edited save can only ever fall back to a safe default, never render
broken.

## TODO

- [ ] Real cross-device sync, if it is ever worth the account and the server
