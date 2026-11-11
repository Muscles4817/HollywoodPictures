// The scripted player (state/playerBot.ts) doubles as the suite's only
// end-to-end test of a studio's life: from an empty studio, through the market,
// casting, a backgrounded shoot, post-production and a dated release, entirely
// by dispatched actions with no project held open. A reducer change that breaks
// any of those hand-offs shows up here as a throw or as a film that never comes
// out. The numbers it produces are the business of the opt-in harness
// (playerEconomy.diagnostic.test.ts), not of this file.
import { describe, it, expect } from 'vitest';
import { BOT_STRATEGIES, botStartFilm, createBotStudio, hasUniqueProjectIds, runBot } from './playerBot';
import { studioReducer } from './studioReducer';
import { DIFFICULTY_TIERS } from '../data/difficulty';

const tier = (id: string) => DIFFICULTY_TIERS.find((t) => t.id === id)!;
const strategy = (name: string) => BOT_STRATEGIES.find((s) => s.name === name)!;

describe('scripted player: a studio plays itself through the real reducer', () => {
  const run = runBot(7, tier('midmajor'), strategy('Steady'), 2);

  it('gets films made and released without a project ever being held open', () => {
    expect(run.films.length).toBeGreaterThanOrEqual(2);
    expect(run.years).toHaveLength(2);
    for (const film of run.films) expect(film.totalCost).toBeGreaterThan(0);
  });

  it('never jams a film in the pipeline', () => {
    expect(run.stuck.filter((line) => !line.includes('cannot-afford-greenlight'))).toEqual([]);
  });

  it('leaves a well-formed studio behind', () => {
    expect(hasUniqueProjectIds(run.finalState)).toBe(true);
    expect(run.finalState.projects.every((p) => p.kind !== 'player-in-progress' || p.draft !== null)).toBe(true);
    expect(Number.isFinite(run.finalState.studio.cash)).toBe(true);
  });

  it('is deterministic for a seed', () => {
    const again = runBot(7, tier('midmajor'), strategy('Steady'), 1);
    const first = runBot(7, tier('midmajor'), strategy('Steady'), 1);
    expect(again.years).toEqual(first.years);
    expect(again.films).toEqual(first.films);
  });
});

describe('answering a prep decision with no project open', () => {
  it('does not push a null draft into the slate', () => {
    // The crash the bot found on its first run: RESOLVE_PREPRODUCTION_CHOICE
    // for a backgrounded film while nothing was focused assembled the slate
    // from [focusedDraft!, ...] - a null draft, which threw on the next action.
    // Prep decisions are rolled, so try seeds until one produces a decision.
    let exercised = false;
    for (let seed = 1; seed <= 12 && !exercised; seed++) {
      let s = createBotStudio(seed, tier('midmajor'));
      for (let day = 0; day < 60 && s.projects.every((p) => p.kind !== 'player-in-progress'); day++) {
        s = botStartFilm(studioReducer(s, { type: 'ADVANCE_DAY' }), strategy('Steady'));
      }
      for (let day = 0; day < 120 && !exercised; day++) {
        const waiting = s.projects.flatMap((p) => (p.kind === 'player-in-progress' && p.draft.preProduction?.status === 'awaiting-choice' ? [p.draft] : []));
        if (waiting.length === 0) {
          s = studioReducer(s, { type: 'ADVANCE_DAY' });
          continue;
        }
        expect(s.focusedProjectId).toBeNull();
        s = studioReducer(s, {
          type: 'RESOLVE_PREPRODUCTION_CHOICE',
          choiceId: waiting[0].preProduction!.pendingChoice!.choices[0].id,
          productionId: waiting[0].id,
        });
        expect(s.projects.every((p) => p.kind !== 'player-in-progress' || p.draft !== null)).toBe(true);
        expect(() => studioReducer(s, { type: 'ADVANCE_DAY' })).not.toThrow();
        exercised = true;
      }
    }
    expect(exercised, 'no prep decision arose in 12 seeds to exercise the path').toBe(true);
  });
});
