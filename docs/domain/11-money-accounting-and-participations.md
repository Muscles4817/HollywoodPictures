# 11 — Money, Accounting & Participations

*Who gets paid, in what order, out of what.* The waterfall is the least
intuitive part of the industry and the one most often modelled wrongly.

> **Domain reference.** Real industry, not this game. See `README.md`.

---

## 1. From ticket to studio

```
Ticket price ($12)
   └─ Exhibitor keeps ~45–55% domestic, ~55–60% international
       └─ DISTRIBUTOR'S GROSS RECEIPTS ("rentals")
            └─ minus distribution fee (30–35% of rentals, studio to itself)
                 └─ minus distribution expenses (P&A, prints, shipping, dubbing,
                      residuals, taxes, checking costs, trade dues)
                      └─ minus negative cost
                           └─ minus interest and overhead
                                └─ NET PROFIT (if any)
```

Each arrow is a real contractual deduction. The public "gross" at the top is
roughly **double** what the studio actually receives, before a single cost is
recouped.

Two things about this diagram are worth stating explicitly, because almost
every popular account of film money gets them wrong:

1. **The waterfall is a contract, not an accounting standard.** Every rung is
   defined in a schedule attached to a talent deal, and two participants on the
   same film can be standing on differently-defined rungs. There is no single
   "the film's net profit" — there is *this participant's* net profit under
   *this* definition.
2. **The studio's own P&L and the participant's statement are different
   documents.** The studio's internal picture P&L does not charge itself a
   distribution fee, because the fee is revenue moving from one pocket to
   another. The participation statement does. A film can be genuinely
   profitable to the company and permanently unrecouped on every statement it
   issues — not through fraud, but because the two documents are answering
   different questions.

### 1.1 Who actually handles the money

| Role | Where they sit | What they own |
|---|---|---|
| **Production accountant** (+ 1st/2nd assistants, payroll clerk) | On the production, reports to the UPM/line producer and, dotted-line, to studio production finance | The picture's cash while it is being made: purchase orders, payroll, weekly cost report, cash requirement |
| **VP/SVP Production Finance** | Studio | Reviews every cost report, approves cash-flow drawdowns, signs off overages, feeds the negative cost number to corporate |
| **Distribution Finance** | Studio distribution | Booking terms, settlements with exhibitors, collections, checking costs |
| **Contract Administration / Participations & Residuals** | Studio finance | Reads every talent contract, builds each participant's definition into the system, issues statements, computes residuals |
| **Business Affairs** | Studio | Negotiated the definition in the first place; owns the dispute when it arrives |
| **Strategic Planning / FP&A** | Studio corporate | The greenlight model and the **ultimates** (§5.1) |
| **Treasury** | Corporate | Where the cash actually is: funding the production account, funding P&A, hedging currency |
| **Corporate Controller / film accounting** | Corporate | Capitalising film cost, amortising it, taking write-downs (§5.3) |
| **Tax & incentives group** | Corporate or outside advisers | Qualifying spend, filing for credits, monetising them (§8.3) |
| **Contingent-compensation auditor** | Outside, hired by the participant | The audit (§2.4) |
| **Collection agent** | Outside, independent film only | Receives all revenue and pays the waterfall (§8.4) |

**When** — this chain runs continuously. Production finance is hottest from
prep through wrap; distribution finance from the booking conversations
(3–6 months out) to roughly 120 days after release; participations and
residuals never stop, and are still issuing statements on films from forty
years ago.

### 1.2 The exhibitor split, in detail

The distributor does not get "half the box office" by rule. It gets whatever it
negotiated, and the shape of the deal matters.

- **Sliding scale (the classic form)** — a declining weekly percentage:
  roughly 70% to the distributor in week one, 60%, 50%, 40%, then a floor.
  A big film's *opening weekend* is therefore the highest-margin box office
  it will ever earn, which is one more reason studios front-load.
- **90/10 over the house nut (largely historical in the US)** — the exhibitor
  first keeps an agreed weekly operating allowance (the "house nut"), and 90%
  of everything above it goes to the distributor. Ferocious for a hit, and
  the reason cinemas care so much about concessions, which they keep entirely.
- **Aggregate / firm terms (the modern US norm)** — a single blended
  percentage for the whole run, negotiated per title with the circuit's **film
  buyer**. Simpler, and it removes the weekly settlement argument.
- **Holdover and screen commitments** are traded against rate: a distributor
  wanting four weeks guaranteed on 3,500 screens pays for it in points.
- **Premium formats** carry a surcharge that is split differently, and IMAX
  takes its own cut of the premium.

Blended outcomes, which is what the models actually use:

| Market | Distributor's share of gross | Notes |
|---|---|---|
| US/Canada | 50–55% | Higher for a front-loaded event film, lower for a leggy one |
| UK, Australia, Western Europe | 40–47% | VAT/local taxes come off the top first |
| Japan | ~50% | Local distributor structures vary |
| China (revenue-share import) | ~25% | The single biggest reason Chinese gross flatters a film |
| Most of Latin America, SE Asia | 40–45% | Local taxes and remittance friction |

**Gross vs rentals.** "Gross" is what the audience paid, before local ticket
taxes in most reporting. "Rentals" is what reaches the distributor. Public
box-office reporting is always gross (`10-theatrical-release-and-box-office.md`
§10); every internal document is rentals.

### 1.3 Worked example A — a $40M thriller

Negative cost $40M. P&A $45M. Worldwide gross $150M ($90M domestic, $60M
international). All figures directional and rounded.

```
THEATRICAL
  Domestic gross                          $90.0M
    × 52% distributor share            =  $46.8M
  International gross                     $60.0M
    × 42% distributor share            =  $25.2M
  ---------------------------------------------
  Theatrical rentals                      $72.0M

  Distribution expenses
    P&A                                  −$45.0M
    Residuals accrued to date             −$4.0M
    Shipping, DCP, dubbing/subtitling,
      checking, trade dues, taxes         −$1.5M
  ---------------------------------------------
  After distribution expenses             $21.5M
  Negative cost                          −$40.0M
  ---------------------------------------------
  THEATRICAL RESULT                      −$18.5M
```

The film is $18.5M underwater the day it leaves cinemas. This is normal, and
it is why "did it make its money back theatrically" is the wrong question.

```
POST-THEATRICAL (lifetime, ~10 years)
  PVOD / TVOD / EST / physical, net       $18.0M
  Pay-1 SVOD licence                      $12.0M
  Pay-2, free TV, international TV, FAST    $9.0M
  Airline, hotel, education, misc           $2.0M
  ---------------------------------------------
  Post-theatrical revenue                 $41.0M
  Later-window residuals                  −$3.0M

STUDIO VIEW
  Lifetime gross receipts     $72.0 + $41.0 = $113.0M
  Distribution expenses        $50.5 + $3.0 =  $53.5M
  Negative cost                             =  $40.0M
  ---------------------------------------------------
  Picture contribution                      = +$19.5M
  Studio overhead charge (12.5% of negative)  −$5.0M
  Capitalised interest                        −$3.0M
  ---------------------------------------------------
  CORPORATE CONTRIBUTION                    = +$11.5M
```

Now the same film seen from a **net profit** participant's statement:

```
PARTICIPANT VIEW — "net profits" definition
  Gross receipts                             $113.0M
  Distribution fee @ 30%                     −$33.9M
  Distribution expenses                      −$53.5M
  Negative cost                              −$40.0M
  Overhead @ 12.5% of negative                −$5.0M
  Interest                                    −$3.0M
  ---------------------------------------------------
  NET POSITION                                −$22.4M   → net profit = $0
```

The studio made $11.5M. The 5% net-profit participant is paid nothing, and
will still be nothing in ten years, because the shortfall is larger than the
remaining tail. The entire difference is the $33.9M distribution fee — money
the studio paid to itself.

Compare three other participants on the same film:

| Participant | Definition | Actually paid |
|---|---|---|
| Writer, 5% of net | As above | **$0** |
| Director, 5% of gross after cash break-even | CBE = negative + distribution expenses + a reduced 10% fee = $104.8M; receipts $113.0M, so $8.2M is above | **$410k** |
| Lead, $2.5M bonus at $150M WW | Threshold met on the nose | **$2.5M** |
| Lead, 5% first-dollar gross | 5% of $72.0M theatrical rentals alone | **$3.6M**, and it is charged as a distribution expense, pushing everyone below further from break-even |

That last row is the mechanic that killed first-dollar gross: a gross player
is paid out of money that has not yet covered anything, so every other
participant's break-even moves away from them by the same amount.

### 1.4 Worked example B — a $200M tentpole

Negative cost $200M (after $25M of incentives, so the gross spend was higher).
P&A $150M worldwide. Worldwide gross $800M: $280M domestic, $520M
international, of which $80M is China.

```
THEATRICAL
  Domestic     $280M × 53%                 = $148.4M
  China         $80M × 25%                 =  $20.0M
  Other int'l  $440M × 43%                 = $189.2M
  ----------------------------------------------------
  Theatrical rentals                         $357.6M

  P&A                                       −$150.0M
  Residuals accrued                          −$18.0M
  Versioning, checking, shipping, taxes,
    trade dues, market costs                 −$12.0M
  ----------------------------------------------------
  After distribution expenses                $177.6M
  Negative cost                             −$200.0M
  ----------------------------------------------------
  THEATRICAL RESULT                          −$22.4M

POST-THEATRICAL (lifetime)
  PVOD/TVOD/EST/physical, net                  $55.0M
  Pay-1 SVOD                                   $60.0M
  Pay-2, free TV, int'l TV, FAST               $25.0M
  Airline and other                             $5.0M
  Consumer products royalty, net               $30.0M
  ----------------------------------------------------
                                              $175.0M

STUDIO VIEW
  Lifetime gross receipts                     $532.6M
  Distribution expenses (incl. later residuals) $182.0M
  Negative cost                              −$200.0M
  Overhead @ 12.5%                            −$25.0M
  Interest                                    −$12.0M
  ----------------------------------------------------
  CORPORATE CONTRIBUTION                     ≈ +$113M

PARTICIPANT VIEW — "net profits"
  Gross receipts                              $532.6M
  Distribution fee @ 30%                     −$159.8M
  Distribution expenses                      −$182.0M
  Negative cost                              −$200.0M
  Overhead                                    −$25.0M
  Interest                                    −$12.0M
  ----------------------------------------------------
  NET POSITION                                −$46.2M   → net profit = $0
```

An $800M worldwide grosser, a solid win for the company, and still nominally
unprofitable on a net-profit statement. Nothing improper has happened. This is
what the definition says.

