import type { Film } from '../../types';
import { computeReportedLegs } from '../../state/selectors';
import { STUDIO_BOX_OFFICE_SHARE, filmMarketBreakdown } from '../../engine/boxOfficeRun';
import { Money } from './Money';
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

/** Domestic vs international geography of the gross (engine/boxOfficeRun.ts:filmMarketBreakdown), plus a nudge about overseas potential left on the table when the film never went international. */
function MarketBreakdown({ film }: { film: Film }) {
  const markets = filmMarketBreakdown(film);
  return (
    <>
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
    </>
  );
}

/**
 * The money story of one released film in one place: how it was released and
 * distributed, where the gross came from (domestic vs international), and an
 * exact gross -> your-profit waterfall that makes every deduction legible -
 * the theatrical/international split, a rented distributor's fee
 * (engine/distribution.ts), then production and marketing - rather than
 * leaving the player to reverse-engineer why "Studio's Share" isn't "Profit".
 * Shared by the post-release screen (wizard/ReleaseResults) and the Studio
 * History dossier (common/FilmDetailModal) so both tell the same story the
 * same way.
 *
 * The waterfall is exact against stored FilmResults fields: gross - theatrical
 * split - distributor fee - production - marketing == profit. The theatrical
 * split uses STUDIO_BOX_OFFICE_SHARE; the distributor's fee is whatever the
 * frozen distributionKeepShare took below that (0 for a self-distributed
 * film, where keepShare is the default share).
 */
export function FilmMoneyBreakdown({ film }: { film: Film }) {
  const r = film.results;
  const finished =
    film.boxOfficeRun.status !== 'running' && r.totalBoxOffice != null && r.studioRevenue != null && r.profit != null;
  const legs = computeReportedLegs(film);

  return (
    <div className="stack" style={{ gap: 10 }}>
      <DistributionLine film={film} />
      <MarketBreakdown film={film} />

      {finished ? (
        <>
          <div className="row">
            <StatTile label="Opening Weekend" value={<Money amount={r.openingWeekend} />} />
            {legs !== null && <StatTile label="Legs" value={`${legs.toFixed(2)}x`} />}
          </div>
          <Waterfall film={film} />
        </>
      ) : (
        <>
          <div className="row">
            <StatTile label="Opening Weekend" value={<Money amount={r.openingWeekend} />} />
            <StatTile label="Gross So Far" value={<Money amount={film.boxOfficeRun.cumulativeGross} />} />
            <StatTile label="Total Box Office" value="Still playing" />
          </div>
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
