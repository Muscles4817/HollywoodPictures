# 16 — Critics, Reviews & Word of Mouth

*How a film's reputation forms, and what it does to the box office.* Reception
is not one thing: critics, aggregate scores, opening-night audiences, and
ordinary word of mouth are four different instruments measuring four different
populations, on four different clocks.

> **Domain reference.** Real industry, not this game. See `README.md`.

---

## 1. The four instruments

| Instrument | Measures | When | Predicts |
|---|---|---|---|
| **Critics / reviews** | Professional critical opinion | 1–14 days before release (or from a festival, months earlier) | Adult and prestige performance; awards viability |
| **Aggregate scores** (Rotten Tomatoes, Metacritic) | Consensus, compressed to a number | With the reviews | Perceived quality; used as a marketing asset |
| **Exit polling** (CinemaScore, PostTrak) | The paying opening-night audience | Opening night | **Legs** — better than anything else |
| **Word of mouth** | Everyone else, talking | Days 2 onward, compounding | The multiple, and the film's life |

The single most useful distinction: **critics predict prestige, audiences
predict money.** They correlate loosely and diverge systematically by genre.

---

## 2. Who critics are

- **Trade critics** — Variety, The Hollywood Reporter, Deadline, Screen
  International. They review from festivals and early screenings, and write for
  *the industry*: their reviews assess commercial prospects as much as quality,
  and they are read by buyers and distributors deciding what to acquire.
- **National press critics** — major newspapers and magazines. Fewer than there
  used to be; staff film-critic positions have been cut heavily.
- **Online and specialist critics** — the largest population by number,
  ranging from serious criticism to aggregation fodder.
- **Broadcast and video critics** — reach a broad audience, more consumer-
  advice than criticism.
- **Aggregator-approved critics** — Rotten Tomatoes and Metacritic each
  maintain an approved list, and admission to it is what makes a critic count
  toward the score. This is a real gatekeeping power.

**Critics' groups** (New York Film Critics Circle, LA Film Critics
Association, National Society of Film Critics) vote awards in December and
shape the awards conversation without predicting the Academy well
(`13-awards-and-critical-reception.md` §4).

---

## 3. How a review gets made

| Stage | What happens |
|---|---|
| **Press screening** | The distributor screens for critics, typically 1–3 weeks out; long-lead press (monthlies) see it earlier |
| **Festival premiere** | For festival titles, reviews land months before release and are the film's permanent first impression (`09-…` §10) |
| **Junket** | Interviews, separate from reviews; access is sometimes implicitly traded on coverage |
| **Embargo** | The contractual date and time critics may publish |
| **Publication** | Reviews land together at the embargo lift, producing a single visible consensus event |
| **Aggregation** | Scores are collected into the RT/Metacritic number within hours |

### 3.1 The embargo as a signal

The embargo date is a message the industry knows how to read:

| Embargo timing | Reads as |
|---|---|
| Weeks early (from a festival) | Confidence; the studio wants the reviews working for the campaign |
| ~1–2 weeks out | Normal |
| Day of release, or opening-night | Low confidence |
| No press screenings at all | The studio expects to be savaged — and the *absence* becomes its own negative news story |

Withholding a film from critics rarely protects it. It reliably produces
coverage about the withholding.

---

## 4. Aggregate scores and their maths

This matters because the two major aggregators measure genuinely different
things, and are routinely confused.

**Rotten Tomatoes** — each review is classified **fresh or rotten** (a binary),
and the Tomatometer is **the percentage of reviews that are positive**.

- It measures **consensus, not quality**. A film every critic finds mildly
  acceptable scores higher than a film half of them consider a masterpiece and
  half consider a failure.
- It is **non-linear near the top**: 99% and 80% represent similar average
  opinion but read as vastly different.
- **Certified Fresh** is a threshold badge (a minimum score, a minimum number
  of reviews, and a minimum number of top critics) and is used in advertising.
- The separate **Audience Score** measures ticket-buyers and diverges from the
  Tomatometer in predictable, genre-linked ways.

**Metacritic** — a **weighted average of numerical scores** (0–100), with
critics weighted by perceived stature.

- Tracks critical esteem far more faithfully.
- Compresses toward the middle: a Metascore of 80 is exceptional, where a
  Tomatometer of 80 is ordinary.

**Practical consequence for a model**: if you want "how well-regarded is this
film", that's Metacritic-shaped. If you want "is there a negative story about
this film", that's Tomatometer-shaped. They are not interchangeable.

---

## 5. What critics respond to

Not a mystery, and reasonably consistent:

- **Originality and authorial voice** — the strongest positive signal.
- **Screenplay quality**, particularly structure and dialogue.
- **Performance**, especially transformative or against-type work.
- **Formal craft** — cinematography, editing, production design, score, when
  they are doing something rather than merely being competent.
- **Thematic seriousness** and contemporary relevance.
- **Direction as a coherent point of view** rather than assembled competence.

And negatively: derivativeness, incoherent structure, tonal confusion,
excessive length, franchise obligation over story, and effects standing in for
drama.

