import type { Film } from '../../types';
import { computeReportedLegs, type FilmAncillaryView } from '../../state/selectors';
import { STUDIO_BOX_OFFICE_SHARE, filmMarketBreakdown } from '../../engine/boxOfficeRun';
import { formatGameMonthYear } from '../../engine/calendar';
import { Money, formatMoney } from './Money';
import { StatTile } from './StatTile';

/** Whole-percent of an amount relative to a base, for the split labels - derived from the film's own settled numbers so a label never drifts from the figure beside it. */
function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/** One row of the gross -> your-profit waterfall. Deductions are indented and shown negative/red; subtotals and the final profit are emphasised with a rule above. */
function Line({ label, amount, kind }: { label: string; amount: number; kind: 'gross' | 'deduction' | 'subtotal' | 'total' }) {
  const emphasise = kind === 'subtotal' || kind === 'total';
  const signed = kind === 'deduction' || kind === 'total';
  return (
    <div
      className="row-between"
      style={{
        padding: '4px 0',
        paddingLeft: kind === 'deduction' ? 14 : 0,
        fontWeight: emphasise ? 600 : 400,
        borderTop: emphasise ? '1px solid var(--border)' : undefined,
      }}
    >
      <span style={kind === 'deduction' ? { color: 'var(--text-muted)' } : undefined}>{label}</span>
      <Money amount={amount} signColor={signed} showSign={signed} />
    </div>
  );
}

function DistributionLine({ film }: { film: Film }) {
  const { releaseType, releaseWindow, distributionMethod, distributorName } = film.marketingChoices;
  const viaDistributor = distributionMethod === 'distributor';
  const pAndA = film.results.distributionPAndA ?? 0;
  return (
    <div style={{ fontSize: '0.9em', color: 'var(--text-muted)' }}>
      <div>
        Release: <strong style={{ color: 'var(--text)' }}>{releaseType}</strong> &middot; {releaseWindow}
      </div>
      <div>
        Distribution:{' '}
        <strong style={{ color: 'var(--text)' }}>{viaDistributor ? (distributorName ?? 'Distributor') : 'Self-distributed'}</strong>
        {viaDistributor
          ? pAndA > 0
            ? ' — they fronted the campaign and recoup it, plus a fee off your rentals'
            : ' — a distributor, in exchange for a fee off your rentals'
          : ' — kept in-house, no distributor fee'}
      </div>
    </div>
  );
}

/**
 * The "did it draw an audience" half of a film's box office - the headline
 * reach figures a player reads first: opening weekend, worldwide gross, legs,
 * and the domestic/international geography (engine/boxOfficeRun.ts:
 * filmMarketBreakdown), plus a nudge about overseas potential left on the
 * table when the film never went international. Deliberately free of the
 * money-in/money-out waterfall (that is FilmFinancials) - "how big was it" and
 * "what did we keep" are different questions in the player's head.
 */
export function FilmPerformance({ film }: { film: Film }) {
  const r = film.results;
  const markets = filmMarketBreakdown(film);
  const legs = computeReportedLegs(film);
  const finished = film.boxOfficeRun.status !== 'running' && r.totalBoxOffice != null;

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="row">
        <StatTile label="Opening Weekend" value={<Money amount={r.openingWeekend} />} />
        {finished ? (
          <StatTile label="Worldwide" value={<Money amount={r.totalBoxOffice!} />} />
        ) : (
          <>
            <StatTile label="Gross So Far" value={<Money amount={film.boxOfficeRun.cumulativeGross} />} />
            <StatTile label="Worldwide" value="Still playing" />
          </>
        )}
        {finished && legs !== null && <StatTile label="Legs" value={`${legs.toFixed(2)}x`} />}
      </div>
      <div className="row">
        <StatTile label="Domestic" value={<Money amount={markets.domestic} />} />
        <StatTile label="International" value={markets.hasInternational ? <Money amount={markets.international} /> : 'None'} />
      </div>
      {!markets.hasInternational && (
        <p className="choice-description" style={{ margin: 0 }}>
          Domestic release only — with no international distribution, roughly <Money amount={markets.unreachedInternationalEstimate} /> of
          overseas potential went unreached. Build the International Distribution track to capture it.
        </p>
      )}
    </div>
  );
}

/**
 * The "what did the studio actually keep" half - how the film was released and
 * distributed, then an exact gross -> your-profit waterfall that makes every
 * deduction legible: the theatrical/international split, a rented distributor's
 * fee (engine/distribution.ts), then production and marketing - rather than
 * leaving the player to reverse-engineer why "Studio's Share" isn't "Profit".
 * While the run is still playing, the final split and profit are withheld
 * (they only settle at the run's end) and only the known costs are shown.
 */
