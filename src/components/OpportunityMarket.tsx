import { useMemo, useState } from 'react';
import { useStudio } from '../state/StudioContext';
import { formatGameDateWithMonth } from '../engine/calendar';
import { WEEK_LENGTH_DAYS, highestBid } from '../engine/opportunities';
import { describeWriter } from '../engine/writerPresentation';
import { describeOpportunityProvenance } from '../engine/opportunityPresentation';
import { Card } from './common/Card';
import { useActionFeedback } from './common/ActionFeedback';
import { Button } from './common/Button';
import { Money, formatMoney } from './common/Money';
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
import './OpportunityMarket.css';

/**
 * A script bought during this screen visit, held just long enough to keep its
 * card in place (see OpportunityMarket's `acquired` state).
 */
interface AcquiredSlot {
  opportunity: Opportunity;
  /** Where the card sat in the grid when it was bought - the receipt takes the same slot. */
  index: number;
  /** What was actually paid, captured at the moment of purchase. */
  paid: number;
}

/** One cell of the market grid: a live listing, or a receipt standing in for one. */
type DisplayEntry =
  | { kind: 'listing'; opportunity: Opportunity }
  | { kind: 'acquired'; slot: AcquiredSlot };

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
/**
 * The card a bought script leaves behind, in the slot its listing occupied.
 *
 * Everything the vanished listing used to prove is restated here - the title,
 * what it cost, what the studio is left holding - plus the one thing the player
 * most likely wants next. It stays until dismissed rather than fading: this
 * screen is scrolled, and a confirmation that times out while the player is
 * still thumbing down the grid is the same silence again.
 */
function AcquiredReceiptCard({
  slot,
  balance,
  onOpenLibrary,
  onDismiss,
}: {
  slot: AcquiredSlot;
  balance: number;
  onOpenLibrary: () => void;
  onDismiss: () => void;
}) {
  return (
    <Card className="opportunity-acquired">
      <div className="row-between" style={{ marginBottom: 4 }}>
        <span className="badge badge-stage-InCinemas">Acquired</span>
        <button
          type="button"
          className="opportunity-acquired__dismiss"
          onClick={onDismiss}
          aria-label={`Dismiss the receipt for ${slot.opportunity.script.title}`}
        >
          ×
        </button>
      </div>

      <div className="card-title">{slot.opportunity.script.title}</div>

      <p className="opportunity-acquired__copy">
        Yours. It has left the market and is sitting in your Asset Library, ready to develop.
      </p>

      <div className="row-between" style={{ marginTop: 8 }}>
        <span className="stat-label">Paid</span>
        <Money amount={slot.paid} />
      </div>

      <div className="row-between">
        <span className="stat-label">Balance</span>
        <Money amount={balance} />
      </div>

      <Button
        variant="primary"
        style={{ marginTop: 8, width: '100%' }}
        onClick={onOpenLibrary}
      >
        Open Asset Library
      </Button>
    </Card>
  );
}

