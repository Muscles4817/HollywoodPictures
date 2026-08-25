# Code quality — bounded quantities, clamps, and saturation

A standing reference, written because the same defect keeps being reintroduced.
It is short on purpose. If you are about to write `Math.min(1, ...)`, read it.

## The rule

**A clamp that binds is a modelling decision wearing a safety check's clothes.**

Clamping is not banned — some of it is correct and unavoidable. But every clamp
in engine code falls into one of three categories, and only one of them is fine
to write without thinking:

| Kind | Example | Verdict |
|---|---|---|
| **Domain** — restating a bound the value already has by definition | `clamp(fame, 0, 100)` on a stat that is 0–100 | Fine, but it belongs at **construction**, not at every use. See *Bounded types* below. |
| **Saturation** — several effects competing for something genuinely finite | crowding cannot take more than all of a film's screen access | Real physics. But a **hard cap is the wrong tool** — see *Saturate, don't cap*. |
| **Band-aid** — the formula produces values outside its own range, so someone capped it | weights summing to 1.2 against a ceiling of 1.0 | **This is a bug.** Fix the formula. |

## The diagnostic: does it bind?

You cannot tell kind 1 from kind 3 by reading the code. You have to measure how
often the clamp actually engages on real data.

- **Never binds** → dead insurance. Harmless, but it is also noise that hides
  the clamps that matter.
- **Binds often** → it is doing the modelling. Every input above the cap now
  produces the same output, and whatever those inputs were carrying is gone.

Write a throwaway probe, run it against a simulated year or two, and count. Two
real examples from this codebase, both found that way:

```text
computeRivalReleaseStrength   bound on 0 of 26 productions, max raw 0.979
                              -> insurance. Harmless.

computePlayerReleaseStrength  identity 100, budget £200M:
                                marketing £150.0M  raw 1.200 -> 1.000
                                marketing  £75.0M  raw 1.150 -> 1.000
                                marketing  £37.5M  raw 1.099 -> 1.000
                                marketing  £15.0M  raw 1.032 -> 1.000
                              -> a TENFOLD marketing cut, and the number never
                                 moved. The cap had eaten the entire term.
```

That second one is the worked example. Three weights (0.7 marketing + 0.3 scale
+ 0.2 identity) summed to a possible **1.170** against a ceiling of **1.0**, and
`Math.min(1, ...)` held the line. The consequence was not a slightly-wrong
number: a mid-size on-brand film read *exactly as strong as a £150M tentpole*,
and a studio in that region could slash its marketing 90% with rivals steering
around it just as hard. A real decision, deleted, invisibly.

## Saturate, don't cap

When a quantity genuinely saturates, say so **smoothly**. A hard cap and a soft
approach encode the same physical claim; only one of them destroys information.

Two shapes already in the engine, both reusable:

**`liftTowardCeiling(base, lift)`** (`engine/bounded.ts`) — for a bonus that must
not push a bounded value past its ceiling. Applies the lift as a share of the
headroom left, so it is strictly monotonic, needs no clamp behind it, and leaves
`lift = 0` reading *exactly* as it did before. It also usually says something
truer than a flat bonus: an advantage is worth more where there is room to grow.

**`crowdingFromPressure`** (`engine/releaseCrowding.ts`) — for several effects
compounding toward a ceiling. Passes through unchanged below a soft knee, then
approaches 1 asymptotically. This one exists *because the hard version was
measured*: 92% of head-on days for a weak film sat at exactly the clamp, so a
merely-contested date and a ruinous one read identically.

Both leave the calibrated range untouched and only change behaviour where the
old code was flat.

## Bounded types

`engine/bounded.ts` provides `Unit` (0–1) and `Stat` (0–100) as branded numbers,
with `unit()` / `stat()` as the only way in. They are numbers at runtime with no
wrapper cost, and they pass anywhere a `number` is wanted — but a raw `number`
cannot be assigned to them. That asymmetry is the whole mechanism: **the bound
lives at construction, once, instead of at ~540 use sites.**

Arithmetic on them yields a plain `number`, which is deliberate. The moment you
combine two bounded values you are back in unbounded space and have to state,
explicitly, what the result's bound is and why.

### Where the boundary is, and why

**Computed engine values: branded.** This is where invariants actually get
violated and where the clamps pile up.

**Hand-authored data tables (`src/data/`): plain `number`.** Branding
`NormalizedScalar` was tried and measured: 1,270 type errors, **1,071 of them in
hand-authored constant tables** (`testScripts.ts`, `settings.ts`,
`storyTypes.ts`, `referenceScripts.ts`). Wrapping every literal `0.4` in those
files buys no safety — a literal in a table is trivially verifiable — and it
directly damages the "rebalance by editing `data/`" convention that makes this
simulation tunable. So `NormalizedScalar` stays a plain `number` alias for
authored data; `Unit` is the type for anything the engine computes.

### Migrating

Not a big-bang rewrite — there is no behavioural benefit and a large risk.
**Adopt on touch**: when you change a function that clamps, ask which of the
three kinds it is, and convert it. Leave a note if you decide a clamp stays.

## Checklist before writing a clamp

1. Is this value bounded **by definition**? → construct it through `unit()` /
   `stat()` and delete the clamp.
2. Can the formula **exceed its own range**? → the formula is wrong. Renormalise
   the weights, or use `liftTowardCeiling`.
3. Does it genuinely **saturate**? → use a soft knee, not `Math.min`.
4. None of the above, and you still want the clamp? → **say what it is protecting
   against, in a comment**, and note whether you checked that it binds.
