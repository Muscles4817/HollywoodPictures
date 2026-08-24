# Premise Corpus Expansion — Design Spec (v0.1 draft)

> Status: **draft, awaiting greenlight.** Nothing here is implemented. This is
> the plan for the one remaining phase of the premise work, written after the
> other four landed and deliberately shaped by what they taught.

---

## 0. Where this sits

| Phase | Name | Status |
| --- | --- | --- |
| 0 | Decouple the fixture rng | **landed** (#174) |
| A | Log-line chosen by hash, not by stream position | **landed** (#175) |
| B | Two-tier pools — effective pool 60.9 → 148.2 | **landed** (#176) |
| C | A log-line declares how many people it is about | **landed** (#177) |
| — | Sequels choose a log-line that fits their cast | **landed** (#178) |
| **5** | **Corpus expansion** | **this document** |

## 1. The finding that should reshape this phase

The corpus was never the bottleneck.

Effective pool — how many equally-likely log-lines would produce the repetition
a player actually experiences — went from **60.9 to 148.2** without a single new
sentence being written. The 342 entries were always there; most of them were
unreachable for most scripts, because the most specific bank won outright and a
Story Type bank holds five.

Two consequences:

1. **The deliverable is an effective-pool number, not an entry count.** "2,000
   entries" is an input. "A player meets N distinct ideas across a 10-year run"
   is the outcome, and the two came apart by a factor of 5.6 as recently as
   yesterday. `PREMISE_NOVELTY_DIAGNOSTIC` already measures the outcome; the
   corpus work should be gated on it moving.
2. **Exhaust allocation before volume.** Allocation is free and already
   instrumented. Volume costs weeks and cannot be undone cheaply.

## 2. The cost nobody estimates correctly

Phase C tagged **one** near-boolean field (`leads`) across 342 hand-written
entries. It took four rounds and three blocked reviews, and the field was wrong
after each of the first three. Not because the work was rushed — because every
guard written to police it was incapable of failing:

| attempt | why it could not fail |
| --- | --- |
| Regex on "two/three/four/twin" | Fitted to the entries already tagged. Two of its seven alternatives matched nothing in the corpus at all. |
| Allowlist of plural verbs | 15 of 32 verbs matched nothing; 8 real ones missing; blind to every collective noun, since "a family **is** forced" is singular. |
| Trailing `-s` conjugation rule | Right shape, two blind spots: `-ss` stems ("pass" → "passes") and irregular pasts. |

Scale that honestly: 2,000 entries × a schema of eight or ten fields is the same
problem roughly thirty times over. The published estimates for corpus pipelines
(8–12 human hours per 1,000) cover *reading prose*. They do not cover verifying
structured fields, and structured fields are the entire reason for doing this.

### 2.1 The design rule that follows

**Every schema field must be machine-checkable, or it will be wrong at scale.**

A field is checkable if a violation can be detected from the entry's own text by
a rule, not by a reader's judgement. Concretely:

| checkable | not checkable |
| --- | --- |
| `leads` — conjugation + collective-noun head | "emotional depth: 7" |
| `setting` — tag against the archetype list | "how fresh does this feel" |
| "promises a chase" — keyword + tone agreement | "is this a good idea" |
| `register` — closed enum | free-text theme |

Anything in the right-hand column belongs in prose, not in a field. A number a
human has to eyeball is a number that will drift.

### 2.2 The second rule

**Write the validators first and prove them on the existing 342.**

This is the single most transferable lesson from phases A–C. Run each proposed
validator against the hand-written corpus:

- If it finds **nothing**, it is fitted to your assumptions and will wave 2,000
  generated entries through exactly as blindly.
- If it finds **real problems in hand-written text**, it will police generated
  text.

Phase C's final guard found 19 genuine errors in a corpus a human had written
and two humans had reviewed. That is what a working validator looks like.

## 3. Plan

### Phase 0 — the free wins, before any generation

Finish what #176 deferred: the **per-save ledger**, so a save does not repeat a
log-line until it has exhausted the pool. With 342 entries and ~235 draws per
in-game year, that is roughly the first year and a half of any playthrough
entirely repeat-free — which is when a player is paying most attention.

No content, small change, and it moves the *felt* result more than the next 500
entries would. **OPEN:** whether this alone is enough to defer the rest of the
phase for a while.

### Phase 1 — schema, validators, eval set

Design the concept schema against §2.1. Write the validators. Run them on the
342. Fix what they find. **Generate nothing yet.**

The existing corpus is the eval set for the validators, and it is free.

### Phase 2 — the blind gate

Produce ~40 entries. Mix with 40 hand-written. If generated entries are reliably
identifiable, the pipeline is not ready and volume will not fix it.

One evening, decisive, and it happens before any money is spent.

### Phase 3 — generate against measured demand

`PREMISE_NOVELTY_DIAGNOSTIC` reports the most-repeated log-lines. That is a map
of precisely which pools are starved. Authoring against it gets most of the
perceived-novelty win for a fraction of a uniform 2,000.

**Target:** an effective-pool figure set by playtesting, not by arithmetic. The
diagnostic's assertion floor moves with it.

### Phase 4 — ship it without doubling the download

~2,000 entries is roughly **+600 KB gzipped** against a current 467 KB bundle,
in a browser game with zero dynamic imports today. Genre-split lazy loading has
to be designed in, not retrofitted.

## 4. Ideas worth considering

**A signature tier.** A small set of genuinely distinctive premises, used **once
per save then permanently retired**. Exhaustion degrades to blandness rather
than repetition, which is the right failure mode: a striking image reused is
noticed far faster than a bland one reused ten times. Requires Phase 0's ledger.

**Make each entry do more mechanical work.** `leads` is currently the only field
with teeth, and it alone produced visibly different scripts. Every further
consequence — this premise implies a chase, a single location, a period setting —
makes the *same* entry generate more distinguishable films. Variety in
consequences reads as variety. This is a multiplier on content you already own.

**Generate structured concepts, render prose from them.** Never generate prose
and parse structure back out. Beyond matching what every shipped system does, it
is the only version that can be validated: structured fields can be checked
field by field, free prose can only be read by a tired reviewer in week three.

## 5. Risks

| Risk | Mitigation |
| --- | --- |
| Volume bought before allocation is exhausted | Phase 0 first; gate on effective pool, not entry count |
| Structured fields wrong at scale | §2.1 — no field that a rule cannot check |
| Validators fitted to assumptions | §2.2 — prove them on the 342 first |
| Reviewer fatigue accepting forgettable entries | Halve the corpus, double the review per entry |
| Bundle doubles | Genre-split lazy loading from the start |

## 6. Explicitly out of scope

Runtime generation of any kind. The game stays deterministic, offline and
dependency-free; a language model is an authoring-time tool and nothing it
touches ships except reviewed static data.
