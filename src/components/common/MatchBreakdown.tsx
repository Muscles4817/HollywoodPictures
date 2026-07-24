import { deriveMatchQualityLabel } from '../../utils/StarRatingConversion';

interface MatchBreakdownProps {
  title: string;
  /** Each row is already a 0-100 "how well does this one dimension match" reading, not two raw numbers the player has to compare themselves - see engine/compatibility.ts:computeCharacterCompatibilityBreakdown/computeTalentCompatibilityBreakdown. `known === false` veils the score as "Unknown" - an axis the casting eye can't yet vouch for (engine/talentCardPresentation.ts:gateKnownAxes); absent/true shows the score as normal. */
  rows: Array<{ label: string; matchScore: number; known?: boolean }>;
}

/** A 0-100 match as its bar-fill tier - green for a genuine strength, blue for a fair match, amber for a soft spot. Colour does the triage the old identical star rows couldn't. */
function matchTier(score: number): 'hi' | 'mid' | 'lo' {
  if (score >= 75) return 'hi';
  if (score >= 60) return 'mid';
  return 'lo';
}

/**
 * Talent Card UX Redesign (user request) - the per-axis role-fit breakdown,
 * now behind the card's disclosure and drawn as labelled bars rather than yet
 * another block of identical star rows. A bar reads as a magnitude at a glance
 * and a coloured one calls out the strengths and soft spots, where five star
 * rows all looked the same. The `title`/`rows` API is unchanged; only the
 * visual language is. Still a distinct component from CompatibilityBadge (whose
 * values are raw stats) - a MatchBreakdown row is already a comparison outcome.
 */
export function MatchBreakdown({ title, rows }: MatchBreakdownProps) {
  const anyVeiled = rows.some((r) => r.known === false);
  return (
    <div className="talent-more-group">
      <div className="talent-more-heading">{title}</div>
      {rows.map(({ label, matchScore, known }) => {
        // An axis the casting eye can't vouch for yet reads as a question mark,
        // not a precise fit for a performance nobody has seen (gateKnownAxes).
        if (known === false) {
          return (
            <div className="talent-bar-row talent-bar-row--unknown" key={label}>
              <span className="talent-bar-label">{label}</span>
              <span className="talent-bar-unknown">Unknown</span>
            </div>
          );
        }
        const tier = matchTier(matchScore);
        return (
          <div className="talent-bar-row" key={label}>
            <span className="talent-bar-label">{label}</span>
            <span className="talent-bar-track">
              <span className={`talent-bar-fill talent-bar-fill--${tier}`} style={{ width: `${Math.max(0, Math.min(100, matchScore))}%` }} />
            </span>
            <span className={`talent-bar-value talent-bar-value--${tier}`}>{deriveMatchQualityLabel(matchScore)}</span>
          </div>
        );
      })}
      {anyVeiled && <p className="talent-bar-unknown-note">Unknown until you see them in the part.</p>}
    </div>
  );
}
