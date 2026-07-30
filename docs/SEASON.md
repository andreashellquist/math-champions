# Season structure — design

Status: **largely built.** Section 11 tracks what remains. This document is the plan to review before any
code lands. Everything here follows from two constraints agreed with the
pedagogy lead, which override any other consideration below:

> **1. No progression element may ever remove progress the child has earned.**
> Longer-by-content, yes. Longer-by-attrition, no.
>
> **2. A correct answer always scores.** The season may change *which questions
> are asked* and *how they are dressed*. It may never change whether a right
> answer goes in.

---

## 1. What "finishing" is

There is an end state, deliberately. An infinite treadmill is demotivating
precisely because nothing is ever completed, and "it never ends" is a poor
reason for an eight-year-old to open an app in month four.

**A completable core plus an uncapped maintenance layer.**

- **Season** — all four operations' core facts to box 5, each confirmed by a
  delayed retention check. Ceremony, permanent trophy.
- **After the season — Underhåll (Maintenance)** — 10–15 items per session
  driven purely by the Leitner due-queue, plus extension content. Framed as
  *staying sharp*, never as the game restarting.

### Length

| knob | value |
|---|---|
| items per 10-minute session | ~45 |
| **new facts introduced per session (the knob)** | **6–8, hard cap** |
| core fact space | 315 tracked facts + 11 sampled strands |
| introduction alone | ~40 sessions |
| + Leitner maturation and review load | **~110–130 sessions** |
| at 10 min/day, 5 days/week | **≈ 5–6 months** |

Do **not** lengthen the arc by lowering the introduction rate below 6/session.
That is padding: it starves the child of new material while inflating review
load, which is the most boring possible failure mode.

### Chaptering

Four competitions, so the child is never more than ~5 weeks from an ending. All
four are **visible from session 1**, named but greyed, so the whole arc is
legible.

| # | Swedish | content | ~sessions | rival |
|---|---|---|---|---|
| 1 | Cupen | addition core, within 20 | 25 | Röda Djävulen |
| 2 | Ligan | subtraction core | 30 | Vita Muren |
| 3 | Europacupen | tables 0–10 | 35 | Katalanska Muren |
| 4 | Finalen | division + mixed | 30 | Kanonjären |

Dynamiten is the season-five opponent in Maintenance, so all five rivals in
`src/game/rivals.js` have a home.

---

## 2. Rivalry as the progression frame

The rivalry **is** the progression system, not a parallel one. It gives the
abstract Leitner arc a face at no extra content cost.

- A **tie** against one rival = first to **3 round-wins**. A round-win is
  goals ≥ 4 of 5, reusing the existing 3-star band in `config.js`.
- A tie spans several sessions. Beat the rival → competition cleared, next
  rival opens.
- Clear all four → **season complete**, trophy awarded, **season N+1 starts
  with the difficulty band recomputed from current mastery.** It never ends and
  never gets easier. This is the direct answer to "it should not be too easy to
  finalize".

**A lost round never removes progress.** Ties have a *not-yet* state, never a
*lost* state. No relegation, no decrementing counters, no expiry. A league
table is explicitly rejected: points and a bottom-of-table position is a report
card.

---

## 3. Honest rival difficulty

Since a correct answer must always score, a rival cannot be made harder by
saving more. What legitimately varies:

**Real difficulty — lives in the maths**

| lever | mechanism | status |
|---|---|---|
| Question selection | rival draws from lowest-box, most-missed facts | **built** (`composeFixture`) |
| No opening gimme | derby round order drops the warm-up | to build |
| Option count | force 4 options regardless of box | to build |
| Round length | `reducer.js` already reads `r.totalKicks ?? TOTAL_KICKS` | free |
| Sudden death | `suddenDeath` flag exists, nothing sets it | to build |
| Distractors | misconception probes only, no magnitude-far decoys | to build |

**Presentation only — real feel, zero outcome effect**

| lever | note | status |
|---|---|---|
| Keeper height | best lever in the list: reads as harder, changes nothing | **built** (`scale`) |
| Kit pattern / gloves | cheapest characterisation per byte | **built** |
| Flourish bias | a fingertip graze feels like beating someone good | to build |
| Shootout clock | capped at `clockScale ≥ 0.8`, and **never applied when `extraTime > 1`** — that setting is the accessibility escape hatch and a rival must not claw it back | to build |

**Never varies:** whether a correct answer scores; whether a timeout demotes
mastery; the star thresholds.

**Difficulty must be legible.** The rival card shows three honest chips —
*Frågor*, *Klocka*, *Längd* — each 1–3 pips. A child can see exactly what makes
this opponent hard, which is what makes "harder" trustworthy rather than
superstitious.

---

## 4. Resistance: format escalation, not bigger numbers

