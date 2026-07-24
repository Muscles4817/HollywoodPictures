import { Money } from './Money';
import { Button } from './Button';
import { deriveOverallScore, deriveRoleFitBreakdown } from './TalentStats';
import {
  deriveComparisonVerdict,
  deriveFitReason,
  deriveFitRead,
  deriveRiskRead,
  qualitativeMagnitude,
  type CompareSide,
  type FitRead,
} from '../../engine/talentCardPresentation';
import { deriveHiringVerdict } from '../../utils/StarRatingConversion';
import { getTypicalSalaryForRole, isAvailableImmediately, deriveBookedUntil } from '../../engine/person';
import { formatGameDateWithMonth } from '../../engine/calendar';
import { fitTier } from './TalentStats';
import type { ReactNode } from 'react';
import type { RoleCategory } from '../../data/talentPresentation';
import type { Person, ProductionRole, Script, ScriptCharacter } from '../../types';

/** One pinned candidate plus everything the comparison needs to score and act on them. */
export interface CompareSlot {
  person: Person;
  role: ProductionRole;
  category: RoleCategory;
  script: Script | null;
  character: ScriptCharacter | null;
  affordable: boolean;
  actionLabel: string;
  actionDisabled: boolean;
  onAct: () => void;
  onUnpin: () => void;
}

interface SideData {
  name: string;
  ageGender: string;
  /** Perceived fit (post read-bias) for actor/director, raw skill for crew, null when nothing to compare. Kept in step with what each card shows. */
  fit: number | null;
  /** The full hedged read for an actor/director fit; null for crew (skill is a known figure, shown exactly). */
  fitRead: FitRead | null;
  fitNote: string | null;
  salary: number;
  availableNow: boolean;
  bookedUntil: number | undefined;
  reliability: number;
  risk: ReturnType<typeof deriveRiskRead>;
  fame: number;
}

function deriveSide(slot: CompareSlot, totalDays: number): SideData {
  const { person, role, category, script, character } = slot;
  const rawFit = deriveOverallScore(person, role, category, script, character);
  const breakdown = deriveRoleFitBreakdown(person, role, category, script, character);
  const reason = breakdown ? deriveFitReason(breakdown.rows, breakdown.noun) : null;
  // Band the fit the same way the card does - but only where it's a judgment
  // (actor/director, i.e. there's a per-axis breakdown); crew skill stays exact.
  const fitRead = rawFit !== null && breakdown ? deriveFitRead(rawFit, person) : null;
  const bookedUntil = deriveBookedUntil(person.availability.commitments);
  const identity = person.identity.gender ?? '';
  return {
    name: person.identity.name,
    ageGender: identity,
    fit: fitRead ? fitRead.perceived : rawFit,
    fitRead,
    fitNote: reason?.strengths.replace(/\.$/, '') ?? null,
    salary: getTypicalSalaryForRole(person, role),
    availableNow: isAvailableImmediately(person, totalDays),
    bookedUntil: bookedUntil && bookedUntil > totalDays ? bookedUntil : undefined,
    reliability: person.reputation.reliability,
    risk: deriveRiskRead(person),
    fame: person.reputation.fame,
  };
}

function toCompareSide(d: SideData): CompareSide {
  return {
    name: d.name,
    fit: d.fit,
    fitConfidence: d.fitRead?.confidence,
    salary: d.salary,
    availableNow: d.availableNow,
    reliability: d.reliability,
    riskTier: d.risk.tier,
    fame: d.fame,
  };
}

type Winner = 'a' | 'b' | null;

/** A single compared attribute: two cells, the winning side highlighted, the middle naming the attribute. */
function Row({
  attr,
  left,
  right,
  winner,
  winTag,
}: {
  attr: string;
  left: ReactNode;
  right: ReactNode;
  winner: Winner;
  winTag?: string;
}) {
  return (
    <div className="talent-cmp-row">
      <div className={`talent-cmp-cell${winner === 'a' ? ' talent-cmp-cell--win' : ''}`}>
        {winner === 'a' && winTag && <span className="talent-cmp-win-tag">▲ {winTag}</span>}
        {left}
      </div>
      <div className="talent-cmp-attr">{attr}</div>
      <div className={`talent-cmp-cell talent-cmp-cell--right${winner === 'b' ? ' talent-cmp-cell--win' : ''}`}>
        {winner === 'b' && winTag && <span className="talent-cmp-win-tag">▲ {winTag}</span>}
        {right}
      </div>
    </div>
  );
}

