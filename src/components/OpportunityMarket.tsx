import { useMemo, useState } from 'react';
import { useStudio } from '../state/StudioContext';
import { formatGameDate } from '../engine/calendar';
import { WEEK_LENGTH_DAYS, highestBid } from '../engine/opportunities';
import { Card } from './common/Card';
import { Button } from './common/Button';
import { Money } from './common/Money';
import { ScriptDetails } from './common/ScriptDetails';
import {
  CheckboxFilterDropdown,
  type CheckboxFilterOption,
} from './common/CheckboxFilterDropdown';
import {
  EMPTY_SCRIPT_RATINGS_FILTER,
  ScriptRatingsFilterDropdown,
  type CreativeRatingField,
  type ScriptRatingsFilterValue,
  type ToneBand,
  type ToneRatingField,
  type WritingRatingField,
} from './common/ScriptRatingsFilterDropdown';
import { useReconciledFilterSelection } from '../hooks/useReconciledFilterSelection';
import type { Opportunity, Script } from '../types';
import { calculateStarRating } from '../utils/StarRatingConversion';

interface OpportunityMarketFilters {
  priceBands: Set<string>;
  ratings: ScriptRatingsFilterValue;
}

type OpportunitySortKey = 'newest' | 'price' | 'expiring';

const SORT_OPTIONS: Array<{ value: OpportunitySortKey; label: string }> = [
  { value: 'newest', label: 'Newest' },
  { value: 'price', label: 'Acquisition Price' },
  { value: 'expiring', label: 'Expiring Soonest' },
];

function sortValue(opportunity: Opportunity, sortKey: OpportunitySortKey): number {
  switch (sortKey) {
    case 'newest': return opportunity.postedOnDay;
    case 'price': return opportunity.acquisitionCost;
    case 'expiring': return opportunity.expiresOnDay;
  }
}

interface AcquisitionPriceBand {
  id: string;
  label: string;
  minimum: number;
  maximum?: number;
}

interface ScriptRatingValues {
  writing: Record<WritingRatingField, number>;
  creative: Record<CreativeRatingField, number>;
  tone: Record<ToneRatingField, number>;
}

const ACQUISITION_PRICE_BANDS: AcquisitionPriceBand[] = [
  {
    id: 'under-100k',
    label: 'Under £100k',
    minimum: 0,
    maximum: 100_000,
  },
  {
    id: '100k-500k',
    label: '£100k – £500k',
    minimum: 100_000,
    maximum: 500_000,
  },
  {
    id: '500k-1m',
    label: '£500k – £1m',
    minimum: 500_000,
    maximum: 1_000_000,
  },
  {
    id: '1m-plus',
    label: '£1m+',
    minimum: 1_000_000,
  },
];

function isPriceInBand(
  price: number,
  band: AcquisitionPriceBand,
): boolean {
  return (
    price >= band.minimum &&
    (band.maximum === undefined || price < band.maximum)
  );
}

/**
 * Keeps knowledge of the Script data structure in one place.
 *
 * Change this function if the underlying model uses different property names
 * or nesting.
 */
function getScriptRatingValues(
  script: Script,
): ScriptRatingValues {
  return {
    writing: {
      dialogue: script.dialogue,
      characters: script.characters,
      structure: script.structure,
    },

    creative: {
      originality: script.originality,
      complexity: script.complexity,
    },

    tone: {
      action: script.toneProfile.action,
      comedy: script.toneProfile.comedy,
      romance: script.toneProfile.romance,
      suspense: script.toneProfile.suspense,
      drama: script.toneProfile.drama,
      spectacle: script.toneProfile.spectacle,
    },
  };
}

function matchesMinimumRatings<TField extends string>(
  values: Record<TField, number>,
  minimums: Partial<Record<TField, number>>,
): boolean {
  return (
    Object.entries(minimums) as Array<
      [TField, number | undefined]
    >
  ).every(([field, minimumStars]) => {
    return (
      minimumStars === undefined ||
      calculateStarRating(values[field]) >= minimumStars
    );
  });
}

function matchesToneBand(
  value: number,
  band: ToneBand,
): boolean {
  const stars = calculateStarRating(value);

  switch (band) {
    case 'low':
      return stars < 2;

    case 'medium':
      return stars >= 2 && stars < 4;

    case 'high':
      return stars >= 4;
  }
}

