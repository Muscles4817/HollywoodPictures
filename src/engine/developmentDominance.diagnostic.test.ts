/**
 * Empirical diagnostic for the Phase 5 acceptance test
 * (docs/DESIGN_REVIEW_project_clocks_and_script_openness.md section 4.7):
 *
 *   Can two rational players, looking at the same project, reasonably disagree
 *   about whether to request another rewrite?
 *
 * Not "can waiting hurt?" - a punishment is trivial to add, and replacing
 * "always rewrite" with "never rewrite" would be the same failure wearing a
 * different hat. The question is whether the cost of time is large and
 * uncertain enough that the answer stops being obvious.
 *
 * The harness commissions a pass on a packaged project, runs the real
 * settlement loop day by day while it is in flight, and measures what the wait
 * actually cost: how often the pass overran its scheduled length, and how often
 * a specific in-demand actor the studio would have been chasing was booked out
 * from under it by a rival in the meantime.
 *
 * Skipped in the normal suite (an analysis harness, not an assertion) - run it
 * deliberately with:
 *
 *   DEV_DOMINANCE_DIAGNOSTIC=1 npx vitest run src/engine/developmentDominance.diagnostic.test.ts --disable-console-intercept
 */
import { describe, it } from 'vitest';
import { studioReducer } from '../state/studioReducer';
import { buildStateWithReadyDraft, buildReadyAsset } from '../state/testFixtures';
import { createRng } from './random';
import { generateRivalStudios } from './rivalStudios';
import { deriveScriptExposure } from './scriptExposure';
import { asPlayerDraft, findProject } from './project';
import { deliveryStanding, estimateDelivery } from './deliveryEstimate';
import { campaignWriteOff } from './campaignCommitment';
import type { FilmDraft } from '../types';
import type { GameState } from '../state/gameState';

const SEEDS = 60;
/** How many of the most in-demand free actors count as "the people you were chasing". */
const TARGET_POOL = 3;

// The second arm (section 9.7): how far ahead of the film's own ready-day the
// announced date sits. The talent arm above measures a clock that section 4.8
// already found to be nearly free; this one measures the clock built to replace
// it, so the two are reported side by side rather than one superseding the other.
const SLACK_BANDS = [200, 90, 45, 20];
/** A mid-sized campaign booked against the date - the money a slip actually puts at risk. */
const CAMPAIGN_AMOUNT = 20_000_000;

const diagnosticEnabled = Boolean(
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.DEV_DOMINANCE_DIAGNOSTIC,
);

