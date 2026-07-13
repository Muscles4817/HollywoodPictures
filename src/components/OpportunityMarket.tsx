import { useMemo, useState } from 'react';
import { useStudio } from '../state/StudioContext';
import { formatGameDate } from '../engine/calendar';
import { Card } from './common/Card';
import { Button } from './common/Button';
import { Money } from './common/Money';
import { ScriptDetails } from './common/ScriptDetails';
import {
  CheckboxFilterDropdown,
  type CheckboxFilterOption,
} from './common/CheckboxFilterDropdown';

interface OpportunityMarketFilters {
  sources: Set<string>;
  priceBands: Set<string>;
}

interface AcquisitionPriceBand {
  id: string;
  label: string;
  minimum: number;
  maximum?: number;
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

  const opportunities = useMemo(
    () =>
      [...state.opportunities].sort(
        (a, b) => a.expiresOnDay - b.expiresOnDay,
      ),
    [state.opportunities],
  );

  const sourceOptions = useMemo<CheckboxFilterOption[]>(() => {
    return [
      ...new Set(
        opportunities.map((opportunity) => opportunity.source),
      ),
    ]
      .sort((a, b) => a.localeCompare(b))
      .map((source) => ({
        id: source,
        label: source,
      }));
  }, [opportunities]);

  const priceBandOptions = useMemo<CheckboxFilterOption[]>(
    () =>
      ACQUISITION_PRICE_BANDS.map((band) => ({
        id: band.id,
        label: band.label,
      })),
    [],
  );

  const [filters, setFilters] = useState<OpportunityMarketFilters>(
    () => ({
      sources: new Set(sourceOptions.map((option) => option.id)),
      priceBands: new Set(
        priceBandOptions.map((option) => option.id),
      ),
    }),
  );

  const filteredOpportunities = useMemo(() => {
    return opportunities.filter((opportunity) => {
      const matchesSource = filters.sources.has(
        opportunity.source,
      );

      const matchesPrice = ACQUISITION_PRICE_BANDS.some(
        (band) =>
          filters.priceBands.has(band.id) &&
          isPriceInBand(opportunity.acquisitionCost, band),
      );

      return matchesSource && matchesPrice;
    });
  }, [opportunities, filters]);

  const toggleFilter = (filterId: string) => {
    setOpenFilterId((current) =>
      current === filterId ? null : filterId,
    );
  };

  const closeFilters = () => {
    setOpenFilterId(null);
  };

  const setSourceFilter = (sources: Set<string>) => {
    setFilters((current) => ({
      ...current,
      sources,
    }));
  };

  const setPriceBandFilter = (priceBands: Set<string>) => {
    setFilters((current) => ({
      ...current,
      priceBands,
    }));
  };

  return (
    <div className="stack">
      <div className="row-between">
        <h1 style={{ margin: 0 }}>Opportunity Market</h1>

        <Button
          onClick={() =>
            dispatch({ type: 'RETURN_TO_DASHBOARD' })
          }
        >
          Home
        </Button>
      </div>

      <p className="choice-description" style={{ margin: 0 }}>
        Screenplays and pitches available to acquire — each one expires
        if left too long, and acquiring it charges its price immediately
        and adds it to your Asset Library, where you can develop it into
        a Project whenever you&apos;re ready.
      </p>

      {opportunities.length > 0 && (
        <div className="market-filters">
          <span className="market-filters__label">Filters</span>

          <CheckboxFilterDropdown
            id="opportunity-source"
            label="Source"
            options={sourceOptions}
            selectedIds={filters.sources}
            allSelectedLabel="All sources"
            noneSelectedLabel="No sources"
            selectedCountLabel={(count) => `${count} sources`}
            isOpen={openFilterId === 'opportunity-source'}
            onToggle={toggleFilter}
            onClose={closeFilters}
            onChange={setSourceFilter}
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
            isOpen={openFilterId === 'acquisition-price'}
            onToggle={toggleFilter}
            onClose={closeFilters}
            onChange={setPriceBandFilter}
          />
        </div>
      )}

      {opportunities.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0 }}>
            Nothing available right now — check back as time passes.
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
          {filteredOpportunities.map((opportunity) => {
            const affordable =
              state.studio.cash >= opportunity.acquisitionCost;

            return (
              <Card key={opportunity.id}>
                <div
                  className="row-between"
                  style={{ marginBottom: 4 }}
                >
                  <span className="card-tag">
                    {opportunity.source}
                  </span>

                  <span
                    style={{
                      color: 'var(--text-muted)',
                      fontSize: '0.85em',
                    }}
                  >
                    Expires{' '}
                    {formatGameDate(opportunity.expiresOnDay)}
                  </span>
                </div>

                <div className="card-title">
                  {opportunity.script.title}
                </div>

                <ScriptDetails script={opportunity.script} />

                <div
                  className="row-between"
                  style={{ marginTop: 8 }}
                >
                  <span className="key-stat-label">
                    Acquisition Price
                  </span>

                  <Money amount={opportunity.acquisitionCost} />
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
                      opportunityId: opportunity.id,
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
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}