The lesson that survives both examples: **the percentage is noise, the
definition is the deal.** 2% of adjusted gross is worth more than 15% of net
on almost any film ever made.

### 1.5 When the money actually moves

The waterfall is an ordering of *deductions*, not of *dates*. Real timing:

| Event | Timing |
|---|---|
| Exhibitor settles and remits | 30–90 days after the playdate; longer in some international territories |
| International sub-distributor remits | Quarterly, often 60–90 days after quarter end |
| Home entertainment retailers remit | Monthly to quarterly, net of returns reserves |
| SVOD licence fee | On delivery or on window start; sometimes in instalments across the window |
| Participation statement issued | Quarterly for the first 2–3 years, then semi-annually, then annually |
| Participation cheque | 30–60 days after the statement, if there is a positive balance |
| Residuals | Quarterly per market, on statutory-ish guild deadlines (§4.3) |

The practical consequence: a film's money arrives over a decade, in dozens of
currencies, from hundreds of counterparties, and every one of them has its own
settlement lag. Chasing it is a whole department.

---

## 2. The definitions ladder

Participations are defined against one of several bases, and the base matters
far more than the percentage.

| Definition | What it is | Who gets it |
|---|---|---|
| **First-dollar gross** | A percentage of the distributor's gross receipts from dollar one, before any deductions | Historically the very top tier of stars and directors; now near-extinct |
| **Adjusted gross / gross after break-even** | Gross receipts after defined deductions (often P&A and a multiple of negative cost) | Strong talent deals |
| **Cash break-even** | Participation begins once the studio has recouped its actual cash outlay, with a negotiated definition of what counts | The common modern structure |
| **Net profit** | After distribution fee, all expenses, negative cost, interest, and overhead | Nominally generous, in practice rarely paid |
| **Box office bonuses** | Fixed cash payments at defined worldwide/domestic gross thresholds | The modern replacement for gross points |
| **Buyout** | A larger up-front fee in lieu of all backend | Streaming standard |

### 2.1 Why "net profit" is a byword

Net profit participations are usually worth nothing because the deductions are
self-dealing and compounding:

- **Distribution fee** — the studio charges *itself* 30–35% of rentals for
  distributing the film, before costs.
- **Overhead** — 10–15% of the negative cost charged as a studio overhead fee.
- **Interest** — charged on the negative cost, and (crucially) accrued
  *before* revenue is applied to principal, so the debt can grow.
- **Cross-collateralisation** rules and allocation of shared costs.

Compounded, a film with a large reported gross can carry a permanent nominal
loss. This is a genuine, documented, and repeatedly litigated feature of studio
accounting, not folklore.

**Contingent compensation audits** are a routine industry activity, and
disputes over the definition — not the percentage — are the norm.

### 2.2 What is actually negotiated

**Who** — the studio's **Business Affairs** executive on one side; the talent's
**lawyer** (not the agent — agents negotiate the fee, lawyers negotiate the
definition) on the other, with the agent in the room on the headline terms.
The studio's opening position is its **standard net profit definition**, a
document of 20–40 pages that has existed in substantially the same form for
decades. Nobody expects it to be accepted whole; the negotiation is a list of
amendments to it.

**When** — after the deal memo settles fee, credit, and pay-or-play, and often
*after* the actor has started work. Long-form contracts are notoriously signed
in post-production, which weakens the studio's leverage slightly and the
talent's enormously (the film is already made).

The fights, roughly in order of how much money they move:

| Point | Studio position | Talent position | Why it matters |
|---|---|---|---|
| **Distribution fee rate** | 30–35% domestic, 35–40% foreign, 20–25% home video | Reduce to a flat 10–15%, or eliminate on defined receipts | Usually the single largest deduction |
| **Fee on sub-distributed revenue** | Full fee on the amount received | No double fee where a sub-distributor already took one | "Double-dipping"; matters most internationally |
| **Home video base** | Only 20% of home-video revenue counts as gross receipts (the "royalty") | 100% inclusion, or a negotiated 35–50% | Historically the most valuable single concession available |
| **Affiliate / self-dealing licences** | Studio may licence to its own streamer or network at a rate it sets | Must be arm's-length, or benchmarked, or subject to an imputed-value formula | The central modern dispute (§2.4) |
| **Overhead** | 10–15% of negative | Delete, or cap, or exclude overhead-on-overages | Pure margin to the studio |
| **Interest** | Charged on negative + overhead, accruing before principal | Simple interest, no interest-on-overhead, revenue applied to principal first | Compounding makes this large on a slow-earning film |
| **P&A** | At cost, plus an advertising administration fee | At cost only; cap the total; exclude corporate cross-promotion charged in | Cross-promotion charges are contentious |
| **Cross-collateralisation** | Across territories, media, and sequels | None, or territory-only | Lets a studio net a flop's shortfall against a hit |
| **Break-even definition** | Includes fee, overhead, interest | "Cash break-even": actual cash out only | Defines whether a participation ever begins |
| **Deferments and their priority** | Below recoupment | Above it | A deferment paid first is real money |
| **Bonus thresholds** | Worldwide gross, studio-reported, excluding China | Include China; include awards and franchise triggers | Bonuses are the modern backend |
| **Audit rights** | 24 months to object; one audit a year; no contingency-fee auditors; studio premises | 36 months; multiple pictures in one audit; the auditor of choice | Determines whether the deal is enforceable in practice |

Two structural notes:

- **Escalators and pooling.** Where several participants have gross-side deals,
  the studio negotiates a **pool** — a fixed maximum percentage of gross paid
  out to all of them, divided among them — so its exposure is bounded even if
  the cast list grows.
- **The streaming buyout.** For a film made for a service with no theatrical
  window, there is no gross to point at, so the entire backend is converted to
  cash at signature — commonly a premium of 20–50% over the theatrical quote
  in exchange for all contingent compensation. Post-2023 the guild agreements
  layered a viewership bonus back on top (§4.2), but individual deals remain
  buyout-shaped.

### 2.3 What a participation statement actually looks like

A statement is typically 4–15 pages, machine-generated, and arrives quarterly.
Its shape is stable across studios:

```
PICTURE: [title]            PARTICIPANT: [name]        PERIOD: Q3, ending 30 Sep
DEFINITION: Exhibit "A" — Net Proceeds, as amended by Sections 4, 7, 9

                                     THIS PERIOD      CUMULATIVE
GROSS RECEIPTS
  Theatrical — domestic                  12,441        41,204,882
  Theatrical — foreign                   84,310        28,660,115
  Home video royalty (20% of $x)          9,802         6,441,004
  Pay television                              0        12,000,000
  Free television / other                31,455         3,880,221
  Non-theatrical / airline                 2,110           515,660
                                     ----------      ------------
  TOTAL GROSS RECEIPTS                  140,118        92,701,882

DISTRIBUTION FEES
  Domestic @ 30% / foreign @ 40% ...     48,201        31,116,447

DISTRIBUTION EXPENSES
  Advertising and publicity                 501        44,890,220
  Prints, DCP, versioning                     0         3,115,004
  Residuals                              14,880         7,660,441
  Taxes, checking, trade dues, MPA        1,204         2,004,118
  Gross participations                        0         3,600,000
                                     ----------      ------------
                                       16,585        61,269,783

PRODUCTION COST
  Negative cost                                        40,112,004
  Overhead @ 12.5%                                      5,014,000
  Interest                                 91,004       9,220,551
                                     ----------      ------------
                                                       54,346,555

BALANCE (UNRECOUPED)                                 (54,030,903)
PARTICIPANT'S SHARE @ 5.00%                                     0
```

How practitioners read one, in order:

1. **The definition line at the top**, not the numbers. Which exhibit, as
   amended by which sections. If the wrong exhibit is being applied, nothing
   below it matters.
2. **The unrecouped balance's trend**, not its level. Is it shrinking, flat, or
   *growing*? A growing balance late in life means interest exceeds revenue and
   the participation is dead.
3. **Interest against gross receipts for the period.** If interest for the
   quarter is larger than gross receipts for the quarter, the film can never
   recoup arithmetically.
4. **Whether new revenue lines have appeared** — a licence to an affiliated
   streamer showing up as a single round number is the flag that starts most
   audits.
5. **Gross participations as an expense line.** This is how you discover that
   someone senior to you is being paid ahead of you.
6. **Whether costs from another picture have appeared** via
   cross-collateralisation the contract may not permit.

A statement showing a positive balance triggers payment 30–60 days later, less
withholding. Most participants on most films never see one.

### 2.4 How an audit is actually conducted

**Who** — a specialist **contingent-compensation audit** boutique, hired by the
participant (or their lawyer), staffed by accountants who do nothing else and
who have usually worked inside a studio's participations department. The
studio's side is handled by Participations & Residuals, with Business Affairs
and outside counsel appearing when the findings get large.

**When** — triggered by (a) a statement that looks wrong, (b) a film that
obviously performed and shows nothing, (c) a licence to an affiliated buyer, or
(d) simply the incontestability clock running down. Contracts typically make a
statement **binding after 24–36 months** unless objected to, so audits cluster
just before that deadline.

The sequence:

| Stage | What happens | Elapsed |
|---|---|---|
| **Notice** | Formal written audit notice citing the contract's audit clause | Day 0 |
| **Scheduling** | The studio offers dates; audit rooms are a bottleneck and multi-month waits are normal | 1–6 months |
| **Fieldwork** | 2–8 weeks on studio premises. The auditor gets the general ledger extracts for the picture, distribution contracts, licence agreements, allocation schedules, and expense support — usually on a **sampling** basis, because nobody vouchers 40,000 transactions | 2–8 weeks |
| **Follow-up requests** | The long tail. Documents withheld as "confidential third-party agreements" are the friction point | 1–9 months |
| **Draft report** | Findings, each with a contract citation and a dollar quantification | +1–2 months |
| **Studio response** | Concede, dispute, or reclassify each finding | +2–6 months |
| **Negotiation / settlement** | The overwhelming majority end here, at a fraction of the claim | 6–24 months from notice |
| **Arbitration or litigation** | Rare, expensive, and usually about a definitional principle rather than a number | Years |

**What audits typically find**, in rough order of frequency:

| Finding | Typical mechanism |
|---|---|
| **Unreported or late-reported revenue** | Territories, ancillary markets, and small windows that simply were not swept into the picture's ledger |
| **Non-arm's-length affiliate licences** | The film licensed to a sister streamer or network at an allocated rate the participant cannot test |
| **Improper allocation in package deals** | A library or output package sold for one price, allocated across titles by a formula that disadvantages this picture |
| **Distribution fees charged twice** | Full fee taken on receipts a sub-distributor has already fee'd |
| **Expenses outside the definition** | Corporate marketing, market-research overhead, executive travel, cross-promotion with other titles |
| **Interest computed wrongly** | Applied to overhead, compounded when the contract said simple, or not credited with revenue promptly |
| **Home-video base misapplied** | The 20% royalty applied where the deal said otherwise |
| **Foreign exchange** | Converted at a corporate rate rather than the date-of-receipt rate; blocked-currency handling |
| **Unauthorised cross-collateralisation** | Another picture's shortfall netted in |
| **Residuals over-accrued** | Reserved at a higher rate than actually paid, and never trued up |

Directionally, an audit of a large picture commonly produces claims in the
**low single-digit millions**, settles for a **fraction** of that, and costs
the participant **$50k–$500k** to run. The economics only work above a certain
size, which is precisely why small participants rarely audit and why the
definition, not the enforcement, is where the value is.

The genuinely modern issue is **vertical integration**. When the distributor,
the streamer, the network, and the international arm are all the same
corporate parent, most of a film's post-theatrical revenue is set by internal
transfer pricing. Gross-defined deals are exposed to this too, not just net
ones, and the standard remedy negotiated today is an **imputed value** clause:
if the picture is licensed to an affiliate, the participant's gross is
calculated using a benchmark — comparable arm's-length licences, or a formula
tied to domestic box office — rather than the price the parent actually paid
itself.

### 2.5 The skill axis — negotiating and defending a backend

1. **Knowing which three points to spend leverage on.** No lawyer wins the
   whole exhibit. The good ones take the fee rate, the home-video base, and the
   affiliate-licence clause, and trade away twelve cosmetic points to get them.
2. **Preferring certainty to theory.** A $2M bonus at $150M worldwide is
   collectible by anyone with a calculator; 7.5% of net requires a decade and
   an auditor. Experienced representation converts theoretical points into
   defined-trigger cash wherever the client's leverage allows.
3. **Drafting the audit clause as if you will use it.** A 36-month
   incontestability window, the right to audit multiple pictures together, and
   no prohibition on the auditor you want are worth more than another point.
4. **Modelling the deal before signing it.** A good lawyer runs the client's
   definition against two or three plausible box-office outcomes and can say
   "at $300M worldwide this pays you nothing" *before* the client accepts it.
5. **On the studio side: consistency.** A business affairs executive who grants
   an idiosyncratic definition creates a precedent every agent in town will
   cite within a month. The standard exhibit's real function is to be standard.
6. **Reading the statement when it arrives.** Most participations are lost by
   inattention — statements unread until the contest window has closed.

### 2.6 How participation deals go wrong

| Failure | Consequence |
|---|---|
| Percentage negotiated, definition accepted as boilerplate | The headline "10% of the back end" pays $0 |
| Bonus keyed to *domestic* gross on a film that plays internationally | The film grosses $600M worldwide and misses the trigger |
| No imputed-value clause; film goes to the affiliated streamer | Gross receipts set by the counterparty's own parent |
| Contest window missed | Statements become binding and unauditable |
| Deferment placed below recoupment | A "guaranteed" payment that never arrives |
| Cross-collateralisation with a sequel or a slate | A hit's overage disappears into another film's hole |
| Pooling ignored | Late-cast additions dilute an existing gross point |
| Backend taken instead of fee by a talent without leverage | Below-quote cash for a worthless contingency |

---

## 3. Revenue sources over a film's life

| Window | Timing | Character |
|---|---|---|
| **Theatrical** | Weeks 1–12 | Public, volatile, sets everything downstream |
| **PVOD / TVOD** | 17–45 days after theatrical | High margin, front-loaded to the release |
| **EST (purchase)** | Alongside TVOD | Declining but high margin |
| **Physical media** | ~3–4 months | Small, catalogue and collector driven |
| **Premium SVOD window** | ~3–9 months | A fixed licence fee; often the largest single post-theatrical payment |
| **Pay TV / basic SVOD / AVOD** | 1–5 years | Recurring licence fees |
| **Free TV** | Later | Small per-run fees |
| **International TV & ancillary** | Ongoing | Territory-by-territory |
| **Airline, hotel, military, education** | Ongoing | Small but real |
| **Merchandising, licensing, games, theme parks, music** | Ongoing | Negligible for most films; dominant for a handful of franchises |
| **Library / catalogue** | Perpetual | The reliably profitable part of a studio |

A useful shape: theatrical is the **marketing event that establishes the
asset's value**, and the asset then earns for decades. Studios buy libraries
for this reason, and library value is why loss-making prestige films still get
made.

### 3.1 How each window is actually priced and sold

**Who** — a studio's **Worldwide Content Distribution / Licensing** group,
under an EVP or President of Distribution, with separate teams for home
entertainment, domestic television, international television, and (since the
2010s) digital platform sales. On the other side of the table sit a streamer's
**Head of Film Acquisitions** or **Content Planning** group, a pay-TV network's
programming executive, or an international broadcaster's acquisitions head. On
independent films the seller is a **sales agent** working territory by
territory (`03-financing-and-dealmaking.md` §4).

**When** — the theatrical deal is done 3–6 months before release; home
entertainment and PVOD terms are platform-standard and set annually; the pay-1
SVOD placement is usually already fixed years earlier by an **output deal**;
free TV and international TV are sold in the 12–36 months after release; the
title falls into library sales thereafter.

| Window | How it is priced | Rule of thumb |
|---|---|---|
| **PVOD** (premium early rental, ~$19.99) | Revenue share with the platform | Distributor keeps ~**80%** in the premium window |
| **TVOD** (standard rental, $3.99–$5.99) | Revenue share | Distributor keeps ~**70%** |
| **EST** (digital purchase) | Revenue share, with promotional pricing | Distributor keeps ~**70%** |
| **Physical** | Wholesale price to retail, minus returns reserve, minus manufacturing | Distributor nets ~**45–60%** of retail; volumes now small outside family and collector titles |
| **Pay-1 SVOD / premium window** | A licence fee, usually by formula against domestic box office, with a floor and a cap | Commonly **10–20% of domestic box office**, floored at a few $M and capped around **$25–40M** |
| **Pay-2 / basic SVOD** | Package or per-title fee for a later window | Low single-digit % of domestic box office |
| **AVOD / FAST** | Revenue share on ad impressions, or a flat licence for a channel slot | Small per title; meaningful only at library scale |
| **Free TV** | Per-run licence fee, by title tier | Small; a handful of runs over years |
| **International TV** | Territory by territory, often as a package | Priced off local theatrical performance and star recognition |
| **Airline / hotel / military / education** | Per-title fees to aggregators | Tens of thousands per title, not more |

The single most useful aggregate: **lifetime post-theatrical revenue for a
typical studio title lands at roughly 40–60% of its worldwide theatrical
rentals**, spread over about a decade with two-thirds of it inside the first
three years. Family and franchise titles run higher; adult dramas that
underperformed theatrically run lower, because every downstream price is
indexed to the theatrical result.

That indexing is the reason theatrical matters so much more than its own
revenue share suggests. A film that grosses $60M domestic instead of $30M
does not merely earn $30M more in cinemas; it roughly doubles its pay-1 fee,
lifts its international TV pricing, and moves up a tier in every package it
will ever appear in.

### 3.2 Output deals versus title-by-title

- **Output deal** — a multi-year agreement under which a buyer takes *every*
  qualifying title from a studio's slate in a defined window, at a formula
  price. Historically how pay TV worked (a studio's entire output going to one
  premium network), and how most studios placed their pay-1 window in the
  streaming era. Advantages to the studio: guaranteed, bankable, poolable
  revenue that can be shown to lenders. Disadvantage: a breakout title is
  underpriced by the formula's cap.
- **Title-by-title** — negotiated per film. Better for hits, worse for the
  slate's floor, and administratively far heavier.
- **The vertically-integrated case** — the studio's own streamer takes the
  window. No cash changes hands externally at all, which is excellent for the
  parent and a live problem for every participant (§2.4).

Output deals are also how a studio's post-theatrical revenue becomes *forecast-
able*, which is what allows an ultimates model (§5.1) to be built with any
confidence at all.

### 3.3 Library and catalogue deals

Once a title's first-cycle windows have run, it stops being sold individually
and starts being sold in bulk:

- **Volume packages** — a few hundred titles licensed to a broadcaster or
  streamer for a term, priced on hours, title recognition, and genre mix
  rather than on any individual film.
- **Channel deals** — a branded FAST channel built from a genre slice of the
  library; the studio supplies titles and shares ad revenue.
- **Long-term exclusive licences** — a whole library placed with one platform
  for 5–10 years. This is a financing event as much as a sales one.
- **Outright catalogue sale or corporate M&A** — the library changes owner.
  See §12 for how the price is set.

Library licensing is negotiated by a small team and is the highest-margin
activity in the building: the negative cost was written off decades ago, the
marketing is zero, and the only real costs are residuals, restoration, and
delivery. It is also the least glamorous job in the company, which is why it
is chronically under-resourced relative to what it earns.

### 3.4 Revenue mix varies enormously by film type

Directional share of lifetime revenue:

| Film type | Theatrical | Home/digital | Licensing | Consumer products |
|---|---|---|---|---|
| Broad four-quadrant tentpole | 55–65% | 10–15% | 15–20% | 5–20% |
| Animated family franchise | 40–50% | 10–15% | 15–20% | 20–35% |
| Horror | 55–70% | 15–20% | 15–25% | ~0 |
| Adult drama / prestige | 30–45% | 15–20% | 35–45% | 0 |
| Comedy | 40–55% | 15–20% | 25–40% | ~0 |
| Streaming original (no theatrical) | 0 | 0 | 100% (internal) | Rare |

The prestige row explains a lot of greenlight behaviour: an adult drama earns
most of its money *after* cinemas, in television and library windows, which is
why studios kept making them long after their theatrical economics stopped
working — and why the collapse of the pay-TV licence market hurt that category
far more than the box office ever did.

---

## 4. Residuals

Guild-mandated payments to writers, directors, and performers for reuse beyond
the initial market. Administered by the guilds, calculated per formula, and a
real line in distribution expenses.

- Historically based on a percentage of **distributor's gross** for home video
  and TV (with the notorious 20%-of-revenue home-video base that halved the
  effective rate).
- Streaming residuals were the central issue of the 2023 WGA and SAG-AFTRA
  strikes; the settlements added viewership-based bonuses to the fixed-fee
  structure.
- Residuals are payable **regardless of profitability** — they are not
  contingent compensation. This is what makes them valuable.

Practical consequence: a credited writer on a long-running library title can
earn residuals for decades. An uncredited rewriter earns nothing
(`02-development.md` §7).

### 4.1 Who administers a residual

