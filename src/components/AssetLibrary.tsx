import { useMemo, useState, type Dispatch } from 'react';
import { useStudio } from '../state/StudioContext';
import { formatGameDate } from '../engine/calendar';
import { Card } from './common/Card';
import { Button } from './common/Button';
import { ScriptDetails } from './common/ScriptDetails';
import {
  CheckboxFilterDropdown,
  type CheckboxFilterOption,
} from './common/CheckboxFilterDropdown';
import { deriveAssetStatus, type AssetStatus } from '../engine/project';
import type { GameAction } from '../state/gameState';
import type { Asset } from '../types';
import './AssetLibrary.css';
import { StarRating } from './common/StarRating';

const TEST_SCRIPT_ID_PREFIX = 'test-script-';

type AssetStatusFilter = 'all' | 'available' | 'in-development' | 'used';
type AssetSort =
  | 'recent'
  | 'title'
  | 'cost-desc'
  | 'writing-desc'
  | 'creative-desc'
  | 'complexity-desc';

interface AssetLibraryFilters {
  genres: Set<string>;
  sources: Set<string>;
  audiences: Set<string>;
  scales: Set<string>;
}

const STATUS_TABS: Array<{ id: AssetStatusFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'available', label: 'Available' },
  { id: 'in-development', label: 'In Development' },
  { id: 'used', label: 'Previously Used' },
];

function toFilterOptions(values: string[]): CheckboxFilterOption[] {
  return [...new Set(values)]
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({ id: value, label: value }));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getWritingScore(script: {
  dialogue: number;
  characters: number;
  structure: number;
}): number {
  return average([script.dialogue, script.characters, script.structure]);
}

function getCreativeScore(script: {
  originality: number;
  complexity: number;
}): number {
  return average([script.originality, script.complexity]);
}

function scoreToStars(value: number, max = 100): number {
  return Math.max(0, Math.min(5, Math.round((value / max) * 10) / 2));
}

type AssetWithStatus = { asset: Asset; status: AssetStatus };

interface AssetControls {
  statusFilter: AssetStatusFilter;
  filters: AssetLibraryFilters;
  /** The search box text, already trimmed and lower-cased. */
  normalizedSearch: string;
}

/**
 * Whether one asset passes the current search/status/facet controls - the
 * single predicate both the acquired-asset grid and the Test Scripts grid run,
 * so the two sections filter identically instead of the test scripts being
 * shown raw.
 */
function assetMatchesControls(
  { asset, status }: AssetWithStatus,
  { statusFilter, filters, normalizedSearch }: AssetControls,
): boolean {
  if (statusFilter !== 'all' && status.status !== statusFilter) return false;

  if (!filters.genres.has(String(asset.script.genre))) return false;
  if (!filters.sources.has(String(asset.source))) return false;
  if (!filters.audiences.has(String(asset.script.intendedAudience))) return false;
  if (!filters.scales.has(String(asset.script.scale))) return false;

  if (!normalizedSearch) return true;

  const searchableText = [
    asset.script.title,
    asset.script.synopsis,
    asset.script.genre,
    asset.script.storyType,
    asset.script.primarySetting,
    asset.script.scale,
    asset.script.intendedAudience,
    asset.source,
  ]
    .join(' ')
    .toLocaleLowerCase();

  return searchableText.includes(normalizedSearch);
}

/** A stable-per-`sortBy` ordering, shared by both grids so the sort control drives them together. */
function sortAssets(list: AssetWithStatus[], sortBy: AssetSort): AssetWithStatus[] {
  return [...list].sort((left, right) => {
    switch (sortBy) {
      case 'title':
        return left.asset.script.title.localeCompare(right.asset.script.title);

      case 'cost-desc':
        return right.asset.script.cost - left.asset.script.cost;

      case 'writing-desc':
        return getWritingScore(right.asset.script) - getWritingScore(left.asset.script);

      case 'creative-desc':
        return getCreativeScore(right.asset.script) - getCreativeScore(left.asset.script);

      case 'complexity-desc':
        return right.asset.script.complexity - left.asset.script.complexity;

      case 'recent':
      default:
        return right.asset.acquiredOnDay - left.asset.acquiredOnDay;
    }
  });
}