function MiniBar({ value, tier }: { value: number; tier?: 'hi' | 'mid' | 'lo' }) {
  return (
    <span className="talent-cmp-bar">
      <span className={`talent-cmp-bar-fill${tier ? ` talent-bar-fill--${tier}` : ''}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </span>
  );
}

// The fit cell, kept in step with the card: a hedged verdict over a band for an
// actor/director (never a bare number), the exact skill read for crew.
function fitCell(d: SideData): ReactNode {
  if (d.fitRead) {
    const { verdict, confidenceLabel, low, high } = d.fitRead;
    return (
      <>
        <span className="talent-cmp-big">{verdict}</span>
        <span className="talent-cmp-note">{confidenceLabel}</span>
        <span className="talent-cmp-bar">
          <span className="talent-cmp-bar-fill" style={{ marginLeft: `${low}%`, width: `${Math.max(2, high - low)}%` }} />
        </span>
        {d.fitNote && <span className="talent-cmp-note">{d.fitNote}</span>}
      </>
    );
  }
  return (
    <>
      <span className="talent-cmp-big">{deriveHiringVerdict(d.fit!)}</span>
      <MiniBar value={d.fit!} tier={fitTier(d.fit!) === 'strong' ? 'hi' : fitTier(d.fit!) === 'good' ? 'mid' : 'lo'} />
      {d.fitNote && <span className="talent-cmp-note">{d.fitNote}</span>}
    </>
  );
}

function availabilityBadge(d: SideData): ReactNode {
  if (d.availableNow) return <span className="talent-badge talent-badge--ok">✓ Available now</span>;
  return (
    <span className="talent-badge talent-badge--bad">
      Booked{d.bookedUntil ? ` until ${formatGameDateWithMonth(d.bookedUntil)}` : ''}
    </span>
  );
}

const FIT_MARGIN = 3;
const RELIABILITY_MARGIN = 8;
const FAME_MARGIN = 8;

/**
 * Talent Card UX Redesign (user request) - the two-pin comparison view.
 * Deliberately NOT two cloned cards side by side: one shared table, each row an
 * attribute compared across both candidates with the stronger side highlighted
 * and the difference named, opening with a plain-English recommendation that
 * only commits to a pick when one candidate clearly wins (user choice). Built
 * to answer "which of these two do I hire?" as fast as possible - fit, cost,
 * availability, reliability, risk, and draw, ordered by how much they decide it.
 */
export function TalentComparison({ a, b, totalDays }: { a: CompareSlot; b: CompareSlot; totalDays: number }) {
  const da = deriveSide(a, totalDays);
  const db = deriveSide(b, totalDays);
  const verdict = deriveComparisonVerdict(toCompareSide(da), toCompareSide(db));

  const fitWinner: Winner =
    da.fit === null || db.fit === null || Math.abs(da.fit - db.fit) < FIT_MARGIN ? null : da.fit > db.fit ? 'a' : 'b';
  const salaryWinner: Winner = da.salary === db.salary || da.salary === 0 || db.salary === 0 ? null : da.salary < db.salary ? 'a' : 'b';
  const availWinner: Winner = da.availableNow === db.availableNow ? null : da.availableNow ? 'a' : 'b';
  // Reliability and star draw read as qualitative bands, so a row only declares
  // a winner when the bands actually differ - otherwise "High vs High, one is
  // MORE RELIABLE" contradicts the label the player is reading. The margins
  // gate out near-ties within the same band before the band comparison.
  const relDiffers = qualitativeMagnitude(da.reliability) !== qualitativeMagnitude(db.reliability);
  const relWinner: Winner =
    !relDiffers || Math.abs(da.reliability - db.reliability) < RELIABILITY_MARGIN ? null : da.reliability > db.reliability ? 'a' : 'b';
  const riskRank = { dependable: 0, 'some-risk': 1, volatile: 2 } as const;
  const riskWinner: Winner = da.risk.tier === db.risk.tier ? null : riskRank[da.risk.tier] < riskRank[db.risk.tier] ? 'a' : 'b';
  const fameDiffers = qualitativeMagnitude(da.fame) !== qualitativeMagnitude(db.fame);
  const fameWinner: Winner =
    !fameDiffers || Math.abs(da.fame - db.fame) < FAME_MARGIN ? null : da.fame > db.fame ? 'a' : 'b';

  const salaryGap = Math.abs(da.salary - db.salary);
  const bothFit = da.fit !== null && db.fit !== null;

  return (
    <div className="talent-cmp">
      <div className={`talent-cmp-verdict${verdict.pick ? ` talent-cmp-verdict--pick-${verdict.pick}` : ''}`}>
        <div className="talent-cmp-verdict-k">Recommendation</div>
        <div className="talent-cmp-verdict-v">{verdict.summary}</div>
      </div>

      <div className="talent-cmp-heads">
        <div className={`talent-cmp-head${verdict.pick === 'a' ? ' talent-cmp-head--pick' : ''}`}>
          <div className="talent-cmp-name">{da.name}</div>
          {da.ageGender && <div className="talent-cmp-mini">{da.ageGender}</div>}
          <button className="talent-cmp-unpin" onClick={a.onUnpin}>Unpin</button>
        </div>
        <div className={`talent-cmp-head talent-cmp-head--right${verdict.pick === 'b' ? ' talent-cmp-head--pick' : ''}`}>
          <div className="talent-cmp-name">{db.name}</div>
          {db.ageGender && <div className="talent-cmp-mini">{db.ageGender}</div>}
          <button className="talent-cmp-unpin" onClick={b.onUnpin}>Unpin</button>
        </div>
      </div>

      {bothFit && (
        <Row
          attr="Role fit"
          winner={fitWinner}
          winTag="Better fit"
          left={fitCell(da)}
          right={fitCell(db)}
        />
      )}

      <Row
        attr="Salary"
        winner={salaryWinner}
        winTag={salaryGap > 0 ? undefined : undefined}
        left={
          <>
            <span className="talent-cmp-big"><Money amount={da.salary} /></span>
            <span className={`talent-cmp-note talent-cmp-note--${a.affordable ? 'ok' : 'bad'}`}>{a.affordable ? 'Within budget' : 'Over budget'}</span>
            {salaryWinner === 'a' && <span className="talent-cmp-note">Cheaper by <Money amount={salaryGap} /></span>}
          </>
        }
        right={
          <>
            <span className="talent-cmp-big"><Money amount={db.salary} /></span>
            <span className={`talent-cmp-note talent-cmp-note--${b.affordable ? 'ok' : 'bad'}`}>{b.affordable ? 'Within budget' : 'Over budget'}</span>
            {salaryWinner === 'b' && <span className="talent-cmp-note">Cheaper by <Money amount={salaryGap} /></span>}
          </>
        }
      />

      <Row
        attr="Availability"
        winner={availWinner}
        left={availabilityBadge(da)}
        right={availabilityBadge(db)}
      />

      <Row
        attr="Reliability"
        winner={relWinner}
        winTag="More reliable"
        left={
          <>
            <span className="talent-cmp-big">{qualitativeMagnitude(da.reliability)}</span>
            <MiniBar value={da.reliability} />
          </>
        }
        right={
          <>
            <span className="talent-cmp-big">{qualitativeMagnitude(db.reliability)}</span>
            <MiniBar value={db.reliability} />
          </>
        }
      />

      <Row
        attr="Risk"
        winner={riskWinner}
        winTag="Lower risk"
        left={<span className={`talent-badge talent-badge--risk-${da.risk.tier}`}>{da.risk.label}</span>}
        right={<span className={`talent-badge talent-badge--risk-${db.risk.tier}`}>{db.risk.label}</span>}
      />

      <Row
        attr="Star draw"
        winner={fameWinner}
        winTag="Bigger name"
        left={
          <>
            <span className="talent-cmp-big">{qualitativeMagnitude(da.fame)}</span>
            <MiniBar value={da.fame} />
          </>
        }
        right={
          <>
            <span className="talent-cmp-big">{qualitativeMagnitude(db.fame)}</span>
            <MiniBar value={db.fame} />
          </>
        }
      />

      <div className="talent-cmp-actions">
        <Button variant={verdict.pick === 'a' ? 'primary' : 'secondary'} disabled={a.actionDisabled} onClick={a.onAct}>
          {a.actionLabel} {da.name.split(' ')[0]}
        </Button>
        <Button variant={verdict.pick === 'b' ? 'primary' : 'secondary'} disabled={b.actionDisabled} onClick={b.onAct}>
          {b.actionLabel} {db.name.split(' ')[0]}
        </Button>
      </div>
    </div>
  );
}