Residuals are the only part of this document where the money is
institutionally chased on the talent's behalf, which is exactly why they work.

| Party | Role |
|---|---|
| **Studio residuals department** | Computes the residual for each market from the revenue reports, produces the residual run, cuts the cheques |
| **WGA Residuals Department** | Receives writer residuals *and the statements*, audits the calculation, distributes to writers per the credit determination |
| **DGA** | Same for directors, UPMs, and ADs; DGA is notably aggressive about statement-level auditing |
| **SAG-AFTRA** | Receives performer residuals, allocates across the cast per the formula and per-performer entitlement, distributes |
| **Pension/health plans** | Take contributions calculated on top of the residual |
| **Payroll/residuals service bureaux** | Do the arithmetic and distribution for independents and smaller distributors |
| **Successor distributor** | Any buyer of the picture must sign an **assumption agreement** taking on the residual obligation — the guilds hold security interests in the copyright to enforce it (§12.4) |

Credit determination gates everything: the residual follows the **credit**, not
the work (`02-development.md` §7). This is why credit arbitration is fought so
hard — it is a decades-long annuity, not a vanity contest.

### 4.2 The shape of the formulas

Every guild's formula is different and every one is amended each bargaining
cycle. What is stable is the *shape*: residuals are either a **percentage of a
defined revenue base**, or a **fixed sum per use per market**, and sometimes
both. Directionally, with the caveat that the exact rates move every three
years:

| Market | Formula shape | Directional rate |
|---|---|---|
| **Free television (feature reuse)** | % of the distributor's gross from that market, sometimes after a deduction for distribution | ~1.2–1.9% depending on guild, applied cumulatively across runs |
| **Basic cable / pay TV** | % of distributor's gross for the market | Low single-digit % |
| **Home video** | % applied to a **20% royalty base** — i.e. only one dollar in five of home-video revenue counts | ~1.5–1.8% of the base for writers/directors (≈0.3–0.36% of revenue); ~5.4% of the base for the performer pool (≈1.08%) |
| **EST/TVOD** | Historically treated on the home-video base; partly improved since | As above, with negotiated uplifts |
| **Licensed SVOD** | % of the licence fee received | Low-to-mid single-digit % |
| **Streaming original (made for the service)** | A **fixed residual** by budget tier and platform subscriber tier, paid annually for a defined number of years | Fixed schedule, not revenue-linked |
| **Streaming viewership bonus (post-2023)** | An uplift triggered when a title is viewed by a threshold share of domestic subscribers within the first 90 days | Threshold commonly ~20% of subscribers; bonus roughly **+50%** of the fixed domestic and foreign residual |
| **Foreign television** | % of foreign gross for the market | Low single-digit % |

The 20% home-video base is worth understanding as *the* case study of how a
base beats a rate. It was conceded in the early 1980s when home video was a
speculative business with real manufacturing risk. The rate looked generous;
the base made it worth a fifth of what it appeared to be, and the industry
spent the following forty years — and two strikes — trying and largely failing
to unwind it. When the same argument arrived for streaming, the guilds fought
the *base and the transparency* (viewership data), not the percentage. That was
the lesson learned.

**Residuals are a cost that survives everything.** They are payable whether the
film profited, whether the studio still exists, and whether anybody can find
the participant. They are accrued as a liability against the picture and
against the library, and an unfunded residual liability is a real deduction
from any library's sale price (§12.3).

### 4.3 The timeline of an actual payment

| Step | Timing |
|---|---|
| Market revenue is reported into the studio's residual system | Monthly to quarterly, following the licensee's own reporting lag |
| Residual computed and the guild statement produced | Within the quarter |
| Payment to the guild, with the supporting statement | Guild agreements set deadlines measured in **weeks after the quarter** — typically 30–60 days, with late-payment interest |
| Guild allocates and distributes to individuals | Weeks; SAG-AFTRA's allocation across a large cast is the slowest step |
| Pension and health contributions remitted | With the payment |
| Guild audit of the studio's residual computation | Ongoing, on a rolling multi-year cycle |

A first residual cheque on a theatrical feature typically arrives **9–18 months
after release** — the free-TV and home-video reporting chains simply take that
long. Cheques then arrive quarterly, decaying, for as long as the title is
licensed anywhere, which for a durable title means indefinitely.

### 4.4 Where residuals go wrong

| Failure | Consequence |
|---|---|
| Credit lost in arbitration | The residual stream goes to someone else, permanently |
| Address not kept current with the guild | Unclaimed residuals sit in a guild account for years; the guilds publish lists of people they cannot find |
| Distributor insolvency | Residuals unpaid; guilds enforce against the copyright and can block further exploitation |
| Library sold without a signed assumption agreement | The title becomes unlicensable until the obligation is assumed |
| Non-signatory production | No residuals at all — one of the real reasons guild signatory status is fought over |
| Studio accrual not trued up to actual payment | An over-accrual sits as a phantom expense on participation statements until an audit catches it |
| Foreign sub-distributor under-reports | The base is understated and nobody downstream can see it |

---

## 5. The studio's own P&L

For any given picture the studio is tracking:

```
Negative cost           the cost of making the film (production + post)
+ Overhead charge       10–15% of negative
+ Capitalised interest  on funds advanced
+ P&A                   the marketing spend
+ Residuals & distribution expenses
= Total cost of the picture

Rentals (theatrical, all territories)
+ Home entertainment revenue
+ Licensing revenue (SVOD, pay TV, free TV, international)
+ Ancillary and merchandising
= Total revenue

Revenue − Total cost = the picture's contribution
```

Two further layers sit above single-picture accounting:

- **Slate economics.** Studios are portfolio businesses. A slate of 12 films
  might have 2 large winners, 4 modest profits, 4 marginal, and 2 disasters,
  and the slate is judged in aggregate. This is why studios can afford
  individually irrational bets.
- **Corporate strategy.** A film may exist to feed a streaming service, sustain
  a franchise, retain a filmmaker relationship, or defend a theme park IP —
  and be greenlit at a price that a standalone P&L would never justify.

### 5.1 How a greenlight is actually modelled — the ultimates

**Who** — the model is built by **Strategic Planning / FP&A** (a small team of
analysts under an EVP Finance), using inputs from Distribution (opening
projection, screen count, dating), Marketing (P&A requirement), International
(territory-by-territory estimates), Home Entertainment and Licensing
(downstream pricing), Production Finance (negative cost), and Business Affairs
(participations and their triggers). It is presented to the **greenlight
committee** — studio chair, president of production, president of marketing,
president of distribution, head of business affairs, CFO, and often the parent
company's CEO above a threshold.

**When** — a first pass exists at the pitch or the option; a serious model
appears when a director and a cast are attached; the decision model is built
in the 4–10 weeks before greenlight and refreshed at every material change
(a cast change, a budget change, a date move). After release it is *revised
quarterly for the rest of the film's life* — that revision is the accounting
consequence described in §5.3.

**What the model is.** A single spreadsheet, per picture, projecting **ultimate
revenue** — total revenue expected across every market over roughly ten years
from release — against **ultimate cost**. Its columns are the windows of §3;
its rows are years 1 through 10 (or 20 for a franchise); its bottom line is a
contribution figure and a cash-on-cash return.

The assumptions that actually drive it, roughly in order of leverage:

| Assumption | Where it comes from | Sensitivity |
|---|---|---|
| **Domestic opening weekend** | Comps, tracking-model, genre and date | Everything downstream is indexed to it |
| **Domestic multiple** | Genre and expected quality/word of mouth (`10` §4) | 2.2× vs 3.2× moves total domestic ~45% |
| **International index** | Ratio of international to domestic for this genre and cast | 1.0× vs 2.5× is the difference between a loss and a hit |
| **China assumption** | Whether an import slot is likely; the 25% share | Frequently modelled at zero to be safe |
| **P&A requirement** | Marketing's judgement of what it takes to open it | Has a hard floor (§6.4) |
| **Downstream indices** | % of domestic box office for each post-theatrical window | Comes from the output deals and recent comps |
| **Consumer products** | Licensing division, franchise-only | Near-zero for most films |
| **Participation load** | Business affairs; the pool and the bonus schedule | Rises exactly when the film succeeds |
| **Incentives** | Tax group: qualifying spend × rate, less monetisation discount | 15–35% off the negative when it works |
| **Currency** | Treasury's forward rates | Small on any one film, large across a slate |

**How it is stress-tested.** A model presented to a greenlight committee that
shows one number is not a model, it is an advertisement. What is actually
shown:

1. **Three cases** — downside, base, upside — each a *coherent world*, not a
   percentage haircut. The downside case has a worse opening *and* a worse
   multiple *and* a lower international index, because in reality these are
   correlated.
2. **The downside case is the decision case.** The question the committee asks
   is not "how much could this make" but "what does it cost us if it does not
   work, and can we absorb that?"
3. **Break-even sensitivity** — what worldwide gross is required, and how that
   compares to the comps. If break-even sits above the *best* comparable film
   in the genre, the model has answered the question.
4. **Cost-to-date and the sunk-cost trap** — development spend is explicitly
   excluded from the go/no-go arithmetic, and good committees say so out loud,
   because the commonest bad greenlight is "we've already spent $8M on it".
5. **What the film is worth if it is a 6 rather than an 8** — quality risk
   modelled as an outcome distribution, not a point estimate.
6. **The abandonment option** — the cost of *not* making it, including the
   pay-or-play commitments already given, is a real number and is compared to
   the downside case.

### 5.2 A greenlight model, worked

A $90M action-comedy with a mid-tier star, modelled at greenlight:

```
                              DOWNSIDE      BASE      UPSIDE
Domestic opening                 $22M       $34M       $48M
Multiple                          2.4×       2.8×       3.3×
Domestic total                   $53M       $95M      $158M
International index               1.1×       1.4×       1.8×
International total              $58M      $133M      $284M
Worldwide gross                 $111M      $228M      $442M

Rentals @ ~46% blended           $51M      $105M      $203M
P&A                             −$95M      −$95M     −$110M
Other distribution expenses     −$12M      −$16M      −$26M
Negative cost (net of $14M
  incentives)                   −$90M      −$90M      −$90M
Participations                    $0        −$3M      −$14M
                              --------   --------   --------
Theatrical result              −$146M      −$99M      −$37M

Post-theatrical (lifetime)       $28M       $52M       $96M
                              --------   --------   --------
PICTURE CONTRIBUTION           −$118M      −$47M      +$59M
Overhead + interest             −$16M      −$16M      −$18M
                              --------   --------   --------
CORPORATE CONTRIBUTION         −$134M      −$63M      +$41M
```