Bigger numbers are a weak difficulty axis that mostly tests patience. Changing
the *retrieval demand* is real difficulty and raises retention.

| lvl | format | introduce when |
|---|---|---|
| 0 | 3-option MC | default |
| 1 | 4-option MC | op first-try ≥70% (last 20) |
| 2 | free numeric entry | op ≥85% **and** ≥20 mastered facts |
| 3 | missing operand | that specific fact at box ≥4 |
| 4 | interleaved mixed rounds | ≥2 ops at ≥80% |
| 5 | word problems | op at lvl 2; offered, never forced |

**Pre-empt the accuracy drop in copy**, or the child reads escalation as
regression:

> `Nu skriver du svaret själv. Det känns svårare — det är meningen. Det är så
> det fastnar.`

### Challenge gates — "Uttagningen"

One per competition, plus re-certification every ~30 sessions.

- **Predictable.** The child is told what's in it and shown a readiness
  indicator. No surprise assessments.
- **Only offered at ≥85% predicted pass.** A gate you're offered is a gate
  you're expected to pass. Gates **certify**, they do not filter.
- **MUST NOT block content — ever.** Failing never locks an operation, format,
  character or competition. The next operation unlocks on Leitner evidence
  regardless. Gates award insignia, not access. Blocking inverts the pedagogy:
  the child who fails would then get *less* variety and more of what they
  already struggle with.
- **Untimed.** Never combined with the Shootout clock.
- Bounded and visible: 20 items, ~4 min, `Fråga 8 av 20`.
- **Failure is diagnosis, not verdict:** `Du klarade 17 av 20. De tre som gled
  undan står först i kön nästa gång.` Those facts get boosted priority.
- Retry only after ≥1 intervening session — immediate retry teaches cramming.
- No pass/fail stamp, no grade, no red.

---

## 5. Progress markers

**The unit of visible progress is the week's delta, not the cumulative total.**
This is the most important line in the document. "38% complete" invites
grinding and simultaneously renders a 62%-shaped deficit. "6 new facts went
automatic this week" is true, specific, and re-earnable every week.

1. **Weekly card** — on first launch each week:
   > `Den här veckan`
   > `6 nya tal sitter automatiskt.`
   > `3 kom tillbaka och stannade.`
   > `Du är på A5 av A9 i addition.`

   Never a percentage. Never compared to last week's *number* — that
   manufactures a streak. A thin week reports without evaluation:
   `2 nya tal. Alla veckor ser olika ut.`

2. **The mastery map** — **built** (`MasteryMap.jsx`). Rename box levels to
   squad progression so demotion is legible without shame:
   `Provspel → Akademin → Reserv → A-truppen → Startelvan → Kapten`.
   A demotion reads `Den här går tillbaka till A-truppen för lite mer träning.`

3. **Trophy cabinet** — four competition trophies plus the season trophy.
   Permanent, non-decaying.

**Anti-grind guards:** no global completion % on any menu; progress always
shown toward the *nearest* marker, never toward the season — goal-gradient
motivates when the goal is close and demoralises when it isn't.

---

## 6. The overjustification test

Every progression element must pass **all five** before it ships.

1. **Information** — does it state something true and specific about what the
   child can now *do*? (`Nio-tricket: 10 nior i rad` passes. `Level 7` fails.)
2. **Contingency** — earned by demonstrated competence, or by
   volume/attendance? Attendance rewards are attendance schedules in
   competence clothing.
3. **Removal** — if deleted tomorrow, would the child still play? If honestly
   no, that thing is running the motivation, not the maths.
4. **Loss** — can it break, decay, expire or be revoked? **Automatic fail.**
5. **Fungibility** — can it be accumulated or spent as a generic quantity?
   Currency, XP, points-as-such: **automatic fail.**

Red flags specific to this build: a global XP total, a level-up not tied to a
named skill, a completion % headline, a weekly fixture with a breakable
counter, anything with a daily reset.

The season trophy, competition trophies, mastery map, skill badges and weekly
delta card all pass all five.

---

## 7. Persistence

Extends `emptyState()` in `mastery.js`. Requires **`STATE_VERSION` 2 → 3**, a
migration in `storage.js`, and clamping in `sanitize()` — new fields must be
sanitised on *every* load, not only migrations, per that file's own rule.

```js
rivalry: {
  season: 1,
  current: 'red_devil',            // active tie, null between seasons
  wins:  { red_devil: 2 },         // round-wins in the active tie, 0..3
  h2h:   { red_devil: [12, 15] },  // lifetime [won, played] per rival
  cups:  [{ season: 1, at: 1730000000000 }],
}
```

`h2h` is rendered as a **count, never a percentage**, and the "played" figure
is never shown as a loss tally. If wins are 0, the ledger string doesn't render
at all — `Nästa möte: …` shows instead.

