# Design Review: Casting Redesign — Producing a Cast Instead of Buying Actors

Status: **pure conceptual exercise - no code, no implementation.** Builds
directly on three already-shipped systems: the Person model (canonical
identity + role-specific careers, `types/index.ts`), the Character and
Setting Foundations milestone (`ScriptCharacter`/`CharacterTraitProfile`,
`engine/castRequirements.ts`, `engine/compatibility.ts`), and the Producer
Workspace (`components/projectWorkspace/`, free navigation between
Overview/Cast & Crew/Production/Finance). Nothing here is decided until
it's built and folded into `DESIGN.md`.

---

## TL;DR

- **The hard part is already built.** `computeActorCharacterCompatibility`
  (`engine/compatibility.ts`) already scores a specific actor's
  `ActingStyle` against a specific `ScriptCharacter`'s traits - that
  function *is* the Suitability score this redesign asks for. This
  proposal is mostly about **when and how the player sees that number**,
  not about inventing new scoring math.
- **One appeal function, three front doors.** Open Casting, Direct
  Approach, and Interested Talent (talent approaching the studio) are not
  three systems - they're three different ways of surfacing and resolving
  the *same* `computeActorAppeal` calculation (§3). Open Casting rolls it
  against a generated candidate pool every week; Direct Approach rolls it
  once against a specific person the moment the player makes an offer;
  Interested Talent rolls it in reverse, checking unattached people
  against the studio's open slots each week and surfacing the ones who'd
  say yes. Building three separate acceptance systems would be the
  mistake here.
- **Casting stays per-Character, not per-role-slot.** Today's Cast & Crew
  hub has one tile for "Lead Actor" covering however many leads the script
  needs (`effectiveRoleCapacity`). This redesign splits that into one row
  per `ScriptCharacter` of Lead/Supporting prominence - `characterForRoleSlot`
  already establishes this exact positional mapping, it's just never been
  surfaced as the primary browsing unit. **This is the single biggest UI
  complexity risk in the whole proposal** (an eight-character ensemble
  script means eight parallel casting states) and I address it directly in
  §8.
- **Director-first is a readiness rule, not a new mechanic.** Nothing about
  `deriveProjectReadiness` currently orders `missing-director` before
  `missing-lead-cast`; both just fire independently. Making Director-first
  *meaningful* is one new blocker condition, not new architecture.
- **I'm recommending against a new "actor values" taxonomy.** The brief
  asks for Brand-vs-Prestige weighting that varies per actor. I'd derive
  that from three fields that already exist on `Person`
  (`reputation.prestige`, `personality.ambition`, `personality.ego`) rather
  than adding a stored preference stat - see §4's pushback.
- **Casting Director is optional, same shape as VFX Supervisor** - doesn't
  block anything, biases an existing calculation (applicant curation) when
  present, absent entirely and everything still works, just wider variance.
- **Phasing (§12) puts the character-first UI reframe and terminology pass
  first, real accept/reject third.** Rejection is the one change with
  genuine softlock risk (§8), so it ships after the no-softlock widening
  formula exists, not before.

---

## 0. What "Suitability" already is, and isn't

Before designing anything new, it's worth being precise about what
`computeActorCharacterCompatibility` already gives us, because the whole
redesign leans on it:

```ts
// engine/compatibility.ts - already shipped, Character and Setting Foundations milestone
export function computeCharacterCompatibility(actingStyle: ActingStyle, traits: CharacterTraitProfile): number
export function computeActorCharacterCompatibility(person: Person, character: ScriptCharacter): number | null
```

This is a direct, unweighted comparison across the five `ActingStyle`
axes and their matching `CharacterTraitProfile` fields
(`characterTransformation`↔`transformationDemand`,
`emotionalPerformance`↔`emotionalDemand`, `charisma`↔`charismaDemand`,
`comedy`↔`comedyDemand`, `physicalPerformance`↔`physicalDemand`). It
answers *only* "does this actor's craft suit this role" - it knows
nothing about fame, salary, availability, or whether the actor would
actually say yes. That's correct and shouldn't change: Suitability is one
input to Appeal (§3), not a replacement for it. The redesign's job is to
build the other inputs and combine them - not to touch this function at
all.