This is a real and common shape, and a committee looking at it will usually
say no, or say yes only with the budget cut and a co-financier taking half.
The film needs roughly **$355M worldwide** to break even all-in — 3.9× its
negative cost — and only the upside case clears it. The typical outcomes of
this conversation are: cut the negative to $65M, cut P&A by moving to a less
competitive date, sell 40% to a co-financier (§7), or restructure the star's
deal from cash to bonuses so the cost arrives only if the film works.

### 5.3 Ultimates after release — amortisation and write-downs

This is the least-known and most consequential piece of studio finance.

Film production costs are **capitalised** as an asset while the film is made.
Once released, that asset is written off against revenue using the
**individual-film-forecast method**: in each period, the fraction of remaining
capitalised cost expensed equals the fraction of remaining *ultimate revenue*
earned in that period. Ultimate revenue is generally estimated over a window of
about **ten years from initial release**.

Three consequences that drive real behaviour:

1. **Ultimates are re-estimated every quarter.** Finance revisits the forecast
   for every unamortised title on the books. If the estimate falls, the
   amortisation rate rises immediately and retrospectively.
2. **A miss shows up fast and all at once.** When a film opens far below model,
   the ultimate is cut in the same quarter and the studio takes an
   **impairment / write-down** — the headline "the studio took a $X00M charge"
   figure. It is not a cash event; the cash left months earlier. It is the
   accounting catching up.
3. **A hit smooths.** Raising an ultimate lowers the amortisation rate on the
   remaining cost, flattering later periods. This is legitimate and also a
   reason to read a studio's quarterly film results sceptically.

Practically, the finance department's central discipline is **honest
ultimates**. A studio that lets optimistic ultimates stand carries overvalued
assets and discovers the truth in a single ugly quarter; a studio that revises
promptly takes small, frequent, survivable hits. This is one of the clearest
dividing lines between well-run and badly-run studios (§11).

### 5.4 Slate economics, numerically

A representative 12-film studio slate, with corporate contribution after
overhead and interest, over the films' lifetimes:

| # | Type | Negative | P&A | WW gross | Contribution |
|---|---|---|---|---|---|
| 1 | Franchise sequel | $200M | $160M | $1.10B | **+$260M** |
| 2 | Animated original | $135M | $150M | $720M | **+$115M** |
| 3 | Horror | $15M | $30M | $185M | **+$60M** |
| 4 | Star-driven action | $110M | $110M | $430M | **+$25M** |
| 5 | Broad comedy | $45M | $60M | $175M | **+$12M** |
| 6 | Genre thriller | $35M | $45M | $140M | **+$8M** |
| 7 | Prestige drama (awards) | $28M | $40M | $95M | **+$2M** |
| 8 | YA adaptation | $70M | $75M | $190M | **−$15M** |
| 9 | Mid-budget drama | $40M | $50M | $85M | **−$25M** |
| 10 | Comedy sequel | $60M | $65M | $110M | **−$40M** |
| 11 | Would-be franchise starter | $150M | $140M | $260M | **−$150M** |
| 12 | Tentpole miss | $210M | $170M | $310M | **−$220M** |
| | **Slate** | **$1.10B** | **$1.10B** | **$3.80B** | **+$32M** |

What that table is really saying:

- **The distribution is not merely skewed, it is dominated by its tail.** Two
  films produce more contribution than the other ten combined; two films
  destroy nearly as much. Median performance is close to zero.
- **The slate cleared about 1.5% on $2.2B deployed** — a bad year would be
  negative, and a good year turns on whether film 1 grossed $1.1B or $700M.
  This is why the theatrical business is judged over three-to-five year cycles
  and why library and television revenue, which are steady, are what actually
  keep the lights on.
- **The small film is the best return on capital.** Film 3 returned about 1.3×
  the $45M deployed on it; film 1 about 0.7× on $360M. Studios keep making
  the big ones because $60M of contribution does not pay for a studio, a
  distribution apparatus, or a franchise pipeline.
- **You cannot select the winners in advance.** If anyone could, films 11 and
  12 would not have been made — they were the most confidently modelled films
  on the slate.

### 5.5 Overhead: the layer above the slate

A studio's own operating cost — the lot, the executives, the distribution
apparatus, development spending on films never made, and the write-off of
abandoned projects — runs into the **hundreds of millions per year** and is
carried by the slate's contribution plus library and television income. This is
the honest reason the overhead charge exists on participation statements: the
company really does have a cost that no individual picture pays for. It is
also why the charge is resented, since it is levied per picture as a percentage
of negative cost rather than allocated to actual usage.

Development write-offs deserve their own mention: a studio spends **$40–100M a
year** developing material, and the large majority of it never becomes a film.
Those costs are expensed when a project is abandoned (`02-development.md` §9)
and are a permanent, invisible drag that never appears in any single film's
P&L.

---

## 6. Break-even, honestly stated

There is no single break-even number, because it depends on the definition.
Three that matter:

1. **Theatrical cash break-even** — rentals cover negative cost + P&A. Rule of
   thumb: **~2–2.5× negative cost in worldwide gross**, ignoring marketing;
   **~3.5–4×** once marketing is included
   (`10-theatrical-release-and-box-office.md` §8).
2. **Ultimate break-even** — all revenue over the asset's life covers all cost.
   Most studio films get here eventually; the strike price for a *good*
   investment is much higher.
3. **Contractual break-even** — whatever the participation agreement says,
   which may be none of the above.

When a trade paper reports a film "lost $100M", it is usually a modelled
estimate of (1) or (2), not a studio figure.

### 6.1 Worked cases

Blended rentals rate is assumed at ~48–52% depending on the domestic/
international mix. "Multiple" is worldwide gross ÷ negative cost.

**A. Micro-budget horror.** Negative $8M, P&A $22M, WW gross $95M ($62M
domestic, $33M international).

```
Rentals                     $46.1M
P&A + other dist. expenses −$25.0M
Negative                    −$8.0M
Theatrical result          +$13.1M
Post-theatrical            +$17.0M
Contribution (after o/h)   ≈+$28M     Break-even WW gross ≈ $68M = 8.5× negative
```

The lesson is the **8.5×**. A cheap film needs a huge multiple of its negative
cost because P&A has a floor that does not scale down (§6.4). It is still the
best return on capital on any slate, because the absolute numbers are small.

**B. Mid-budget comedy that underperforms.** Negative $45M, P&A $60M, WW $120M
($75M domestic, $45M international).

```
Rentals                     $58.0M
P&A + other                −$66.0M
Negative                   −$45.0M
Theatrical result          −$53.0M
Post-theatrical            +$26.0M
Contribution (after o/h)   ≈−$34M     Break-even WW gross ≈ $230M = 5.1× negative
```

Reported in the trades as "lost $50M" — a theatrical-only estimate. The real
lifetime number is smaller, and slower.

**C. Prestige awards film.** Negative $26M, P&A $32M plus an $8M awards
campaign (`13-awards-and-critical-reception.md`), WW $88M.

```
Rentals                     $42.2M
P&A + awards + other       −$44.0M
Negative                   −$26.0M
Theatrical result          −$27.8M
Post-theatrical            +$31.0M   (unusually high share: TV and library)
Contribution (after o/h)    ≈−$1M
```

Roughly break-even, with the awards run bought as marketing for the library
value and for the studio's ability to attract the next filmmaker. This is what
"prestige films are loss leaders" actually means numerically: not a $30M hole,
a rounding error plus an intangible.

**D. Animated family franchise.** Negative $145M, P&A $155M, WW $690M, plus
consumer products.

```
Rentals                    $324.0M
P&A + other               −$175.0M
Negative                  −$145.0M
Theatrical result           +$4.0M
Post-theatrical           +$105.0M
Consumer products, net     +$65.0M
Contribution (after o/h)   ≈+$140M
```

Note that the theatrical result is roughly zero and the film is a large
success. Animation's economics live downstream — home viewing, television, and
merchandise — which is why family films are valued on a completely different
break-even multiple from live action.

**E. Streaming original, no theatrical.** Negative $85M, plus a **cost-plus**
fee of 10–20% paid to the producing entity, plus a talent buyout premium.
There is no gross, no rentals, no P&A in the theatrical sense, and no
break-even: the film is an operating expense of a subscription business and is
judged on **completion rate, acquisition attributable to the title, and
retention**, not on revenue. The studio's return is contractually fixed at
signature. Everything in §1 and §2 simply does not apply, which is exactly why
talent representation fought so hard about it.

### 6.2 Why break-even multiples differ so much

| Driver | Effect on the break-even multiple |
|---|---|
| Low negative cost | **Raises** it — P&A floor is fixed |
| High international share | Lowers rentals rate; **raises** the gross needed |
| Large China component | **Raises** it sharply — 25% share |
| Family/animation | **Lowers** it in lifetime terms — downstream and CP revenue |
| Gross participations | **Raises** it — paid before recoupment |
| Awards campaign | **Raises** it by the campaign cost |
| Co-financing | Does not change the multiple, changes who bears it |
| A long shelf between wrap and release | **Raises** it — interest accrues, incentives may lapse |

### 6.3 The three numbers a studio actually watches

1. **Cash-on-cash**: total cash in versus total cash out, ignoring overhead and
   interest. What treasury cares about.
2. **Contribution after overhead and interest**: what the picture did for the
   company. What the committee is judged on.
3. **Ultimate**: the forecast that drives amortisation and therefore reported
   earnings (§5.3). What the parent company's shareholders see.

They can and do point in different directions on the same film at the same
time, and most public arguments about whether a film "made money" are two
people quoting different ones.

### 6.4 The P&A floor

Worth stating separately because it deforms every break-even calculation: you
cannot open a film wide in the US for less than roughly **$25–35M**, and a
competitive wide release costs **$50–100M+** domestically with a similar sum
internationally (`09-marketing-and-distribution.md` §1). Below that spend the
film simply is not visible. This means the break-even multiple is a *hyperbola*
against negative cost, not a constant — enormous for cheap films, approaching
2.5–3× only for very expensive ones. Any model that uses a single "2.5× to
break even" rule for every budget level is wrong at both ends.

---

## 7. Co-financing and risk sharing

- **Slate deals** — an outside investor takes, say, 25% of every film on a
  slate for a term, paying 25% of costs and receiving 25% of the defined
  revenue. Diversifies the investor and de-risks the studio.
- **Single-picture equity** — a partner (Legendary, Skydance, New Regency)
  takes a defined share of one film.
- **Split-rights deals** — one party takes domestic, another international.
- **Presales and gap** — see `03-financing-and-dealmaking.md`.
- **Insurance-wrapped structures** and tax-motivated financings appear and
  disappear as regulation changes.

