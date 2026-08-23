# 01 — Industry Structure

*Who exists, what they do, and who pays whom.* This is the map the rest of the
library hangs off: every later document describes a stage of work, and this one
describes the institutions that carry out those stages.

> **Domain reference.** Describes the real film industry, not this game. See
> `README.md` for scope, era, and currency conventions. Game mapping lives in
> `15-game-mapping.md`.

---

## 1. The value chain

Four functions. Historically separated by law, now partly re-integrated.

| Function | What it does | Who does it |
|---|---|---|
| **Development** | Turns an idea into a shootable screenplay | Studios, production companies, writers, producers |
| **Production** | Physically makes the film | Production companies, studios' physical production arms, crew |
| **Distribution** | Sells it to audiences, books it into channels | Studio distribution arms, independent distributors, streamers |
| **Exhibition** | Shows it | Cinema chains, independent cinemas, streaming platforms |

The money flows *backwards* along this chain: the audience pays the exhibitor,
the exhibitor remits to the distributor, the distributor recoups its costs and
then pays the financiers and participants. See `11-money-accounting-and-participations.md`
for the waterfall in detail.

The critical asymmetry: **whoever controls distribution controls the recoupment
order**, which is why distribution is where the power sits, and why a producer
with a finished film and no distributor has an asset they cannot monetise.

### 1.1 The Paramount Consent Decrees

From 1948, US studios were barred from owning cinemas and from *block booking*
(forcing exhibitors to take a slate to get the hit) and *blind bidding*
(booking films sight-unseen). This is why the studio system's vertical
integration broke and why the "package" model replaced the contract-player
model. The decrees were terminated in 2020; the practical effect has been
limited so far, but studio-owned exhibition is no longer illegal per se.

The mechanics worth understanding, because they explain the shape of the
modern industry:

- **Block booking** meant a studio sold its year as a bundle. An exhibitor who
  wanted the two prestige pictures took the forty programmers with them. Under
  that regime, a studio's problem was *filling the schedule*, which is why it
  kept actors, directors, and writers on seven-year contracts and made 40–60
  films a year. Quality control mattered less than throughput.
- **Divorcement** forced the studios to sell their theatre chains (typically
  over 1949–1954). Once a studio had to persuade an exhibitor film-by-film,
  every picture had to sell itself, and the contract roster became a fixed cost
  with no guaranteed outlet.
- **The package replaced the contract.** With no standing roster, projects
  became one-off assemblies of freelance elements — a script, a director, a
  star — brokered by agents. This is the single structural fact that makes the
  agency business (§5) central rather than peripheral.

Relevance: any simulation that lets a studio own screens, or guarantee its own
films screen counts, is modelling a pre-1948 or post-2020 industry, not the
one in between.

### 1.2 The route the money actually takes, and how long it takes

Cash does not move instantly, and the lags matter more than most descriptions
admit — a film can be a hit and a cash-flow problem at the same time.

| Step | Who pays whom | Typical lag |
|---|---|---|
| Ticket sold | Audience → exhibitor | Immediate |
| **Settlement** of the engagement | Exhibitor → distributor | 30–60 days after playdate; specialty and small circuits later, sometimes 90+ |
| Distributor recoups P&A and takes its **distribution fee** | Internal | Continuous, applied first (`11` §1) |
| **Producer/financier statement** | Distributor → producer, financiers | Quarterly, issued 45–90 days after quarter end |
| **Participations** (backend) | Distributor → talent | With the statement; first-dollar players are paid far earlier than net players, who are usually never paid at all |
| **Residuals** | Studio → guild → member | Guilds process and distribute; commonly a further 1–2 quarters behind the revenue event |
| Home/digital/TV revenue | Platform, broadcaster → distributor | 30–120 days depending on the licence |

Two consequences. First, a production company living on producing fees and
overhead has almost no working capital sensitivity to whether the film worked —
it was paid during production. Second, an equity financier waits **12–36 months**
after release to know its actual return, and its money is committed 12–24
months before release. The full cash cycle from first dollar in to final
meaningful dollar out is commonly **three to five years**.

### 1.3 Who bears which risk

Risk is not evenly distributed along the chain, and the party bearing a given
risk is usually the party that gets to make the corresponding decision.

| Risk | Who wears it | How they hedge |
|---|---|---|
| **Development** — money spent on scripts that never shoot | Studio, pod, or producer | Volume; a studio expects to develop 10–20 projects for every one made (`02` §1) |
| **Production** — cost overrun, weather, illness, disaster | Financier and, on independents, the completion guarantor | Contingency (usually 10%), bond, insurance (`03` §8) |
| **P&A** — the marketing spend, often 50–100% of negative cost | Distributor, unless shared | Tracking, dating, and the ability to pull spend late |
| **Exhibition** — empty seats, fixed rent and labour | Exhibitor | Term negotiation, screen reallocation weekly, concessions |
| **Talent career risk** | The individual | Quotes, backend, and representation (§5) |

The party who did *not* take the risk generally does not get the argument.
This is the mechanism behind the rule of thumb in §4: control follows money.

---

## 2. The majors

Five majors, plus a tier of well-capitalised players who behave like majors in
some respects.

**The majors** (own worldwide distribution infrastructure, release 8–20+ wide
films a year):

| Studio | Parent | Notable labels |
|---|---|---|
| Walt Disney Studios | Disney | Marvel, Pixar, Lucasfilm, 20th Century Studios, Searchlight |
| Warner Bros. Pictures | Warner Bros. Discovery | New Line, DC Studios, Warner Animation |
| Universal Pictures | Comcast/NBCUniversal | Focus Features, Illumination, DreamWorks Animation, Blumhouse (output) |
| Paramount Pictures | Paramount (Skydance) | Nickelodeon Movies, MTV Films |
| Sony Pictures | Sony | Columbia, TriStar, Screen Gems, Sony Pictures Classics, Sony Pictures Animation |

**Mini-majors / near-majors**: Lionsgate (self-distributing, heavy library and
franchise focus), Amazon MGM Studios (major library, theatrical ambitions,
streaming parent), Apple Original Films (streamer with selective theatrical).

**Streamers as principal buyers**: Netflix, Amazon, Apple. Structurally
different — see §7.

**Specialty / independent distributors**: A24, Neon, Focus Features,
Searchlight, Bleecker Street, IFC, Magnolia, Sony Pictures Classics. These
release fewer, cheaper films, lean on festivals and awards, and platform
(open small, expand) rather than open wide.

Scale, directionally: a major's film division books **$1–4bn** of theatrical
rental a year on a slate of 10–20 wide releases and typically holds
**10–25%** of the domestic market, with the leader's share swinging several
points a year on the timing of two or three franchise titles. A specialty
label releases **5–15** films a year, most of them costing less than a major's
marketing budget for one.

### 2.1 What a studio actually is

A modern major is not primarily a factory. It is:

- a **balance sheet** that can absorb a $200M bet;
- a **distribution and marketing network** with worldwide relationships;
- a **library** (the reliably profitable part of the business);
- a **brand portfolio** of franchises and labels;
- a small **creative executive layer** that buys and supervises.

It very often does not employ the people who make the film. Cast, crew, and
frequently the production company are hired per-picture.

Six distinguishable businesses sit inside the film group, and they have very
different economics:

| Business | Character | Margin behaviour |
|---|---|---|
| **New theatrical releases** | Lumpy, high-variance, capital-hungry | Can lose money for a whole year; a single title can swing the division |
| **Library** | Annuity — hundreds or thousands of titles licensed continuously | Steady, high-margin, low headcount; funds the risk-taking |
| **Distribution services** | Selling *other people's* films through the pipe for a fee (10–15%) | Reliable fee income with no negative-cost exposure |
| **Franchise/IP management** | Sequels, spin-offs, consumer products, parks | The strategic reason a modern major exists |
| **Physical facilities** | Lot, stages, post services (§13) | Real-estate-like; sometimes larger than it looks |
| **Home/digital licensing** | Windowed sales into TVOD/EST/SVOD/free TV | Declining physical, growing licensing; see `11` §3 |

The headcount reality: a major film division might employ **300–1,500** people
across all of the above, of whom only **15–40** are creative executives making
buying decisions. The people who actually make the movies — several thousand
per year across the slate — are almost all freelancers on per-picture
contracts.

### 2.2 Studio org chart (film division)

```
Chairman / CEO of the film group
├── President of Production ("head of production")
│   └── EVP / SVP Production → VP / Director of Development ("creative execs")
│         — each exec carries a slate of projects, gives notes, shepherds
├── Physical Production (EVP) — budgets, schedules, line producers, safety
├── Business Affairs — deal-making, quotes, contracts, closing the deal
├── Legal — chain of title, clearances, E&O
├── Marketing (President) — creative advertising, media buying, publicity,
│     promotions/partnerships, research (tracking)
├── Distribution (President) — theatrical booking, release dating, international
├── Home Entertainment / Digital — TVOD, EST, physical, licensing windows
└── Finance / Corporate — greenlight modelling, co-financing, incentives
```

The greenlight decision (`02-development.md` §8) is normally made by the
chairman/president tier, informed by a model built by finance and a marketing
"can we sell it?" read.

#### 2.2.1 The creative ladder, tier by tier

Titles vary between studios; the *functions* are consistent. Compensation
figures below are directional US studio ranges and move with era and studio.

| Tier | What they actually do, day to day | Reports to | Authority | Typical comp | Typical tenure |
|---|---|---|---|---|---|
| **Reader / story analyst** | Reads submissions and writes **coverage** — logline, synopsis, comment, and a Recommend / Consider / Pass on script and on writer (`02` §5). Freelance or in-house; a busy reader covers 8–15 scripts a week | Story department / creative exec | None. Their power is negative: a Pass usually ends it | $50–90 per piece of coverage freelance; $50–75K in-house | 1–3 years, usually a route in |
| **Creative executive / story editor** | Reads everything, takes general meetings with junior writers, tracks what other studios are buying, writes internal notes, staffs the exec's list of writers per project | Director of Development / VP | Recommends. Cannot commit money | $80–140K | 1–3 years |
| **Director of Development / VP Production** | Carries **6–15 projects**. Runs notes calls with writers, hires writers off approved lists, sits on casting and location conversations, is the studio's day-to-day voice to the producer | SVP/EVP | Can spend against an approved development budget — options, a writing step — usually up to a threshold in the low-to-mid six figures | $150–300K | 2–4 years |
| **SVP / EVP Production** | Carries the bigger and more fragile projects, argues them upward, is in the room at greenlight, supervises production on the ground | President of Production | Can champion to greenlight; can kill; still cannot greenlight | $300K–1M | 3–5 years |
| **President of Production** | Owns the *shape of the slate*: what genres, what budget bands, how many. Assigns projects to execs. Chairs the weekly staff meeting. Hires and fires the exec layer | Chairman | Effective greenlight recommendation; the chairman rarely overrules a hard no | $1–3M | 3–6 years |
| **Chairman / CEO, film group** | Owns the P&L. Makes the final greenlight and the date call, sets relationships with the top 20 filmmakers in the business, answers to the corporate parent | Corporate CEO | Final | $3–10M+ with bonus and equity | 4–8 years |

Two non-creative departments outsiders consistently underrate:

- **Business Affairs** — lawyers and dealmakers who convert a creative "yes"
  into a signed deal. They hold the **quote** database (what everyone was last
  paid, `12` §2), draft and negotiate every agreement, and in practice set the
  ceiling on what a project can afford. A creative executive who cannot work
  with business affairs loses projects at the last metre. Business affairs
  reports to the chairman or to the general counsel — deliberately *not* to
  the creative side, so that the person who fell in love with the project is
  not the person negotiating for it.
- **Physical Production** — line producers, UPMs, and cost estimators who read
  a script and say what it costs (`04` §4). Their board-level function is to
  tell the greenlight committee that the $80M script is a $110M film. Their
  ongoing function is to sit on the film's cost report every week and escalate
  when it drifts.

#### 2.2.2 How a project moves through the tiers

The ordered path from "someone has material" to "the studio is legally
committed". Elapsed times are for a project that does not stall — most stall.