export function FilmFinancials({ film, ancillary }: { film: Film; ancillary?: FilmAncillaryView | null }) {
  const r = film.results;
  const finished =
    film.boxOfficeRun.status !== 'running' && r.totalBoxOffice != null && r.studioRevenue != null && r.profit != null;

  return (
    <div className="stack" style={{ gap: 10 }}>
      <DistributionLine film={film} />
      {finished ? (
        <>
          <Waterfall film={film} />
          {ancillary && <FilmAfterlife film={film} ancillary={ancillary} />}
        </>
      ) : (
        <>
          <div className="row">
            <StatTile label="Production Cost" value={<Money amount={r.productionCost} />} />
            <StatTile label="Marketing Cost" value={<Money amount={r.marketingCost} />} />
            <StatTile label="Total Cost" value={<Money amount={r.totalCost} />} />
          </div>
          <p className="choice-description" style={{ margin: 0 }}>
            The theatrical split, any distributor fee, and your final profit settle when the run ends.
          </p>
        </>
      )}
    </div>
  );
}

/**
 * The money story of one released film in one place - performance (reach) then
 * financials (the gross -> profit waterfall). Shared by the Studio History
 * dossier (common/FilmDetailModal); the post-release Premiere screen
 * (wizard/ReleaseResults) instead places FilmPerformance and FilmFinancials in
 * two distinct cards, since "how big was it" and "what did we keep" are
 * different questions the player asks at different moments.
 *
 * The waterfall is exact against stored FilmResults fields: gross - theatrical
 * split - distributor fee - production - marketing == profit.
 */
export function FilmMoneyBreakdown({ film, ancillary }: { film: Film; ancillary?: FilmAncillaryView | null }) {
  return (
    <div className="stack" style={{ gap: 16 }}>
      <FilmPerformance film={film} />
      <FilmFinancials film={film} ancillary={ancillary} />
    </div>
  );
}

/**
 * A film's post-theatrical afterlife (engine/ancillary.ts) - the four revenue
 * windows that arrive over the months and years after its run, extending the
 * theatrical waterfall above into a lifetime figure. Amounts already banked show
 * plainly; income still to come is noted as arriving over time (it lands in the
 * cash activity feed as it settles). The prose headline is the qualitative,
 * number-free read of what this film is built to earn downstream.
 */
function FilmAfterlife({ film, ancillary }: { film: Film; ancillary: FilmAncillaryView }) {
  const { profile, outlook, pending, backend, backendParticipants, lifetimeProfit } = ancillary;
  const { catalogue } = profile;
  const backendLabel = backendParticipants.length === 1 ? `Backend — ${backendParticipants[0]}` : 'Backend participation';
  return (
    <div className="stack" style={{ gap: 0, marginTop: 6 }}>
      <div style={{ fontWeight: 600, borderTop: '1px solid var(--border)', paddingTop: 8 }}>Post-theatrical afterlife</div>
      <p className="choice-description" style={{ margin: '2px 0 6px' }}>{outlook.headline}</p>
      <Line label="Home entertainment & digital" amount={profile.homeEntertainment} kind="gross" />
      <Line label="TV & streaming licensing" amount={profile.licensing} kind="gross" />
      <Line label="Merchandising" amount={profile.merchandising} kind="gross" />
      <Line label={catalogue.years > 0 ? `Catalogue (over ~${catalogue.years} years)` : 'Catalogue'} amount={catalogue.total} kind="gross" />
      {backend < 0 && <Line label={backendLabel} amount={backend} kind="deduction" />}
      <Line label="Lifetime profit" amount={lifetimeProfit} kind="total" />
      {pending > 0 && (
        <p className="choice-description" style={{ margin: '4px 0 0' }}>
          <Money amount={pending} /> of this is still to come — it arrives over the months and years ahead and appears in
          your cash activity as each window pays.
        </p>
      )}
      <AncillaryTimeline film={film} ancillary={ancillary} />
    </div>
  );
}

/**
 * Label + colour for each revenue window on the lifetime timeline. Theatrical
 * leads (the anchor); the four ancillary windows follow it in the same order as
 * the afterlife lines above.
 *
 * Drawn from index.css's categorical tint ramp rather than from five
 * hand-picked hues. These were `hsl(...)` literals until the design-system
 * check learned to look for colours that are not hex - which meant this chart
 * kept its light-theme hues on the dark theme, where the ramp re-tones. Every
 * window keeps its own identity; it is now an identity the theme knows about.
 */
const TIMELINE_WINDOW_META: Record<string, { label: string; color: string }> = {
  theatrical: { label: 'Theatrical', color: 'var(--tint-blue-ink)' },
  homeEntertainment: { label: 'Home ent', color: 'var(--tint-green-ink)' },
  licensing: { label: 'TV & streaming', color: 'var(--tint-violet-ink)' },
  merchandising: { label: 'Merch', color: 'var(--tint-gold-ink)' },
  catalogue: { label: 'Catalogue', color: 'var(--tint-neutral-ink)' },
};