A studio with a co-financier on a hit gives away upside; on a flop it has
halved a disaster. Over a slate, the co-financier's expected return depends
entirely on whether the studio can select against them — which is why these
deals are structured as *slates*, not picks.

### 7.1 How a slate deal is actually structured

**Who** — on the studio side, the CFO and an EVP of Corporate Finance or
Strategic Planning, with outside counsel. On the money side, a fund manager
raising from institutional limited partners (pension funds, insurers,
endowments, family offices, and — in several vintages — hedge funds), an
investment bank arranging the debt, and a specialist entertainment lender
providing the senior tranche. A rating agency appears if the debt is to be
placed publicly.

**When** — negotiated over 6–12 months, closed before the covered slate begins,
covering **3–5 years** or a fixed number of pictures, whichever comes first.

The structure, in the shape it almost always takes:

```
                    SPECIAL PURPOSE VEHICLE ("the fund")
   Senior debt      50–65% of the fund   bank/institutional, SOFR + 2.5–5%,
                                         first out, secured on the fund's
                                         receivables
   Mezzanine        10–20%               higher coupon, sometimes with a
                                         profit kicker
   Equity           25–35%               the LPs; last out, takes the risk
                        │
                        ▼
   The SPV funds an agreed % of the negative cost of each qualifying
   picture (and often the same % of P&A), and receives the same % of the
   picture's "defined revenue" — after the studio's fees.
```

Every term that matters is about *what qualifies* and *what comes off the top*:

| Term | Typical | Why it matters |
|---|---|---|
| **Participation rate** | 20–50% of each picture | Sets the exposure |
| **Qualifying criteria** | Budget band, genre, rating, release pattern | Determines what the fund is actually buying |
| **Exclusions / carve-outs** | Named franchises, animation, sequels to existing hits, films already co-financed | **The single most important term.** A slate with the crown jewels carved out is a different asset |
| **Distribution fee to the studio** | 10–15% of gross receipts (reduced from the 30–35% standard) | The largest single drag on the fund's return |
| **P&A** | Charged at cost, at the fund's share; sometimes with an ad-admin fee | Whether the fund funds P&A changes the risk profile entirely |
| **Overhead** | Usually excluded for the fund, sometimes charged at a reduced rate | Negotiated hard |
| **Cross-collateralisation** | Full, across the whole slate | Standard, and essential to the diversification logic |
| **Opt-out / put rights** | The studio may withdraw a limited number of pictures; the fund may have limited rejection rights | The adverse-selection control |
| **Term and tail** | 3–5 years of pictures, revenue collected for 10+ | The money comes back very slowly |
| **Reporting and audit** | Quarterly statements, annual audit rights | Funds that skipped this regretted it |

### 7.2 What the investor's return actually looks like

Take a fund putting up 30% of a 12-picture slate resembling §5.4, at a 12%
studio distribution fee, funding 30% of both negative cost and P&A.

```
CAPITAL DEPLOYED
  Fund's share of negative cost           30% × $1.10B  =  $330M
  Fund's share of P&A                     30% × $1.10B  =  $330M
                                                          -------
                                                            $660M

RETURNED
  Slate's total gross receipts (rentals + all
    post-theatrical + consumer products, 12 pictures)      $2.80B
  Fund's 30% share                                          $840M
  Less studio distribution fee @ 12% of receipts           −$101M
  Less fund's 30% share of other distribution
    expenses (residuals, versioning, taxes, checking)       −$75M
                                                          -------
  Returned to the fund over ~10 years                       $664M

  Gross multiple on invested capital                         1.01×
```

That is *before* leverage, before the fund's management fee, before the
manager's carry, and before ten years of the time value of money. Add a
2%-and-20% structure and senior debt that must be repaid first, and the
equity's outcome is meaningfully negative on a slate that was, for the studio,
a normal year. Cut the distribution fee to 8% and the same slate returns about
1.06×; add two carved-out franchise titles back into the pool and it reaches
**1.2–1.3×** — a mediocre absolute return for a decade of illiquid risk, but
not a disaster.

That sensitivity is the whole story: **the fee rate and the carve-out list
determine the outcome, and both are set before a single film is made.**

### 7.3 Why several of these have gone badly

Slate funds have been raised in waves — a large one in the mid-2000s, another
in the 2010s, and a smaller stream since — and the record for investors is
poor. The recurring causes, and they are not mysterious:

| Cause | Mechanism |
|---|---|
| **Fee drag** | The fund pays 100% of its share of costs but shares in revenue only after the studio's distribution fee. Even a "reduced" 12% fee on gross is a very large number relative to a slate's ~1–3% margin |
| **Adverse selection** | Where the studio can carve out or opt out, the fund gets the pictures the studio is least confident about. Every well-drafted fund tries to close this and none closes it entirely, because the studio decides what gets made |
| **No control** | The fund cannot change a budget, a release date, a P&A spend, or a greenlight. It is a passive claim on decisions made by someone with a different objective function |
| **Vintage risk** | The mid-2000s funds were underwritten on DVD economics, and the DVD market fell by more than half in the following years. No amount of diversification protects against a whole window disappearing |
| **Leverage** | Senior debt is repaid first out of a slow, back-loaded revenue stream. When the slate underperforms modestly, the equity is wiped out entirely |
| **Duration** | Capital is locked for a decade against a return that would look thin at three years |
| **Opacity** | The fund's revenue is reported by the studio, under the studio's definitions, with the studio's allocations — the participation problem of §2 at fund scale |
| **Correlation with the studio's incentives** | The studio's fee is earned on gross; the fund's return depends on net. When those diverge, the studio's rational choice — spend more P&A, take a bigger swing — is not the fund's |

The honest summary: **the studio is selling risk transfer, and it prices it
well.** Slate money keeps coming back because the asset class is genuinely
uncorrelated with equities, because a hit slate can return well, and because
there is always a new pool of capital that has not read the last one's results.

### 7.4 The skill axis on both sides

**A studio doing this well:**

1. Sells participation in the *slate* it was going to make anyway, not a slate
   assembled to attract money.
2. Keeps the relationship renewable. A fund that loses money once does not
   return, and repeat co-financing partners are worth far more than one
   good vintage.
3. Uses co-financing to raise its *risk appetite* — greenlighting the films it
   could not carry alone — rather than simply to de-risk what it was doing.
4. Does not carve out so aggressively that the deal becomes obviously
   one-sided, because the market knows.

**An investor doing this well:**

1. Negotiates the **fee**, not the percentage. Every point off the
   distribution fee is worth more than any other term.
2. Refuses carve-outs, or prices them: if the franchises are excluded, the
   participation rate on everything else must rise.
3. Insists on funding negative cost *only*, leaving P&A to the studio, so the
   studio's own money is at risk in the release decision.
4. Buys audit rights and uses them.
5. Underwrites to the *downside* case of §5.1, not the base, and assumes the
   worst two films on the slate are theirs.
6. Sizes the position for a decade of illiquidity and models the return after
   fees, carry, and leverage — not the gross multiple.

---

## 8. Cash flow through production

Money leaves before it arrives, always.

| Stage | Cash movement |
|---|---|
| Development | Small, sustained outflow over years |
| Prep | Ramping outflow; construction and deposits |
| Shoot | Peak burn; weekly payroll is the largest single item |
| Post | Sustained outflow; VFX invoiced on milestones |
| P&A | Large outflow in the 8 weeks before release |
| Theatrical | First inflow — but exhibitors remit on **30–90 day** terms |
| Home/licensing | Inflows over years |
| Participations | Paid quarterly or semi-annually, in arrears, after audit |

The gap between P&A outflow and rental inflow is the sharpest liquidity point
in the whole business, and it is why distribution is a capital-intensive
activity that only large balance sheets can sustain.

### 8.1 How a production is actually funded, week to week

**Who** — the **production accountant** runs the picture's money on the ground,
with a **1st assistant accountant** (payroll), a **2nd assistant** (accounts
payable), and on a large show a payroll clerk and an asset/petty-cash clerk.
They report to the **UPM/line producer** on set and to **studio production
finance** on the money. Above them sit the studio's **Treasury** (which holds
and moves the cash) and, on a bonded independent film, the **completion
guarantor's representative** (`03-financing-and-dealmaking.md` §7), who
counter-signs drawdowns.

**When** — the accounts office opens on the first day of prep and closes 3–9
months after wrap. It is one of the very first and very last departments.

The weekly cycle, which is the same on almost every production:

| Day | What happens |
|---|---|
| **Mon–Tue** | Timecards from the previous week are collected by department, checked against the daily production report for hours, turnaround, meal penalties and overtime, and coded |
| **Tue–Wed** | Payroll is transmitted to the **payroll service** (which is the legal employer of record for most crew), with union pension/health/welfare contributions calculated on top |
| **Wed** | The payroll service draws the funds — the production must have cash in the account 2–3 days before crew are paid |
| **Thu** | Crew paid. Weekly payroll on a $60M studio picture in production runs roughly **$1.2–2.5M**, and is the largest single recurring item |
| **Thu–Fri** | **Hot costs** — the previous days' overage against schedule, circulated fast and roughly (`06-principal-photography.md`) |
| **Fri/Mon** | The **weekly cost report** — the full estimate-to-complete for every account, with variances explained — goes to the UPM, producer, studio, and (if bonded) the guarantor (`03-financing-and-dealmaking.md` §10) |
| **Rolling** | Purchase orders raised before commitment; invoices matched and paid on 15–45 day terms; petty cash floats issued to departments and reconciled weekly |
| **Monthly** | The **cash requirement** — a forward projection of the next 4–8 weeks' outflow — is submitted to the studio, which wires against it |

**Cash flow schedule.** Before a foot of film is shot, the accountant produces a
week-by-week projection of the entire picture's outflow, derived from the
schedule and the budget. This document is what the studio funds against, what a
bank lends against, and what the guarantor monitors. It is typically shaped:

```
Prep (8–10 wks)   ▁▂▃▄▅   15–25% of the budget — deposits, build, fittings,
                            travel, insurance premiums
Shoot (8–14 wks)  ███████  45–60% — payroll dominates, then locations,
                            transport, catering, equipment rental
Wrap (2–4 wks)    ▅▃▂      5% — restoration, returns, final payroll
Post (16–40 wks)  ▃▃▃▃▄▅▃  20–30% — editorial, VFX milestones, music, sound,
                            DI, deliverables
Contingency       held back, released only on the studio's authority
```

The rhythm matters: the **peak burn week is somewhere in the middle of the
shoot**, and the difference between the peak and the average is a factor of
three or more. A financier who funds the average rather than the peak stops
the picture.

### 8.2 Interim finance: what fills the gaps