| Stage | What happens | Who is involved | Typical elapsed |
|---|---|---|---|
| **Submission** | An agent, manager, lawyer, or pod sends material to a named executive. Nothing arrives unsolicited; unrepresented material is returned unread for legal reasons | Agent → creative exec's assistant | Same day |
| **Coverage** | The story department logs and covers it | Reader, story editor | 1–5 days; a hot spec is covered overnight |
| **Exec read** | The executive reads it themselves. This is the real gate — coverage screens, it does not decide | Creative exec / VP | Over a weekend ("the weekend read") |
| **Internal champion forms** | The exec decides to fight for it. Without a champion, nothing proceeds — this is the single most important fact about studio development | VP/SVP | Days |
| **Monday staff meeting** | Each exec pitches what they read. Peers push back. Material that survives goes up | President of Production + all execs | Weekly |
| **Head-of-production read** | The president reads and gives a temperature | President of Production | 3–10 days |
| **Comps and model** | Finance builds a rough P&L using comparable titles; physical production gives a budget range; marketing gives a "can we sell it?" | Finance, physical production, marketing | 1–3 weeks |
| **Business affairs engagement** | Deal terms explored with the agent — is the price real, is the director available, what's the rights position | Business affairs, agent, lawyer | 1–4 weeks |
| **Decision** | Buy, pass, or "we'd do it with X attached" — the most common answer | Chairman, president, marketing, finance | Days |
| **Deal close** | Long-form agreement papered; often the film begins work on the deal memo alone | Business affairs, outside counsel | 4–16 weeks, frequently after work has started |

The same ladder runs again at **greenlight** (`02` §8), with harder numbers and
the addition of distribution (is there a date?) and international (does it
travel?).

#### 2.2.3 What a creative executive's week actually looks like

- **Reading**: 3–6 scripts, 5–20 sets of pages, and coverage on another 10–20.
  Most of it at night and at the weekend, because the day is meetings.
- **General meetings**: 5–15 a week with writers, directors, and junior
  producers. A general has no agenda; its purpose is to establish whether the
  person is good and what they want to make, so their name is on the list when
  a job comes up.
- **Notes calls**: 2–5, each 45–90 minutes, with a writer and usually a
  producer. See `02` §6 for how notes work and fail.
- **Staff meeting**: weekly, 1–3 hours, where projects live or die.
- **Tracking**: constant informal calls with peers at other studios and with
  agents about what is going out, who is attached to what, and what a rival
  paid. Information is the raw material of the job.
- **Production supervision**: for projects in prep or shooting, dailies,
  cost reports, cut screenings, and set visits — an exec on a shooting film may
  be on it half-time.
- **Servicing filmmakers**: the unglamorous majority — returning calls,
  smoothing an argument between a producer and a director, getting an answer
  out of business affairs.

#### 2.2.4 What separates a good creative executive from a bad one

The skill axis, and it is not "loving movies":

1. **Taste that is legible.** Not just liking the right things, but being able
   to say *why* in terms other people can act on. An exec whose enthusiasm
   cannot be reconstructed by their boss cannot get anything made.
2. **Giving a note that identifies the problem, not one that prescribes a
   solution.** "The second act sags" is useless; "we stop wanting the thing we
   wanted on page 30, and nothing replaces it" is actionable. Prescriptive
   notes from executives are the standard failure mode (`02` §6).
3. **Knowing what their own studio actually makes.** A brilliant project the
   studio has no business making is a waste of the exec's credibility, which
   is a finite balance they spend on champions.
4. **Deal flow.** Being the executive agents call *first* with a hot spec on a
   Friday. This is earned by reading fast, answering honestly, and passing
   cleanly — an exec who takes three weeks to say no stops getting material.
5. **Internal politics.** Getting a project onto the agenda, lining up the
   marketing and finance reads before the meeting rather than during it, and
   knowing which fights to lose.
6. **Writer judgement.** The hardest and most valuable skill: knowing which of
   the forty available writers can actually solve *this* script's problem.
   Studios keep informal lists of who is good at structure, who at dialogue,
   who at action, who is fast, and who fights notes.
7. **Protecting the film from the studio.** The best executives absorb bad
   internal notes rather than transmitting them, and tell the filmmakers only
   what is real. The worst forward everything and call it collaboration.
8. **Passing well.** Half the job is saying no, quickly and without insult, so
   the relationship survives to the next project.

#### 2.2.5 What success and failure look like at the executive layer

| Failure | What it looks like | Consequence |
|---|---|---|
| **No champion** | A good script that everyone likes and nobody fights for | Sits in development indefinitely, then lapses |
| **Champion leaves** | The exec who bought it is fired or moves | The project is *orphaned*; the successor has no stake in its success and every reason to prefer their own |
| **Note laundering** | Exec transmits every internal opinion verbatim | Contradictory drafts, writer burnout, "development hell" (`02` §6) |
| **Buying to fill a slot** | A date exists, so a script is bought to fill it | The most reliable route to an expensive bad film |
| **Overpaying for heat** | Winning a spec auction against three studios | The price becomes the project's problem; a $3M script needs a $100M film to justify it |
| **Slow pass** | Sitting on material for weeks | Agents stop submitting first; the studio sees material late and pays more |
| **Losing physical production's confidence** | Consistently under-representing what a project costs | The exec's budget numbers stop being believed at greenlight |

Success, concretely: the exec's projects **convert** — a working ratio is that
a good executive gets **one to three films a year** made out of a list of
10–15 active projects, and that the films come in near the budget they
promised at greenlight. Track record is measured in conversions and in
relationships kept, not in scripts bought.

#### 2.2.6 Tenure, regime change, and why it matters

Studio creative jobs are short. A creative executive lasts **2–4 years** in a
post; a president of production **3–6**; a chairman **4–8**. Turnover is not a
sign of dysfunction, it is the normal metabolism of the business, and it has
three structural consequences:

1. **Development slates do not survive their owners.** A new chairman inherits
   50–150 projects in active development, of which they personally bought
   none. The rational move is to clear the decks: a wave of **turnaround**
   (`02` §9) and quiet lapsing follows every regime change, typically within
   6–12 months.
2. **Relationships reset.** Pods and filmmakers with a deal at the studio have
   it because of a person. When that person goes, the deal is renegotiated or
   not renewed at term. This is why producers work hard to have relationships
   at *several* studios.
3. **The clock is short relative to the pipeline.** A film takes 3–6 years
   from purchase to release. An executive's tenure is shorter than their own
   product cycle, so they are judged on films started by their predecessor and
   their own bets are graded by their successor. This asymmetry pushes
   executives toward projects that can be made *fast* and toward known IP,
   which is legible upward immediately.

#### 2.2.7 The slate as a portfolio

The president of production and the chairman are not choosing films one at a
time; they are assembling a **year**. A typical major slate is deliberately
mixed:

- **2–4 tentpoles** ($150–300M+) that carry the year and anchor the calendar.
- **3–6 mid-budget** films ($30–80M) — genre, star vehicles, comedies.
- **4–8 low-budget** films ($5–30M) — horror, thriller, faith, specialty.
- **1–3 awards plays**, often through the specialty label.
- Plus **acquisitions** and **negative pickups** to fill gaps (`03` §5).

The scarce resource being allocated is not money but **release dates**
(`09` §5). There are roughly 30–40 viable wide-release weekends a year, shared
with every competitor, and a studio holds dates years in advance and defends
them. A greenlight is in practice a decision to spend a date.

---

## 3. Production companies and pods

Between the studio and the film sits a **production company**. It may be:

- a **producer's shingle** with a studio deal (Plan B, Bad Robot, Blumhouse,
  Heyday, Working Title);
- a **star's or director's company** (Appian Way, Hello Sunshine);
- an **independent** with no home, assembling finance per picture.

Two deal shapes:

- **First-look deal** — studio funds development/overhead in exchange for the
  right to see and match anything the company develops first. Typically 2–3
  years, low seven figures a year for a strong pod.
- **Overall deal** — the company (or a writer/showrunner) is exclusive to the
  studio for a term; more expensive, more common in TV.

If the studio passes, a first-look project can go into **turnaround** — see
`02-development.md` §9.

### 3.1 What a pod actually is, staffed

"Pod" is the industry's word for a production company housed at a studio,
usually literally — a bungalow or a suite on the lot, with studio phones,
studio IT, and a parking space. A pod is small. Even a famous one is fewer
people than a single department on a shooting film.

| Role | Headcount | What they do |
|---|---|---|
| **The principal(s)** | 1–3 | The name on the door. Sets taste, carries the relationships, is the person a director will take a call from |
| **President of Production / Head of Film** | 0–1 | Runs the company day to day; the principal's proxy in rooms; often the person who actually develops |
| **Creative executive(s)** | 1–4 | Read, cover, take generals, run notes, chase writers and rights |
| **Head of physical production** | 0–1 | Only at pods that produce at volume; budgets and schedules in-house |
| **Development assistant / coordinator** | 1–2 | Tracks submissions, options, deal status, and the reading list |
| **Assistants** | 1 per executive | Roll calls, take notes, read, and are the pod's actual memory |
| **Business/legal** | 0–1, usually outside counsel | Options, chain of title, deal memos |

A strong first-look pod is therefore commonly **4–10 people**. Blumhouse-style
volume operations and the largest pods run 20–60. The economics only work
because everything else — crew, cast, post, marketing — is bought per picture
and paid for by the film's budget, not the company.

### 3.2 What overhead actually pays for

The first-look "low seven figures" is not profit. Directionally, an annual
overhead of **$1–3M** for a strong pod is consumed roughly as:

| Line | Share | Notes |
|---|---|---|
| Salaries and benefits | 50–65% | The executives and assistants above |
| Office and support | 10–15% | Often provided in kind by the studio (space on the lot, IT, security, post facilities at rate) |
| Development costs | 10–25% | Options, research, writers' first steps below a threshold, script fees the studio approves |
| Travel, festivals, entertaining | 5–10% | Markets, Sundance, Cannes, taking directors to dinner — this is deal flow, not perk |
| Assistants' overtime, coverage, subscriptions | 5% | Readers, breakdown services, tracking services |

Two mechanical points practitioners know:

1. **Overhead is usually an advance, not a gift.** In most deals, overhead paid
   in a year is recoupable against the producing fees the pod earns on films it
   sets up at the studio. A pod that makes nothing costs the studio the cash; a
   pod that makes two films effectively paid for its own office.
2. **Development costs are charged to the picture.** Script fees, option
   payments, and research are tracked and, when a film is greenlit, folded into
   the negative cost as **development costs** — which then have to be repaid
   before anyone sees net profit (`11` §1). A long development history is a
   real, capitalised drag on a film's backend.

### 3.3 How a first-look deal works mechanically

The document is short and the mechanics are precise:

1. **Term** — 2–3 years, sometimes with a studio option to extend.
2. **Exclusivity of submission** — the pod must submit *covered material* to
   the studio before anyone else. What counts as covered is negotiated: usually
   any feature-length live-action project the principal would produce, with
   carve-outs for TV, documentary, projects with the principal only acting or
   directing, and pre-existing obligations.
3. **The election window** — the studio has a fixed period to say yes. Typical
   shapes: **5–10 business days** on a finished spec script, **10–30 days** on
   a pitch or a book, longer if a submission requires a writer attachment.
   Silence is a pass, and a pod's first complaint about a bad deal is always
   that the studio takes the full window on everything.
4. **If the studio elects** — it pays for the underlying rights and the writer,
   the project is set up in-house, and the pod's producers are attached with a
   negotiated **producing fee** (commonly **2–5% of budget**, often capped, and
   in practice negotiated as a fixed number: $250K–$1M+ per producer on a
   studio film, with a further backend of net or, rarely, gross points).
5. **If the studio passes** — the pod is free to shop it, subject to two common
   strings: a **matching right** (the studio can match a third-party offer
   within a window) and a **reimbursement** obligation (a competing buyer must
   repay the studio's out-of-pocket development costs, sometimes with a premium
   or a passive percentage, if the film gets made).
6. **Passive participation** — some deals give the studio a passive backend on
   projects set up elsewhere during the term, whether or not it developed them.
7. **Sunset** — after the term, the studio usually retains rights to whatever it
   already elected, and the pod takes its unset projects with it.

An **overall deal** replaces submission exclusivity with *personal* exclusivity:
the principal cannot work for anyone else in the covered field for the term.
It costs materially more and is the norm in television, where a showrunner's
time is the asset.

### 3.4 How a pod actually operates, day to day

- **Sourcing.** The pod's real product is *access to material before the
  market*. That means: relationships with 30–60 literary agents and managers,
  standing arrangements with book scouts and publishers for manuscripts
  pre-publication, journalists who bring articles before they run, and a
  reading list of a few hundred writers.
- **Developing.** Optioning material cheaply (`02` §3), hiring a writer with
  the studio's money or its own, and running the draft cycle — typically
  **9–24 months** and two to five drafts before the studio will consider it.
- **Attaching.** The pod's leverage is often a director or star who will take
  the principal's call. Attachment converts a script into a package, which is
  what a studio actually buys (`03` §2).
- **Producing.** Once greenlit, one or two of the pod's people are on the film
  full-time from prep to delivery — hiring the line producer, mediating between
  director and studio, and absorbing problems that would otherwise reach the
  chairman.
