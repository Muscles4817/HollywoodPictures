import { useState } from 'react';
import { useStudio } from '../../state/StudioContext';
import { MANDATORY_TALENT_ROLES, OPTIONAL_TALENT_ROLES } from '../../data/talentGeneration';
import { TALENT_PRESENTATION, type RoleCategory } from '../../data/talentPresentation';
import { effectiveRoleCapacity } from '../../engine/castRequirements';
import { castingGenderLabel, castingAgeBandLabel } from '../../engine/casting';
import { computeCommittedSpend, deriveFocusedDraft } from '../../state/selectors';
import { computeTalentCompatibility } from '../../engine/compatibility';
import { computeTalentCost } from '../../engine/cost';
import { dominantLean, explainEffectsStrategy, explainEnvironmentStrategy } from '../../engine/recommendation';
import { synthesizeProductionIdentity } from '../../engine/productionIdentity';
import { describeCharacterDemands } from '../../engine/scriptPresentation';
import { deriveProjectReadiness } from '../../engine/projectReadiness';
import { toneProfileBreakdown } from '../../data/tones';
import { CHARACTER_ARCHETYPE_LABELS } from '../../data/scriptTagLabels';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { RangeSlider } from '../common/RangeSlider';
import { ScoreBar } from '../common/ScoreBar';
import { Money, formatMoney } from '../common/Money';
import { CompatibilityBadge } from '../common/CompatibilityBadge';
import { RoleHiringDrawer } from './RoleHiringDrawer';
import { CastingDrawer } from './CastingDrawer';
import { findAssignedPerson } from '../../data/helpers';
import { getCareerForRole, getDirectorCareer, getTypicalSalaryForRole } from '../../engine/person';
import { deriveStaffingBoard, STAFFING_STAGE_LABELS, type StaffingRow } from '../../state/staffingBoard';
import type { EffectsMethodKey, EnvironmentMethodKey, FilmDraft, Person, ProductionRole, Script, ScriptCharacter } from '../../types';

const MASTER_BUDGET_RANGE = { min: 300_000, max: 30_000_000 };
const DEFAULT_MASTER_BUDGET = 3_000_000;

const ENV_LEAN_SHORT: Record<EnvironmentMethodKey, string> = { studio: 'studio', location: 'location', digital: 'digital worldbuilding' };
const EFFECTS_LEAN_SHORT: Record<EffectsMethodKey, string> = { practical: 'practical effects', digital: 'digital effects' };

/** A one-line tile summary of whoever's hired, role-category-aware - a condensed cousin of RoleHiringDrawer's fuller candidate stats. */
function tileHeadline(person: Person, role: ProductionRole, category: RoleCategory): string {
  const career = getCareerForRole(person, role);
  if (category === 'director' && career && 'productionStyle' in career) {
    const env = dominantLean(career.productionStyle.environmentStrategy);
    const fx = dominantLean(career.productionStyle.effectsStrategy);
    return `Leans ${ENV_LEAN_SHORT[env.key]}, ${EFFECTS_LEAN_SHORT[fx.key]}`;
  }
  if (category === 'actor') return `Fame ${person.reputation.fame}`;
  return career && 'skill' in career ? `Skill ${career.skill}` : '';
}

// Workstream I, Phase 2a - the live Cast & Crew staffing board: the central
// dashboard for the whole production. One row per role (actor character or crew
// head), each on the same staffing lifecycle (state/staffingBoard.ts), with its
// budget allocation + lock (subsuming Phase 1b's allocation table), a compact
// progress read, over-budget warning, and direct navigation into the relevant
// hiring/casting flow. Suitability / compatibility / department reads are left as
// documented extension points (state/staffingBoard.ts) - rendered only once those
// Workstream II systems populate them, never mocked here.
function progressSummary(row: StaffingRow): string {
  if (row.stage === 'attached') return `✓ ${row.attached.join(', ')}`;
  if (row.stage === 'negotiating') {
    return `Offer out${row.counts.counters > 0 ? ` - ${row.counts.counters} counter${row.counts.counters === 1 ? '' : 's'}` : ''}`;
  }
  const parts: string[] = [];
  if (row.counts.applicants > 0) parts.push(`${row.counts.applicants} applicant${row.counts.applicants === 1 ? '' : 's'}`);
  if (row.counts.shortlist > 0) parts.push(`${row.counts.shortlist} shortlisted`);
  if (row.counts.auditions > 0) parts.push(`${row.counts.auditionsReady}/${row.counts.auditions} audition${row.counts.auditions === 1 ? '' : 's'}`);
  if (row.activeSearch && row.counts.applicants === 0) parts.push('call open');
  return parts.length > 0 ? parts.join(' · ') : '—';
}