Studio pictures are funded off the parent's balance sheet and none of this
applies. Independent pictures are assembled from instruments, and the interest
on those instruments is a real, and frequently underestimated, cost of the
film (§13):

| Instrument | What it does | Typical cost |
|---|---|---|
| **Presale discounting** | A bank advances against signed territory contracts, at a discount for the buyer's credit | SOFR + 3–6%, plus arrangement fees; only investment-grade-ish buyers discount well |
| **Tax credit loan** | A bank advances against an expected incentive certificate before it is issued | Advance of **75–90%** of the expected credit; all-in cost commonly **6–12%** of the amount advanced, more where the jurisdiction is slow or the credit must be sold |
| **Gap loan** | Lends against *unsold* territories, secured on the sales estimates | Sized at 10–20% of budget with 150–200% coverage in unsold estimates; **10–15%+** all-in — the most expensive money in the stack |
| **Equity bridge** | Covers a timing mismatch while equity closes | Short, expensive |
| **Facility/overdraft** | Smooths the weekly cycle | Bank rate plus margin |
| **Completion bond** | Not finance, but the thing that makes the finance lendable | **1.5–3% of budget**, often with a rebate if no claim |

All of it is secured on the picture, and all of it is repaid out of the
**collection account** in a strict order.

### 8.3 The waterfall on an independent picture

Studio waterfalls are internal accounting. Independent waterfalls are a
contract between strangers, administered by a neutral third party — a
**collection account management agreement (CAMA)** with a **collection agent**
who receives every dollar of revenue worldwide and pays it out in a defined
order, taking a fee of roughly **0.5–1% of receipts**. The order is typically:

```
1. Collection agent's fee and costs
2. Sales agent's commission (10–25%) and recoupable sales expenses
   (market costs, delivery, marketing materials — usually capped)
3. Residuals and guild obligations
4. Senior debt: presale/gap/tax-credit loans, plus interest and fees
5. Completion guarantor's recoupment (if it funded an overage)
6. Deferments (if negotiated above equity)
7. Equity, to recoupment — often with a **premium** of 10–20% on top
8. Net profits split, commonly 50/50 between financiers and producers,
   with the producers' half then split among producers, talent, and
   any back-end participants
```

The two positions everyone fights for are **above the sales agent's commission**
(nearly impossible) and **the equity premium** (routine). Talent backend on an
independent film sits at step 8 and is worth exactly as much as it sounds.

### 8.4 The P&A trough

The single worst liquidity moment in the business, worth walking through with
dates. A wide release with $80M of domestic P&A:

| Week relative to release | Cumulative P&A spent | Cash received |
|---|---|---|
| −12 | $6M (trailer, digital, early buys) | $0 |
| −6 | $22M | $0 |
| −3 | $45M | $0 |
| −1 | $72M | $0 |
| Release | $80M | $0 |
| +2 | $88M (holdover spend) | $0 |
| +4 | $92M | First settlements begin |
| +8 | $95M | ~40% of domestic rentals in |
| +13 | $95M | ~75% in |
| +26 | $95M | Domestic substantially collected; international still arriving |

The distributor is out **$95M of cash for roughly a month before the first
dollar returns**, on an asset whose value is determined in a single weekend.
Multiply that by a slate of 10–15 wide releases with overlapping trenches and
the working capital requirement is measured in the **billions**. This — not
production cost — is the real barrier to entry in distribution, and the reason
the number of companies that can release films wide worldwide is single digits.

### 8.5 Where cash flow fails

| Failure | Consequence |
|---|---|
| Cash flow schedule funded to the average, not the peak | Payroll misses in the middle of the shoot; the crew walks; the picture stops |
| Late wire from a financier | Payroll service will not process; a single missed payroll ends a production's credibility permanently |
| Tax credit disallowed or delayed | The loan against it comes due with no source of repayment |
| Sales estimates fall below the gap loan's coverage | Lender calls the loan or blocks delivery |
| Overage funded by the guarantor | Guarantor recoups ahead of equity; the producers' backend evaporates |
| P&A committed before a date is locked | Non-refundable media buys against a release that moves |
| A release date slip after P&A has flighted | Much of the spend is wasted and must be repeated |
| Exhibitor insolvency | Rentals for a played engagement simply never arrive |
| Blocked or devaluing currency | Revenue recognised, cash unavailable or worth less on repatriation |
| No collection account on an independent film | Money reaches whoever it reaches first, and the waterfall becomes a lawsuit |

---

## 9. Numbers to anchor on

| Item | Directional figure |
|---|---|
| Exhibitor's share, domestic | 45–50% of gross |
| Exhibitor's share, international | 55–60% of gross |
| Distributor's share, China (revenue-share import) | ~25% of gross |
| Studio distribution fee (against participations) | 30–35% of rentals |
| Reduced distribution fee in a co-financing deal | 10–15% |
| Studio overhead charge | 10–15% of negative cost |
| Interest charged on negative | Prime/SOFR + a margin, compounding |
| Home-video participation base | 20% of home-video revenue |
| Theatrical break-even, gross vs negative | ~2–2.5× (excl. marketing) |
| All-in break-even, gross vs negative | ~3.5–4× for an expensive film; 5–9× for a cheap one |
| Minimum viable US wide-release P&A | $25–35M; competitive $50–100M+ |
| Pay-1 SVOD licence | ~10–20% of domestic box office, floored and capped |
| Lifetime post-theatrical revenue | ~40–60% of worldwide theatrical rentals |
| Share of studio films that are individually profitable on theatrical alone | Roughly half of wide releases, by common industry estimate |
| Typical international share of a broad tentpole's WW gross | 60–70% |
| Exhibitor remittance terms | 30–90 days |
| Participation statement cadence | Quarterly → semi-annual → annual |
| Statement incontestability period | 24–36 months |
| Cost of a participation audit to the claimant | $50k–$500k |
| Collection agent's fee (independent) | 0.5–1% of receipts |
| Sales agent's commission (independent) | 10–25% |
| Completion bond | 1.5–3% of budget |
| Gap loan cost | 10–15%+ all-in |
| Tax credit loan advance | 75–90% of the expected credit |
| Equity premium before net profit split (independent) | 10–20% |
| Studio development spend written off annually | $40–100M+ |
| Ultimate revenue estimation window | ~10 years from release |

---

## 10. The finance function: who does this and what makes them good

Everything above is executed by people, and the quality of that execution is a
real variable in a studio's results. The roles are laid out in §1.1; this
section is about the skill axis for each of the three that matter most.

### 10.1 The production accountant

**When** — first day of prep to 3–9 months after wrap. Reports to the UPM and
to studio production finance.

**What separates good from bad:**

1. **The cost report tells the truth early.** A good accountant's
   estimate-to-complete moves in small increments and is right at week four. A
   bad one's is flat for eight weeks and then jumps $3M, which is the same
   information delivered too late to act on.
2. **They know the difference between an overage and a timing difference.** Not
   every big week is a problem, and calling every one a problem destroys the
   report's signal value.
3. **Fluency in union rules and incentive qualification.** Meal penalties,
   turnaround, forced calls, and — separately — whether a given spend qualifies
   for the incentive. Mis-coding qualifying spend can cost more than the entire
   accounting department.
4. **They are trusted by the UPM and by the studio simultaneously**, which is
   structurally difficult, because those two want different news.
5. **Purchase-order discipline before commitment.** An accounts office that
   discovers costs when invoices arrive is reporting history, not managing.
6. **The wrap is clean.** Final cost, asset disposal, incentive filing package,
   and closing the books without a tail of unrecorded liabilities.

**Failure looks like**: a cost report that is contradicted by the bank balance;
an incentive claim rejected at audit; a bond claim triggered by an overage
nobody saw coming; unpaid vendors surfacing months after wrap.

### 10.2 The participations and residuals department

**When** — from the first contract signature, forever.

**What separates good from bad:**

1. **The definition is coded correctly the first time.** A mis-coded
   participant produces years of wrong statements and a guaranteed audit.
2. **Statements go out on time.** Late statements are the single most reliable
   trigger of a dispute, independent of the numbers.
3. **Allocations are defensible.** When a package deal is split across titles,
   the method is written down, applied consistently, and survives a question.
4. **Accruals are trued up.** Residual reserves that never reconcile to actual
   payments are the easiest audit finding in the business.
5. **They flag the film that is about to break through** so business affairs
   knows a bonus is coming before the talent's lawyer calls.

### 10.3 The greenlight modeller

**When** — 4–10 weeks before each greenlight; quarterly thereafter forever.

**What separates good from bad:**

1. **Honest comps.** The temptation is to comp a film to its best-performing
   relative. The discipline is comping to the *median* of everything that
   resembles it, including the ones nobody remembers.
2. **Correlated downside cases.** A downside where the opening is bad but
   international holds up is not a downside case, it is a fantasy.
3. **Willingness to present a number the room does not want.** The modeller
   works for a chair who has often already decided. A finance function that
   only produces supporting arithmetic is worthless.
4. **Prompt ultimates revision** (§5.3), including on films the company is
   emotionally invested in.
5. **Knowing which assumption the answer hangs on**, and saying so, rather than
   presenting fifty inputs of equal apparent weight.

---

## 11. What separates a well-run studio financially from a badly-run one

Two studios releasing similar slates in the same year can produce very
different results, and only part of that is luck. The differences are
observable.

### 11.1 The practices

1. **Cost discipline set at greenlight, not on set.** The budget is fixed by
   deciding what the film is, before a director has been promised anything.
   Studios that greenlight ambitious scripts at optimistic numbers and then
   negotiate downward mid-production pay for it twice.
2. **P&A allocated against expected return, not against sunk cost.** The
   commonest expensive error in the business is spending more marketing on a
   film that has tested badly, because the negative cost is already spent. A
   well-run studio will cut P&A on a picture it no longer believes in and
   accept the smaller loss.
3. **Honest ultimates, revised promptly** (§5.3). Small frequent write-downs,
   not one annual catastrophe.
4. **A slate with a deliberate risk shape.** Two or three big swings, a spine
   of mid-budget genre films with real margins, and at least one cheap
   high-return category (horror, faith, documentary, low-cost comedy). Studios
   that abandon the low end lose the only reliable return-on-capital on the
   slate and the pipeline that produces new filmmakers.
5. **A release calendar planned 18–30 months out and defended.** Dating is
   nearly free to get right and enormously expensive to get wrong
   (`09-marketing-and-distribution.md` §7.1).
6. **Participation exposure that scales with success.** Bonuses and
   break-even-defined points cost nothing on a flop. Fixed cash and
   first-dollar gross cost the same on a flop as on a hit.