---

## 1. New state: the Casting Call

A character's casting status needs to be more than "cast or not cast."
Today a `FilmDraft`'s `talent: TalentAssignment[]` is the only cast-related
state, and it's flat - a person is either assigned to a role or they
aren't. Open Casting needs something that persists *between* assignment
attempts: a call that's open, has a channel, and accumulates applicants
over time.

```ts
export type CastingChannel = 'OpenCasting';
// Future: 'AgencyOutreach' | 'PersonalNetwork' | 'InternationalSearch' | 'EmergingTalentSearch'
// See §9 - deliberately a union of one today so later channels are a
// variant addition, not a redesign.

export interface CastingCall {
  id: string;
  characterId: string; // ScriptCharacter.id - one call per Character, not per role
  role: 'Lead Actor' | 'Supporting Actor';
  channel: CastingChannel;
  openedOnDay: GameDay;
  nextApplicantCheckDay: GameDay; // mirrors engine/opportunities.ts's nextGenerationCheckDay
  applicants: CastingApplicant[];
}

export interface CastingApplicant {
  person: Person; // browsable candidate, same "hold the object, not an id" pattern
                   // state.talentPool already uses for candidate browsing
  appliedOnDay: GameDay;
}
```

`FilmDraft` gains `castingCalls: CastingCall[]`. Suitability, Interest,
salary ask, and availability are **not** stored on `CastingApplicant` -
they're derived at display/decision time from `person` + the current
`script`/`studio`/`director` state, the same "derive, don't roll and
store" principle the codebase already applies everywhere else (`docs/DESIGN.md`
§5.34's own header comment, `engine/commercialProfile.ts`'s entire reason
for existing). The only thing worth freezing is *who applied and when* -
re-deriving their fit every render is cheap and always current; re-rolling
who showed up every render would be wrong.

A call closes (stops accumulating new applicants, keeps existing ones
visible) either when the player casts the role or explicitly ends it -
there's no fixed duration, unlike the original brief's "open for a chosen
duration." I'd cut the duration picker: it's a decision with no real
stakes attached (nothing bad happens if a call stays open longer), and
`docs/DESIGN.md`'s own "does anything need to observe or branch on this"
test (`DESIGN_REVIEW_development_pipeline.md` §6, applied to Talent
states) says no. The call just stays open until resolved.

---

## 2. Applicant generation

New weekly-cadence function, structurally identical to
`engine/opportunities.ts`'s existing generation timer
(`WEEK_LENGTH_DAYS`, `nextGenerationCheckDay`):

```ts
function generateCastingApplicants(
  call: CastingCall,
  character: ScriptCharacter,
  script: Script,
  studio: Studio,
  director: Person | undefined,
  castingDirectorSkill: number | undefined, // undefined = no Casting Director hired
  talentPool: Person[], // state.talentPool.Actor
  rng: RandomFn,
): Person[]
```

Each weekly tick draws a small batch from the Actor talent pool, weighted
by `computeActorAppeal` (§3) rather than sampled uniformly - people who'd
plausibly be interested in this specific role show up more often, people
who wouldn't (wrong prestige/brand fit, salary target this project can't
reach, already booked through the shoot) show up less, not never. This
reuses `findCandidatesNearPrice`'s existing weighted-sampling shape rather
than inventing a new one.

**Casting Director skill affects two independent things**, per the
brief's own point 5 - and I'd keep them genuinely independent parameters
rather than one dial, because "more applicants" and "better applicants"
are different promises to the player:

- **Volume**: batch size scales modestly with skill (a skilled Casting
  Director's *network* is bigger, not just their taste).
- **Curation**: the appeal-weighted sample gets progressively biased
  toward the high-suitability tail as skill rises, plus a separate,
  small, skill-scaled chance per tick of injecting a "discovery" - a
  low-fame, high-suitability person pulled preferentially rather than at
  the pool's natural low-fame frequency. No Casting Director hired =
  unbiased sampling (wide variance, occasionally a star applies out of
  nowhere, occasionally the whole batch is mediocre) - exactly the "the
  producer can do this themselves, a specialist just makes it better"
  shape `VFX Supervisor` already establishes as optional
  (`components/wizard/RoleHiringDrawer.tsx`'s existing genre-hint pattern,
  §12).

---

## 3. The one appeal function

This is the actual new piece of logic in this whole redesign - everything
else is UI, state shape, and reuse.

```ts
export interface ActorAppealFactors {
  suitability: number;          // computeActorCharacterCompatibility - reused directly, unchanged
  brandFit: number;             // studio.brand, weighted by this actor's commercial lean
  prestigeFit: number;          // studio.prestige + script quality + director reputation, weighted by this actor's prestige lean
  salaryFit: number;            // offered salary vs. this actor's minimumSalary/typicalSalary
  scheduleFit: number;          // derived from deriveBookedUntil vs. the project's planned start day
  attachmentMomentum: number;   // derived from who's already attached to *this* project - see below
}

export function computeActorAppeal(person: Person, character: ScriptCharacter, script: Script, studio: Studio, director: Person | undefined, currentTalent: TalentAssignment[], offeredSalary: number, plannedStartDay: GameDay): ActorAppealFactors & { overall: number }
```

**Attachment momentum, derived rather than stored** (folding in the
Additional Notes' "production momentum" point): a major name signing
should make the rest of the cast easier to attract, but I'd resist making
that a stored, decaying value the way "momentum" usually implies. Nothing
here needs to decay because nothing here needs to be remembered past the
current shape of `currentTalent` - `attachmentMomentum` is just a fresh
read of who's *currently* attached to this specific project (the
director, and whoever's already cast), weighted by their own fame/prestige,
recomputed every time `computeActorAppeal` runs. Sign a bigger star,
`currentTalent` changes, every other applicant's `attachmentMomentum`
term is higher on the very next calculation - no tick, no separate state,
no decay curve to tune. This keeps momentum project-scoped rather than
studio-scoped by construction (it can only ever reflect *this* film's
attached talent, never leaks into another project), and costs nothing
beyond one more read of already-live state - the same "derive from what's
already true" instinct as `computeSchedulePressure` deriving pressure
from `daysElapsed`/`recommendedDays` rather than storing a pressure value.

**Prestige-vs-commercial lean, derived rather than stored** (pushing back
on the brief's own framing here): the brief asks for actor personalities
that determine how much they value Brand vs. Prestige, which reads like a
new stored preference. I'd derive it instead from three fields `Person`
already has:

- `reputation.prestige` - a person who already carries real critical
  standing plausibly *keeps caring* about it.
- `personality.ambition` + `personality.ego` - high ambition/ego without
  correspondingly high prestige reads as commercially hungry (wants to
  *become* a bigger star, cares about Brand/visibility/salary more than
  the studio's critical standing).

A simple linear combination of those three existing fields gets you "the
same studio is attractive to different actors for different reasons"
without a new taxonomy. I'd start here and only add a dedicated stored
axis later if this formula genuinely doesn't differentiate actors enough
in practice - adding the general mechanism *before* confirming the simple
version is insufficient is exactly the premature-generality trap this
codebase's own conventions warn against (`CLAUDE.md`-equivalent guidance:
no abstraction beyond what's demonstrated to be needed).

**Script quality's contribution** reuses `computeScriptScore`
(`engine/scoring.ts`) directly rather than reading craft stats piecemeal -
one already-calibrated number, not a second one invented for this.

**This single function is what both Open Casting's weighting (§2) and
Direct Approach's accept/reject roll (§5) call.** An actor who'd show up
readily in an Open Casting pool for a role should read as similarly
receptive if the player instead Direct-Approaches them - same inputs, same
formula, two different presentations of the result (a ranked list vs. a
yes/no roll). Divergent formulas for the two paths would be a real bug
waiting to happen (a player discovering Direct Approach "feels different"
from Open Casting for no in-fiction reason).

---

## 4. Reputation and Brand/Prestige - what changes, what doesn't

Nothing about `engine/reputation.ts` or `Studio.brand`/`Studio.prestige`
changes shape. This redesign is a new *reader* of those two stats, not a
new writer. The only new logic is the per-actor weighting described in
§3 - Brand and Prestige themselves stay exactly what they are today.

---

## 5. Direct Approach

One offer action, resolved via `computeActorAppeal` against an
acceptance threshold. The threshold itself should scale with the actor's
own selectiveness (`reputation.fame` and `personality.ego` both plausibly
raise the bar - a bigger star needs a stronger overall pitch to say yes to
anything), not be a single fixed cutoff - this is the same "the target
moves based on who you're asking" shape `deriveProjectReadiness`'s
existing thresholds don't have but arguably should for this specific
mechanic.

Per the brief's own point 8, the response is a discriminated type from
day one, even though only two variants exist at launch:

```ts
export type OfferResponse =
  | { status: 'accepted' }
  | { status: 'rejected'; reason: 'suitability' | 'brand-prestige-mismatch' | 'salary' | 'schedule' };
// Future: | { status: 'countered'; counterTerms: OfferCounterTerms }
```

Surfacing `reason` (the single lowest-scoring `ActorAppealFactors` field)
costs nothing extra to compute and gives the player something actionable
("they turned it down over money" vs. "they didn't buy the project" are
different next moves) - matching how `deriveProjectReadiness`'s own
warnings are always specific, never a bare boolean.

This is also where the discriminated-union choice pays for itself
immediately, not just for the future: adding `'countered'` later is a
type-union addition plus one new UI branch, not a shape migration.

---

## 6. Interested Talent (inbound)

The reverse of Direct Approach, using the identical `computeActorAppeal`
function: each weekly tick, for each open `CastingCall`, roll a small
number of currently-unattached, plausibly-interested people from the pool
against that call's appeal threshold, and inject any that clear it
straight into that character's "Interested Talent" list without the
player having searched. Surfaced via a notification through the existing
`components/common/Inbox.tsx` - this is exactly the kind of event that
component already exists to host, not a new UI surface.

This is genuinely cheap once §3 exists: it's the same formula, same
threshold shape as Direct Approach's acceptance check, just iterating over
"which unattached people would say yes to this" instead of checking one
specific person the player named.

---

## 7. Explaining appeal - natural-language reasons, not raw numbers

Folding in the Additional Notes' points 3/4: `ActorAppealFactors` (§3)
should never surface to the player as five raw numbers. This codebase
already has a working pattern for exactly this translation job -
`engine/scriptPresentation.ts`'s `describeSettingImplication`/
`describeCharacterDemands`/`describeCommercialAppeal`/`describeCostDrivers`,
each turning a numeric profile into a short, capped sentence rather than
a stat block. I'd add a sibling module, `engine/castingPresentation.ts`,
doing the same job for `ActorAppealFactors`:

```ts
export function describeApplicantInterest(factors: ActorAppealFactors): string
export function describeOfferRejection(factors: ActorAppealFactors): string
```

Both read off the same underlying data, just pick a different pole of it:
`describeApplicantInterest` names the one or two *highest*-scoring
factors ("Excited by the screenplay," "Wants to work with this director,"
"Drawn to the studio's prestige"), `describeOfferRejection` names the
single *lowest*-scoring one ("Salary below expectations," "Already
committed elsewhere," "Not convinced the role suits them"). This is the
exact same `reason` field `OfferResponse` already carries in §5, just
generalized into prose and reused on the *applicant* side (§2/§6) as well
as the rejection side, rather than inventing a second, parallel
explanation system. One appeal function (§3), one description module
reading it from both directions - not two.

---

## 8. Character-first Cast & Crew UI

The Cast & Crew workspace section keeps its existing role-tile grid for
Director/Writer/Cinematographer/Composer/Editor/VFX Supervisor - none of
that changes; those roles were never character-attached and the brief
doesn't ask them to be. What changes is Lead Actor/Supporting Actor:
instead of one tile per role showing an aggregate "0/4 hired" count, it
becomes **one row per `ScriptCharacter`** of Lead/Supporting prominence,
each showing name, prominence, archetype label, and its top demand notes
(reusing `describeCharacterDemands`, `engine/scriptPresentation.ts` -
already built, already used on `ScriptDetails`/`FilmDetailModal`) plus a
compact casting-status chip (Not started / Open Casting - N applicants /
Cast: `<name>`).

**On "scene count" from the brief**: I'd cut this specifically.
`ScriptCharacter` has no scene-count field today, and adding one purely
for this display would be new stored data with no other consumer -
exactly the kind of cosmetic-only stat the Character and Setting
Foundations milestone's own section 9 (interpretable through *existing*
fields, not new arbitrary ones) already argued against. Prominence +
`describeCharacterDemands`'s existing summary sentence already communicates
"how big a part is this" without inventing a number nothing else reads.

**On the ensemble-complexity risk flagged in the TL;DR**: selecting a
character opens a drill-in panel (Open Casting / Direct Approach /
Interested Talent, one screen, tabbed) rather than expanding all eight
characters' full detail inline - the same "compact list, details on
demand" principle `docs/DESIGN.md`'s screenplay-redesign sections
established for script cards (`ScriptDetails.tsx`'s own Setting/Cast
sections cap themselves at a few lines per character for exactly this
reason).

**Director-first gating**: `deriveProjectReadiness` gains one new rule -
Lead/Supporting Actor casting (Open Casting, Direct Approach, and
Interested Talent alike) stays visually available but its appeal
calculations read as meaningfully weaker without a Director hired (no
`director.reputation` term to draw on in §3, and the UI surfaces this as
a soft nudge - "hiring your Director first will attract stronger
interest" - rather than a hard block. A hard block risks exactly the kind
of dead-end `docs/DESIGN.md`'s own Producer Workspace section already
moved away from (free navigation, nothing forces a fixed order) - I'd
keep casting *technically* possible pre-Director, just visibly worse, so
the incentive is real without reintroducing the linear-wizard constraint
the Producer Workspace redesign deliberately removed.

---

## 9. No softlock

Per the brief's point 7, and my own concern raised before this document:
once actors can say no, `missing-lead-cast`/`missing-supporting-cast`
(`engine/projectReadiness.ts`) need a guaranteed path to resolution, not
just a hope that enough applicants eventually say yes.

Widening formula, keyed off elapsed time and rejection count - both
already-available signals (`currentDay - call.openedOnDay`, a count of
`OfferResponse.status === 'rejected'` against this character) - shifting
three things in `generateCastingApplicants`/`computeActorAppeal` as either
grows:

- Applicant pool size increases.
- The effective acceptance threshold used by Interested Talent (§6) and
  the *presentation* of Open Casting applicants' own selectiveness both
  soften.
- The Casting Director "discovery" chance (§2) rises even without one
  hired, at a lower base rate.

This is the same shape as `computeSchedulePressure` already uses
(`engine/production.ts`) - a pressure value derived from elapsed-vs-expected,
not a new mechanic type. No project should ever be *structurally* uncastable;
worst case, the player is looking at a wide-open, low-selectivity pool
after enough real-time has passed, which is a legitimate producer
experience ("we widened the search") rather than a dead end.

---

## 10. Search methods as future design space

Per the brief's point 4: `CastingChannel` (§1) is a union of one today
(`'OpenCasting'`) specifically so `AgencyOutreach`/`PersonalNetwork`/
`InternationalSearch`/`EmergingTalentSearch` are variant additions later,
each presumably biasing `generateCastingApplicants`'s sampling differently
(Agency Outreach: fewer, more established, pricier; Personal Network:
who the Director/producer already knows, keyed off some future
relationship-history concept; Emerging Talent: skewed toward low-fame/
high-suitability, a permanent version of the Casting Director's
"discovery" roll). None of this needs designing now - the union type is
the only thing that needs to exist now, and it costs nothing.

---

## 11. Casting Director role

New `ProductionRole` value, `'Casting Director'`, added to
`OPTIONAL_TALENT_ROLES` (`data/talentGeneration.ts`) alongside `VFX
Supervisor` - same "doesn't block Greenlight, materially improves an
existing mechanic when present" shape, including a
`RoleHiringDrawer.tsx`-style contextual hint (today's `showVfxHint`
pattern: "This genre benefits strongly from VFX" → "This script's ensemble
size means a Casting Director will save real time"). A skill-based
`CrewCareer<'Casting Director'>`, identical shape to `Writer`/
`Cinematographer`/`Composer`/`Editor` - no new career-shape work, just a
new discriminant value.

---

## 12. Terminology

Per the brief's closing note: player-facing copy moves from
hire/hired/hiring language to cast/offer/approach/attach language
throughout the Cast & Crew workspace - "Not yet hired" → "Not yet cast",
a bare "Hire" button → "Cast" (Open Casting instant-pick, once that still
exists) or "Make Offer" (Direct Approach), and so on.
`RoleHiringDrawer.tsx`'s existing "Casting For" header is already exactly
the right register - it's the rest of the surrounding copy that needs to
catch up to it.

I'd scope this to **player-facing strings only** for now. Renaming the
underlying identifiers - `RoleHiringDrawer.tsx`, `HireTalent.tsx`,
`SET_TALENT_FOR_ROLE`/`TOGGLE_TALENT_FOR_ROLE`, `state.talentPool` - is a
large, purely mechanical, low-risk-but-high-diff-noise sweep with zero
behavioral payoff. Bundling it into the same PRs as the functional
changes this document proposes would make every diff harder to review for
no reason (`docs/DESIGN_REVIEW_development_pipeline.md`'s own "reviewable
commits" discipline). I'd do it, if at all, as its own standalone
housekeeping pass after the functional work lands and the new names have
settled - renaming `RoleHiringDrawer.tsx` before Direct Approach exists
just means renaming it again later.

---

## What this deliberately does not touch

- `computeActingScore`/the quality pipeline (`engine/scoring.ts`) -
  completely unchanged. This redesign changes *how* a Person ends up in a
  `TalentAssignment`, never how that assignment is scored once made.
- Crew roles other than the new Casting Director - Director/Writer/
  Cinematographer/Composer/Editor/VFX Supervisor stay on today's
  instant-hire role-tile model. The brief's "director selection should
  happen before meaningful casting" is honored as a readiness signal
  (§8), not by folding Director into the character-casting UI itself.
- Agents, real negotiation beyond `OfferResponse`'s binary today,
  chemistry between actors, deadlines, competing simultaneous offers,
  awards history - all explicitly named as future work by the brief
  itself, and the types proposed here (`CastingChannel`, `OfferResponse`)
  are shaped specifically so those land as additions, not rewrites.
- Persistent relationship/collaboration history across films (an actor
  "remembering" working with this studio or director before) - out of
  scope, consistent with the Character and Setting Foundations
  milestone's own IP-boundary decision (`docs/DESIGN.md` - no
  persistent cross-film identity yet).
- Save shape/migration - a `FilmDraft.castingCalls` field is new required
  state once built, meaning a `SAVE_KEY` bump with no migration code,
  following this project's established convention
  (`state/persistence.ts`'s 30+ prior shape-break comments).

---

## Challenges, consolidated

1. **No fixed casting-call duration** - §1. The brief's "open for a
   chosen duration" adds a decision with no real stakes; I'd let calls
   stay open until resolved instead.
2. **No new "actor values" taxonomy for Brand-vs-Prestige weighting** -
   §3/§4. Derive it from `reputation.prestige`/`personality.ambition`/
   `personality.ego`, which already exist, rather than a new stored
   preference stat.
3. **Cut "scene count" from the character-casting UI** - §8. Not a field
   that exists, no other consumer, purely cosmetic - prominence plus the
   existing `describeCharacterDemands` summary already covers it.
4. **Casting stays per-Character, not a duration-gated aggregate per
   role** - §1/§8 - and I'm flagging the resulting UI complexity (one row
   per Lead/Supporting character, potentially many in parallel on an
   ensemble script) as the single biggest risk in this whole proposal,
   addressed with a compact-list-plus-drill-in pattern rather than solved
   away.
5. **Director-first stays a soft nudge, not a hard gate** - §8. A hard
   block would reintroduce the fixed-order constraint the Producer
   Workspace redesign deliberately removed.
6. **One appeal function for all three attachment paths** - §3/§6. Open
   Casting, Direct Approach, and Interested Talent must all call
   `computeActorAppeal`, not maintain three divergent formulas that could
   drift apart.
7. **One description module for both applicant interest and offer
   rejection** - §7. `describeApplicantInterest`/`describeOfferRejection`
   read the same `ActorAppealFactors`, never a second parallel
   explanation system.
8. **`attachmentMomentum` is derived, never stored/decaying** - §3. A
   fresh read of who's currently attached to *this* project, recomputed
   every call - no ticking bonus, no decay curve to tune.

---

## 13. Phasing

Matching the incremental, test-each-step discipline the Character and
Setting Foundations milestone and the Producer Workspace rollout both
already used - this is a bigger arc than either of those single
milestones and shouldn't land as one commit.

| Phase | Ships | Player-visible behavior change | Risk |
|---|---|---|---|
| **A - Character-first reframe** | Cast & Crew's Lead/Supporting section becomes one row per `ScriptCharacter` instead of per-role tiles; Suitability badge always visible (already computable today); Director-first soft nudge; player-facing terminology pass (§12) | Casting *looks* and *reads* completely different, but the underlying mechanic is identical - instant-pick from `state.talentPool`, no rejection yet. | Low - no new state, no new formulas, purely a UI/readiness/copy change over existing data. |
| **B - Open Casting** | `CastingCall`/`CastingApplicant` state, weekly applicant generation (§2) mirroring `engine/opportunities.ts`'s cadence, still instant-accept-whoever-the-player-picks; `describeApplicantInterest` (§7) surfaced per applicant | Casting a role becomes a multi-week activity with a growing, self-explaining applicant list instead of an instant static pool-browse. | Medium - new persistent state, new weekly tick logic, but no rejection risk yet (todays "willing" semantics hold). |
| **C - Direct Approach + real acceptance** | `computeActorAppeal` (§3, including `attachmentMomentum`), `OfferResponse` + `describeOfferRejection` (§5/§7), applied to both Direct Approach *and* Open Casting applicants (an applicant can now, in principle, decline if the player's offered terms don't clear their threshold) | Actors can say no for the first time, and say why. This is the phase that actually changes the core loop. | Highest - must ship alongside §9's no-softlock widening formula in the same phase, not after, or a bad-luck stretch of rejections becomes a real dead end. |
| **D - Casting Director + Interested Talent** | New optional `Casting Director` role (§11) biasing applicant curation; inbound Interested Talent via the Inbox (§6), reusing Phase C's appeal function in reverse | Reputation starts working *for* the player proactively, not just when they go looking. | Low - both features are thin wrappers around Phase C's already-built appeal function. |
| **E - Future** (not scoped) | Negotiation/counter-offers extending `OfferResponse`, additional `CastingChannel` variants (§10), chemistry, deadlines, competing offers, relationship history, and shortlisting (Additional Notes point 9 - promoting a subset of `CastingApplicant`s within an open call before committing; genuinely low-cost whenever it lands, just not essential to any phase above) | — | Deferred entirely, per the brief's own scoping. |

Phase C is the one I'd expect to need the same heavily-tested, one-continuous-effort
treatment the Person Model Redesign and Character and Setting Foundations
milestones both got - it's the phase where a wrong call (an acceptance
threshold tuned too high, a widening formula that kicks in too late)
directly produces a stuck project, which is exactly the failure mode §9
exists to prevent.