function matchesToneBands(
  values: Record<ToneRatingField, number>,
  selectedBands: Partial<Record<ToneRatingField, ToneBand>>,
): boolean {
  return (
    Object.entries(selectedBands) as Array<
      [ToneRatingField, ToneBand | undefined]
    >
  ).every(([field, band]) => {
    return band === undefined || matchesToneBand(values[field], band);
  });
}

function matchesScriptRatings(
  ratings: ScriptRatingValues,
  filters: ScriptRatingsFilterValue,
): boolean {
  return (
    matchesMinimumRatings(
      ratings.writing,
      filters.writingMinimums,
    ) &&
    matchesMinimumRatings(
      ratings.creative,
      filters.creativeMinimums,
    ) &&
    matchesToneBands(
      ratings.tone,
      filters.toneBands,
    )
  );
}

/**
 * The shared, time-limited pool of Opportunities (development-pipeline doc)
 * - acquiring one charges its own acquisitionCost immediately and turns it
 * into a permanently-owned Asset (ACQUIRE_OPPORTUNITY, state/studioReducer.ts).
 * The pool itself is world-level and settles lazily off the calendar
 * (engine/opportunities.ts), the same pattern the release calendar and
 * rival market already use - so this screen is a pure read/act view over
 * GameState.opportunities, nothing generated here.
 */
