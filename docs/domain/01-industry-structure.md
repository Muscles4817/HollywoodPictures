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

Relevance: any simulation that lets a studio own screens, or guarantee its own
films screen counts, is modelling a pre-1948 or post-2020 industry, not the
one in between.

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

### 2.1 What a studio actually is

A modern major is not primarily a factory. It is:

- a **balance sheet** that can absorb a $200M bet;
- a **distribution and marketing network** with worldwide relationships;
- a **library** (the reliably profitable part of the business);
- a **brand portfolio** of franchises and labels;
- a small **creative executive layer** that buys and supervises.

It very often does not employ the people who make the film. Cast, crew, and
frequently the production company are hired per-picture.

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

### 8.1 Ratings

In the US, **CARA** (the MPA's Classification and Rating Administration)
issues G / PG / PG-13 / R / NC-17. It is voluntary, but most chains will not
book an unrated or NC-17 film, so it is effectively mandatory. A rating is a
**commercial constraint**: an R rating removes the under-17 unaccompanied
audience, which matters enormously for family and franchise titles, and studios
routinely re-cut to secure PG-13. The UK equivalent is the **BBFC** (U, PG,
12A, 15, 18), which is statutory for physical media.

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
