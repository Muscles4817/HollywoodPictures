import { StarRating } from './StarRating';
import { deriveMatchQualityLabel } from '../../utils/StarRatingConversion';

interface MatchBreakdownProps {
  title: string;
  /** Each row is already a 0-100 "how well does this one dimension match" reading, not two raw numbers the player has to compare themselves - see engine/compatibility.ts:computeCharacterCompatibilityBreakdown/computeTalentCompatibilityBreakdown. */
  rows: Array<{ label: string; matchScore: number }>;
}

/**
 * Talent Card UX Redesign - replaces the old pattern of showing an actor's
 * own raw ActingStyle axes next to a Character's raw trait demands as two
 * side-by-side star blocks the player had to compare by eye
 * (CompatibilityBadge, still used elsewhere for a script/director's own
 * self-description with nothing to compare against). This is a distinct
 * component rather than a new CompatibilityBadge mode - CompatibilityBadge's
 * `breakdown` values are raw stats; a MatchBreakdown row is already a
 * comparison outcome, and giving it a second meaning depending on props
 * risked exactly the "is this a stat or a verdict" ambiguity this redesign
 * is trying to remove. One reusable per-axis "how well does this match"
 * reading, shared by every dimension a casting card wants to break down
 * (acting-style-vs-character, tone-vs-script).
 */
export function MatchBreakdown({ title, rows }: MatchBreakdownProps) {
  return (
    <div className="talent-section">
      <div className="stat-group-title">{title}</div>
      {rows.map(({ label, matchScore }) => (
        <div className="talent-match-row" key={label}>
          <div className="talent-match-row-header">
            <span className="talent-match-row-label">{label}</span>
            <StarRating value={matchScore} />
          </div>
          <span className="talent-match-quality">{deriveMatchQualityLabel(matchScore)}</span>
        </div>
      ))}
    </div>
  );
}
