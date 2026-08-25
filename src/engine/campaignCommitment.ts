// Committing a marketing campaign against an announced release date, and what
// it costs to move off it (docs/DESIGN_REVIEW_project_clocks_and_script_openness.md
// section 9.4).
//
// This is the thing that cannot be substituted. Not the date - nobody allocates
// those, and a rival can always open against you (section 9.1). What cannot be
// replaced is the money already pointed at that date: trailer placement bought
// on other studios' tentpoles, upfront commitments, partner and licensing
// tie-ins with lead times measured in months. Move the date and a share of it
// simply bought nothing.
//
// A campaign is a BOOKING here, not a payment. Media is committed early and paid
// close to air, so the cash is charged at release with the rest of marketing;
// what committing early buys is that the claim reads as funded rather than bare,
// and what it costs is the freedom to move.
//
// Pure: plain data in, plain data out.
import type { CampaignCommitment, GameDay, Money } from '../types';

/**
 * How far ahead of release a campaign is substantially bought. Inside this
 * window the spend is progressively unrecoverable; outside it, almost nothing
 * has been placed yet.
 */
const CAMPAIGN_RAMP_DAYS = 150;

/**
 * What is lost even on a commitment nothing has been spent against yet -
 * cancellation terms, forfeited placements, the agency's own work. A move is
 * never free, however early.
 */
const CANCELLATION_RATE = 0.15;

/**
 * The share of a commitment that a move writes off, given how close the date
 * being abandoned was. Rises from CANCELLATION_RATE far out to effectively all
 * of it on the eve of release.
 */
export function campaignWriteOffFraction(daysUntilRelease: number): number {
  const spent = Math.min(1, Math.max(0, 1 - daysUntilRelease / CAMPAIGN_RAMP_DAYS));
  return spent + (1 - spent) * CANCELLATION_RATE;
}

/** The cash a move costs, given the commitment and today. Zero when nothing is committed. */
export function campaignWriteOff(commitment: CampaignCommitment | undefined, today: GameDay): Money {
  if (!commitment || commitment.amount <= 0) return 0;
  return Math.round(commitment.amount * campaignWriteOffFraction(commitment.forReleaseDay - today));
}

/**
 * The commitment after moving to `newReleaseDay`. The written-off share is gone;
 * what remains carries to the new date, because the campaign is not abandoned -
 * it is re-pointed, at a cost. Accumulates `writtenOff` so the player can see
 * what date-shuffling has cost across several moves.
 */
export function commitmentAfterMove(
  commitment: CampaignCommitment,
  newReleaseDay: GameDay,
  today: GameDay,
): CampaignCommitment {
  const lost = campaignWriteOff(commitment, today);
  return {
    amount: Math.max(0, commitment.amount - lost),
    committedOnDay: commitment.committedOnDay,
    forReleaseDay: newReleaseDay,
    writtenOff: (commitment.writtenOff ?? 0) + lost,
  };
}

/** A player-facing account of what moving would cost right now - a named price, never a bare refusal. */
export function describeCampaignWriteOff(commitment: CampaignCommitment | undefined, today: GameDay): string | null {
  const lost = campaignWriteOff(commitment, today);
  if (!commitment || lost <= 0) return null;
  const pct = Math.round(campaignWriteOffFraction(commitment.forReleaseDay - today) * 100);
  return `Moving writes off ${pct}% of the committed campaign — the placements bought against this date cannot follow it.`;
}