- **Politics.** Keeping the pod's projects at the top of a busy executive's
  list, and surviving regime change (§2.2.6).

### 3.5 What makes a producer's company valuable

The skill axis, from a studio's point of view — this is what the overhead is
buying:

1. **Deal flow the studio cannot replicate.** The pod sees material first
   because agents like the principal, or because they have a book pipeline, or
   because writers want to be developed there.
2. **Talent gravity.** A director or star who will do a film with them and not
   otherwise. This is the single most common reason a rich overhead deal
   exists, and the most fragile — the relationship can end.
3. **Conversion rate.** A pod that develops beautifully and makes nothing is a
   cost centre. A working benchmark: a strong first-look pod delivers **one
   film every 12–24 months**; a volume pod several a year.
4. **Cost discipline.** A producer whose films come in on the number promised
   gets greenlit again. One who is always $12M over does not, however good the
   films are.
5. **A repeatable engine.** The most valuable pods have a *model*, not just
   taste: a low-budget horror machine with fixed budgets and a backend-heavy
   filmmaker deal; a family-animation pipeline; a prestige-drama operation that
   reliably lands nominations. A model is forecastable, and studios pay for
   forecastability.
6. **Absorbing problems.** A producer who can handle a difficult director, a
   dropped location, or a cast crisis without the studio having to intervene is
   worth their fee on that alone.
7. **An owned library.** Pods that retain co-ownership or sequel rights in what
   they make accumulate an actual asset rather than a series of fees.

### 3.6 How pods fail

| Failure | Mechanism | Consequence |
|---|---|---|
| **No conversion** | Develops constantly, greenlights nothing | Deal not renewed at term; often 2–3 years' overhead written off |
| **Principal distracted** | Goes off to direct or star for 18 months | The company runs on the president of production; deal flow dries up |
| **Regime change** | The champion executive leaves | Submissions get slow-walked; the deal quietly lapses |
| **The relationship was the deal** | The star or director the pod delivered goes elsewhere | The rationale for the overhead disappears overnight |
| **Overhead outruns fees** | Big staff, few films | The studio recoups against fees that never arrive |
| **Reputation for overspending** | Two consecutive overruns | Physical production flags every future budget; greenlights get harder |
| **Losing the writers** | Reputation for bad notes or bad payment | Agents stop sending material first, which is the whole asset |

---

## 4. Financiers

Films are frequently *not* funded solely by the distributing studio.

- **Co-financing / slate financing** — an outside party takes a percentage of a
  studio's slate (spreading risk across many films rather than picking one).
  Historically hedge funds, sovereign funds, insurance money.
- **Equity partners on single pictures** — Legendary, Skydance, New Regency,
  Village Roadshow have all functioned as co-financiers on major-studio films.
- **Gap and mezzanine lenders** — banks lending against unsold territories.
- **Soft money** — tax incentives and rebates (`03-financing-and-dealmaking.md` §6).
- **Pre-sales** — selling territory rights before production to fund it.

Rule of thumb: the more of its own money a studio has in a film, the more
control it exercises over cut, cast, and date.

### 4.1 Who these people actually are

Film finance is not one market. The counterparties differ in what they want,
what they will accept, and how long they stay.

| Type | Who they are | What they want | Time horizon |
|---|---|---|---|
| **Institutional slate investors** | Private equity, hedge funds, pension and sovereign money, sometimes insurance-wrapped vehicles | Uncorrelated returns from a diversified portfolio; mid-teens IRR | 5–8 years, one fund cycle |
| **Strategic co-financiers** | Legendary, Skydance, New Regency, Village Roadshow, Chinese and Gulf strategics in particular eras | Access to franchise IP, credit, and a seat in the business | 5–15 years; often want to become studios |
| **Senior lenders** | Entertainment lending desks at specialist and regional banks | Repayment, full stop. Lend against contracted receivables, not hope | 12–36 months per picture |
| **Gap / mezzanine lenders** | Specialist funds, some banks | High interest (mid-to-high teens) on the riskiest tranche of debt | 12–30 months |
| **Tax-credit lenders** | Specialist finance houses | Discount the certainty of a government rebate; low risk, low margin | 6–24 months |
| **High-net-worth / family office** | Individuals, often first-timers | Sometimes returns, often proximity to the business | Unpredictable; the least sophisticated and most litigious money in the market |
| **Sales-driven money** | Foreign distributors paying minimum guarantees (§9) | A finished film for their territory | Delivery-driven |
| **Public/soft money** | National and regional film funds, tax authorities, broadcasters with a remit | Local spend, local jobs, cultural output | Statutory |

The senior/mezzanine/equity distinction is the important one: **debt gets paid
first and does not care whether the film is good**; equity gets paid last and
takes the whole loss. Most of what looks like "financing a film" is actually
assembling a stack of instruments with different recoupment positions
(`03` §1).

### 4.2 How a co-financing deal is actually struck

A slate deal is a securities transaction dressed as a film deal, and it moves
like one.

| Phase | What happens | Who | Typical duration |
|---|---|---|---|
| **Origination** | An investment bank, a specialist advisor, or the studio's own corporate finance group approaches capital with a slate proposition | Studio CFO / corporate development, bank | Weeks to months |
| **Term sheet** | Non-binding: percentage of the slate, number of pictures, term, fee structure, exclusions | Studio finance, investor's principals | 4–8 weeks of negotiation |
| **Diligence** | The investor tests the studio's history and accounting (§4.3) | Investor's analysts, outside consultants, auditors | 2–4 months |
| **Structuring** | An SPV is formed; debt is layered over the equity; tax and jurisdiction settled | Lawyers, tax counsel, lenders | 1–3 months, overlapping |
| **Documentation** | Co-financing agreement, distribution agreement, security documents, intercreditor agreement, collection account agreement | Both sides' outside counsel | 2–4 months |
| **Close and first funding** | Money is committed; pictures start attaching as they are greenlit | Everyone | — |

Total: **6–12 months** from first conversation to close for an institutional
slate deal. Single-picture equity moves far faster — **4–12 weeks** — because
there is less to diligence and the deadline is a start date.

**The points that are actually fought over**, in rough order of how much money
they move:

1. **Which films are in.** The investor wants the whole slate; the studio wants
   to carve out its surest things (established franchises, animation) and its
   riskiest. Every historical slate deal that lost money lost it here. This is
   straightforward **adverse selection**: the party choosing the pictures knows
   more than the party funding them.
2. **The distribution fee.** The studio charges a fee on gross receipts for
   distributing. Third-party rate-card fees run **25–35%**; slate partners
   negotiate **10–15%**, and the difference across a slate is enormous.
3. **Whether P&A is shared.** Co-financing the negative but not the marketing
   is a very different risk than co-financing both. The studio would prefer the
   investor fund a share of P&A; the investor would prefer to fund the negative
   only and be recouped before P&A. Where this lands determines the deal.
4. **Recoupment position.** Pari passu with the studio out of the same pot is
   the honest structure. Anything else — the studio recouping its fee and
   overhead first, or cross-collateralising across pictures in a way that
   favours one side — moves value quietly.
5. **The definition of gross receipts.** The single most consequential page.
   What is included, at what level, net of what deductions (`11` §2).
6. **Approvals.** Investors usually get **no creative approval** and instead a
   *budget cap*: consent required above an agreed negative cost, and a right to
   opt out of a picture that exceeds it. Strategic co-financiers negotiate more
   — cast and director consultation, sequel rights, credit.
7. **Audit rights.** How often, with how much notice, and who pays. A deal
   without meaningful audit rights is not a deal.
8. **Term and exit.** What happens to pictures in progress if the arrangement
   ends, and whether the investor's interest can be sold on.

### 4.3 What diligence actually consists of

For a slate deal, the investor's analysts will typically:

- **Rebuild the studio's last 8–12 years of releases** picture by picture from
  public gross data plus disclosed budgets, estimating ultimates and testing
  what the proposed structure would have returned historically. This is the
  central exercise and it is why deals are struck after good decades and
  regretted after bad ones.
- **Model the distribution.** Film returns are severely skewed — a slate's
  outcome is dominated by its top two or three titles — so the analysis is a
  Monte Carlo over a fat-tailed distribution, not an average. The key question
  is not the mean return but the probability that the carved-out slate misses
  the tail entirely.
- **Read the distribution agreement's accounting definitions** and price the
  gap between "gross receipts" as defined and money that actually exists.
- **Test the exclusions** — get the list of carve-outs in writing and model the
  slate without them.
- **Audit history** — has this studio been sued over participations, and how
  did it settle (`11` §2)?
- **Assess the executive regime** — the slate will be picked by people whose
  tenure (§2.2.6) is shorter than the deal.
- **Structure for tax and currency** and confirm the security package: who has
  a charge over the copyright, who controls the **collection account**, and
  what happens on insolvency.

For **single-picture** equity, diligence is smaller and different: read the
script, check the budget against a schedule, confirm the cast deals and dates
are real, check the tax credit is applied for and lendable, check chain of
title is clean (§11), confirm the completion bond and the sales estimates, and
verify that the distributor's minimum guarantee is from a party that can pay.

### 4.4 What separates good money from bad money

1. **It closes.** The most valuable attribute of a financier is that the wire
   arrives on the date it was promised. Productions are destroyed by money that
   was "two weeks away" for five months.
2. **It understands the asset class.** Money that expects a bond-like return
   from a fat-tailed business will panic after one bad picture and stop funding
   mid-slate, which is worse for the studio than never having had it.
3. **It is patient.** Returns arrive over 3–5 years (§1.2). Capital with a
   two-year horizon is structurally mismatched.
4. **It brings something besides cash** — a territory, a tax jurisdiction, a
   relationship, a co-production treaty.
5. **It does not want to be a producer.** Money that wants creative approvals
   it lacks the experience to exercise is the recurring disaster of independent
   film.
6. **It is documented.** Handshake equity that has not signed by the start of
   principal photography is the classic route to a production shutting down in
   week three.

### 4.5 How financing arrangements fail

| Failure | Mechanism | Consequence |
|---|---|---|
| **Adverse selection on a slate** | Investor funds everything except the franchises | Systematically below-average returns; the deal is not renewed and the sector's appetite closes for years |
| **Fee stack eats the return** | Distribution fee + overhead + interest before any profit split | The film succeeds and the equity still loses |
| **Money doesn't close** | Verbal commitment, no signed documents | Production shuts down; crew paid off; cast lost to other jobs |
| **Gap loan under-collateralised** | Unsold territories don't sell at estimate | Lender forecloses on the film; producer loses the asset |
| **Cross-collateralisation surprise** | Losses on one picture absorb profits on another | Investor's winners never pay out |
| **No collection account** | Distributor collects and self-reports | Money disappears into the distributor's balance sheet; recovery is litigation |
| **Currency and timing** | Foreign MGs paid on delivery, costs incurred earlier | Cash-flow gap that must be bridged expensively |
| **Completion bond called** | Overrun past contingency | The guarantor takes over the picture and can replace the director (`03` §7) |

---

## 5. Agencies, managers, lawyers

**Talent agencies** represent actors, directors, writers, and below-the-line
talent, and procure employment. Standard commission is **10%**.

- The big four: **CAA, WME, UTA, Paradigm** (plus Gersh, APA, and boutiques).
- Agencies are licensed and regulated (California Talent Agencies Act) and
  operate under guild franchise agreements.

**Managers** advise on career strategy and can produce; commission typically
**10–15%**; legally may not procure employment in California, a line that is
routinely stretched.

**Entertainment lawyers** paper the deal; typically **5%** or hourly.

A well-represented star can therefore be paying 25–30% off the top before tax.

### 5.1 Packaging

An agency that represents the writer, director, and star of a project can
deliver them as a **package**, historically charging the production a
*packaging fee* (the "3-3-10": 3% of budget cash, 3% deferred, 10% of
backstop profits) instead of commissioning its clients.