---

## 8. Navigation

One new screen, everything else reuses existing surfaces.

- **`SeasonScreen`** — `.trophy-card` container, season header with earned cup
  glyphs, then four `.unlock-row`s: rival at `size={44} animate={false}`,
  nickname, tie-progress bar, lifetime ledger. Active rival's row takes the
  `.roster-card.selected` treatment.
- **Menu** — a one-line rivalry strip above PLAY. **Do not add a fifth
  button**; the strip itself is the tap target, as the mastery bar already is.
- **ModeSelect** — the existing `fixture-chip`.
- **ResultScreen** — three tie pips; `banter.wonTie` on a tie win, otherwise
  `banter.closeTie`.
- **TrophyScreen** — a "Troféer" section.

---

## 9. Prestige, after the season

Speed is the **wrong** primary axis — low ceiling, and the one axis with a
documented anxiety cost. In priority order:

1. **Depth: new content.** Multi-digit, money, fractions-lite, and **negative
   numbers as goal difference** — `−3` as a table position rather than an
   abstraction is a genuinely good football fit.
2. **Same facts, harder formats.** Full free-entry + missing-operand +
   interleaved is a materially different task on identical content.
3. **Tränarläge (Coach mode).** After mastering an operation the child chooses
   or writes the hint a fact should show: `Vilket knep skulle du ge en kompis?`
   The protégé effect is a real motivator *and* a real learning gain, and it
   costs almost nothing on top of the existing hint engine.
4. **Local two-player** — turn-taking, each player's goals shown separately,
   **no combined scoreline and no winner declared.** If competitive two-player
   is wanted, make it co-operative against the rival instead.

---

## 10. Hyperfocus — do NOT cap

**Amended after the ADHD review. An earlier draft of this document implied a
grind cap at 8 rounds. Do not build it.**

Hyperfocus is not a bonus mode; it is the *same* attentional dysregulation seen
from the other side. The impairment is in **shifting**, in both directions. A
child in productive hyperfocus on maths facts is in the rarest and most valuable
state this app will ever produce, and interrupting it externally:

1. wastes the state;
2. produces a disproportionate distress response — **the interruption causes the
   meltdown, not the stopping**;
3. teaches a durable lesson: *engaging deeply with this app gets me cut off.*

The real costs of hyperfocus are skipped meals, the crash afterwards, and
learning value decaying as fatigue rises. **A cap addresses none of them.**

What to do instead:

- **Never block, never grey out, never say "that's enough."**
- **Make the boundary the child's, at a natural break.** From round 7, `En till`
  and `Klar för idag` get *equal visual weight* on the ResultScreen. Equal weight
  is the entire intervention — the previous layout nudged toward continuing, and
  removing the nudge is enough. **Built.**
- **Act on content, not access.** If first-attempt accuracy over the last 10
  items falls ≥15 points below the session's own earlier baseline, switch the
  next round to `['warmup','review','warmup']` at 3 kicks. The child keeps
  playing and keeps succeeding; the learning value stops going negative. This is
  the honest version of a cap — it protects the pedagogy without touching
  autonomy.
- **Externalise elapsed time once per ~20 minutes.** Information only, no action
  attached, and *once*: `Du har spelat i en halvtimme. Du kan sluta när du vill
  — eller köra vidare.` A single neutral timestamp is a kindness; a repeated one
  is nagging.
- **The one legitimate hard boundary is the parent's**, fires only at a round
  boundary, and announces itself when set so the child knows the rule exists in
  advance. Predictable limits are tolerable; surprise limits are not.

---

## 11. Build order

- [x] `STATE_VERSION` 3 + `rivalry` persistence + sanitiser
- [x] Tie tracking on round end (round-win = goals ≥ 4)
- [x] `SeasonScreen` + menu strip
- [x] Derby: rival picks the questions, forced 4 options, difficulty pips
- [x] Weekly delta card
- [x] Format escalation: 4 options, missing operand, word problems, free numeric
      entry, interleaved mixed rounds
- [x] Fatigue degrades content rather than access (`isFatiguing`)
- [x] `STATE_VERSION` 4 — first-attempt latency ring, so the Shootout clock
      derives from the child rather than from content mastery
- [ ] **Uttagningen gates** — the last substantial piece. Certify, never block;
      untimed; only offered at ≥85% predicted pass; failure reported as
      diagnosis with the missed facts queued first.
- [x] Sudden death on a 5/5 Shootout — earned by a perfect round, never a
      tiebreak, ends on the first non-goal, capped at +10
- [x] Flourish bias per rival, `clockScale` floored at 0.8 and ignored entirely
      when `extraTime > 1`
- [x] Box-level names (`Provspel → Kapten`) so a demotion reads without shame
- [x] Parent view behind `?parent=1`