function StaffingBoardSection({
  draft,
  onOpenCharacter,
  onOpenRole,
}: {
  draft: FilmDraft;
  onOpenCharacter: (character: ScriptCharacter, role: 'Lead Actor' | 'Supporting Actor') => void;
  onOpenRole: (role: ProductionRole) => void;
}) {
  const { state, dispatch } = useStudio();
  const board = deriveStaffingBoard(draft, state.totalDays);
  const plannedStartDay = state.totalDays + board.plannedStartOffsetDays;
  const charById = new Map((draft.script?.cast ?? []).map((c) => [c.id, c] as const));

  const openRow = (row: StaffingRow) => {
    if (row.characterId) {
      const character = charById.get(row.characterId);
      if (character) onOpenCharacter(character, row.role as 'Lead Actor' | 'Supporting Actor');
    } else {
      onOpenRole(row.role);
    }
  };

  return (
    <div className="staffing-board">
      <div className="staffing-board__window">
        {board.plannedStartOffsetDays > 0
          ? <>Shoot planned to start <strong>day {plannedStartDay}</strong> - delayed {board.plannedStartOffsetDays} day{board.plannedStartOffsetDays === 1 ? '' : 's'} to wait on booked talent.</>
          : <>Shoot begins as soon as the cast is set.</>}
      </div>
      <table>
        <thead>
          <tr>
            <th>Role</th><th>Status</th><th>Progress</th><th>Planned</th><th>Committed</th><th>Remaining</th><th aria-label="Lock" /><th aria-label="Open" />
          </tr>
        </thead>
        <tbody>
          {board.rows.map((row) => (
            <tr key={row.key} className={row.warnings.includes('over-budget') ? 'staffing-row--warn' : undefined}>
              <td>{row.label}{row.optional ? ' (optional)' : ''}</td>
              <td><span className={`staffing-stage staffing-stage--${row.stage}`}>{STAFFING_STAGE_LABELS[row.stage]}</span></td>
              <td className="staffing-progress">{progressSummary(row)}</td>
              <td><Money amount={row.budget.planned} /></td>
              <td><Money amount={row.budget.committed} /></td>
              <td className={row.warnings.includes('over-budget') ? 'staffing-overbudget' : undefined}><Money amount={row.budget.remaining} /></td>
              <td>
                <button
                  type="button"
                  className="allocation-lock"
                  aria-label={`${row.budget.locked ? 'Unlock' : 'Lock'} ${row.role} budget`}
                  aria-pressed={row.budget.locked}
                  title={row.budget.locked ? 'Locked - reserved against the auto-split' : 'Lock to reserve this allocation against the auto-split'}
                  onClick={() => dispatch({ type: 'SET_ROLE_BUDGET_LOCK', role: row.role, locked: !row.budget.locked })}
                >
                  {row.budget.locked ? '🔒' : '🔓'}
                </button>
              </td>
              <td><Button className="btn-sm" onClick={() => openRow(row)}>Open</Button></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><td colSpan={3}>Total</td><td><Money amount={board.totalPlanned} /></td><td><Money amount={board.totalCommitted} /></td><td><Money amount={board.totalRemaining} /></td><td colSpan={2} /></tr>
        </tfoot>
      </table>
      <p className="staffing-board__note">Every role's staffing at a glance - open any to search, audition, negotiate or hire. Lock a budget to keep its share when the rest rebalance. Suitability, compatibility and department reads will surface here as those systems come online.</p>
    </div>
  );
}

function RoleTile({ role, optional, onOpen }: { role: ProductionRole; optional: boolean; onOpen: () => void }) {
  const { state } = useStudio();
  const draft = deriveFocusedDraft(state)!;
  const profile = TALENT_PRESENTATION[role];
  const capacity = effectiveRoleCapacity(role, draft.script);
  const hired = draft.talent.filter((a) => a.role === role).map((a) => a.person);
  const isMulti = capacity.max > 1;
  const filled = hired.length >= capacity.min;

  return (
    <Card selectable onClick={onOpen}>
      <div className="row-between">
        <div className="card-title">{role}{optional ? ' (optional)' : ''}</div>
        {isMulti && <span className="badge">{hired.length}/{capacity.max}</span>}
      </div>
      {hired.length === 0 ? (
        <>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 8px', fontSize: '0.85em' }}>{profile.hook}</p>
          <p style={{ margin: 0, color: filled ? 'var(--text)' : 'var(--red)' }}>{optional ? 'Not hired' : 'Not yet hired'}</p>
        </>
      ) : isMulti ? (
        <div className="stack" style={{ gap: 2 }}>
          {hired.map((h) => (
            <div key={h.id} className="row-between">
              <span>{h.identity.name}</span>
              <span style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>{tileHeadline(h, role, profile.category)}</span>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="card-title" style={{ fontSize: '1em', marginBottom: 2 }}>{hired[0].identity.name}</div>
          <div style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>
            {tileHeadline(hired[0], role, profile.category)} &middot; <Money amount={getTypicalSalaryForRole(hired[0], role)} />
          </div>
        </>
      )}
    </Card>
  );
}

/**
 * Casting Redesign, Phase A (docs/DESIGN_REVIEW_casting_redesign.md
 * section 8) - one row per Lead/Supporting `ScriptCharacter` instead of an
 * aggregate "Lead Actor 0/4" tile, so the player reads this section as "who
 * plays our villain" rather than "how many of role slot #2 are filled."
 * Whoever plays this Character is read live off `draft.talent` by its
 * explicit binding (`characterId`, docs/DESIGN_REVIEW_casting_slot_binding.md),
 * so every Character is independently castable in any order and recasting one
 * never disturbs the rest - no positional bookkeeping on the row itself.
 */
function CharacterCastingRow({
  character,
  role,
  onOpen,
}: {
  character: ScriptCharacter;
  role: 'Lead Actor' | 'Supporting Actor';
  onOpen: () => void;
}) {
  const { state } = useStudio();
  const draft = deriveFocusedDraft(state)!;
  // Slot-bound casting (docs/DESIGN_REVIEW_casting_slot_binding.md): every
  // Character is independently castable in any order, so this row just reflects
  // whoever's bound to it (if anyone) - no "wait your turn" state any more.
  const cast = draft.talent.find((a) => a.role === role && a.characterId === character.id)?.person ?? null;

  return (
    <Card selectable onClick={onOpen}>
      <div className="row-between">
        <div className="card-title">{character.name}</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {character.castingGender && character.castingGender !== 'Any' && (
            <span className="badge" title="Only actors of this gender can be cast in this role.">
              {castingGenderLabel(character.castingGender)}
            </span>
          )}
          {character.castingAgeBand && character.castingAgeBand !== 'Any' && (
            <span className="badge" title="The age this role is written for. Casting well outside it is a stretch that costs role-fit; a wildly wrong age can't be cast.">
              {castingAgeBandLabel(character.castingAgeBand)}
            </span>
          )}
          <span className="badge">{character.prominence} &middot; {CHARACTER_ARCHETYPE_LABELS[character.archetype]}</span>
        </div>
      </div>
      <p style={{ color: 'var(--text-muted)', margin: '4px 0 8px', fontSize: '0.85em' }}>{describeCharacterDemands(character)}</p>
      {cast ? (
        <div style={{ fontSize: '0.85em' }}>
          <div className="card-title" style={{ fontSize: '1em', marginBottom: 2 }}>{cast.identity.name}</div>
          <div style={{ color: 'var(--text-muted)' }}>
            Fame {cast.reputation.fame} &middot; <Money amount={getTypicalSalaryForRole(cast, role)} />
          </div>
        </div>
      ) : (
        <p style={{ margin: 0, color: 'var(--red)' }}>Not yet cast</p>
      )}
    </Card>
  );
}

/** Every Lead/Supporting Character in cast order - Minor characters aren't cast at all (see types/index.ts:Script.cast), so they're excluded here entirely rather than shown as permanently uncastable rows. */
function castableCharacters(script: Script): Array<{ character: ScriptCharacter; role: 'Lead Actor' | 'Supporting Actor' }> {
  const leads = script.cast.filter((c) => c.prominence === 'Lead');
  const supporting = script.cast.filter((c) => c.prominence === 'Supporting');
  return [
    ...leads.map((character) => ({ character, role: 'Lead Actor' as const })),
    ...supporting.map((character) => ({ character, role: 'Supporting Actor' as const })),
  ];
}

/**
 * Replaces the old aggregate "Lead Actor"/"Supporting Actor" tiles with one
 * row per Character - "We're still looking for our villain," not "Lead
 * Actor 0/1" (Casting Redesign design review, section 8/Additional Notes
 * point 1). Opening a row now opens Open Casting/Direct Approach for that
 * specific Character (components/wizard/CastingDrawer.tsx), not the old
 * shared-per-role RoleHiringDrawer Phase A used as a stopgap.
 */
function CharacterCastingSection({
  script,
  onOpenCharacter,
}: {
  script: Script;
  onOpenCharacter: (character: ScriptCharacter, role: 'Lead Actor' | 'Supporting Actor') => void;
}) {
  const entries = castableCharacters(script);
  if (entries.length === 0) return null;
  return (
    <div className="stack">
      <h3 style={{ margin: 0 }}>Cast</h3>
      <div className="grid">
        {entries.map(({ character, role }) => (
          <CharacterCastingRow
            key={character.id}
            character={character}
            role={role}
            onOpen={() => onOpenCharacter(character, role)}
          />
        ))}
      </div>
    </div>
  );
}

export function HireTalent() {
  const { state, dispatch } = useStudio();
  const draft = deriveFocusedDraft(state)!;
  // The master budget lives on the draft (FilmDraft.castCrewBudget) so it
  // persists and every subsequent hire can re-split the remainder against it
  // (engine/castBudget.ts); the slider just reflects it, defaulting until the
  // player first moves it.
  const masterBudget = draft.castCrewBudget ?? DEFAULT_MASTER_BUDGET;
  const [openRole, setOpenRole] = useState<ProductionRole | null>(null);
  // Casting Redesign, Phase B - separate from `openRole` above (which still
  // drives Director/crew's unchanged RoleHiringDrawer flow) since Open
  // Casting is scoped to one specific Character, not a whole role.
  const [openCharacter, setOpenCharacter] = useState<{ character: ScriptCharacter; role: 'Lead Actor' | 'Supporting Actor' } | null>(null);

  function talentsForRole(role: ProductionRole): Person[] {
    return draft.talent.filter((a) => a.role === role).map((a) => a.person);
  }

  // Role-agnostic aggregates - flattened once, ignoring which slot each hire is in.
  const allTalent = draft.talent.map((a) => a.person);

  const totalSalary = computeTalentCost(draft.talent);
  const missingMandatory = MANDATORY_TALENT_ROLES.filter(
    (role) => talentsForRole(role).length < effectiveRoleCapacity(role, draft.script).min,
  );
  const filledMandatoryCount = MANDATORY_TALENT_ROLES.length - missingMandatory.length;
  const committedSpend = computeCommittedSpend(draft, state.producerPool ?? [], state.stuntTeamPool ?? []);
  const canAfford = state.studio.cash >= committedSpend;

  function handleMasterBudgetChange(value: number) {
    dispatch({ type: 'SET_TALENT_BUDGET_SPLIT', totalBudget: value });
  }

  // Evolving Production Identity - the exact same synthesis Plan Production
  // uses later (engine/productionIdentity.ts), shown as soon as it's
  // computable (script + a director) rather than waiting for that screen -
  // both Strategy recommendations only ever needed those two things.
  const director = findAssignedPerson(draft.talent, 'Director');
  const directorCareer = director && getDirectorCareer(director);
  const identity =
    draft.script && directorCareer
      ? synthesizeProductionIdentity(draft.script, explainEnvironmentStrategy(draft.script, directorCareer), explainEffectsStrategy(draft.script, directorCareer))
      : null;

  // Soft quality warnings - informational, never block Continue (missing
  // roles and affordability already do that below). Both need at least a
  // couple of hires before they mean anything, so an almost-empty cast
  // doesn't trip a false alarm.
  const compatScores = draft.talent
    .map((a) => (draft.script ? computeTalentCompatibility(a.person, a.role, draft.script) : null))
    .filter((s): s is number => s !== null);
  const avgCompat = compatScores.length > 0 ? compatScores.reduce((a, b) => a + b, 0) / compatScores.length : null;
  const lowCompatWarning = compatScores.length >= 2 && avgCompat !== null && avgCompat < 45;

  const avgReliability = allTalent.length > 0 ? allTalent.reduce((s, t) => s + t.reputation.reliability, 0) / allTalent.length : null;
  const avgEgo = allTalent.length > 0 ? allTalent.reduce((s, t) => s + t.personality.ego, 0) / allTalent.length : null;
  const temperamentWarning =
    allTalent.length >= 2 && avgReliability !== null && avgEgo !== null && (avgReliability < 45 || avgEgo > 65);

  // Casting Redesign, Phase A - the single source of truth for readiness
  // (engine/projectReadiness.ts), reused here rather than re-deriving a
  // second, locally-scoped "still need to cast/hire" list. Also carries the
  // new cast-before-director nudge (section 8 of the design review).
  const readiness = deriveProjectReadiness(draft, state.studio.cash);
  // Director gets its own standalone tile above (see below - "director
  // first" is reinforced by ordering, not just the nudge). Lead/Supporting
  // Actor move to CharacterCastingSection entirely.
  const crewRoles = MANDATORY_TALENT_ROLES.filter(
    (role) => role !== 'Director' && role !== 'Lead Actor' && role !== 'Supporting Actor',
  );
  const castBeforeDirectorNudge = readiness.warnings.find((w) => w.code === 'cast-before-director');
  const stillNeeded = readiness.blockers.filter((b) =>
    ['missing-director', 'missing-lead-cast', 'missing-supporting-cast', 'missing-mandatory-crew'].includes(b.code),
  );

  return (
    <div className="stack">
      <h1>Cast & Crew</h1>
      <p className="choice-description">
        Cast your key roles and hire your crew one attachment at a time. Fame boosts box office appeal - especially
        your lead's. Your director and crew have a Skill rating; actors instead have five specific Acting Style
        strengths - there's no single "acting skill," just how well their particular strengths suit the character
        they'd play. Reliability and Ego apply across everyone attached to the production: an unreliable, high-ego
        team raises the odds of a costly incident once filming starts.
      </p>

      <div className="row">
        <div className="card stack" style={{ flex: 2 }}>
          <h3 style={{ margin: 0 }}>Casting For</h3>
          {draft.script ? (
            <>
              <div className="card-title">{draft.script.title}</div>
              <p className="card-synopsis">{draft.script.synopsis}</p>
              <div style={{ fontSize: '0.85em' }}>
                <div>Leads: {draft.script.requiredLeads}</div>
                <div>Supporting Roles: {draft.script.requiredSupporting}</div>
                <div>Intended Audience: {draft.script.intendedAudience}</div>
              </div>
              <CompatibilityBadge breakdown={toneProfileBreakdown(draft.script.toneProfile)} defaultLabel="Tone Profile" />
            </>
          ) : (
            <p style={{ margin: 0 }}>No script selected.</p>
          )}
        </div>

        <div className="card stack" style={{ flex: 3 }}>
          <h3 style={{ margin: 0 }}>Production Overview</h3>
          <ScoreBar label="Cast &amp; Crew Progress" value={(filledMandatoryCount / MANDATORY_TALENT_ROLES.length) * 100} />
          <div className="row">
            <div className="stat">
              <div className="stat-label">Roles Filled</div>
              <div className="stat-value">{filledMandatoryCount}/{MANDATORY_TALENT_ROLES.length}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Current Payroll</div>
              <div className="stat-value"><Money amount={totalSalary} /></div>
            </div>
          </div>
          <p className="production-identity" style={{ fontSize: '0.95em' }}>
            {identity ?? 'Hire a director to see how this production is taking shape.'}
          </p>
          {lowCompatWarning && (
            <div className="card production-tension" style={{ margin: 0 }}>
              This cast doesn't fit the script especially well overall - worth checking compatibility before you lock it in.
            </div>
          )}
          {temperamentWarning && (
            <div className="card production-tension" style={{ margin: 0 }}>
              This team's temperament (reliability/ego) raises the odds of on-set friction once filming starts.
            </div>
          )}
        </div>
      </div>

      <RangeSlider
        label="Target Cast & Crew Budget"
        min={MASTER_BUDGET_RANGE.min}
        max={MASTER_BUDGET_RANGE.max}
        logScale
        value={masterBudget}
        onChange={handleMasterBudgetChange}
        formatValue={formatMoney}
        description="Splits across everyone still to cast, weighted by how much each role carries the film - your lead and director claim the biggest shares, crew the smallest. Each hire's own fee comes off the top as you go, so casting one role above its target leaves less for the rest and retargets them lower. Open any role to fine-tune its target afterward."
        lowLabel="Shoestring"
        highLabel="Big Budget"
      />

      <StaffingBoardSection
        draft={draft}
        onOpenCharacter={(character, role) => setOpenCharacter({ character, role })}
        onOpenRole={setOpenRole}
      />

      <div className="grid">
        <RoleTile role="Director" optional={false} onOpen={() => setOpenRole('Director')} />
      </div>

      {castBeforeDirectorNudge && (
        <div className="card production-tension" style={{ margin: 0 }}>
          {castBeforeDirectorNudge.message}
        </div>
      )}

      {draft.script && (
        <CharacterCastingSection
          script={draft.script}
          onOpenCharacter={(character, role) => setOpenCharacter({ character, role })}
        />
      )}

      <div className="grid">
        {crewRoles.map((role) => (
          <RoleTile key={role} role={role} optional={false} onOpen={() => setOpenRole(role)} />
        ))}
        {OPTIONAL_TALENT_ROLES.map((role) => (
          <RoleTile key={role} role={role} optional onOpen={() => setOpenRole(role)} />
        ))}
      </div>

      {openRole && <RoleHiringDrawer role={openRole} onClose={() => setOpenRole(null)} />}
      {openCharacter && (
        <CastingDrawer
          character={openCharacter.character}
          role={openCharacter.role}
          onClose={() => setOpenCharacter(null)}
        />
      )}

      <div className="sticky-footer">
        <div className="row-between">
          <div>
            <div className="stat-label">Total Cast Salary</div>
            <div className="stat-value"><Money amount={totalSalary} /></div>
          </div>
        </div>
        {stillNeeded.length > 0 && (
          <p style={{ color: 'var(--red)', margin: '8px 0 0' }}>{stillNeeded.map((b) => b.message).join(' ')}</p>
        )}
        {!canAfford && <p style={{ color: 'var(--red)', margin: '8px 0 0' }}>You can't afford this so far. Adjust your picks.</p>}
      </div>
    </div>
  );
}