The WGA declared this a conflict of interest, ordered members to fire
non-compliant agents in 2019, and the ensuing dispute ended with agreements
phasing packaging fees out and capping agency ownership of affiliated
production entities. Packaging as a *practice* (assembling elements to raise a
project's value) persists; the *fee* has largely gone.

Why it matters mechanically: agencies aggregate leverage. A star's availability
is often the real gating factor on a film's schedule, and the agency controls
that calendar.

### 5.2 How an agency is organised

An agency is a partnership of departments, and the department is the unit that
matters.

```
Board / partners (equity, or a PE-backed holding company)
├── Motion Picture Talent      — actors for film
├── Motion Picture Literary    — writers and directors for film
├── Television (talent, literary, packaging, unscripted)
├── Below-the-line / Production ("crafts") — DPs, editors, PDs, composers
├── Music, Comedy touring, Books, Theatre
├── Sports, Endorsements, Brand & corporate consulting
├── Business Affairs (the agency's own lawyers, who close the big deals)
└── Support: legal, finance, IT, research, the mailroom
```

The **desk** is the atomic unit: one agent plus one or two assistants. The
assistant rolls calls (places them, in sequence, keeping the agent on the
phone continuously), listens in and takes notes, maintains the desk's grid of
clients and status, reads, and knows everything. The mailroom-to-assistant-to-
agent ladder is the industry's main training pipeline: **3–6 years** from
mailroom to junior agent, with heavy attrition, and it produces most studio
executives and managers too.

**Coverage** inside an agency: a client is signed by the *agency*, not by one
agent, and is "covered" by a team — a point person plus agents in TV, books,
endorsements, and touring. Big-agency pitch is precisely this: one signature,
eight departments.

### 5.3 What an agent actually does in a day

- **Calls, all day.** A busy motion-picture agent's assistant rolls **80–200**
  calls a day. Almost nothing is done by email, because email creates a record
  and removes tone.
- **The morning staff meeting.** Each department meets weekly (Monday is the
  convention) to run the client list, the availability grid, and the material
  going out. Agency-wide meetings share what every department is hearing. This
  internal information pooling is the core advantage of a large agency.
- **Tracking.** Informal, constant, reciprocal calls with peers *at rival
  agencies* about what is being submitted, who passed, what a studio paid, who
  is attaching to what. Junior agents and assistants run parallel tracking
  networks. The industry's real information system is this network, not the
  trades (§12).
- **Submissions and lists.** Getting clients onto the studio's and casting
  director's lists for roles (`04` §8), submitting writers for open assignments,
  putting a director's name in front of a producer with material.
- **Going out with material.** For a spec script or a pitch, the agent controls
  the process: who gets it, when, whether it goes wide or to a select few,
  whether there is a deadline for bids.
- **Negotiating.** Fee, backend, credit, perks, approvals, dates. Above a
  threshold the agency's own business affairs lawyer takes over the paper while
  the agent holds the relationship.
- **Servicing.** Set visits, premieres, reading a client's passion project,
  managing a client through a bad review or a lost job. Most of an agent's week
  is emotional labour, and clients leave over it more often than over money.

### 5.4 How clients are signed — and poached

**Signing** is a sales process:

1. **Identification.** A festival breakout, a strong self-tape circulating, a
   play, a first novel, a viral short, a staff writer being promoted, or a
   below-the-line credit that suddenly matters. Agencies employ people whose
   whole job is to watch for this, and juniors are promoted on who they found.
2. **The approach.** Usually indirect — through the client's manager, lawyer, a
   producer, or a fellow client. Cold approaches are weak.
3. **The meeting.** The agency's pitch is a **plan**: here are the six specific
   people I will get you in a room with in the next ninety days, here is the
   role I think you should not take, here is what your career looks like in
   three years. Vague enthusiasm loses to a named list.
4. **The team.** For a serious signing the agency brings a group — the point
   agent, department heads, sometimes a board member — to demonstrate coverage.
5. **Close.** Guild-franchised agency agreements are typically **1–3 years**
   with a **"91-day clause"**: if the agency fails to obtain a bona fide offer
   within a set number of consecutive days of unemployment, the client may
   terminate at will. In practice clients leave when they like, with notice.

**Poaching** is the same process aimed at a signed client, and it happens
constantly. The usual vectors: a manager or lawyer who prefers a different
agency and steers, a competing plan pitched during a lull, a specific job
dangled ("we can get you in on this"), or an agent leaving and taking clients
with them — which is why agent employment contracts contain non-solicits and
why agent moves are news (§12).

**Commission mechanics** that shape behaviour:

- 10% of **gross compensation**, including backend, in perpetuity for deals
  made during the term (a **sunset**: the departing agency keeps commissioning
  the deals it made, often on a declining scale).
- Guild rules bar commissioning a member down below **scale**, hence the
  ubiquitous **"scale plus ten"** deal on smaller jobs — the production pays
  minimum plus the agent's commission so the actor nets scale.
- Because commission is a percentage of *this job*, the agent's incentive is
  slightly misaligned with career architecture, which is precisely the gap
  managers sell into.

### 5.5 What separates a good agent from a bad one

1. **Telling the client the truth.** That the offer is the best that is coming,
   that the passion project is not going to be financed, that the quote has
   dropped. Agents who only deliver good news lose clients at the first bad
   year.
2. **Knowing what is actually getting made.** Not what is announced (§12) but
   what has a date, a budget, and a champion. This is what tracking is for.
3. **Casting the client correctly.** Reading which role will move a career and
   which will merely pay — and being willing to argue for the lower fee.
4. **Sequencing.** A career is a sequence, not a set of transactions: a
   prestige job to reset perception, then a commercial job to reset the quote,
   then the director relationship that pays off in five years.
5. **Making calls with no commission in them.** Getting a client a meeting on a
   job the agency does not represent, or introducing two clients. This is how
   relationship capital is built and it does not show up in a quarter.
6. **Reading.** Agents who read are rare and are the ones writers stay with.
7. **Picking the fight.** Knowing when to hold up a deal over a credit or a
   backend definition and when to close, because a buyer burned over a trivial
   point remembers for a decade.
8. **Protecting the buyer relationship.** The counterparty is a repeat player.
   An agent who extracts a maximum on one deal and poisons a studio for their
   other forty clients has done a bad trade.
9. **Speed and reachability.** Returning the call. It is stated as a joke and it
   is the most common actual complaint.

### 5.6 How leverage is actually exercised

Agency power is not abstract. It operates through a small number of concrete
levers:

| Lever | Mechanism | When it works |
|---|---|---|
| **Controlling the go-out** | The agent decides who sees a hot spec, when, and whether there is a bid deadline — classically out Friday, bids Monday | When there is genuine competitive heat; a manufactured auction that fails is visible and costly |
| **Availability** | The client's calendar is the schedule constraint; the agency knows and shapes it | Always. Dates are the most binding constraint in the business (`04` §8.4) |
| **Attachment** | Putting a director or star on a project raises its value and can force a greenlight | When the attachment is real and dated, not "interested" |
| **The competing offer** | "There is another offer" — sometimes true | Once. Buyers compare notes |
| **Quote-setting** | Establishing a client's price on a deal that sets the floor for the next three | Early in a career, and after a hit |
| **Bundling without a fee** | Delivering writer + director + cast as a package, now commissioned client-by-client rather than fee'd | Constantly; the practice outlived the fee (§5.1) |
| **Withholding service** | Declining to submit clients to a buyer who behaves badly | Rarely stated, occasionally real, and only credible from a large agency |
| **Information asymmetry** | Knowing what the studio's slate needs before the studio says so | Continuously; it is the compounding advantage of scale |

### 5.7 Agents vs managers vs lawyers — who does what

| | Agent | Manager | Lawyer |
|---|---|---|---|
| **Licensed** | Yes (state talent agency acts); franchised by the guilds | No licence required | Bar admission |
| **May procure employment** | Yes — this is the defining function | Not in California, in law; in practice they do, and the exposure is a client suing to disgorge commissions | Yes, incidentally |
| **Commission** | 10% | 10–15% | 5% or hourly ($600–1,500/hr) |
| **Client load** | 30–100+ per agent | 5–20 per manager | Dozens |
| **May produce** | Historically restricted; agency-affiliated production is capped | Yes — and a producer credit plus fee is often the real economics | Rarely |
| **Actual value** | Deal flow, market information, the go-out, the calendar | Time, taste, career strategy, hand-holding, developing material with the client | The paper — where the money and the risk actually live |

The practical division: the agent gets the offer, the lawyer makes sure the
offer means what it appears to mean, and the manager decides whether the
client should want it. A star with all three pays **25–30%** off the top before
tax and, on a well-run team, considers it cheap.

---

## 6. Guilds and unions

Almost every studio film in the US is union. Each guild sets **minimums**
(scale), working conditions, credit rules, and **residuals**.

| Body | Covers | Key levers |
|---|---|---|
| **WGA** (Writers Guild of America, East/West) | Screenwriters | Minimums by budget tier, credit arbitration (§ `02-development.md` §7), separated rights, residuals |
| **DGA** (Directors Guild) | Directors, UPMs, 1st/2nd ADs | Minimums, **director's cut** guarantee, prep/post time, one-director rule |
| **SAG-AFTRA** | Performers, stunt performers, background | Scale, overtime, meal penalties, nudity riders, residuals, consent/AI terms |
| **IATSE** | Below-the-line crafts (camera, grip, electric, art, editorial, sound, hair/makeup, costume…) | Local-by-local rates, turnaround, meal penalties, health & pension contributions |
| **Teamsters Local 399** | Drivers, transportation, location managers | Transport, casting of vehicles |
| **AFM** | Musicians | Scoring session rates, new-use payments |

Two crew-side rules that shape schedules and budgets more than any other:

- **Turnaround** — the minimum rest between wrap and the next call (commonly
  10 hours, longer for some categories). Violating it incurs penalty payments
  and is the main reason a schedule cannot simply keep pushing.
- **Meal penalties** — a meal must be broken every ~6 hours; running past it
  charges escalating per-person penalties.

Strikes are a structural feature, not an anomaly: WGA 2007–08, WGA and
SAG-AFTRA 2023. A strike freezes development and production industry-wide and
shifts release calendars by a year or more.

### 6.1 What a signatory is, and how a production becomes union

A guild agreement binds a **company**, not an industry. The production entity —
almost always a single-purpose LLC formed for the one film — signs the guild's
collective agreement and becomes a **signatory**. Because the signatory is the
SPV and not the parent, a studio's obligations are ring-fenced per picture,
and a guild will often require additional security (a parent guarantee, a
deposit, or proof of funding) before it will let a thinly capitalised producer
sign.

The agreements themselves:

| Guild | Agreement | Renegotiated |
|---|---|---|
| WGA | Minimum Basic Agreement (MBA) | Every 3 years |
| DGA | Basic Agreement (BA) and Freelance Live and Tape Television Agreement | Every 3 years |
| SAG-AFTRA | Codified Basic Agreement / Theatrical Agreement, plus low-budget agreements | Every 3 years |
| IATSE | Basic Agreement (West Coast studio locals) and Area Standards Agreement (the rest of the US), plus local agreements and low-budget tiers | Every 3 years |
| Teamsters / Basic Crafts | Black Book agreement | Every 3 years |

The three routes into union coverage:

1. **Voluntary signing, because of the talent you want.** This is the real
   mechanism. Under **Global Rule One**, a SAG-AFTRA member may not work on a
   non-signatory production anywhere in the world. So the moment a producer
   wants any professional actor, they must sign. The same logic applies to
   directors (a DGA member cannot direct a non-signatory film) and writers.
   The guilds therefore organise producers through their members' scarcity
   rather than through workplace elections.
2. **Organising a shoot in progress.** IATSE flips non-union productions by
   quietly collecting authorisation cards from the crew and then presenting the
   producer with a demand. Producers usually sign, because a single lost
   shooting day costs more than the wage differential for the whole schedule.
   This most often happens in weeks 2–4 of a shoot, when the production is
   committed and the crew's leverage peaks.
3. **Low-budget agreements as an on-ramp.** Every guild publishes tiered
   agreements with reduced minimums, deferrals, and simplified terms for films
   under stated budget thresholds — SAG-AFTRA's Ultra Low Budget / Modified Low
   Budget / Low Budget tiers, WGA's low-budget rates, IATSE's tiered
   agreements. These exist to keep small films inside the system rather than
   outside it, and they are the normal route for a first feature.

A separate structure applies internationally. The UK is covered by **BECTU**
and **Equity** agreements (PACT/BECTU, PACT/Equity), which are less
prescriptive on turnaround and rest than the US locals but carry their own
rules; Canada has **ACTRA** and IATSE locals; Australia the **MEAA**. A US
studio film shooting abroad typically applies its US guild obligations to its
US-covered talent and the local agreement to local crew — one of several
reasons runaway production is administratively complicated as well as cheap
(`03` §6).

### 6.2 How minimums are actually structured

"Scale" is not one number. Each guild builds its minimums differently, and the
structure drives behaviour more than the level does.

**WGA — priced by step and by budget tier.** The MBA prices each writing
service separately: original screenplay including treatment, screenplay
excluding treatment, first draft, rewrite, polish, and story alone. There are
two principal budget tiers (a low threshold historically around **$5M**), and
the high-budget minimum for a complete original screenplay sits in the
**low six figures** in the 2020s. Payment is in installments tied to
*commencement* and *delivery* of each step, which is what makes step deals
(`02` §4) work: the studio can stop after any step. Separated rights (publication
and dramatic rights the writer retains on an original) and sequel/remake
payments are guild-mandated, not negotiated.

**DGA — priced by time, plus guaranteed process.** The director's minimum is
a weekly rate against guaranteed weeks, tiered by budget, and it comes bundled
with the guild's real prize: **guaranteed prep and post time**. The DGA
mandates a minimum cutting period for the **director's cut** (commonly
**10 weeks** on a feature over a length threshold, longer on longer films),
during which the studio may not take the film away. It also mandates the
**one-director rule** (a film has one director; replacing one is a formal
process) and controls credit placement — the director's card position on the
main titles is a guild rule, not a courtesy. The DGA also covers UPMs, 1st ADs,
and 2nd ADs, with their own rate schedules, and it is the guild that most
directly constrains post schedule.

