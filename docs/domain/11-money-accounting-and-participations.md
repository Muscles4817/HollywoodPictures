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

---

## 9. Numbers to anchor on

| Item | Directional figure |
|---|---|
| Exhibitor's share, domestic | 45–50% of gross |
| Exhibitor's share, international | 55–60% of gross |
| Studio distribution fee (against participations) | 30–35% of rentals |
| Studio overhead charge | 10–15% of negative cost |
| Interest charged on negative | Prime + a margin, compounding |
| Theatrical break-even, gross vs negative | ~2–2.5× (excl. marketing) |
| All-in break-even, gross vs negative | ~3.5–4× |
| Share of studio films that are individually profitable on theatrical alone | Roughly half of wide releases, by common industry estimate |
| Typical international share of a broad tentpole's WW gross | 60–70% |
