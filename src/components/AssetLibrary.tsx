import { useMemo, useState, type Dispatch } from 'react';
import { useStudio } from '../state/StudioContext';
import { formatGameDateWithMonth } from '../engine/calendar';
import { Card } from './common/Card';
import { Button } from './common/Button';
import { ScriptDetails } from './common/ScriptDetails';
import {
  CheckboxFilterDropdown,
  type CheckboxFilterOption,
} from './common/CheckboxFilterDropdown';
import { deriveAssetStatus, type AssetStatus } from '../engine/project';
import type { GameAction } from '../state/gameState';
import type { Asset, Genre, Person } from '../types';
import './AssetLibrary.css';
import { StarRating } from './common/StarRating';
import { deriveBookedUntil, getWriterCareer, isPersonAvailableOnDay } from '../engine/person';
import { writerProfileFromPerson } from '../engine/writers';
import { describeWriter, describeRewriteProjection, describeCommissionProjection } from '../engine/writerPresentation';
import { rewriteDurationDays, rewriteFee, type RewriteKind } from '../engine/rewrite';
import { commissionDurationBounds, commissionFee, commissionProgress, commissionedOnDay, isRecentlyCommissioned } from '../engine/commission';
import { GENRES } from '../data/genres';

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

function formatMoney(amount: number): string {
  return `£${Math.round(amount).toLocaleString('en-GB')}`;
}

interface RewritePanelProps {
  asset: Asset;
  writers: Person[];
  totalDays: number;
  cash: number;
  dispatch: Dispatch<GameAction>;
  onClose: () => void;
}

/**
 * The commission form for a freelance Rewrite/Polish pass (Phase 3). Numbers
 * stay hidden behind qualitative copy - the player sees the writer's tier, what
 * they're known for, and a projected effect, not raw craft stats - with only
 * the concrete fee and duration exposed (the two things a business decision
 * genuinely needs).
 */
function RewritePanel({ asset, writers, totalDays, cash, dispatch, onClose }: RewritePanelProps) {
  const [kind, setKind] = useState<RewriteKind>('polish');
  const [writerId, setWriterId] = useState<string>('');

  const available = useMemo(
    () =>
      writers
        .filter((writer) => isPersonAvailableOnDay(writer, totalDays))
        .sort((left, right) => (getWriterCareer(right)?.skill ?? 0) - (getWriterCareer(left)?.skill ?? 0)),
    [writers, totalDays],
  );

  const writer = available.find((candidate) => candidate.id === writerId) ?? null;
  const career = writer ? getWriterCareer(writer) : null;
  const profile = writer ? writerProfileFromPerson(writer) : null;
  const fee = career ? rewriteFee(career.typicalSalary, kind) : 0;
  const days = rewriteDurationDays(kind, asset.script);
  const description = writer ? describeWriter(writer) : null;
  const projection = profile ? describeRewriteProjection(profile, asset.script, kind) : null;
  const canCommission = writer !== null && cash >= fee;

  return (
    <div className="asset-library-card__rewrite-panel stack" style={{ gap: 8, marginTop: 8 }}>
      <div className="row" style={{ gap: 6 }}>
        {(['polish', 'rewrite'] as RewriteKind[]).map((option) => (
          <Button
            key={option}
            className="btn-sm"
            variant={kind === option ? 'primary' : undefined}
            aria-pressed={kind === option}
            onClick={() => setKind(option)}
          >
            {option === 'polish' ? 'Polish' : 'Rewrite'}
          </Button>
        ))}
      </div>

      <label className="stack" style={{ gap: 4 }}>
        <span className="stat-label">Freelance writer</span>
        <select value={writerId} onChange={(event) => setWriterId(event.target.value)}>
          <option value="">Choose a writer…</option>
          {available.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.identity.name}
            </option>
          ))}
        </select>
      </label>

      {writer && description && (
        <div style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>
          <div>
            {description.tier} · {description.knownFor}
          </div>
          {projection && <div style={{ marginTop: 2 }}>{projection}.</div>}
        </div>
      )}

      <div className="row-between" style={{ fontSize: '0.85em' }}>
        <span className="stat-label">Fee</span>
        <strong>{formatMoney(fee)}</strong>
      </div>
      <div className="row-between" style={{ fontSize: '0.85em' }}>
        <span className="stat-label">Time</span>
        <strong>~{days} days</strong>
      </div>

      <div className="row" style={{ gap: 8 }}>
        <Button
          variant="primary"
          disabled={!canCommission}
          onClick={() => {
            dispatch({ type: 'REWRITE_ASSET', assetId: asset.id, kind, writerId: writer!.id });
            onClose();
          }}
        >
          Commission {kind === 'polish' ? 'Polish' : 'Rewrite'}
        </Button>
        <Button className="btn-sm" onClick={onClose}>
          Cancel
        </Button>
      </div>

      {writer && cash < fee && (
        <p style={{ color: 'var(--red)', margin: 0, fontSize: '0.85em' }}>
          Can&apos;t afford this fee right now.
        </p>
      )}
    </div>
  );
}