7. **Downside protection bought before it is needed** — co-financing,
   pre-sales, incentives, and insurance arranged at greenlight rather than
   scrambled for after a budget overrun.
8. **A library that is actively exploited** (§12) rather than treated as an
   archive.
9. **Relationships priced as assets.** Filmmakers, agencies, and co-financiers
   who have been treated well over a decade deliver material and capital that
   cannot be bought at market.
10. **Overhead proportionate to the slate.** A studio releasing eight films a
    year cannot carry the infrastructure of one releasing twenty-five.

### 11.2 The signatures of a badly-run one

| Signature | What it indicates |
|---|---|
| Repeated large single-quarter write-downs | Ultimates were not being revised honestly |
| Films released long after they were completed | Capital tied up, interest accruing, and a dating problem nobody solved |
| Budgets that rise 20%+ between greenlight and wrap | The greenlight number was aspirational |
| P&A that scales up on weak testing | Sunk-cost decision-making |
| A slate consisting only of tentpoles | No return-on-capital floor; every year is a coin flip |
| Chronic first-dollar and fixed-cash talent deals | Costs that do not fall when the film fails |
| Executive turnover mid-slate | Films inherited by people with no stake in them get orphaned in marketing |
| Films shelved or sold for a tax write-off | Capital destroyed to stop a worse outcome — a symptom, not a strategy |
| Library licensed on long exclusive terms for near-term cash | Selling the durable asset to fund the volatile one |
| Development spend rising while production volume falls | Money going into a pipeline that does not empty |
| Participation disputes with the same filmmakers repeatedly | A definition problem that is now a relationship problem |

### 11.3 The uncomfortable truth about skill

Selection skill in greenlighting is real but weak: the best studios are
demonstrably better than the worst over a decade, and neither can reliably
pick a hit. What separates them is mostly the **management of outcomes they
did not choose** — how fast a mistake is recognised, how cheaply a failure is
allowed to fail, how completely a success is exploited across windows and
sequels, and how much of the downside was contractually placed with someone
else *before* anyone knew which films would work.

---

## 12. The library: how the durable asset is valued and traded

The library is the only reliably profitable part of a studio, and the least
discussed. It is worth treating properly, because most of the industry's
corporate history — every studio acquisition, every streamer's content spend —
is a fight over libraries.

### 12.1 What a library actually is

Not just films. A library is:

- **The copyrights** in a set of completed pictures, plus the underlying
  rights the studio controls in each.
- **The rights that are actually available** — which is always fewer than the
  titles, because territories, media, formats, and terms were sold off
  historically and some have not reverted.
- **The physical and digital assets** — negatives, masters, mixes, textless
  elements, subtitles and dubs, artwork, trailers, and the metadata that makes
  a title findable and licensable.
- **The obligations that travel with it** — residuals, participations,
  music licences with finite terms, and any encumbrance a lender has placed on
  it.
- **The sequel, remake, and derivative rights** — often worth more than the
  films themselves.

### 12.2 How it is valued

**Who** — corporate development at the buyer, an investment bank on each side,
and specialist library valuers who model title-by-title. **When** — in an M&A
process, in a refinancing, or when a private equity owner is preparing an exit.

Two methods, always run together:

1. **A multiple of trailing cash flow.** The library's last 12–36 months of
   licensing revenue net of direct costs, times a multiple. Commonly **6–12×**,
   with the multiple set by the durability of the cash flow: recognisable
   titles, a franchise or two, and a diversified customer base command the top
   of the range; a library whose revenue is concentrated in one expiring
   contract commands the bottom.
2. **A discounted cash flow over a decay curve.** Library revenue decays
   predictably in the absence of events: **5–15% a year** for ordinary
   catalogue, much slower for durable titles, and it *steps up* on a remake, a
   sequel, an anniversary, a restoration, a death, or a cultural revival. The
   DCF is where the buyer's view of streaming demand and its own distribution
   plans get expressed.

Adjustments that move the price materially:

| Factor | Effect |
|---|---|
| Franchise and sequel rights held clean | Large premium — this is often the whole reason for the deal |
| Rights fragmented by territory or medium | Discount; some titles are unlicensable as a package |
| Residual and participation obligations | Direct deduction; quantified in diligence |
| Music rights expiring or limited to original media | Discount; re-clearing a score can be prohibitive |
| Asset condition (no 4K master, damaged elements) | Restoration costs **$50k–$500k+ per title** |
| Chain of title defects | Deal-breaking on individual titles; insurable at a price |
| Metadata quality | Sounds trivial, gates every automated licensing deal |
| Titles with talent whose reputation has changed | Real, awkward, and priced |

### 12.3 How libraries are traded

- **Corporate M&A** — the library comes with the company. Most of the famous
  studio acquisitions were library acquisitions with an operating business
  attached.
- **Outright catalogue sale** — a defined set of titles sold, usually by a
  distressed owner or a private-equity holder exiting.
- **Long-term exclusive licence** — the library placed with one platform for
  5–10 years for a large fee. Economically similar to a sale for the term, and
  the most common way a mid-size owner monetises. Dangerous, because the
  library is idle to everyone else for a decade and comes back with its
  customer relationships cold.
- **Securitisation** — bonds issued against the library's projected cash
  flows. Attractive when rates are low; it turns a slow asset into cash and
  leaves the obligations behind.
- **Sale-and-licence-back** — the owner sells and retains distribution.

### 12.4 The two mechanics outsiders always miss

- **Residuals travel with the picture.** Any buyer must sign a guild
  **assumption agreement** accepting the residual obligations, and the guilds
  hold security interests in the copyrights to enforce it. A library bought
  without assumption cannot be exploited: the guilds can block it. This makes
  residual liability a real, quantified line in every library valuation (§4.1).
- **Chain of title is the whole diligence.** Every option, every writer
  agreement, every music licence, every co-production contract in a film's
  history has to establish an unbroken transfer of rights. Older independent
  libraries routinely contain titles that cannot be licensed because a
  document from 1978 is missing. Title insurance exists precisely for this.

### 12.5 What makes a library good

1. **Recognisable titles**, because licensing is a name-recognition business
   at the point of sale.
2. **Franchise potential** — the derivative rights are the option value, and
   a single revived franchise can be worth more than the rest of the catalogue.
3. **Rights held whole**, worldwide, all media, in perpetuity.
4. **Volume in a coherent genre**, which can become a channel.
5. **Assets in modern condition** with clean metadata.
6. **Diversified licensees**, so no single expiring contract sets the value.
7. **Active management** — a library sold, re-cut, re-released, restored, and
   promoted earns multiples of the same library left in a vault.

---

## 13. The specific ways films lose money that are not "it flopped"

Public discussion of film finance has one failure mode: not enough people
came. That is the most visible cause and far from the only one. Each of the
following has, on its own, converted films that performed acceptably into
losses.

| Mechanism | How it happens | Typical damage |
|---|---|---|
| **Overhead charge** | 10–15% of negative added regardless of outcome, and levied whether or not the studio did anything for it | $5–30M on a picture |
| **Capitalised interest** | Accrues on the negative from the first dollar spent, before any revenue, and continues through any delay | 5–10% of negative on a film with a long tail; more if shelved |
| **The shelf** | A completed film held 12–30 months for a date, a re-cut, a legal issue, or a corporate reorganisation. Interest accrues, cast availability for reshoots lapses, marketing must be rebuilt, and the film reads as damaged goods before release | Several $M plus a permanently worse opening |
| **Cross-collateralisation** | Another picture's or another territory's shortfall netted against this one's overage, where the contract allows it | Can erase a participation entirely |
| **A bad date** | Opening against a bigger film for the same audience, or in a corridor with no audience, or moving late and losing the P&A already flighted (`09` §7.1) | 20–40% of the achievable gross |
| **P&A overspend on a film that will not respond** | Sunk-cost escalation after weak testing; a profitable small film turned into a loss by its own campaign | The difference between a $30M and an $80M campaign |
| **Reshoots and post overruns** | 2–6 weeks of additional photography at full unit cost, plus the VFX that must be redone, plus the delay | $5–40M |
| **VFX scope creep** | Shot count rising through post while vendors are already booked (`08-vfx-and-specialty.md`) | 10–30% over the VFX budget |
| **Gross participations paid on a losing film** | A first-dollar or low-threshold participant is paid out of receipts that never covered the cost | Millions, paid precisely when the film can least afford it |
| **Escalators triggered by success that is not enough** | Bonuses keyed to a gross the film reaches, on a picture that still loses money at that gross | Adds cost exactly at the margin |
| **Unrecouped or disallowed incentives** | Spend that did not qualify, a cultural test failed, a cap reached before the application, a slow-paying jurisdiction, or a queue; plus the discount on monetising the credit early | 15–35% of the budget was in the model and 0% arrives |
| **Currency** | International rentals earned in weakening currencies; blocked funds that cannot be repatriated; a strengthening dollar converting a good foreign year into a flat one | 5–15% of international revenue in a bad cycle |
| **Financing cost on an independent picture** | Gap at 10–15%, credit loans, bond fee, legal, and CAMA fees, all stacked before equity | 8–15% of the budget consumed by the act of raising it |
| **A collapsed window** | The post-theatrical value indexed to a theatrical run that was cut short, or a day-and-date release that removed the exclusivity the downstream price was based on | Post-theatrical revenue falls with the theatrical number, twice |
| **A licensee or distributor failing** | Territory sold, film delivered, distributor insolvent. The rights are tied up and the money never comes | The whole territory |
| **Music and underlying rights with short terms** | A licence cleared for theatrical and home video only, or for a term that expires, making a later window impossible without re-clearing | Blocks a window or costs six figures to fix |
| **Litigation and credit disputes** | Rights claims, credit arbitration outcomes, on-set incidents | Legal cost plus delay plus, occasionally, an injunction |
| **A rating that does not match the film's audience** | An R on a film built for teenagers, or cuts that damage the film to get a PG-13 (`07-postproduction.md`) | 20–40% of the audience |
| **Insurance events** | A cast member's illness or death, a weather loss, a location destroyed. Insured, but the deductible, the schedule damage, and the uninsurable consequences are real | Weeks of schedule; occasionally the picture |
| **Corporate reallocation** | The film assigned to feed a sister streaming service at an internal price; the picture's own P&L is decided by a transfer-pricing memo | Determines the outcome without reference to the audience |

The pattern across all of these: **a film's financial result is largely
determined before the audience is consulted.** By the time the opening weekend
number arrives, the budget, the participation load, the incentive assumption,
the release date, the P&A commitment, the window structure, and the financing
cost are all fixed. The weekend decides how far along a curve the film lands.
It does not decide the shape of the curve.