export function OpportunityMarket() {
  const { state, dispatch } = useStudio();
  const confirmAction = useActionFeedback();

  /**
   * Scripts bought on this visit, remembered only so their card can stay put.
   *
   * Acquiring removes the Opportunity from state, so the card used to simply
   * vanish out from under the finger that tapped it - on a phone, scrolled
   * deep into the grid with neither the page heading nor the cash balance in
   * view, that is indistinguishable from a dead button. Keeping the slot and
   * turning it into a receipt means the confirmation appears exactly where the
   * player is already looking. Purely presentational and deliberately not
   * persisted: it describes this screen visit, not the studio.
   */
  const [acquired, setAcquired] = useState<AcquiredSlot[]>([]);

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

  // Author lookup by id (Phase 2: authored Opportunity Market) - the world
  // writer pool is world-level, so this resolves an opportunity's writerIds
  // reference to the Person for the "Written by ..." line, without the
  // opportunity ever carrying a copy of them.
  const writersById = useMemo(
    () => new Map(state.talentPool.Writer.map((writer) => [writer.id, writer])),
    [state.talentPool.Writer],
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

  const ownedAssetIds = useMemo(
    () => new Set(state.studio.assets.map((asset) => asset.id)),
    [state.studio.assets],
  );

  // Only ever show a receipt for a purchase that genuinely landed. The reducer
  // guards ACQUIRE_OPPORTUNITY (expired, already contested, unaffordable) and
  // no-ops rather than throwing, so an optimistic card could otherwise claim an
  // acquisition the studio never made - a worse failure than the silence this
  // whole feature exists to fix. An acquired Opportunity becomes an Asset under
  // the same id, which is what makes this checkable.
  const acquiredSlots = useMemo(
    () => acquired.filter((slot) => ownedAssetIds.has(slot.opportunity.id)),
    [acquired, ownedAssetIds],
  );

  // The grid as rendered: live listings, with each receipt spliced back into
  // the slot its listing occupied when it was bought.
  const displayEntries = useMemo<DisplayEntry[]>(() => {
    const entries: DisplayEntry[] = filteredOpportunities.map((opportunity) => ({
      kind: 'listing',
      opportunity,
    }));
    for (const slot of acquiredSlots) {
      entries.splice(Math.min(slot.index, entries.length), 0, { kind: 'acquired', slot });
    }
    return entries;
  }, [filteredOpportunities, acquiredSlots]);

  const dismissReceipt = (opportunityId: string) =>
    setAcquired((current) => current.filter((slot) => slot.opportunity.id !== opportunityId));

  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>
        Opportunity Market
      </h1>

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

      {/* Keyed off the rendered grid rather than the raw listings: buying the
          last matching script must not swap its own receipt out for an empty
          state, which is the exact disappearing act this screen is fixing. */}
      {displayEntries.length === 0 ? (
        opportunities.length === 0 ? (
          <div className="card">
            <p style={{ margin: 0 }}>
              Nothing available right now — check back as
              time passes.
            </p>
          </div>
        ) : (
          <div className="card">
            <p style={{ margin: 0 }}>
              No opportunities match the selected filters.
            </p>
          </div>
        )
      ) : (
        <div className="grid grid-wide">
          {displayEntries.map(
            (entry, entryIndex) => {
              if (entry.kind === 'acquired') {
                return (
                  <AcquiredReceiptCard
                    key={`acquired-${entry.slot.opportunity.id}`}
                    slot={entry.slot}
                    balance={state.studio.cash}
                    onOpenLibrary={() => dispatch({ type: 'VIEW_ASSET_LIBRARY' })}
                    onDismiss={() => dismissReceipt(entry.slot.opportunity.id)}
                  />
                );
              }

              const opportunity = entry.opportunity;
              const affordable =
                state.studio.cash >=
                opportunity.acquisitionCost;
              const isNew =
                state.totalDays - opportunity.postedOnDay <
                WEEK_LENGTH_DAYS;
              const leader = highestBid(opportunity);
              const playerIsLeading = leader?.bidderId === 'player';
              const authorId = opportunity.writerIds?.[0];
              const author = authorId ? writersById.get(authorId) : undefined;
              const authorDescription = author ? describeWriter(author) : null;
              const bidAmount = bidAmountFor(opportunity);
              const bidValid =
                bidAmount > bidFloorFor(opportunity) &&
                bidAmount <= state.studio.cash;

              return (
                <Card key={opportunity.id}>
                  {/* The listing's own metadata - what kind of ad this is and
                      when it closes. Set as a rule line rather than as pills:
                      it is not a property of the film, and dressing it like
                      one put ten identical badges on every card with no way to
                      tell which mattered. */}
                  <div className="classified-head">
                    <span className="classified-kind">
                      {opportunity.source}
                      {isNew && <span className="classified-new"> · New this week</span>}
                    </span>
                    <span className="classified-expiry">
                      Closes {formatGameDateWithMonth(opportunity.expiresOnDay)}
                    </span>
                  </div>

                  <h3 className="classified-title">
                    {opportunity.script.title}
                  </h3>

                  <p style={{ margin: '2px 0 6px', fontSize: '0.82em', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                    {describeOpportunityProvenance(opportunity.source, { writerName: author?.identity.name })}
                  </p>

                  {author && authorDescription && (
                    <div style={{ margin: '2px 0 6px' }}>
                      <span style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>
                        Written by{' '}
                      </span>
                      <span style={{ fontSize: '0.85em', fontWeight: 600 }}>
                        {author.identity.name}
                      </span>
                      <div style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>
                        {authorDescription.tier} · {authorDescription.knownFor}
                      </div>
                    </div>
                  )}

                  <div className="classified-price">
                    <span className="classified-price__label">Screenplay</span>
                    <span className="classified-price__value">
                      <Money amount={opportunity.script.cost} />
                    </span>
                  </div>

                  <ScriptDetails
                    script={opportunity.script}
                    showCost={false}
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
                              onClick={() => {
                                dispatch({
                                  type: 'PLACE_BID',
                                  opportunityId: opportunity.id,
                                  amount: bidAmount,
                                });
                                // No `amount` on the notice on purpose: a bid
                                // commits nothing until it wins (see the
                                // reducer's PLACE_BID), and a receipt quoting a
                                // charge and a new balance here would be a lie.
                                confirmAction({
                                  kicker: 'Bid placed',
                                  subject: opportunity.script.title,
                                  detail: `You lead at ${formatMoney(bidAmount)}. Nothing is charged unless you win, in ${daysUntilResolution} day${daysUntilResolution === 1 ? '' : 's'}.`,
                                });
                              }}
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
                        onClick={() => {
                          dispatch({
                            type: 'ACQUIRE_OPPORTUNITY',
                            opportunityId:
                              opportunity.id,
                          });
                          // The receipt in this card's own slot is the whole
                          // confirmation - no floating notice as well. The
                          // player is by definition looking at this card (they
                          // just tapped it), and the receipt already carries
                          // the title, the price and the new balance. A second,
                          // near-identical notice over the top of it is noise
                          // on a 375px viewport, not reassurance.
                          setAcquired((current) => [
                            ...current,
                            {
                              opportunity,
                              index: entryIndex,
                              paid: opportunity.acquisitionCost,
                            },
                          ]);
                        }}
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