**SAG-AFTRA — priced by engagement type.** Day performer, three-day performer,
weekly performer, and "**under-five**" (fewer than five lines) are separate
categories with separate rates; background has its own scale and per-zone
minimum hiring quotas. Mid-2020s day-performer scale is around
**$1,200/day** with weekly rates at a discount to five days. Layered on top:
overtime after 8 hours, meal penalties, a rest period (**12 hours** for
performers, longer after a distant location), premiums for hazardous work,
nudity riders requiring advance written consent and a closed set, dubbing and
looping payments, and — since 2023 — consent and compensation terms for
**digital replicas and AI**. Scale is a floor; stars negotiate multiples of it
(`12` §2).

**IATSE — priced by the hour, per local, with a benefits engine underneath.**
Each local (600 camera, 700 editors, 728 lighting, 80 grips, 892 costume
designers, and so on) has its own classifications and hourly rates. The
structure that matters:

- **The workday** is 8 hours at straight time, then time-and-a-half, then
  **double time** after 12 (or 14, per agreement), which is why the back half
  of a long day is disproportionately expensive.
- **Turnaround** — commonly **9–10 hours** between wrap and call, with penalty
  payments for invasion; improved in the 2021 and 2024 rounds.
- **Meal penalties** — a break every 6 hours, escalating per-person penalties
  after.
- **Health and pension contributions** — the employer pays a percentage of
  gross payroll plus hourly contributions into the plans. Crew accumulate
  **banked hours** toward health coverage, and this, not the hourly rate, is
  what most below-the-line members are actually protecting in a negotiation. A
  slow year that leaves members short of their qualifying hours is a genuine
  crisis, and residual income is a major funder of the plans.

**Teamsters and the Basic Crafts** (drivers, plasterers, laborers, plumbers)
negotiate together in the "Black Book" agreement, with their own scale, and
drivers' rules — who may move a vehicle, how many drivers a convoy needs —
have outsized schedule effects.

**AFM** prices scoring sessions per musician per session, with **new-use**
payments if the recording is reused elsewhere. It is the reason a score is
often recorded in London or Eastern Europe on a buyout rather than in Los
Angeles on session terms.

### 6.3 What a strike actually looks like

A strike is a sequence, and the sequence is roughly the same every time.

| Phase | What happens | Effect on production |
|---|---|---|
| **T-12 to T-6 months** | Both sides posture publicly. Studios **stockpile**: buy scripts, accelerate development, greenlight early, push productions to shoot before expiry | Development and production run hot; writers get unusually good deals |
| **T-8 weeks** | Formal negotiations open at the AMPTP (the studios bargain collectively through the Alliance of Motion Picture and Television Producers) | Slates are quietly rescheduled |
| **T-4 weeks** | **Strike authorisation vote** by members — a mandate, not a strike. A weak vote (under ~90%) weakens the negotiators | Buyers slow-walk deals |
| **Week 0** | Contract expires; the board calls the strike. **Struck work** is defined — what members may not do, including for foreign and non-signatory employers | Covered work stops that day |
| **Weeks 1–3** | Picket lines at lots and locations. Picket captains, rotas. Other unions honour lines: a WGA picket at a gate frequently stops a shoot no writer is on, because Teamsters will not cross | Productions with completed scripts continue in a writers' strike; **all** production stops in a performers' strike, including press and promotion |
| **Weeks 3–8** | Interim agreements offered to independents who agree to the guild's terms — these keep small films shooting and split the employer side | Independent production continues; studio production does not |
| **Weeks 6–16** | Attrition. Crew (not on strike, not working) exhaust savings; support funds open; below-the-line hardship becomes the political story | Post work drains away; the last films finish and the pipeline empties |
| **Endgame** | Back-channel talks, then a marathon session, then a tentative agreement | — |
| **Ratification** | Membership votes; typically 1–3 weeks | Work resumes on ratification, or on a board-lifted strike order |
| **T+1 to T+9 months** | Restart is *not* instantaneous: scripts must be finished, crews rebooked, stages re-secured, dates re-dated. Release calendars shift 6–18 months | The lost year shows up in the theatrical slate 12–24 months later |

Second-order effects worth naming: awards seasons are disrupted (no
promotion), festivals lose talent, the trades' business model wobbles, tax
incentive allocations lapse unused, and the crew who leave the industry during
a long strike do not all come back — which produces a skills shortage in the
recovery.

### 6.4 Jurisdiction disputes

Guilds fight each other as well as employers, and the boundary fights are
where a lot of practical weirdness comes from.

| Dispute | The line | Why it matters |
|---|---|---|
| **IATSE vs Teamsters** | Who drives and who rigs — camera trucks, condors, picture vehicles, location scouting | Determines crew counts and who may touch what on a set |
| **IATSE vs local/regional locals** | Basic Agreement (LA studio locals) vs Area Standards Agreement (elsewhere) | Different rates and rules for the same job in Georgia vs Los Angeles |
| **WGA vs Animation Guild (IATSE 839)** | Animated features are historically written under 839, not the WGA MBA | Animation writers get different minimums, different residuals, and often no WGA credit — one of the largest coverage gaps in the business |
| **SAG-AFTRA vs Teamsters** | Precision and stunt driving | Long-running, occasionally litigated |
| **SAG vs AFTRA (pre-2012)** | Film vs broadcast performers, before the merger | Produced decades of duplicated jurisdiction; resolved by merger |
| **VFX** | Largely unorganised until the 2020s, when unit-by-unit organising began at studio-adjacent facilities | The reason VFX labour conditions differ sharply from on-set conditions (`08` §3) |
| **Reality and documentary** | Whether producers who write are "writers" | Determines whether an entire production sector is covered at all |

Two further mechanics practitioners rely on:

- **Financial core.** A US worker may resign full union membership and pay only
  the portion of dues attributable to representation, retaining the right to
  work non-union jobs. It is legal, it is rare, and within SAG-AFTRA it is
  socially radioactive.
- **Reciprocity and residency.** Working across locals and countries requires
  permits, transfers, and sometimes visa sponsorship; an American HOD on a UK
  shoot and a UK HOD on a US shoot are both administrative projects.

### 6.5 What the guilds mean for a production's plan

- They **fix the price floor** but rarely the actual price; scale matters for
  the bottom 80% of a cast and crew list and is irrelevant to the top.
- They **fix the shape of the day and the week**, which is what actually
  drives cost: turnaround, meal penalties, and overtime bands convert schedule
  optimism directly into money (`06` §6).
- They **fix the post schedule**, via the DGA cut period.
- They **fix credit**, via WGA arbitration and DGA placement rules, which
  removes a whole category of negotiation and creates another.
- They **create a residual liability** that follows the film forever
  (`11` §5) and that is a real line in any library valuation (§11).

---

## 7. Streamers: a different economic animal

A traditional studio film is a **speculative asset**: it costs money, then earns
a variable return. A streaming original is typically a **commissioned asset**:

- **Cost-plus** — the streamer pays the negative cost plus a fixed premium
  (often quoted around 10–30% depending on the deal and era) and owns
  everything, worldwide, in perpetuity.
- **No backend** — participants are bought out up front, so the upside is
  capped and the downside is eliminated. This changed talent economics
  substantially; "buyouts" replaced points.
- **No box office signal** — success is measured by internal viewing metrics
  and subscriber retention, not a public weekend number.

Consequences worth understanding for any simulation: a streamer-financed film
has *no theatrical risk*, *no marketing recoupment problem*, and *no public
scoreboard*. It also generates no exhibition data and no library sales, since
it is already owned.

Streamers do release theatrically, mostly for awards eligibility (an Academy
qualifying run) or for a small number of event titles.

### 7.1 Who is in the room

The org looks superficially like a studio's and behaves differently.

| Role | What they do | Difference from a studio |
|---|---|---|
| **Head of Film** | Owns the film slate and its budget envelope | Budget is an annual **content spend** allocation, not a per-picture P&L |
| **VPs / Directors of film** | Split by genre, by budget band, and increasingly by **region** (local-language originals) | A large streamer commissions in 15–30 countries in local languages, which a studio does not |
| **Acquisitions** | Buys finished films at festivals and completed-but-unsold films | A much larger function than at a major; volume matters |
| **Business & Legal Affairs** | Papers buyouts, bonus schedules, and perpetual worldwide grants | Negotiating away backend, not defining it |
| **Data science / content strategy** | Models expected viewing hours, audience segment reach, and retention impact | The equivalent of tracking and the greenlight model combined, and it sits *inside* the decision, not beside it |
| **Marketing** | Mostly on-service (the row, the artwork, the thumbnail) plus paid campaigns | The single biggest lever — placement on the home screen — costs nothing and is invisible to outsiders |
| **Physical production** | The same job as at a studio | Identical; the crafts do not change |

### 7.2 How a commission is actually negotiated

1. **Submission.** An agency brings a package — usually script plus director
   plus at least one star, because a streamer buying a naked script is rarer
   than a studio doing so. Pods with streamer overall deals submit directly.
2. **Exec champion and internal read.** As at a studio (§2.2.2), but faster.
3. **The data read.** Analysts produce a view of the expected audience: which
   segments, how many hours, how much of it is *incremental* (people who would
   not otherwise have watched anything) and whether it addresses a gap — a
   territory, a genre, a demographic the service under-serves. The question is
   not "will it make money" but "what does this buy us that we do not have".
4. **The number.** Negative cost is built by physical production as usual. The
   streamer then pays **cost plus a fee** — commonly quoted at **10–30%** of
   the negative cost — which is the producer's and financiers' entire economics.
   There is no recoupment, no waterfall, and nothing to audit.
5. **Buyouts.** Talent is paid a fee that includes a computed buyout of the
   residuals and backend they would have earned in a theatrical model. The
   arithmetic is explicit: business affairs models what the participation would
   have been worth against comparable theatrical performance and pays a
   fraction of it in cash, up front. Post-2021 this has partly reverted:
   several services introduced **bonus schedules** paying additional sums if
   viewership crosses defined tiers, which is a backend by another name.
6. **Weekly greenlight committee.** The decision is made by a standing
   committee, usually weekly, chaired by the head of film with data, finance,
   marketing, and legal present.
7. **Close.** Because the buyer funds everything and owns everything, the deal
   is dramatically simpler than a co-financed studio picture: no capital stack,
   no collection account, no gap loan, no completion bond in most cases, no
   territory carve-outs, no windows negotiation.

Elapsed time from submission to a firm yes is commonly **4–12 weeks**, against
**6–24 months** for a comparable studio greenlight.

### 7.3 How the approval process differs from a studio greenlight

| Question asked at a studio greenlight | Streamer equivalent |
|---|---|
| What will it gross, domestic and international? | How many viewing hours, and from whom? |
| Can marketing sell it in a 2.5-minute trailer? | Will the artwork earn a click in the row? |
| Is there a date, and can we defend it? | Slots are effectively unlimited; dating is a scheduling convenience, not a scarce resource |
| What is the P&A commitment? | On-service promotion is near-free; paid spend is discretionary and can be decided after delivery |
| What is the rating, and does it cost us the family audience? | Maturity rating affects placement, not access |
| What's the backend exposure? | None — it was bought out |
| Do we own the sequel? | Yes, along with everything else, everywhere, forever |
| What happens if it tests badly? | It is released anyway, quietly, or shelved at no incremental cost |

The consequential differences for how films get made:

- **Failure is cheap and quiet.** A studio flop is a public event with a
  measurable number; a streaming underperformer disappears from the row. This
  changes the risk appetite at commissioning and removes most of the career
  consequence for the people who made it — which cuts both ways.
- **No turnaround.** The streamer owns the film in perpetuity, so a shelved
  project cannot be rescued by another buyer (`02` §9). A completed film can be
  written off and never released.