function CompactStarRating({ value }: { value: number }) {
  const stars = scoreToStars(value);

  return (
    <span className="asset-library-stars" title={`${stars} / 5`}>
      <StarRating value={value} />
    </span>
  );
}

interface AssetCardProps {
  asset: Asset;
  status: AssetStatus;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  somethingElseFocused: boolean;
  dispatch: Dispatch<GameAction>;
}

function AssetCard({
  asset,
  status,
  isExpanded,
  onToggleExpanded,
  somethingElseFocused,
  dispatch,
}: AssetCardProps) {
  const writingScore = getWritingScore(asset.script);
  const creativeScore = getCreativeScore(asset.script);

  return (
    <div className="asset-library-card-shell">
      <Card>
        <article
          className={[
            'asset-library-card',
            `asset-library-card--${status.status}`,
          ].join(' ')}
        >
          <header className="asset-library-card__header">
            <div className="asset-library-card__badges">
              <span
                className={`asset-status-badge asset-status-badge--${status.status}`}
              >
                {status.status === 'available' && 'Available'}
                {status.status === 'in-development' && 'In Development'}
                {status.status === 'used' && 'Previously Used'}
              </span>
              <span className="badge">{asset.source}</span>
            </div>

            <span className="asset-library-card__owned-date">
              {formatGameDate(asset.acquiredOnDay)}
            </span>
          </header>

          <div className="asset-library-card__body">
            <div>
              <h2 className="asset-library-card__title">
                {asset.script.title}
              </h2>

              <div className="asset-library-card__classification">
                <span>{asset.script.genre}</span>
                <span>{asset.script.storyType}</span>
                <span>{asset.script.scale}</span>
              </div>
            </div>

            <p className="asset-library-card__synopsis">
              {asset.script.synopsis}
            </p>

            <div className="asset-library-card__metrics">
              <div>
                <span>Writing</span>
                <CompactStarRating value={writingScore} />
              </div>
              <div>
                <span>Creative</span>
                <CompactStarRating value={creativeScore} />
              </div>
              <div>
                <span>Audience</span>
                <strong>{asset.script.intendedAudience}</strong>
              </div>
              <div>
                <span>Cast</span>
                <strong>
                  {asset.script.requiredLeads} lead
                  {asset.script.requiredLeads === 1 ? '' : 's'} ·{' '}
                  {asset.script.requiredSupporting} support
                </strong>
              </div>
            </div>

            <div className="asset-library-card__cost-row">
              <span>Screenplay cost</span>
              <strong>£{asset.script.cost.toLocaleString('en-GB')}</strong>
            </div>

            {status.status === 'in-development' && (
              <p className="asset-library-card__status-copy asset-library-card__status-copy--active">
                A project based on this asset is currently underway.
              </p>
            )}

            {status.status === 'used' && (
              <p className="asset-library-card__status-copy">
                Used for {status.projectIds.length} released film
                {status.projectIds.length === 1 ? '' : 's'}.
              </p>
            )}

            {isExpanded && (
              <div className="asset-library-card__details">
                <ScriptDetails script={asset.script} />
              </div>
            )}
          </div>

          <footer className="asset-library-card__footer">
            <button
              type="button"
              className="asset-library-details-button"
              aria-expanded={isExpanded}
              onClick={onToggleExpanded}
            >
              {isExpanded ? 'Hide details' : 'View details'}
            </button>

            {status.status === 'available' && (
              <Button
                variant="primary"
                onClick={() =>
                  dispatch({
                    type: 'CREATE_PROJECT_FROM_ASSET',
                    assetId: asset.id,
                  })
                }
              >
                Start Development
              </Button>
            )}

            {status.status === 'in-development' && (
              <Button
                variant="primary"
                disabled={somethingElseFocused}
                title={
                  somethingElseFocused
                    ? 'Leave the project currently in focus before opening this one.'
                    : undefined
                }
                onClick={() =>
                  dispatch({
                    type: 'RESUME_PROJECT',
                    projectId: status.projectId,
                  })
                }
              >
                Open Project
              </Button>
            )}

            {status.status === 'used' && (
              <span className="asset-library-card__archived-label">
                Archive asset
              </span>
            )}
          </footer>

          {status.status === 'in-development' && somethingElseFocused && (
            <p className="asset-library-card__blocked-note">
              Another project is currently in focus.
            </p>
          )}
        </article>
      </Card>
    </div>
  );
}