/**
 * A proportional strip of a film's whole lifetime revenue, window by window -
 * theatrical rentals plus the four post-theatrical windows, each segment sized
 * by its share and split into the portion already received (solid) and the
 * portion still scheduled (faded). The at-a-glance companion to the afterlife
 * waterfall above: where a superhero film shows a fat merch block and an Oscar
 * drama a long faded catalogue tail. Colours double as the legend.
 */
function AncillaryTimeline({ film, ancillary }: { film: Film; ancillary: FilmAncillaryView }) {
  const theatrical = film.results.studioRevenue ?? 0;
  const segments = [
    { key: 'theatrical', total: theatrical, settled: theatrical },
    ...ancillary.windows.map((w) => ({ key: w.window, total: w.total, settled: w.settled })),
  ].filter((s) => s.total > 0);
  const grand = segments.reduce((sum, s) => sum + s.total, 0);
  if (grand <= 0) return null;

  const nextDue = ancillary.windows
    .map((w) => w.nextDueDay)
    .filter((d): d is number => d != null)
    .sort((a, b) => a - b)[0];

  return (
    <div className="stack" style={{ gap: 6, marginTop: 12 }}>
      <div style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>Lifetime revenue by window</div>
      <div style={{ display: 'flex', width: '100%', height: 22, borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border)' }}>
        {segments.map((s) => {
          const meta = TIMELINE_WINDOW_META[s.key];
          const settledPct = s.total > 0 ? (s.settled / s.total) * 100 : 0;
          const scheduled = s.total - s.settled;
          const title = `${meta.label}: ${formatMoney(s.total)}${scheduled > 0 ? ` (${formatMoney(scheduled)} still scheduled)` : ''}`;
          return (
            <div key={s.key} title={title} style={{ width: `${(s.total / grand) * 100}%`, display: 'flex', minWidth: 2 }}>
              <div style={{ width: `${settledPct}%`, background: meta.color }} />
              <div style={{ width: `${100 - settledPct}%`, background: meta.color, opacity: 0.28 }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
        {segments.map((s) => {
          const meta = TIMELINE_WINDOW_META[s.key];
          return (
            <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.78em', color: 'var(--text-muted)' }}>
              <span style={{ width: 9, height: 9, borderRadius: 'var(--radius)', background: meta.color, display: 'inline-block' }} />
              {meta.label} <Money amount={s.total} />
            </span>
          );
        })}
      </div>
      <div style={{ fontSize: '0.75em', color: 'var(--text-muted)' }}>
        Solid = received &middot; faded = still to come{nextDue != null ? ` · next payment ${formatGameMonthYear(nextDue)}` : ''}
      </div>
    </div>
  );
}

/** The finished-film gross -> profit waterfall. Kept separate so the non-null narrowing below is local and the deduction sequence reads top to bottom. */
function Waterfall({ film }: { film: Film }) {
  const r = film.results;
  const gross = r.totalBoxOffice!;
  const studioShare = r.studioRevenue!;
  // Studio's headline theatrical rentals, before any distributor fee - the
  // same STUDIO_BOX_OFFICE_SHARE the engine keeps for a self-distributed film.
  const grossRentals = Math.round(gross * STUDIO_BOX_OFFICE_SHARE);
  const theatricalSplit = gross - grossRentals;
  // Everything the distributor took below the standard rentals - its percentage
  // fee plus any fronted P&A it recouped - is the gap between rentals and the
  // studio's final share; exactly 0 for a self-distributed film. The P&A recoup
  // is a known dollar figure, peeled off first, so the remainder is the fee.
  const distributorTake = Math.max(0, grossRentals - studioShare);
  const recoup = Math.min(r.distributionMarketingRecoup ?? 0, distributorTake);
  const distributorFee = distributorTake - recoup;

  return (
    <div className="stack" style={{ gap: 0 }}>
      <Line label="Total box office" amount={gross} kind="gross" />
      <Line label={`Theaters & international keep ${pct(theatricalSplit, gross)}%`} amount={-theatricalSplit} kind="deduction" />
      {distributorTake > 0 ? (
        <>
          <Line label="Box-office rentals" amount={grossRentals} kind="subtotal" />
          {distributorFee > 0 && <Line label={`Distributor's fee (${pct(distributorFee, grossRentals)}%)`} amount={-distributorFee} kind="deduction" />}
          {recoup > 0 && <Line label="Distributor P&A recouped" amount={-recoup} kind="deduction" />}
          <Line label="Your studio's share" amount={studioShare} kind="subtotal" />
        </>
      ) : (
        <Line label="Your studio's share" amount={studioShare} kind="subtotal" />
      )}
      <Line label="Production" amount={-r.productionCost} kind="deduction" />
      <Line label={r.distributionPAndA != null ? 'Marketing (press tour)' : 'Marketing'} amount={-r.marketingCost} kind="deduction" />
      <Line label="Your profit" amount={r.profit!} kind="total" />
    </div>
  );
}
