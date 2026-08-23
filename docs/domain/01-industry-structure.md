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

| Failure | Consequence |
|---|---|
| **Over-asking then under-delivering** | The distributor pushed for 4,000 locations on a film that plays to 2,200; per-screen collapses, and the buyer discounts the next ask |
| **Dumping** | Releasing a film the distributor has given up on with no spend | Exhibitors lose money on committed screens and remember |
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