export function OpportunityMarket() {
  const { state, dispatch } = useStudio();

  const [openFilterId, setOpenFilterId] = useState<string | null>(
    null,
  );

  const [sortKey, setSortKey] = useState<OpportunitySortKey>('newest');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const opportunities = useMemo(
    () => {
      const sign = sortDirection === 'asc' ? 1 : -1;
      return [...state.opportunities].sort(
        (a, b) => sign * (sortValue(a, sortKey) - sortValue(b, sortKey)),
      );
    },
    [state.opportunities, sortKey, sortDirection],
  );

  // A plain, referentially-stable string array (not the {id,label}[] the
  // dropdown wants) - the dependency useReconciledFilterSelection below
  // actually needs, kept separate from sourceOptions so mapping to display
  // labels doesn't create a new array reference every render.
  const sourceIds = useMemo(
    () =>
      [...new Set(opportunities.map((opportunity) => opportunity.source))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [opportunities],
  );

  const sourceOptions = useMemo<CheckboxFilterOption[]>(
    () => sourceIds.map((source) => ({ id: source, label: source })),
    [sourceIds],
  );

  // Milestone: reconciles itself as new opportunity sources appear (e.g. a
  // background day-tick generating a fresh batch while this screen is
  // open) instead of freezing "selected sources" at whatever existed on
  // the very first render - see useReconciledFilterSelection's own doc
  // comment for the bug this replaced.
  const [selectedSources, setSelectedSources] = useReconciledFilterSelection(sourceIds);

  const priceBandOptions = useMemo<CheckboxFilterOption[]>(
    () =>
      ACQUISITION_PRICE_BANDS.map((band) => ({
        id: band.id,
        label: band.label,
      })),
    [],
  );

  const [filters, setFilters] =
    useState<OpportunityMarketFilters>(() => ({
      priceBands: new Set(
        priceBandOptions.map((option) => option.id),
      ),

      ratings: {
        writingMinimums: {
          ...EMPTY_SCRIPT_RATINGS_FILTER.writingMinimums,
        },
        creativeMinimums: {
          ...EMPTY_SCRIPT_RATINGS_FILTER.creativeMinimums,
        },
        toneBands: {
          ...EMPTY_SCRIPT_RATINGS_FILTER.toneBands,
        },
      },
    }));

  const filteredOpportunities = useMemo(() => {
    return opportunities.filter((opportunity) => {
      const matchesSource = selectedSources.has(
        opportunity.source,
      );

      const matchesPrice = ACQUISITION_PRICE_BANDS.some(
        (band) =>
          filters.priceBands.has(band.id) &&
          isPriceInBand(
            opportunity.acquisitionCost,
            band,
          ),
      );

      const scriptRatings = getScriptRatingValues(
        opportunity.script,
      );

      const matchesRatings = matchesScriptRatings(
        scriptRatings,
        filters.ratings,
      );

      return (
        matchesSource &&
        matchesPrice &&
        matchesRatings
      );
    });
  }, [opportunities, filters, selectedSources]);

  const toggleFilter = (filterId: string) => {
    setOpenFilterId((current) =>
      current === filterId ? null : filterId,
    );
  };

  const closeFilters = () => {
    setOpenFilterId(null);
  };

  const setPriceBandFilter = (
    priceBands: Set<string>,
  ) => {
    setFilters((current) => ({
      ...current,
      priceBands,
    }));
  };

  const setRatingsFilter = (
    ratings: ScriptRatingsFilterValue,
  ) => {
    setFilters((current) => ({
      ...current,
      ratings,
    }));
  };

  // Milestone: Opportunity Market bidding. Per-card draft bid amount, keyed
  // by opportunity id - lazily defaults to a small increment over whatever
  // needs beating (the current highest bid, or the listed acquisitionCost
  // if this is the player's first look at an already-contested one) rather
  // than starting every input at zero.
  const [bidAmounts, setBidAmounts] = useState<Record<string, number>>({});

  function bidFloorFor(opportunity: Opportunity): number {
    return highestBid(opportunity)?.amount ?? opportunity.acquisitionCost;
  }

  function bidAmountFor(opportunity: Opportunity): number {
    return bidAmounts[opportunity.id] ?? Math.round(bidFloorFor(opportunity) * 1.1);
  }

  const daysUntilResolution = Math.max(0, state.nextOpportunityCheckDay - state.totalDays);

  return (
    <div className="stack">
      <div className="row-between">
        <h1 style={{ margin: 0 }}>
          Opportunity Market
        </h1>

        <Button
          onClick={() =>
            dispatch({
              type: 'RETURN_TO_DASHBOARD',
            })
          }
        >
          Home
        </Button>
      </div>

      <p
        className="choice-description"
        style={{ margin: 0 }}
      >
        Screenplays and pitches available to acquire — a fresh batch
        posts every week, and rival studios shop here too. Acquiring
        an uncontested one charges its price immediately and adds it
        to your Asset Library. The moment a rival also wants the same
        one, it becomes a bidding war instead — place your own bid to
        compete, and whoever's leading when the week closes wins it,
        at their own bid.
      </p>

      {opportunities.length > 0 && (
        <div className="market-filters">
          <span className="market-filters__label">
            Filters
          </span>

          <CheckboxFilterDropdown
            id="opportunity-source"
            label="Source"
            options={sourceOptions}
            selectedIds={selectedSources}
            allSelectedLabel="All sources"
            noneSelectedLabel="No sources"
            selectedCountLabel={(count) =>
              `${count} sources`
            }
            isOpen={
              openFilterId === 'opportunity-source'
            }
            onToggle={toggleFilter}
            onClose={closeFilters}
            onChange={setSelectedSources}
          />

          <CheckboxFilterDropdown
            id="acquisition-price"
            label="Acquisition Price"
            options={priceBandOptions}
            selectedIds={filters.priceBands}
            allSelectedLabel="All prices"
            noneSelectedLabel="No prices"
            selectedCountLabel={(count) =>
              `${count} price ranges`
            }
            isOpen={
              openFilterId === 'acquisition-price'
            }
            onToggle={toggleFilter}
            onClose={closeFilters}
            onChange={setPriceBandFilter}
          />

          <ScriptRatingsFilterDropdown
            id="script-ratings"
            value={filters.ratings}
            isOpen={
              openFilterId === 'script-ratings'
            }
            onToggle={toggleFilter}
            onClose={closeFilters}
            onChange={setRatingsFilter}
          />

          <label className="stack" style={{ gap: 4 }}>
            <span className="stat-label">Sort By</span>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as OpportunitySortKey)}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <Button onClick={() => setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))}>
            {sortDirection === 'asc' ? 'Ascending ↑' : 'Descending ↓'}
          </Button>
        </div>
      )}

      {opportunities.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0 }}>
            Nothing available right now — check back as
            time passes.
          </p>
        </div>
      ) : filteredOpportunities.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0 }}>
            No opportunities match the selected filters.
          </p>
        </div>
      ) : (
        <div className="grid grid-wide">
          {filteredOpportunities.map(
            (opportunity) => {
              const affordable =
                state.studio.cash >=
                opportunity.acquisitionCost;
              const isNew =
                state.totalDays - opportunity.postedOnDay <
                WEEK_LENGTH_DAYS;
              const leader = highestBid(opportunity);
              const playerIsLeading = leader?.bidderId === 'player';
              const bidAmount = bidAmountFor(opportunity);
              const bidValid =
                bidAmount > bidFloorFor(opportunity) &&
                bidAmount <= state.studio.cash;

              return (
                <Card key={opportunity.id}>
                  <div
                    className="row-between"
                    style={{ marginBottom: 4 }}
                  >
                    <span className="row" style={{ gap: 6 }}>
                      <span className="badge">
                        {opportunity.source}
                      </span>
                      {isNew && (
                        <span className="badge badge-stage-InCinemas">
                          New This Week
                        </span>
                      )}
                    </span>

                    <span
                      style={{
                        color: 'var(--text-muted)',
                        fontSize: '0.85em',
                      }}
                    >
                      Expires{' '}
                      {formatGameDate(
                        opportunity.expiresOnDay,
                      )}
                    </span>
                  </div>

                  <div className="card-title">
                    {opportunity.script.title}
                  </div>

                  <ScriptDetails
                    script={opportunity.script}
                  />

                  {leader ? (
                    <>
                      <div
                        className="row-between"
                        style={{ marginTop: 8 }}
                      >
                        <span className="stat-label">
                          {playerIsLeading
                            ? 'You Are Leading'
                            : `Leading: ${leader.bidderName}`}
                        </span>

                        <Money amount={leader.amount} />
                      </div>

                      {playerIsLeading ? (
                        <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: '0.85em' }}>
                          Resolves in {daysUntilResolution} day{daysUntilResolution === 1 ? '' : 's'} - nothing more to do unless you're outbid.
                        </p>
                      ) : (
                        <>
                          <div className="row" style={{ marginTop: 8, gap: 8 }}>
                            <input
                              type="number"
                              min={leader.amount + 1}
                              step={1000}
                              value={bidAmount}
                              onChange={(e) =>
                                setBidAmounts((prev) => ({
                                  ...prev,
                                  [opportunity.id]: Number(e.target.value),
                                }))
                              }
                              style={{ flex: 1 }}
                              aria-label="Your bid"
                            />
                            <Button
                              variant="primary"
                              disabled={!bidValid}
                              onClick={() =>
                                dispatch({
                                  type: 'PLACE_BID',
                                  opportunityId: opportunity.id,
                                  amount: bidAmount,
                                })
                              }
                            >
                              Outbid
                            </Button>
                          </div>
                          <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: '0.85em' }}>
                            Resolves in {daysUntilResolution} day{daysUntilResolution === 1 ? '' : 's'} - highest bid wins.
                          </p>
                          {!bidValid && bidAmount <= state.studio.cash && (
                            <p style={{ color: 'var(--red)', marginTop: 6 }}>
                              Must exceed the current leading bid.
                            </p>
                          )}
                          {bidAmount > state.studio.cash && (
                            <p style={{ color: 'var(--red)', marginTop: 6 }}>
                              Can&apos;t afford this bid right now.
                            </p>
                          )}
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <div
                        className="row-between"
                        style={{ marginTop: 8 }}
                      >
                        <span className="stat-label">
                          Acquisition Price
                        </span>

                        <Money
                          amount={
                            opportunity.acquisitionCost
                          }
                        />
                      </div>

                      <Button
                        variant="primary"
                        style={{
                          marginTop: 8,
                          width: '100%',
                        }}
                        disabled={!affordable}
                        onClick={() =>
                          dispatch({
                            type: 'ACQUIRE_OPPORTUNITY',
                            opportunityId:
                              opportunity.id,
                          })
                        }
                      >
                        Acquire
                      </Button>

                      {!affordable && (
                        <p
                          style={{
                            color: 'var(--red)',
                            marginTop: 6,
                          }}
                        >
                          Can&apos;t afford this right now
                        </p>
                      )}
                    </>
                  )}
                </Card>
              );
            },
          )}
        </div>
      )}
    </div>
  );
}