describe.skipIf(!diagnosticEnabled)('development dominance diagnostic', () => {
  it('reports what a rewrite actually costs in time and lost package', () => {
    let runs = 0;
    let overran = 0;
    let overrunDays = 0;
    let scheduledDays = 0;
    let lostATarget = 0;
    let actorsBookedDuringWait = 0;
    let scriptsWithConcern = 0;
    // Release-date arm, one row per slack band.
    const dateArm = SLACK_BANDS.map((slack) => ({ slack, cells: 0, worsened: 0, missed: 0, writeOff: 0 }));

    for (let seed = 0; seed < SEEDS; seed++) {
      const base = buildStateWithReadyDraft(seed);
      const asset = buildReadyAsset(createRng(seed + 500));
      const start: GameState = {
        ...base,
        studio: { ...base.studio, cash: 50_000_000, assets: [...base.studio.assets, asset] },
        rivalStudios: generateRivalStudios(createRng(seed + 900)),
      };
      if (deriveScriptExposure(asset.script).length > 0) scriptsWithConcern++;

      const writer = start.talentPool.Writer[0];
      const commissioned = studioReducer(start, { type: 'REWRITE_ASSET', assetId: asset.id, kind: 'rewrite', writerId: writer.id });
      const pending = commissioned.studio.assets.find((a) => a.id === asset.id)?.pendingRewrite;
      if (!pending) continue;
      runs++;

      const took = pending.readyOnDay - start.totalDays;
      const scheduled = pending.estimatedDays?.low ?? took;
      scheduledDays += scheduled;
      if (took > scheduled) {
        overran++;
        overrunDays += took - scheduled;
      }

      const targets = [...commissioned.talentPool.Actor]
        .filter((a) => a.availability.commitments.length === 0)
        .sort((left, right) => right.reputation.fame - left.reputation.fame)
        .slice(0, TARGET_POOL)
        .map((a) => a.id);
      const freeBefore = commissioned.talentPool.Actor.filter((a) => a.availability.commitments.length === 0).length;

      let after = commissioned;
      for (let day = after.totalDays; day <= pending.readyOnDay; day++) after = studioReducer(after, { type: 'ADVANCE_DAY' });

      const freeAfter = after.talentPool.Actor.filter((a) => a.availability.commitments.length === 0).length;
      actorsBookedDuringWait += freeBefore - freeAfter;
      const taken = targets.filter(
        (id) => (after.talentPool.Actor.find((a) => a.id === id)?.availability.commitments.length ?? 0) > 0,
      ).length;
      if (taken > 0) lostATarget++;

      // --- The release-date arm -------------------------------------------
      // Same project, same REAL pass length just measured, but now asked what
      // the wait does to a date the studio has already claimed and bought
      // against. The draft is rolled back to development (its fixture ships
      // release-ready) so the estimate covers the whole pipeline ahead.
      const packaged = asPlayerDraft(findProject(start.projects, start.focusedProjectId));
      if (!packaged) continue;
      const inDevelopment: FilmDraft = {
        ...packaged,
        preProduction: null,
        photography: null,
        postProductionFinalReadyDay: null,
        postProductionScreeningReadyDay: null,
        testScreeningResolved: false,
      };
      const bare = estimateDelivery(inDevelopment, start.totalDays);
      for (const row of dateArm) {
        const announcedDay = bare.readyOnDay + row.slack;
        const announced: FilmDraft = { ...inDevelopment, announcedReleaseDay: announcedDay };
        const before = estimateDelivery(announced, start.totalDays);
        const withPass = estimateDelivery(announced, start.totalDays, start.totalDays + took);
        row.cells++;
        if (deliveryStanding(withPass) !== deliveryStanding(before)) row.worsened++;
        if (deliveryStanding(withPass) === 'missed') row.missed++;
        // What it would cost to buy the date back by moving it, priced from the
        // day the film would actually be ready with the pass in it.
        row.writeOff += campaignWriteOff(
          { amount: CAMPAIGN_AMOUNT, committedOnDay: start.totalDays, forReleaseDay: announcedDay },
          Math.min(announcedDay, withPass.readyOnDay),
        );
      }
    }

    const pct = (n: number) => `${Math.round((n / runs) * 100)}%`;
    const pctOf = (n: number, total: number) => `${Math.round((n / total) * 100)}%`;
    const money = (n: number) => `£${(Math.round(n / 100_000) / 10).toFixed(1)}m`;
    const dateRows = dateArm
      .map(
        (row) =>
          `  ${String(row.slack).padStart(3)}d of slack   changed standing ${pctOf(row.worsened, row.cells).padStart(4)}` +
          `   went to 'missed' ${pctOf(row.missed, row.cells).padStart(4)}` +
          `   mean cost to move ${money(row.writeOff / row.cells)}`,
      )
      .join('\n');
    console.log(`
Development dominance — ${runs} runs
  Scripts carrying a named concern      ${pct(scriptsWithConcern)}
  Passes that overran their schedule    ${pct(overran)}
  Mean scheduled length                 ${(scheduledDays / runs).toFixed(1)} days
  Mean overrun (when it overran)        ${overran ? (overrunDays / overran).toFixed(1) : '0'} days
  Actors booked by rivals during a wait ${(actorsBookedDuringWait / runs).toFixed(1)} of ~890 free
  Waits that cost a top-${TARGET_POOL} target        ${pct(lostATarget)}

  Acceptance test (section 4.7): the wait is a genuine bet only when losing
  something you wanted is a live possibility, not a rounding error. A
  single-digit "cost a target" rate means time is still nearly free and the
  rewrite is still close to strictly correct - see section 5's second clock.

What the SAME wait costs a claimed release date (section 9.7)
${dateRows}

  The talent clock and the date clock are answering the same question with
  different instruments. The first says time is nearly free, because talent is
  substitutable. The second says what it costs when something non-substitutable
  is pointed at the date - which is the clock section 4.8 predicted would be
  needed. Read the two rows together: the rewrite stops being strictly correct
  at the slack band where the standing changes and the money to move is real.
`);
  });
});