/**
 * Every owned Asset (development-pipeline doc) - acquired from the
 * Opportunity Market and permanently the studio's, whether or not it ever
 * becomes a Project. Status is derived from GameState.projects rather than
 * duplicated on the Asset itself.
 */
export function AssetLibrary() {
  const { state, dispatch } = useStudio();
  const somethingElseFocused = state.focusedProjectId !== null;

  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<AssetStatusFilter>('available');
  const [sortBy, setSortBy] = useState<AssetSort>('recent');
  const [openFilterId, setOpenFilterId] = useState<string | null>(null);
  const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null);

  const assetsWithStatus = useMemo(
    () =>
      state.studio.assets
        .filter((asset) => !asset.id.startsWith(TEST_SCRIPT_ID_PREFIX))
        .map((asset) => ({
          asset,
          status: deriveAssetStatus(asset, state.projects),
        })),
    [state.projects, state.studio.assets],
  );

  const testScriptsWithStatus = useMemo(
    () =>
      state.studio.assets
        .filter((asset) => asset.id.startsWith(TEST_SCRIPT_ID_PREFIX))
        .map((asset) => ({
          asset,
          status: deriveAssetStatus(asset, state.projects),
        }))
        .sort((left, right) =>
          left.asset.script.title.localeCompare(right.asset.script.title),
        ),
    [state.projects, state.studio.assets],
  );

  // Facet options are drawn from both the acquired library and the Test
  // Scripts, so a value that only a test script carries (e.g. a genre the
  // player has never acquired) is still a selectable filter - otherwise the
  // default "all options selected" set would silently exclude every test
  // script of that value.
  const filterableAssets = useMemo(
    () => [...assetsWithStatus, ...testScriptsWithStatus],
    [assetsWithStatus, testScriptsWithStatus],
  );

  const genreOptions = useMemo(
    () =>
      toFilterOptions(
        filterableAssets.map(({ asset }) => String(asset.script.genre)),
      ),
    [filterableAssets],
  );

  const sourceOptions = useMemo(
    () =>
      toFilterOptions(
        filterableAssets.map(({ asset }) => String(asset.source)),
      ),
    [filterableAssets],
  );

  const audienceOptions = useMemo(
    () =>
      toFilterOptions(
        filterableAssets.map(({ asset }) =>
          String(asset.script.intendedAudience),
        ),
      ),
    [filterableAssets],
  );

  const scaleOptions = useMemo(
    () =>
      toFilterOptions(
        filterableAssets.map(({ asset }) => String(asset.script.scale)),
      ),
    [filterableAssets],
  );

  const [filters, setFilters] = useState<AssetLibraryFilters>(() => ({
    genres: new Set(genreOptions.map((option) => option.id)),
    sources: new Set(sourceOptions.map((option) => option.id)),
    audiences: new Set(audienceOptions.map((option) => option.id)),
    scales: new Set(scaleOptions.map((option) => option.id)),
  }));

  const statusCounts = useMemo(() => {
    const counts: Record<AssetStatusFilter, number> = {
      all: assetsWithStatus.length,
      available: 0,
      'in-development': 0,
      used: 0,
    };

    for (const { status } of assetsWithStatus) {
      counts[status.status] += 1;
    }

    return counts;
  }, [assetsWithStatus]);

  const normalizedSearch = searchText.trim().toLocaleLowerCase();

  const visibleAssets = useMemo(
    () =>
      sortAssets(
        assetsWithStatus.filter((entry) =>
          assetMatchesControls(entry, { statusFilter, filters, normalizedSearch }),
        ),
        sortBy,
      ),
    [assetsWithStatus, filters, normalizedSearch, sortBy, statusFilter],
  );

  // The Test Scripts grid runs the exact same controls as the acquired grid.
  const visibleTestScripts = useMemo(
    () =>
      sortAssets(
        testScriptsWithStatus.filter((entry) =>
          assetMatchesControls(entry, { statusFilter, filters, normalizedSearch }),
        ),
        sortBy,
      ),
    [testScriptsWithStatus, filters, normalizedSearch, sortBy, statusFilter],
  );

  const toggleFilter = (filterId: string) => {
    setOpenFilterId((current) =>
      current === filterId ? null : filterId,
    );
  };

  const closeFilters = () => {
    setOpenFilterId(null);
  };

  const toggleExpandedAsset = (assetId: string) => {
    setExpandedAssetId((current) => (current === assetId ? null : assetId));
  };

  const clearAllFilters = () => {
    setSearchText('');
    setStatusFilter('all');
    setFilters({
      genres: new Set(genreOptions.map((option) => option.id)),
      sources: new Set(sourceOptions.map((option) => option.id)),
      audiences: new Set(audienceOptions.map((option) => option.id)),
      scales: new Set(scaleOptions.map((option) => option.id)),
    });
  };

  return (
    <div className="stack asset-library">
      <div>
        <h1 style={{ margin: 0 }}>Asset Library</h1>
        <p className="asset-library__summary">
          {statusCounts.all} asset{statusCounts.all === 1 ? '' : 's'} ·{' '}
          {statusCounts.available} available ·{' '}
          {statusCounts['in-development']} in development ·{' '}
          {statusCounts.used} previously used
        </p>
      </div>

      <p className="choice-description" style={{ margin: 0 }}>
        Browse acquired screenplays, compare their creative and production
        profiles, and choose what your studio should develop next. Assets remain
        yours permanently, even when a pre-greenlight project is abandoned.
      </p>

      {filterableAssets.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0 }}>
            Nothing owned yet — acquire something from the Opportunity Market
            first.
          </p>
        </div>
      ) : (
        <>
          <section className="asset-library-controls" aria-label="Asset filters">
            <div className="asset-library-controls__top-row">
              <label className="asset-library-search">
                <span className="sr-only">Search assets</span>
                <input
                  type="search"
                  value={searchText}
                  placeholder="Search title, synopsis, genre…"
                  onChange={(event) => setSearchText(event.target.value)}
                />
              </label>

              <label className="asset-library-sort">
                <span>Sort</span>
                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as AssetSort)}
                >
                  <option value="recent">Recently acquired</option>
                  <option value="title">Title</option>
                  <option value="cost-desc">Screenplay cost</option>
                  <option value="writing-desc">Writing quality</option>
                  <option value="creative-desc">Creative quality</option>
                  <option value="complexity-desc">Complexity</option>
                </select>
              </label>
            </div>

            <div className="asset-library-status-tabs" role="tablist">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === tab.id}
                  className={[
                    'asset-library-status-tab',
                    statusFilter === tab.id
                      ? 'asset-library-status-tab--active'
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => setStatusFilter(tab.id)}
                >
                  {tab.label}
                  <span>{statusCounts[tab.id]}</span>
                </button>
              ))}
            </div>

            <div className="asset-library-filter-row">
              <span className="asset-library-filter-row__label">Filters</span>

              <CheckboxFilterDropdown
                id="asset-genre"
                label="Genre"
                options={genreOptions}
                selectedIds={filters.genres}
                allSelectedLabel="All genres"
                noneSelectedLabel="No genres"
                selectedCountLabel={(count) => `${count} genres`}
                isOpen={openFilterId === 'asset-genre'}
                onToggle={toggleFilter}
                onClose={closeFilters}
                onChange={(genres) =>
                  setFilters((current) => ({ ...current, genres }))
                }
              />

              <CheckboxFilterDropdown
                id="asset-source"
                label="Source"
                options={sourceOptions}
                selectedIds={filters.sources}
                allSelectedLabel="All sources"
                noneSelectedLabel="No sources"
                selectedCountLabel={(count) => `${count} sources`}
                isOpen={openFilterId === 'asset-source'}
                onToggle={toggleFilter}
                onClose={closeFilters}
                onChange={(sources) =>
                  setFilters((current) => ({ ...current, sources }))
                }
              />

              <CheckboxFilterDropdown
                id="asset-audience"
                label="Audience"
                options={audienceOptions}
                selectedIds={filters.audiences}
                allSelectedLabel="All audiences"
                noneSelectedLabel="No audiences"
                selectedCountLabel={(count) => `${count} audiences`}
                isOpen={openFilterId === 'asset-audience'}
                onToggle={toggleFilter}
                onClose={closeFilters}
                onChange={(audiences) =>
                  setFilters((current) => ({ ...current, audiences }))
                }
              />

              <CheckboxFilterDropdown
                id="asset-scale"
                label="Scale"
                options={scaleOptions}
                selectedIds={filters.scales}
                allSelectedLabel="All scales"
                noneSelectedLabel="No scales"
                selectedCountLabel={(count) => `${count} scales`}
                isOpen={openFilterId === 'asset-scale'}
                onToggle={toggleFilter}
                onClose={closeFilters}
                onChange={(scales) =>
                  setFilters((current) => ({ ...current, scales }))
                }
              />

              <button
                type="button"
                className="asset-library-clear-filters"
                onClick={clearAllFilters}
              >
                Reset
              </button>
            </div>
          </section>

          {assetsWithStatus.length === 0 ? (
            <div className="card">
              <p style={{ margin: 0 }}>
                You haven't acquired any screenplays yet — pick one up from the
                Opportunity Market. The free Test Scripts below are always
                available to develop, and respond to the filters above.
              </p>
            </div>
          ) : (
            <>
              <div className="asset-library-results-heading">
                <span>
                  Showing {visibleAssets.length} of {assetsWithStatus.length}
                </span>
              </div>

              {visibleAssets.length === 0 ? (
                <div className="card asset-library-empty-filtered">
                  <h2>No matching assets</h2>
                  <p>
                    Try another status tab, remove a filter, or broaden your search.
                  </p>
                  <Button onClick={clearAllFilters}>Reset filters</Button>
                </div>
              ) : (
                <div className="asset-library-grid">
                  {visibleAssets.map(({ asset, status }) => (
                    <AssetCard
                      key={asset.id}
                      asset={asset}
                      status={status}
                      isExpanded={expandedAssetId === asset.id}
                      onToggleExpanded={() => toggleExpandedAsset(asset.id)}
                      somethingElseFocused={somethingElseFocused}
                      dispatch={dispatch}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {testScriptsWithStatus.length > 0 && (
            <section
              className="asset-library-test-scripts"
              aria-label="Test scripts"
            >
              <h2 style={{ margin: 0 }}>Test Scripts</h2>
              <p className="choice-description" style={{ margin: 0 }}>
                Eighty-eight real, iconic screenplays — eleven per genre — free to
                develop any time, for trying out productions without waiting on the
                Opportunity Market.
              </p>

              <div className="asset-library-results-heading">
                <span>
                  Showing {visibleTestScripts.length} of{' '}
                  {testScriptsWithStatus.length}
                </span>
              </div>

              {visibleTestScripts.length === 0 ? (
                <div className="card asset-library-empty-filtered">
                  <h2>No matching test scripts</h2>
                  <p>
                    Try another status tab, remove a filter, or broaden your search.
                  </p>
                  <Button onClick={clearAllFilters}>Reset filters</Button>
                </div>
              ) : (
                <div className="asset-library-grid">
                  {visibleTestScripts.map(({ asset, status }) => (
                    <AssetCard
                      key={asset.id}
                      asset={asset}
                      status={status}
                      isExpanded={expandedAssetId === asset.id}
                      onToggleExpanded={() => toggleExpandedAsset(asset.id)}
                      somethingElseFocused={somethingElseFocused}
                      dispatch={dispatch}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