function topAffinityGenre(affinity: Record<Genre, number>): Genre {
  return GENRES.reduce((best, genre) => (affinity[genre] > affinity[best] ? genre : best), GENRES[0]);
}

interface CommissionPanelProps {
  writers: Person[];
  totalDays: number;
  cash: number;
  dispatch: Dispatch<GameAction>;
  onClose: () => void;
}

/**
 * The library-level form for commissioning a brand-new original screenplay
 * (Phase 4) - the inverse of the Opportunity Market. The player picks a writer
 * and a genre (pre-filled to the writer's strongest affinity); everything else
 * about the eventual script is the writer's own creative identity. Numbers stay
 * hidden behind the writer's tier/"known for"/projection - only fee and time show.
 */
function CommissionPanel({ writers, totalDays, cash, dispatch, onClose }: CommissionPanelProps) {
  const [writerId, setWriterId] = useState('');
  const [genre, setGenre] = useState<Genre | ''>('');
  const [search, setSearch] = useState('');
  const [budgetOnly, setBudgetOnly] = useState(true);

  // The full roster, annotated so the core decision has real scent - each
  // writer shows their tier, what they're known for, the fee, and whether
  // they're affordable/available up front, rather than only after selecting.
  const roster = useMemo(() => {
    const query = search.trim().toLowerCase();
    return writers
      .flatMap((person) => {
        const career = getWriterCareer(person);
        if (!career) return [];
        const fee = commissionFee(career.typicalSalary);
        const available = isPersonAvailableOnDay(person, totalDays);
        return [{
          person,
          skill: career.skill,
          fee,
          available,
          affordable: cash >= fee,
          bookedUntil: available ? null : deriveBookedUntil(person.availability.commitments) ?? null,
        }];
      })
      .filter((entry) => (query ? entry.person.identity.name.toLowerCase().includes(query) : true))
      .filter((entry) => (budgetOnly ? entry.affordable : true))
      // Selectable (available + affordable) writers first, then by skill.
      .sort((a, b) => (a.available && a.affordable ? 0 : 1) - (b.available && b.affordable ? 0 : 1) || b.skill - a.skill);
  }, [writers, totalDays, cash, search, budgetOnly]);

  const writer = writers.find((candidate) => candidate.id === writerId) ?? null;
  const career = writer ? getWriterCareer(writer) : null;
  const profile = writer ? writerProfileFromPerson(writer) : null;
  const fee = career ? commissionFee(career.typicalSalary) : 0;
  const bounds = commissionDurationBounds();
  const description = writer ? describeWriter(writer) : null;
  const projection = profile && genre ? describeCommissionProjection(profile, genre) : null;
  const canCommission = writer !== null && genre !== '' && cash >= fee;

  // Picking a writer pre-fills the brief to their strongest genre (overridable).
  const selectWriter = (person: Person) => {
    setWriterId(person.id);
    const chosenCareer = getWriterCareer(person);
    if (chosenCareer && genre === '') setGenre(topAffinityGenre(chosenCareer.genreAffinity));
  };

  return (
    <div className="card stack" style={{ gap: 8 }}>
      <h2 style={{ margin: 0, fontSize: '1.05em' }}>Commission an original screenplay</h2>
      <p className="choice-description" style={{ margin: 0 }}>
        Pay a writer to develop a brand-new original in a genre you choose — it arrives as an owned asset once they've written it. Pricier than buying from the market or rewriting what you own, but you pick the writer and the genre.
      </p>

      <div className="row-between" style={{ gap: 8, flexWrap: 'wrap' }}>
        <input
          type="search"
          value={search}
          placeholder="Search writers…"
          onChange={(event) => setSearch(event.target.value)}
          style={{ flex: 1, minWidth: 160 }}
          aria-label="Search writers"
        />
        <label className="row" style={{ gap: 6, fontSize: '0.85em' }}>
          <input type="checkbox" checked={budgetOnly} onChange={(event) => setBudgetOnly(event.target.checked)} />
          Within budget
        </label>
      </div>

      <div className="commission-roster" role="listbox" aria-label="Writers">
        {roster.length === 0 ? (
          <p className="choice-description" style={{ margin: 8 }}>
            No writers match — clear the search or turn off &ldquo;Within budget&rdquo;.
          </p>
        ) : (
          roster.map((entry) => {
            const selectable = entry.available && entry.affordable;
            const desc = describeWriter(entry.person)!;
            return (
              <button
                key={entry.person.id}
                type="button"
                role="option"
                aria-selected={entry.person.id === writerId}
                disabled={!selectable}
                className={['commission-writer-row', entry.person.id === writerId ? 'is-selected' : ''].filter(Boolean).join(' ')}
                onClick={() => selectWriter(entry.person)}
              >
                <div className="row-between">
                  <strong>{entry.person.identity.name}</strong>
                  <span>{formatMoney(entry.fee)}</span>
                </div>
                <div className="commission-writer-row__meta">{desc.tier} · {desc.knownFor}</div>
                {!entry.available && (
                  <div className="commission-writer-row__note">
                    Booked{entry.bookedUntil != null ? ` until ${formatGameDateWithMonth(entry.bookedUntil)}` : ''}
                  </div>
                )}
                {entry.available && !entry.affordable && (
                  <div className="commission-writer-row__note commission-writer-row__note--over">Over budget</div>
                )}
              </button>
            );
          })
        )}
      </div>

      <label className="stack" style={{ gap: 4 }}>
        <span className="stat-label">Genre</span>
        <select value={genre} onChange={(event) => setGenre(event.target.value as Genre)}>
          <option value="">Choose a genre…</option>
          {GENRES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      {writer && description && (
        <div style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>
          <div>
            {description.tier} · {description.knownFor}
          </div>
          {projection && <div style={{ marginTop: 2 }}>{projection}.</div>}
        </div>
      )}

      <div className="row-between" style={{ fontSize: '0.85em' }}>
        <span className="stat-label">Fee</span>
        <strong>{writer ? formatMoney(fee) : '—'}</strong>
      </div>
      <div className="row-between" style={{ fontSize: '0.85em' }}>
        <span className="stat-label">Time</span>
        <strong>~{bounds.min}–{bounds.max} days</strong>
      </div>

      <div className="row" style={{ gap: 8 }}>
        <Button
          variant="primary"
          disabled={!canCommission}
          onClick={() => {
            dispatch({ type: 'COMMISSION_SCREENPLAY', writerId: writer!.id, genre: genre as Genre });
            onClose();
          }}
        >
          Commission
        </Button>
        <Button className="btn-sm" onClick={onClose}>
          Cancel
        </Button>
      </div>

      {writer && genre === '' && (
        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.85em' }}>Choose a genre to commission.</p>
      )}
    </div>
  );
}

interface AssetCardProps {
  asset: Asset;
  status: AssetStatus;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  somethingElseFocused: boolean;
  writers: Person[];
  totalDays: number;
  cash: number;
  dispatch: Dispatch<GameAction>;
}

function AssetCard({
  asset,
  status,
  isExpanded,
  onToggleExpanded,
  somethingElseFocused,
  writers,
  totalDays,
  cash,
  dispatch,
}: AssetCardProps) {
  const writingScore = getWritingScore(asset.script);
  const creativeScore = getCreativeScore(asset.script);
  const [showRewrite, setShowRewrite] = useState(false);
  const pending = asset.pendingRewrite;
  const pendingWriter = pending ? writers.find((writer) => writer.id === pending.writerId) : undefined;
  const canDevelopScript = status.status === 'available' && !pending;

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
              {isRecentlyCommissioned(asset, totalDays) ? (
                <span className="badge" style={{ background: 'var(--accent, #4a90d9)', color: '#fff' }}>Just delivered</span>
              ) : commissionedOnDay(asset) !== null ? (
                <span className="badge">Commissioned</span>
              ) : null}
            </div>

            <span className="asset-library-card__owned-date">
              {formatGameDateWithMonth(asset.acquiredOnDay)}
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

            {pending && (
              <p className="asset-library-card__status-copy asset-library-card__status-copy--active">
                In {pending.kind === 'polish' ? 'polish' : 'rewrite'}
                {pendingWriter ? ` with ${pendingWriter.identity.name}` : ''} — ready{' '}
                {formatGameDateWithMonth(pending.readyOnDay)}.
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
                disabled={Boolean(pending)}
                title={pending ? 'A rewrite is in progress on this script.' : undefined}
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

            {canDevelopScript && (
              <Button
                aria-expanded={showRewrite}
                onClick={() => setShowRewrite((open) => !open)}
              >
                {showRewrite ? 'Close' : 'Rewrite / Polish'}
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

          {showRewrite && canDevelopScript && (
            <RewritePanel
              asset={asset}
              writers={writers}
              totalDays={totalDays}
              cash={cash}
              dispatch={dispatch}
              onClose={() => setShowRewrite(false)}
            />
          )}

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
  const [showCommission, setShowCommission] = useState(false);
  const pendingCommissions = state.studio.pendingCommissions ?? [];
  // View preference (not persisted, same as the filters/search above): collapse
  // the whole Test Scripts section so the library shows only assets the player
  // actually acquired. Reversible via the header toggle so the free scripts are
  // never lost, just tucked away.
  const [hideTestScripts, setHideTestScripts] = useState(false);

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

      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Button
          variant="primary"
          aria-expanded={showCommission}
          onClick={() => setShowCommission((open) => !open)}
        >
          {showCommission ? 'Close' : 'Commission an original screenplay'}
        </Button>
      </div>

      {showCommission && (
        <CommissionPanel
          writers={state.talentPool.Writer}
          totalDays={state.totalDays}
          cash={state.studio.cash}
          dispatch={dispatch}
          onClose={() => setShowCommission(false)}
        />
      )}

      {pendingCommissions.length > 0 && (
        <section className="card stack" style={{ gap: 10 }} aria-label="Commissions in progress">
          <h2 style={{ margin: 0, fontSize: '1.05em' }}>In commission</h2>
          {pendingCommissions.map((commission) => {
            const commissionWriter = state.talentPool.Writer.find((writer) => writer.id === commission.writerId);
            const tier = commissionWriter ? describeWriter(commissionWriter)?.tier : null;
            const progress = commissionProgress(commission, state.totalDays);
            return (
              <div key={commission.id} className="stack" style={{ gap: 4 }}>
                <div className="row-between" style={{ fontSize: '0.9em' }}>
                  <span>
                    Original {commission.genre} with <strong>{commission.writerName}</strong>
                    {tier ? <span style={{ color: 'var(--text-muted)' }}> · {tier}</span> : null}
                  </span>
                  <strong>{formatMoney(commission.fee)}</strong>
                </div>
                <div className="commission-progress" aria-hidden="true">
                  <div className="commission-progress__fill" style={{ width: `${Math.round(progress * 100)}%` }} />
                </div>
                <div style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>
                  Ready {formatGameDateWithMonth(commission.readyOnDay)}
                </div>
              </div>
            );
          })}
        </section>
      )}

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
                      writers={state.talentPool.Writer}
                      totalDays={state.totalDays}
                      cash={state.studio.cash}
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
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  flexWrap: 'wrap',
                }}
              >
                <h2 style={{ margin: 0 }}>Test Scripts</h2>
                <Button
                  className="btn-sm"
                  aria-pressed={hideTestScripts}
                  onClick={() => setHideTestScripts((hidden) => !hidden)}
                >
                  {hideTestScripts ? 'Show test scripts' : 'Hide test scripts'}
                </Button>
              </div>

              {hideTestScripts ? (
                <p className="choice-description" style={{ margin: 0 }}>
                  Test scripts are hidden. {testScriptsWithStatus.length} free
                  screenplay{testScriptsWithStatus.length === 1 ? '' : 's'} still
                  available whenever you want them.
                </p>
              ) : (
                <>
                  <p className="choice-description" style={{ margin: 0 }}>
                    Eighty-eight real, iconic screenplays — eleven per genre — free
                    to develop any time, for trying out productions without waiting
                    on the Opportunity Market.
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
                        Try another status tab, remove a filter, or broaden your
                        search.
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
                          writers={state.talentPool.Writer}
                          totalDays={state.totalDays}
                          cash={state.studio.cash}
                          dispatch={dispatch}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
