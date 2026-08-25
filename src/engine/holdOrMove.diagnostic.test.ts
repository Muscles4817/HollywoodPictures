/**
 * Empirical diagnostic for the section 9.6 acceptance test
 * (docs/DESIGN_REVIEW_project_clocks_and_script_openness.md):
 *
 *   Can two rational players, holding the same finished film and facing the
 *   same rival announcement on their date, reasonably disagree about whether
 *   to hold or move?
 *
 * A decision is only real when neither option dominates. This sweeps the space
 * the decision actually lives in - how close the date is, how big the committed
 * campaign is, and how strong the colliding rival is - and asks, for each
 * combination, whether holding or moving is better. If one answer wins
 * everywhere, there is no decision, only an invoice.
 *
 * Skipped in the normal suite - run it deliberately with:
 *
 *   HOLD_OR_MOVE_DIAGNOSTIC=1 npx vitest run src/engine/holdOrMove.diagnostic.test.ts --disable-console-intercept
 */
import { describe, it } from 'vitest';
import { campaignWriteOff } from './campaignCommitment';
import { computeCompetitiveCrowding, type UpcomingRelease } from './releaseCrowding';
import type { CampaignCommitment } from '../types';

const diagnosticEnabled = Boolean(
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.HOLD_OR_MOVE_DIAGNOSTIC,
);

// Crowding costs opening availability (audienceSimulationInputs.ts:
// CROWDING_PENALTY_WEIGHT), so a collision is worth roughly this much of the
// campaign's own value in lost opening. A rough conversion, deliberately: the
// question is whether the two costs are ever comparable, not their exact ratio.
const OPENING_VALUE_MULTIPLE = 2.5;
const CROWDING_PENALTY_WEIGHT = 0.5;

// The board a real move faces: a colliding rival, paired with how much worse the
// best AVAILABLE alternative date is (as a fraction of the campaign's opening
// value). A weak rival beside an empty better window is an easy move; a strong
// one beside nothing but a dead January is the actual dilemma.
const DESTINATIONS: ReadonlyArray<readonly [number, number]> = [
  [0.3, 0.02], // minor collision, somewhere near-equivalent is free
  [0.6, 0.08], // real collision, the alternative gives up a decent frame
  [0.9, 0.18], // tentpole on your date, and nothing good is left
];

describe.skipIf(!diagnosticEnabled)('hold-or-move diagnostic', () => {
  it('reports whether either option dominates across the decision space', () => {
    const today = 500;
    let hold = 0;
    let move = 0;
    const rows: string[] = [];

    for (const daysOut of [30, 60, 120, 200, 300]) {
      for (const campaign of [5_000_000, 20_000_000, 60_000_000, 120_000_000]) {
        for (const [rivalStrength, destinationPenalty] of DESTINATIONS) {
          const releaseDay = today + daysOut;
          const commitment: CampaignCommitment = { amount: campaign, committedOnDay: today - 60, forReleaseDay: releaseDay };

          // Holding: take the collision, lose opening availability.
          const rival: UpcomingRelease = { releaseDay, genre: 'Action', targetAudience: 'Mass Market', strength: rivalStrength };
          const crowding = computeCompetitiveCrowding(
            { releaseDay, genre: 'Action', targetAudience: 'Mass Market' },
            [rival],
            0.6,
          );
          const costOfHolding = campaign * OPENING_VALUE_MULTIPLE * CROWDING_PENALTY_WEIGHT * crowding;

          // Moving: write off the campaign that cannot follow the date, AND
          // accept whatever the destination is worth. A move is only obviously
          // right if somewhere better is standing empty, and good windows are
          // scarce - the alternative is typically a weaker season, or another
          // contested date. Modelling the destination as free was what made
          // this sweep read 87% MOVE on its first run.
          const writeOff = campaignWriteOff(commitment, today);
          const costOfMoving = writeOff + campaign * OPENING_VALUE_MULTIPLE * destinationPenalty;

          const choice = costOfHolding <= costOfMoving ? 'HOLD' : 'MOVE';
          if (choice === 'HOLD') hold += 1; else move += 1;
          rows.push(
            `  ${String(daysOut).padStart(3)}d out  campaign ${String(campaign / 1e6).padStart(3)}m  rival ${rivalStrength.toFixed(1)}  ` +
            `hold ${(costOfHolding / 1e6).toFixed(1)}m  move ${(costOfMoving / 1e6).toFixed(1)}m ` +
            `(writeoff ${(writeOff / 1e6).toFixed(1)}m + worse frame ${((costOfMoving - writeOff) / 1e6).toFixed(1)}m)  -> ${choice}`,
          );
        }
      }
    }

    console.log('\n' + rows.join('\n'));
    const total = hold + move;
    console.log(`\n  HOLD is better in ${hold}/${total} (${Math.round((hold / total) * 100)}%), MOVE in ${move}/${total} (${Math.round((move / total) * 100)}%)`);
    console.log(
      '\n  Acceptance (section 9.6): a decision exists only where neither answer wins\n' +
      '  everywhere. A split anywhere near even means two rational players can look\n' +
      '  at the same board and disagree; a near-100% skew means there is no decision.\n',
    );
  });
});