- **Delivery is the finish line.** With no theatrical run, there is no
  campaign, no legs, no word-of-mouth economics to manage, no exhibition
  relationship. Post schedules are set by the release slot, and the film is
  done when it is delivered.
- **The talent economics invert.** No points means a bigger cheque up front,
  which is excellent for mid-level talent and bad for the handful of people
  whose backend was worth tens of millions.

The model has drifted since 2022: Amazon and Apple commit to real theatrical
runs on selected titles, Netflix runs limited theatrical for awards, and
several services now license *out* library titles rather than hoarding
everything — so the clean "commissioned asset" description is best treated as
the pure case rather than the universal one.

---

## 8. Exhibition

**Chains**: AMC, Regal (Cineworld), Cinemark are the US big three; Odeon,
Vue, Cineworld dominate the UK. Plus large independent circuits and
arthouse/nonprofit venues.

Key facts that drive release strategy:

- **Screen count** is negotiated, not owned. A distributor asks for a wide
  break (typically **2,000–4,000+** US locations for a studio release); the
  exhibitor decides based on expected performance.
- **Film rental** — the exhibitor keeps a share of the gross and remits the
  rest. In the US, roughly **50–55%** of gross goes to the distributor on a
  major release, front-loaded (a higher share in week one, declining weekly);
  internationally it is usually lower (**~40–45%**). Concessions are the
  exhibitor's real margin and they keep 100%.
- **Holdover / minimum engagement** clauses commit a screen for a set number
  of weeks.
- **Windows** — the exclusive theatrical period before home release. Once
  ~90 days by convention, now commonly **17–45 days** and negotiable per title.

Trade bodies: **Cinema United** (formerly NATO) for exhibitors, **MPA** for
the studios. CinemaCon is where the two negotiate in public.

Scale, directionally: the US and Canada have roughly **5,500–6,000 sites** and
**39,000–41,000 screens**, of which the three big circuits control around half.
A modern multiplex has **8–20 screens**, seating **100–400** in a large house
and **40–150** in a small one, and its schedule is rebuilt every week.

### 8.1 Ratings