**Systematic genre bias** — durable and worth encoding:

| Genre | Critical reception vs audience reception |
|---|---|
| Prestige drama, biography | Reviewed **above** audience scores |
| Art film, foreign-language, documentary | Reviewed far above |
| Horror | Reviewed **below** — audiences reward what critics penalise |
| Broad comedy | Reviewed well below |
| Action / franchise | Reviewed below, though the gap narrows for the best-made |
| Animation (family) | Reviewed roughly in line, often generously |

---

## 6. What reviews actually do to box office

The effect is real but **highly conditional**:

| Film type | Review sensitivity |
|---|---|
| **Adult drama, prestige, specialty** | **Very high.** Reviews are the primary awareness mechanism; a strong consensus is the campaign |
| **Mid-budget comedy/thriller** | Moderate. Reviews affect the decision at the margin |
| **Horror** | **Low.** The audience is genre-loyal and reviews are discounted |
| **Pre-sold franchise / event** | **Very low on opening weekend** — the audience has already decided. But it shows up in **week two**, because bad reviews and bad word of mouth reinforce each other |
| **Family** | Low for the children, moderate for the parents deciding |

Two mechanisms to keep distinct:

1. **Reviews as awareness** — for a small film, a rave in a major outlet *is*
   the marketing. This is why platform releases exist (`09-…` §7.2).
2. **Reviews as permission** — for a large film, reviews don't create the
   audience, they modulate whether the second wave shows up.

---

## 7. Audience instruments

**CinemaScore** — polls opening-night audiences at a sample of cinemas and
publishes a letter grade, **A+ to F**.

- The scale is compressed and must be read on its own terms: **A** is good,
  **B+** is mediocre, **B−** is a warning, and **C or below is a disaster**.
  An **F** is exceedingly rare and almost always signals a film that ambushed
  its audience with a tonal or ending betrayal.
- It measures **satisfaction against expectation**, not quality — which is why
  it predicts legs so well and correlates so poorly with reviews.

**PostTrak** — exit surveys covering demographics, how people heard about the
film, and **definite recommend** percentage. More granular, used internally.

**Definite recommend** is the number that actually forecasts word of mouth: it
measures propagation, not approval.

---

## 8. Word of mouth as a mechanism

The most important reception effect and the least directly measurable.

How it propagates:

1. **Opening-night audience** — the pre-sold, most enthusiastic segment. Their
   verdict is measured by CinemaScore.
2. **Saturday and Sunday** — the first non-pre-sold audience arrives partly on
   the strength of Friday's word of mouth. Saturday's performance relative to
   Friday is an early tell.
3. **Week two** — the general audience, deciding largely on what they've heard.
   The second-weekend drop is the result
   (`10-theatrical-release-and-box-office.md` §3).
4. **Weeks three onward** — pure word of mouth; marketing is largely spent.

What makes word of mouth **positive**:

- The film delivers the promise of its own campaign.
- It gives people something to *say* — a scene, a performance, a twist, an
  experience worth describing.
- It rewards recommendation: the recommender looks good for having recommended it.
- It's an event worth attending in a cinema rather than waiting for.

What makes it **negative**:

- Mis-selling (`09-…` §12.2) — the single most reliable cause.
- Running long, or a third act that collapses.
- An ending that betrays the audience's investment.
- Being merely fine. Indifference doesn't propagate, and a film that generates
  no conversation dies quietly regardless of its reviews.

**Modelling note**: word of mouth is *multiplicative and lagged*, not additive.
It acts on the audience the marketing already delivered, it compounds
week over week, and its sign is set by the gap between expectation and
delivery — not by quality in the abstract.

---

## 9. The reception matrix

The combinations that actually occur, and what each means:

| Critics | Audience | Outcome |
|---|---|---|
| High | High | The best case. Legs, awards, and a long ancillary life |
| High | Low | Critical darling, commercial failure. Common for difficult prestige films; still valuable for reputation and library |
| Low | High | The crowd-pleaser. Horror, broad comedy, franchise. Profitable, no awards, and the critics' verdict ages irrelevant |
| Low | Low | Total failure. The only case with no recoverable value |
| Divisive (split) | Divisive | Often the most commercially interesting: argument is propagation, and controversy sells better than indifference |

Note the asymmetry a simulation should preserve: **a mediocre reception is
commercially worse than a divisive one**, because indifference generates no
word of mouth in either direction.

---

## 10. Common misconceptions

1. **"Rotten Tomatoes score = quality."** It's a consensus percentage, and its
   distribution is nothing like a quality distribution.
2. **"Bad reviews kill films."** They kill *adult dramas*. They barely dent a
   pre-sold franchise opening, and they show up a week later instead.
3. **"Critics and audiences are opposed."** They agree more than they disagree;
   the disagreement is genre-structured and predictable.
4. **"Word of mouth is just quality."** It's the gap between what was promised
   and what was delivered — which is why a good film sold wrong underperforms a
   modest film sold honestly.
5. **"Reception is fixed at release."** Critical standing moves over years;
   a film's reputation and its opening weekend are only loosely related, and
   library value follows reputation.