In the US, **CARA** (the MPA's Classification and Rating Administration)
issues G / PG / PG-13 / R / NC-17. It is voluntary, but most chains will not
book an unrated or NC-17 film, so it is effectively mandatory. A rating is a
**commercial constraint**: an R rating removes the under-17 unaccompanied
audience, which matters enormously for family and franchise titles, and studios
routinely re-cut to secure PG-13. The UK equivalent is the **BBFC** (U, PG,
12A, 15, 18), which is statutory for physical media.

### 8.2 How booking actually works

Booking is a negotiation between two named people who will deal with each other
every week for twenty years.

**On the distributor's side**: a **President of Distribution** owns dating and
strategy; a **EVP/VP of Sales** owns the circuit relationships; **circuit
heads** each carry one or more chains nationally (historically this was a
network of regional **branch offices**, now consolidated to a handful of people
per studio); a **print and playdate** or **operations** group handles the
mechanics of getting the DCP and the KDMs out.

**On the exhibitor's side**: a **film buyer** (sometimes "head of film") at the
circuit's head office negotiates terms with each distributor; a **programmer**
assigns titles to sites and auditoria; a **scheduler** sets showtimes and seat
counts; the site's general manager executes and reports.

The sequence:

| Stage | What happens | Who | Timing |
|---|---|---|---|
| **Dating** | The distributor stakes a release date, often years out, and announces it (§12) to deter competitors | Distribution president, chairman | 6 months–3 years ahead |
| **Trade selling** | Footage, presentations, and one-to-one pitches at CinemaCon and in circuit head offices | Sales, marketing, sometimes talent | 3–12 months ahead |
| **The ask** | The distributor states terms and the number of locations/screens it wants | Circuit head → film buyer | 6–12 weeks ahead |
| **Negotiation** | Terms, screen counts, formats (how many PLF/IMAX screens), holdover weeks, and what the exhibitor wants in return on the distributor's *next* title | Circuit head, film buyer | 4–10 weeks ahead |
| **Allocation** | The circuit commits locations and screen counts; the distributor's engagement list is built | Film buyer, programmer | 3–6 weeks ahead |
| **Adjustment** | Tracking (`09` §8) moves; screens are added or cut | Both | Final 2 weeks, and the Tuesday before opening |
| **Weekend** | Grosses reported hourly Friday, estimates Sunday, actuals Monday (§12) | Everyone | Live |
| **The weekly re-book** | Sunday night and Monday, every title's screens are reassessed; changes take effect Friday | Programmer, film buyer, circuit heads | Weekly, all run |
| **Settlement** | The engagement is closed out and money remitted | Distribution accounting, exhibitor accounting | 30–60 days after playdate |

Two things outsiders miss. First, the negotiation is **portfolio-level, not
title-level**: a buyer who gives a distributor a generous break on a weak title
in March is buying consideration on the tentpole in July, and both sides keep
score across years. Second, **screens are reallocated weekly** — a film that
drops 65% loses auditoria the following Friday, and a sleeper that holds gains
them, which is why the second weekend's screen count is itself a signal
(`10` §3).

### 8.3 What a film buyer actually does, and what makes one good

A circuit film buyer sets the revenue of a multi-billion-dollar business by
guessing, weeks ahead, how films nobody has seen will perform, and by
allocating a fixed number of seats among them.

Day to day: reading tracking, watching footage and early screenings, taking
calls from every distributor's circuit head, negotiating terms title by title,
reviewing the weekend's per-screen performance site by site, deciding holdovers
and drops, and arguing over settlement on titles that underperformed.

The skill axis:

1. **Forecasting demand per site, not nationally.** The same film opens
   differently in a suburban 16-plex and a downtown 8-plex; the buyer's real
   product is the *distribution* of a title across a heterogeneous estate.
2. **Reading a distributor honestly.** Knowing which studio's confidence is
   real and which is sales talk, and which marketing plans actually get spent.
3. **Playing the long game across titles.** Trading a favour now for screens
   later, and never spending a relationship on one weekend.
4. **Seat allocation discipline.** Putting a 400-seat house against a title
   that needs 150 wastes the room; the reverse turns away money on Friday
   night and kills word of mouth.
5. **Knowing when to hold.** Keeping a well-reviewed sleeper on two screens for
   six weeks because the multiple is coming, against the pressure of the next
   week's openers.
6. **Local knowledge.** Which sites over-index for family, faith, action,
   Spanish-language, or specialty — an estate has dozens of distinct markets in
   it.

Failure looks like: booking a title too wide and taking a poor per-screen while
the auditoria sit empty; booking too narrow and selling out Friday of a film
that then loses its moment; committing holdover weeks to a title that dies;
and letting a distributor relationship sour so the next tentpole comes with
worse terms.

### 8.4 Terms, in detail

**Firm / aggregate terms** are now the norm for wide releases: a single
percentage of gross for the whole engagement, or a small weekly step-down.
A tentpole might be a flat **55–60%** to the distributor for the run; an
ordinary studio release **50–55%** declining; a specialty title **35%** rising
if it holds.

**The sliding scale** it replaced is still used in parts of the specialty
market and is worth understanding because it explains the vocabulary:

- **The house nut** (or *house allowance*) — an agreed weekly figure
  representing the theatre's operating cost for that auditorium: rent, utilities,
  labour, insurance. Negotiated per site, and always contested, because the
  exhibitor sets it.
- **90/10 over the nut** — of the box office above the house nut, **90%** goes
  to the distributor and 10% to the exhibitor.
- **The floor** — a declining weekly percentage guaranteeing the distributor a
  minimum share regardless: classically **70/60/50/40/35** across weeks one to
  five and 30% thereafter.
- **The distributor takes the greater of the two** each week. In practice a big
  opening pays out on the 90/10 and the tail pays out on the floor.

Worked illustration, one auditorium, one week: gross **$40,000**, house nut
**$12,000**. The 90/10 calculation yields 90% of $28,000 = **$25,200**. The
week-one floor of 70% yields **$28,000**. The distributor takes $28,000
(70%), the exhibitor keeps $12,000. Change the gross to $18,000 and 90/10
yields $5,400 while the floor yields $12,600 — the exhibitor pays the floor and
takes a bad week on the chin. This is exactly why nut negotiation matters.

Other terms in the deal:

| Term | What it does |
|---|---|
| **Minimum engagement / holdover** | Commits the film to a set number of weeks (2–4 typical), so the distributor is not dropped after a soft opening |
| **Screen and seat commitment** | Number of auditoria and, increasingly, seat counts — a distributor cares about capacity, not screens |
| **Format allocation** | How many IMAX, Dolby, or premium large-format screens. IMAX takes its own share of gross (commonly around **12.5%**) off the top, so a PLF booking changes the arithmetic |
| **Showtime commitments** | Number of daily performances and prime-time slots |
| **Clearance** | An exhibitor demanding exclusivity within a geographic zone. Antitrust-sensitive and litigated |
| **Settlement / adjustment** | Post-run renegotiation, still common in specialty: a buyer who took a bath asks for relief and often gets it, because next year exists |
| **Virtual print fee (VPF)** | Historic: distributors subsidised digital projector conversion per booking. Largely expired |
| **Window** | The exclusive theatrical period. Now negotiated per title and sometimes tied to a performance threshold |

### 8.5 What makes an exhibitor relationship good or bad

Good, from the exhibitor's side: the distributor gives honest reads on how a
film is tracking, gives enough notice to plan the estate, spends the marketing
money it said it would, dates its films where they can succeed rather than
dumping them, supports local promotion, and does not shrink the window
unilaterally after terms were agreed.

Good, from the distributor's side: the exhibitor gives the screens and the
prime showtimes it promised, allocates the right *rooms*, does not quietly
under-play a title while over-playing a rival's, settles honestly, and holds
a film that is working rather than clearing it for the next opener.

Bad, and what it costs:

| Failure | What it is | Consequence |
|---|---|---|
| **Over-asking then under-delivering** | Pushing for 4,000 locations on a film that plays to 2,200 | Per-screen collapses; the buyer discounts the next ask |
| **Dumping** | Releasing a film the distributor has given up on, with no spend | Exhibitors lose money on committed screens, and remember |
| **Unilateral window shortening** | Announcing a 17-day window after terms were struck on a 45-day assumption | Circuits retaliate on screen counts; in the extreme, a boycott |
| **Inflated house nut** | Exhibitor pads the allowance under a 90/10 | Distributor audits, relationships sour, terms move to firm percentages |
| **Under-playing** | Booking a title into the smallest house at bad times to favour another | Distributor's checkers spot it; terms tighten next time |
| **Late materials** | DCP or KDM arrives days before opening | Missed shows, refunds, and real operational cost |
| **Chronic settlement disputes** | Every engagement renegotiated after the fact | Working capital problems on both sides |

Underneath all of it sits the exhibitor's actual economics: of a ticket, the
site keeps roughly **45–50%** domestically after film rental; concessions run
at **80–90% gross margin** and supply the majority of the profit; and rent,
labour, and utilities are close to fixed. That is why an exhibitor's decisions
are ultimately about **admissions**, not gross, and why they resist anything
that reduces footfall through the lobby.

---

## 9. International

Roughly **60–70%** of a major studio film's theatrical gross now comes from
outside North America, though the split varies wildly by genre (broad action
and animation travel; comedy and dialogue-driven drama often do not).

Two models for getting there:

- **Studio-direct** — the major's own international offices distribute.
- **Territory sales** — rights are sold country-by-country to local
  distributors, usually via sales agents at markets (**AFM**, **EFM** at
  Berlin, **Marché du Film** at Cannes). This is how most independent films
  are financed and distributed.

**Output deals** commit a territory's distributor to take a studio's whole
slate for a term.

China deserves separate mention: quota-limited imports, a revenue share for
foreign films far below the domestic norm (historically ~25%), and censorship
approval that can alter or block a release.

### 9.1 How studio-direct international actually operates

A major runs a **President of International Distribution** in Los Angeles or
London, with **managing directors** in perhaps 15–30 territory offices and
**sub-distributors** (local companies acting on commission) in the smaller
markets. The division of authority is consistent:

| Decision | Where it is made |
|---|---|
| Global release date and the *shape* of the rollout | Centrally, by the distribution president with the chairman |
| Territory dates within that frame | Territory MD, negotiated centrally — school holidays, local festivals, Ramadan, national competitors, and World Cup fixtures all move dates |
| Local marketing budget | Centrally set as a percentage of forecast gross; spent locally |
| Local creative | Adapted locally from central assets, with approval; some territories cut their own trailers and shoot their own key art |
| Localisation (dubbing, subtitling, title translation) | Centrally managed, executed by local vendors, **8–16 weeks** before release |
| Ratings/censorship submission | Local, per territory, each with its own board and lead time |
| Booking and terms | Local, with the territory's own exhibitor relationships |

**Day-and-date vs staggered.** Piracy has pushed most tentpoles to near-
simultaneous global release; smaller films still stagger to reuse talent for
press tours and to let word of mouth from an early territory build. A common
pattern is a lead territory (occasionally an international market *ahead* of
the US, to seed reviews and buzz) and then a two-to-six-week rollout.

**Localisation is a real production.** A dub is cast, directed, and recorded
per language — 8–20 languages for a tentpole, each requiring a casting session,
a director, a studio, and mixing; plus subtitle files for another 20–40. The
schedule dependency is hard: a late picture lock (`07` §1) compresses dubbing
and is one of the most common causes of a territory date slipping.

### 9.2 Territory sales: how the independent model actually works

For a film without a studio, rights are sliced by **territory × media × term ×
language** and sold as separate assets. The chain:

1. The producer signs with a **sales agent** (also called an international
   sales company) — typically for **10–25 years**, worldwide excluding
   whatever the producer has already sold, with a commission of **10–20%** of
   gross receipts plus **recoupable market expenses** (commonly capped at
   **$75–250K** per film: market fees, travel, poster and promo reel, trailer,
   subtitling, screenings, deliverables).
2. The agent produces the **estimates** — a territory-by-territory grid of
   "ask" and "take" prices. These estimates are the film's actual financial
   foundation: they support the **pre-sales** that fund it (`03` §4) and the
   **gap loan** that bridges what is unsold. A bank will typically lend gap of
   **10–15%** of budget against unsold estimates with **2× coverage**.
3. Buyers commit **minimum guarantees (MGs)** — an advance against the
   territory's revenue — usually **10–20%** on signature and the balance **on
   delivery**. The MG is the money that actually funds the picture; the
   overage above it is frequently never seen.
4. Money is paid into a **collection account** administered by a neutral third
   party under a **CAMA** (collection account management agreement), which
   pays the waterfall in the agreed order so the sales agent is not both
   collector and beneficiary.
5. **Delivery** is a specific, brutal, contractual list — masters, audio stems,
   M&E track, textless materials, chain of title, E&O certificate, music cue
   sheet, credits, artwork, dubbing scripts. Non-delivery of a single item can
   delay payment of the whole MG for months, and delivery disputes are the most
   common way a financed independent film still fails to pay its investors
   (`07` §7).

### 9.3 What a sales agent does day to day

- **Acquiring product.** Reading scripts and packages, deciding what is
  saleable, and competing with rival agents to represent it. The agent's own
  reputation is a component of the estimates: the same package carries higher
  estimates with a top-tier agent because buyers trust their delivery record.
- **Setting and defending estimates.** Too high and the gap loan is
  under-collateralised and the film cannot close; too low and the producer
  cannot finance it. Estimates are the agent's core professional judgement and
  their reputation is destroyed by systematically missing them.
- **Building materials.** A one-sheet, a promo reel or first-footage teaser, a
  sales script, and a lookbook — often before a frame is shot.
- **Working the markets.** Sixty to a hundred half-hour meetings across a
  five-day market, plus screenings, plus dinners.
- **Papering.** Deal memos at the market, long-form afterwards; chasing
  signature and the first payment.
- **Delivering and collecting.** The unglamorous majority of the job.
- **Managing the festival strategy** with the producer, because a premiere slot
  at Cannes, Berlin, Venice, Toronto, or Sundance is itself a sales event
  (`09` §11).

What separates a good sales agent from a bad one:

1. **Estimates that come true.** Everything else follows from this, because it
   is what banks lend against.
2. **A buyer list that answers the phone** — genuine relationships with the
   30–60 companies that matter, and knowledge of which are currently solvent.
3. **Knowing what a territory will actually pay for.** German buyers, Japanese
   buyers, and Latin American buyers want different things; a good agent
   shapes the *package* — this cast, this genre, this rating — to the demand.
4. **Honesty with the producer about what the film is.** The agent who inflates
   estimates to win the film and then cannot deliver has destroyed the
   financing.
5. **Delivery competence.** Getting the MG collected requires operational
   grind that many agents are bad at.
6. **Not over-selling to a buyer who then cannot pay** — buyer insolvency
   leaves a territory dead and the rights entangled.

### 9.4 Markets as events

A film market is a trade fair, not a festival, and the two frequently occupy
the same city in the same week.

| Market | When / where | Character |
|---|---|---|
| **EFM** (European Film Market) | February, Berlin, alongside the Berlinale | The year's first real market; sets the tone for spring. Strong European buyers |
| **Marché du Film** | May, Cannes, alongside the festival | The largest. Booths in the Palais, offices along the Croisette, 12,000+ attendees. Packages sell on a poster and a name |
| **AFM** (American Film Market) | November, Santa Monica historically, relocated in the mid-2020s | US-centric, deal-focused, the last chance to close before year end |
| **TIFF** | September, Toronto | Not formally a market but the biggest North American acquisitions event for finished films |
| **Sundance** | January, Park City | The US indie acquisition market; bidding wars for finished films happen here, overnight and in person |
| **Others** | Hong Kong FILMART (March), Ventana Sur (December, Latin America), Busan/APM (October), the Rotterdam and Berlin co-production markets | Regional and specialist |

The rhythm inside a market:

- **Pre-market.** Announcements are placed in the trades (§12) in the two weeks
  before — "X attaches to star in Y, which Z is selling in Cannes" — because an
  announcement *is* the sales collateral.
- **Screenings.** Buyer screenings are scheduled to the half hour; a title that
  sells out its first screening becomes the market's hot title within a day.
- **Meetings.** Half-hour slots, back to back, in a suite or a booth. Agents
  run a grid; producers hover.
- **The hot title.** One or two packages sell most major territories inside 48
  hours, at prices above estimate. Everything else grinds.
- **The pass.** "We'll look at it in the cut" is a market's polite no, and it
  is the most common answer.
- **Closing.** Deal memos signed on site; the trades report totals; the
  producer's financing either closes or does not.

Cash timing note: MGs are collected on delivery, which is often **12–24
months** after the market. Markets create financing, not cash.

### 9.5 Which territories are worth what

Directionally, for an English-language independent film, the international
(non-US) minimum guarantee pool splits roughly:

| Territory | Rough share of foreign MG |
|---|---|
| Germany/Austria | 8–13% |
| UK/Ireland | 8–12% |
| France | 7–11% |
| Japan | 5–10% |
| Italy | 4–7% |
| Spain | 4–6% |
| Latin America (as a bloc) | 5–9% |
| Australia/NZ | 3–5% |
| Korea | 3–5% |
| Scandinavia, Benelux, CEE, Middle East, rest | the remainder |

These shares are genre-sensitive to an extreme degree: horror over-indexes in
Latin America and Southeast Asia; action and sci-fi in Korea, Japan, and CEE;
literary drama in France and Italy; comedy travels almost nowhere. A film's
international estimate is therefore mostly a statement about its genre and its
cast's foreign recognition, not its quality.

**Output deals** — a local distributor commits to take a studio's whole slate
for a term at agreed terms — used to underpin the independent and mini-major
business and have thinned considerably as local buyers became more selective
and streamers absorbed the middle of the market.

### 9.6 China, in more detail

- **Quota.** Foreign films enter either under a revenue-sharing quota (a
  limited number a year, historically 34) or as **flat-fee buyouts** with no
  upside. Import is handled through state-controlled importers/distributors.
- **Share.** The foreign rights-holder's share of Chinese box office has
  historically been around **25%**, against 50%+ domestically elsewhere — so a
  $200M Chinese gross is worth roughly what a $100M gross is in most markets.
- **Approval.** Content review can require cuts, changes, or refuse a release
  entirely, with no appeal and no timetable.
- **Dating.** Release dates are often confirmed only **2–6 weeks** ahead, and
  **blackout periods** protect domestic titles around major holidays. This is
  incompatible with the way a global campaign is normally planned.
- **Co-production status** — a qualifying China co-production takes a much
  larger share (historically ~43%) and is exempt from quota, at the cost of
  content requirements, local cast, and local shooting.
- **Trend.** The share of the Chinese market taken by imported films fell
  sharply from the late 2010s as domestic production improved; planning a
  film's break-even on a large Chinese gross is now a materially riskier
  assumption than it was (`10` §6).

Other territories with distinctive structures worth knowing: **India** (a huge
admissions market with low ticket prices, dominated by domestic-language
production, and requiring dubbing into 3–5 languages to matter), **Japan**
(distributor-led, slow release patterns, long runs, high ticket prices, and a
strong preference for local dubbing and local marketing), **Korea** (fast,
front-loaded, screen-concentrated, with a screen quota), and the **Gulf**
(fast-growing, censorship-sensitive).

---

## 10. What this means for a simulation

The structural facts most often missed:

1. **A studio is a distributor first.** Its durable advantage is the pipe and
   the library, not the crew.
2. **Most participants are temporary.** Per-picture hiring means relationships,
   availability, and reputation are the persistent state, not employment.
3. **Screens are asked for, not bought.** Exhibitors are a counterparty with
   their own interests.
4. **Guild rules are hard constraints**, and they bind schedule and cost far
   more tightly than any creative decision.
5. **The rating is a market-size decision** disguised as a compliance step.
6. **Financing shape determines control.** Who put the money in determines who
   wins the argument about the cut.
7. **Nothing moves without a champion.** Projects do not advance on merit;
   they advance because a specific person with a specific job title spends
   credibility on them, and they stop the moment that person leaves (§2.2.6).
8. **The scarce resource is dates, not money.** A studio year has 30–40 usable
   weekends and they are allocated years ahead (§2.2.7).
9. **Information is an asset and it moves informally.** The tracking network
   (§5.3, §12) is faster and more accurate than any published source.
10. **Institutions have memories.** Every counterparty in this document —
    agent, exhibitor, financier, sales agent, guild — is a repeat player. A
    win extracted at the cost of a relationship is usually a bad trade.
11. **Lags are long and asymmetric.** Money is committed years before it is
    returned, and the people who made the decision are frequently gone before
    the result is known (§1.2).

---

## 11. How a film is owned and traded as an asset

A film is not primarily a cultural object in this system; it is a bundle of
copyrights with a documented history. Almost every dispute in the business is
ultimately about who owns which slice.

### 11.1 The bundle

Rights are sliced along four axes simultaneously, and any combination can be
sold separately:

- **Territory** — country by country, sometimes by language group.
- **Media** — theatrical, non-theatrical (planes, ships, military, campuses),
  pay TV, free TV, SVOD, AVOD, TVOD/EST, physical, in-flight, hotel.
- **Term** — a licence of 7, 12, 15, or 25 years, or an outright assignment in
  perpetuity.
- **Language** — dubbed and subtitled versions, sometimes licensed separately.

Plus the derivative rights that are negotiated separately and are often worth
more than the film: **sequel, prequel, remake, and television** rights;
**merchandising and consumer products**; **music publishing** and soundtrack;
**stage** rights; **interactive/game** rights; and, increasingly, **AI and
digital replica** rights over performances and likenesses.

The key legal distinction: a **licence** grants use for a term and reverts; an
**assignment** transfers the copyright. Studios assign to themselves; sales
agents license to territories. A film with a clean assignment to a single
entity is far more tradeable than one held together by twenty licences.

### 11.2 Chain of title

The **chain of title** is the documentary trail proving the producing entity
owns what it claims to own. It is assembled during development and audited
before anyone will finance, insure, or distribute. It contains:

- The option and purchase agreement for any underlying material, and its
  own chain back to the original author (`02` §3).
- Every writer's agreement, each with a **work-for-hire** clause vesting
  copyright in the company — under US law, a screenplay written by an employee
  or under a valid work-for-hire agreement is authored by the company.
- Certificates of authorship from every writer, including uncredited ones.
- Director and producer agreements.
- Music licences: **synchronisation** (the composition) and **master use**
  (the recording), separately, for every needle-drop, plus the composer's
  agreement and the AFM paperwork.
- Clearances: locations, artwork visible on screen, trademarks, real people
  depicted, archival footage, stills.
- The **title report** and title clearance.
- Copyright registration and any security interests recorded against it.
- The **E&O (errors and omissions) insurance** policy, which no distributor
  will release without.

A break in the chain — an unsigned certificate of authorship from a writer who
did a two-week polish in 2011, a song used without a master licence — can stop
a release outright, and it surfaces at the worst possible moment, during
delivery.

### 11.3 How films change hands

| Transaction | What moves | Typical context |
|---|---|---|
| **Turnaround** | A studio sells its accumulated development cost (plus interest, plus sometimes a passive backend) to another buyer | A project the studio no longer wants; the classic route by which famous films escape the studio that developed them (`02` §9) |
| **Negative pickup** | A distributor contracts to buy the finished film on delivery for a fixed price; the producer borrows against that contract to make it | Independent financing (`03` §5) |
| **Acquisition** | A finished film's rights are bought, often at a festival, for a territory or the world | Sundance, Toronto, Cannes |
| **Library sale** | Hundreds or thousands of titles sold as a portfolio | Corporate M&A; the reason studio ownership changes hands |
| **Rights reversion** | Rights return to the producer or author at the end of a licence term, or on a distributor's insolvency | The reason old films become unavailable and then reappear |
| **Copyright termination** | Under US law, authors or their heirs may terminate a grant after a statutory period | Periodically upends the ownership of famous underlying works |

**Library valuation**, directionally: a catalogue is valued on trailing
cash flow — commonly a multiple in the region of **7–12×** annual net library
receipts, adjusted for concentration (a library with one franchise is riskier
than one with two hundred steady titles), the residual liability attached
(§6.5), the condition of the physical and digital elements, and whether the
underlying rights are clean and perpetual. This is why the library, not the
slate, is usually what a corporate buyer is actually buying.

### 11.4 What goes wrong

| Failure | What it is | Consequence |
|---|---|---|
| **Unclear chain of title** | A missing signature, certificate, or assignment | No E&O, no distribution, no financing until every past participant is found |
| **Unlicensed music** | A cue used without sync or master rights | Songs replaced in post at cost, or unreleasable in some media |
| **Expired option** | Underlying rights lapse mid-development | Must be re-bought, sometimes competitively (`02` §3) |
| **Overlapping grants** | The same territory sold twice by different parties | Litigation, and a dead territory in the meantime |
| **Distributor insolvency** | The licensee fails holding the rights | Rights frozen in an estate for years; the film cannot be re-licensed |
| **Missing elements** | The negative, the M&E track, or textless materials are lost | No re-versioning or remaster; restoration costs six figures |
| **Undocumented derivative rights** | Sequel/remake rights never cleanly allocated | Nobody can make the sequel; three parties each believe they control it |

---

## 12. The trade press and how information actually moves

The industry runs on information asymmetry, and understanding *where
information comes from* explains a great deal of otherwise inexplicable
behaviour.

### 12.1 The outlets

| Outlet | Role |
|---|---|
| **Deadline** | Speed. Breaks deals, attachments, and hirings, often within hours. The industry's default first read |
| **Variety** / **The Hollywood Reporter** | The two legacy trades: breaking news plus reviews, features, and the awards-season economy |
| **The Wrap**, **IndieWire** | Reporting plus criticism; IndieWire strong on independent and festival |
| **Puck**, **The Ankler** | Subscription newsletters aimed at insiders; analysis and gossip rather than announcements |
| **Screen International**, **Deadline International** | The international and market beat — essential during EFM/Cannes/AFM |
| **Comscore**, **Box Office Mojo**, **The Numbers** | Box office data. Comscore is the industry's actual measurement service; the public sites are the visible surface |
| **Nielsen**, **Samba, Luminate, Antenna** | Third-party estimates of streaming viewership, in the absence of disclosure |

### 12.2 How a story actually gets out

Almost nothing in the trades is discovered by investigation. The typical
mechanisms, roughly in order of frequency:

1. **The planted announcement.** A studio, agency, or PR firm gives an outlet
   an exclusive. Both sides benefit: the outlet gets the story first, the
   source controls the framing.
2. **The agency leak to set a market.** A spec is going out Monday; a Friday
   story that four studios are circling makes the auction real.
3. **The pre-emptive confirmation.** A deal is leaking anyway, so the party
   with the most to lose confirms first, on its own terms.
4. **The competitive spoiler.** Announcing your dinosaur film to deter someone
   else's dinosaur film, or staking a release date publicly so rivals move.
5. **The disgruntled source.** A fired executive, a passed-over producer, an
   agent who lost a client. This is where the genuinely damaging stories come
   from.
6. **The assistant network.** Deals, dates, and gossip circulate horizontally
   through assistants before they reach any principal.

Read trade language accordingly. **"In talks"** means no deal. **"Attached to
star"** means a deal memo at best and often only an agent's confirmation of
interest. **"In negotiations to direct"** frequently means the studio is trying
to force a decision by making the offer public. **"Creative differences"**
means a firing. **"Postponed for scheduling reasons"** usually means a
financing or script problem.

### 12.3 The weekend box office ritual

A weekly, load-bearing information event (`10` §7):

| When | What |
|---|---|
| Thursday evening | Previews begin; distributors and Comscore track hourly |
| Friday morning | Thursday preview figures reported; the first public signal |
| Friday night | Friday actuals inform a revised weekend projection |
| Saturday | The shape of the weekend becomes clear from Friday-to-Saturday movement |
| Sunday morning | **Studio estimates** issued — a projection of the three-day, produced by the distributor itself and mildly self-serving |
| Monday | **Actuals** published. The gap between Sunday estimate and Monday actual is itself scrutinised |
| Monday/Tuesday | Exhibitors reallocate screens for Friday (§8.2) |

### 12.4 The informal system, which matters more

- **Tracking boards and grids.** Agencies, studios, and pods maintain shared
  internal lists of every project in the market: title, writer, agency,
  buyers, status. Junior staff maintain them and trade updates with peers at
  rival companies. This is the real-time map of the business and it is not
  published anywhere.
- **Tracking (audience research)** is separate and is leaked constantly — a
  distributor's confidential four-week-out awareness numbers reliably reach
  competitors and the trades (`09` §8).
- **Test screening results** leak, and a leaked bad test is itself a news
  event that can damage a film months before release.
- **The town is small.** Roughly a few thousand people make the decisions
  described in this document, most of them within a few square miles, many of
  them trained in the same mailrooms. Reputation propagates in days.

Why this matters structurally: **announcements are moves, not reports**. A
studio dating a film three years out, a producer announcing an attachment, an
agency confirming a signing — each is an action taken to change someone else's
behaviour, and reading them as neutral information is the single most common
mistake outsiders make about this industry.

---

## 13. The physical infrastructure, and who owns it

Films are made in buildings owned by somebody, with equipment rented from
somebody. This layer is invisible in most descriptions of the industry and is a
hard constraint on how many films can be made at once.

### 13.1 Studio lots and stages

A "studio" in the real-estate sense is a walled site with **sound stages**,
production offices, workshops, a backlot, and post facilities. The major
historic lots — Warner Bros. Burbank, Sony (the old MGM lot) in Culver City,
Paramount on Melrose, Universal, the Fox lot in Century City — are owned by the
studios whose names they carry or, increasingly, by real-estate companies who
lease them back. A great deal of stage space worldwide is now owned by
property investors and specialist operators rather than by film companies.

Outside Los Angeles: **Pinewood, Shepperton, Leavesden, Elstree, Longcross,
Cardington** and the newer Hertfordshire and Yorkshire builds in the UK;
**Trilith** and the Georgia complexes; **Cinespace** in Toronto and Chicago;
**Origo** and the Budapest stages; **Babelsberg** near Berlin; growing capacity
in Spain, the Czech Republic, Australia, and the Gulf.

Stage economics, directionally:

- A large stage is **15,000–40,000 sq ft** with a clear height of 35–50 ft.
- Stage rent runs roughly **$0.60–1.50 per sq ft per week** in major hubs, so a
  20,000 sq ft stage is broadly **$12,000–30,000 a week**, before power,
  utilities, cleaning, and security.
- A tentpole occupies **4–10 stages** for **6–12 months** including build and
  strike, which is why capacity is measured in stage-weeks.
- Lots also charge for **office space, workshops, parking, mill and paint
  shops, backlot, and post services**, and a studio shooting on its own lot
  charges these to the picture — a real cost to the film and revenue to the
  facility.

**Capacity is a genuine constraint.** The 2021–22 production surge produced a
worldwide stage shortage in which productions took whatever space existed at
whatever price, and the 2023 strikes produced the opposite. Stage availability
in a hub, along with crew depth and tax incentives (`03` §6), is one of the
three factors that actually decides where a film shoots.

### 13.2 Rental houses

Almost no production owns equipment. It rents.

| Category | Typical suppliers | How it is priced |
|---|---|---|
| **Camera** | Panavision, ARRI Rental, Keslow, regional houses | Weekly package rate, heavily discounted from list. A "camera package" for a studio feature runs **$25–75K/week** at list and far less net |
| **Lighting and grip** | Cinelease, MBS Equipment, Quixote, regional | Weekly, plus consumables and generators |
| **Trucks and transportation** | Studio transport departments, Teamster-supplied | Weekly per unit plus drivers |
| **Post equipment and edit suites** | Post houses, or rented and installed on site | Weekly per suite |

The pricing convention that surprises outsiders is the **deal week**: rentals
are quoted weekly but negotiated as a "long-term" rate — a 20-week shoot is
priced at something like 8–12 weeks' worth. The rental house's business is
utilisation, and the negotiation is really about how much of the year the film
occupies the kit.

### 13.3 Post houses and services

Picture and sound post are supplied by facility companies, most of which have
been consolidated into a small number of groups:

- **Picture finishing and DI**: Company 3, Picture Shop, Harbor, Goldcrest,
  Technicolor's successors, plus regional facilities.
- **Sound post**: Skywalker Sound, Formosa, Warner Post, Goldcrest, plus
  independent mix stages. A dub stage rents by the day (`07` §3).
- **VFX**: a globally distributed vendor industry, discussed in `08`.
- **Localisation and versioning**: dubbing studios and subtitle houses in every
  major territory (§9.1).
- **Mastering, QC, and delivery**: the unglamorous companies that produce the
  hundreds of deliverable files each distributor and platform demands
  (`07` §7).

Two structural facts: **film laboratories have almost entirely disappeared**,
so the photochemical path is now a specialist service rather than the default;
and much of the facility sector is owned by private-equity roll-ups, which
means capacity, pricing, and even a project's vendor choice can change because
of a transaction that has nothing to do with any film.

### 13.4 Why the infrastructure layer matters

1. **It caps throughput.** The number of films that can shoot simultaneously in
   a hub is set by stages, crew depth, and kit — not by demand.
2. **It concentrates production geographically**, which is why incentives work:
   a territory that builds stages and trains crew can capture production, and
   one that offers only a rebate cannot.
3. **It is a fixed cost that behaves like a commodity market.** Stage rates,
   crew rates, and kit rates all rise in a boom and collapse in a strike,
   which means the same film costs materially different amounts depending on
   when it shoots.
4. **It is owned by people with no stake in any film's success.** Facility
   owners are paid whether the picture works or not, which makes them the most
   stable and least visible part of the value chain.

---

## 14. A project through the whole structure

One ordered pass, to show how the institutions in this document hand off to
each other. Timings are for a studio film that does not stall; most do.

| Stage | Institutions involved | Typical elapsed |
|---|---|---|
| Material originates — spec, book, article, IP | Writer, agent (§5), pod (§3) | — |
| Submission and coverage | Agency → studio creative exec (§2.2.2) | Days |
| Purchase or option, writer hired | Business affairs, agent, lawyer | 4–16 weeks |
| Development: 2–5 drafts | Pod, creative exec, writer | 9–30 months |
| Attachment of a director, then cast | Agency, pod, casting (`04` §8) | 3–12 months |
| Budget and schedule built | Physical production, line producer (`04` §3–4) | 4–8 weeks |
| Greenlight: model, marketing read, date | Chairman, finance, marketing, distribution (§2.2.7) | Weeks |
| Financing closed; co-financier attaches; incentives applied | Finance, co-financiers (§4), tax counsel | 4–16 weeks |
| Guild agreements signed; SPV formed | Legal, guilds (§6.1) | Weeks |
| Prep, shoot, post | Crew, facilities, vendors (§13), guilds | 12–30 months |
| Marketing campaign built | Studio marketing, trailer and art houses (`09` §2) | 6–12 months, overlapping post |
| Bookings negotiated | Distribution ↔ exhibitor film buyers (§8.2) | 6–12 weeks before release |
| International dating, localisation, censorship | International division, territory MDs (§9.1) | 3–9 months before release |
| Release, weekly re-booking, settlement | Exhibitors, distribution, trades (§12.3) | 6–16 weeks |
| Windows: PVOD, EST, SVOD, TV | Home entertainment, licensing (`11` §3) | Months 1–36 |
| Participations, residuals, audits | Accounting, guilds, participants (`11`) | Quarterly, for decades |
| Library | Studio or rights-holder (§11.3) | Perpetual |
