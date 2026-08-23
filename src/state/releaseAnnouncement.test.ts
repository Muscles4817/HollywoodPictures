import { describe, it, expect } from 'vitest';
import { studioReducer } from './studioReducer';
import { buildStateWithReadyDraft } from './testFixtures';
import { asPlayerDraft, findProject, announcedPlayerDrafts } from '../engine/project';
import { announcedAsUpcomingRelease, playerCalendarPresence } from '../engine/scheduledReleases';
import { chooseReleaseDay } from '../engine/rivalStudios';
import type { UpcomingRelease } from '../engine/releaseCrowding';
import type { GameState } from './gameState';

const focused = (s: GameState) => asPlayerDraft(findProject(s.projects, s.focusedProjectId))!;

describe('ANNOUNCE_RELEASE_DATE', () => {
  it('stakes a claim, and lets it be moved or withdrawn freely', () => {
    // An announcement is a claim, not a booking - moving it costs nothing yet.
    // What will eventually make it expensive is the campaign committed against
    // it (section 9.4), which does not exist at this step.
    const base = buildStateWithReadyDraft(1);
    const day = base.totalDays + 400;

    const announced = studioReducer(base, { type: 'ANNOUNCE_RELEASE_DATE', releaseDay: day });
    expect(focused(announced).announcedReleaseDay).toBe(day);

    const moved = studioReducer(announced, { type: 'ANNOUNCE_RELEASE_DATE', releaseDay: day + 90 });
    expect(focused(moved).announcedReleaseDay).toBe(day + 90);

    const withdrawn = studioReducer(moved, { type: 'ANNOUNCE_RELEASE_DATE', releaseDay: null });
    expect(focused(withdrawn).announcedReleaseDay).toBeUndefined();
  });

  it('refuses a date in the past or today - a claim nobody can believe', () => {
    const base = buildStateWithReadyDraft(2);
    for (const day of [base.totalDays, base.totalDays - 1, 0]) {
      expect(studioReducer(base, { type: 'ANNOUNCE_RELEASE_DATE', releaseDay: day })).toBe(base);
    }
  });
});

describe('what rivals can see', () => {
  it('puts an announced project on the calendar rivals read', () => {
    const base = buildStateWithReadyDraft(3);
    const day = base.totalDays + 300;
    const announced = studioReducer(base, { type: 'ANNOUNCE_RELEASE_DATE', releaseDay: day });

    const drafts = announcedPlayerDrafts(announced.projects);
    expect(drafts).toHaveLength(1);

    const presence = playerCalendarPresence([], drafts, () => 0);
    expect(presence).toHaveLength(1);
    expect(presence[0].releaseDay).toBe(day);
    // A claim rivals cannot see deters nobody - it must carry a real strength.
    expect(presence[0].strength).toBeGreaterThan(0);
  });

  it('shows nothing for a project that has announced nothing', () => {
    const base = buildStateWithReadyDraft(4);
    expect(announcedPlayerDrafts(base.projects)).toHaveLength(0);
    expect(playerCalendarPresence([], [], () => 0)).toEqual([]);
  });

  it('reads a bare announcement as weaker than the same film with a campaign behind it', () => {
    // The staging that makes committing marketing early a real decision rather
    // than bookkeeping: naming a date is a weak claim; buying the campaign is
    // what makes rivals move.
    const base = buildStateWithReadyDraft(5);
    const draft = focused(studioReducer(base, { type: 'ANNOUNCE_RELEASE_DATE', releaseDay: base.totalDays + 300 }));

    const bare = announcedAsUpcomingRelease({ ...draft, marketingChoices: null }, 0)!;
    const funded = announcedAsUpcomingRelease(draft, 0)!;
    expect(funded.strength).toBeGreaterThan(bare.strength);
  });
});

describe('an announcement actually deters', () => {
  it('moves a rival off a day the player has claimed with a matching film', () => {
    // The point of announcing at all. Nothing forbids the rival from opening
    // here - chooseReleaseDay simply finds the day worth more once the player's
    // claim is on the calendar (section 9.1: deterrence, not allocation).
    const claimedDay = 300;
    const candidate = { genre: 'Action' as const, targetAudience: 'Mass Market' as const };

    const undeterred = chooseReleaseDay(claimedDay, candidate, [], 0.5);
    const deterred = chooseReleaseDay(
      claimedDay,
      candidate,
      [{ releaseDay: undeterred, genre: candidate.genre, targetAudience: candidate.targetAudience, strength: 0.9 }],
      0.5,
    );
    expect(deterred).not.toBe(undeterred);
    expect(deterred).toBeGreaterThan(undeterred);
  });

  it('clears the claimed window entirely, which is what makes announcing worth doing', () => {
    // The upside of an announcement: a rival that steps aside does not step aside
    // by a token amount, it leaves the whole 45-day crowding window. So claiming
    // a date early genuinely buys a clear one.
    const claimedDay = 300;
    const candidate = { genre: 'Action' as const, targetAudience: 'Mass Market' as const };
    const undeterred = chooseReleaseDay(claimedDay, candidate, [], 0.5);
    const claim: UpcomingRelease = { releaseDay: undeterred, genre: 'Action', targetAudience: 'Mass Market', strength: 0.9 };
    const deterred = chooseReleaseDay(claimedDay, candidate, [claim], 0.5);
    expect(deterred - undeterred).toBeGreaterThan(45);
  });

  // MEASURED LIMITATION, not an assertion of intent. chooseReleaseDay maximises
  // seasonalDesirability - 0.6 * crowding, and seasonal desirability is nearly
  // flat across neighbouring weeks, so ANY non-zero crowding is enough to tip a
  // rival out of the entire window - by the same distance whether the claim is
  // strong or weak, matching or counterprogrammed. Two consequences the design
  // depends on and does not yet have: counterprogramming never happens, and a
  // rival will essentially never collide with a player's date, so section 9.4's
  // "hold or move" dilemma cannot arise. Locked in as a test so the day rival
  // scheduling is recalibrated, the change is visible rather than silent.
  it('currently flees by the same distance however small the threat - see section 9.5b', () => {
    const claimedDay = 300;
    const candidate = { genre: 'Action' as const, targetAudience: 'Mass Market' as const };
    const base = chooseReleaseDay(claimedDay, candidate, [], 0.5);
    const shift = (other: UpcomingRelease) => chooseReleaseDay(claimedDay, candidate, [other], 0.5) - base;

    const strong = shift({ releaseDay: base, genre: 'Action', targetAudience: 'Mass Market', strength: 0.9 });
    const weak = shift({ releaseDay: base, genre: 'Action', targetAudience: 'Mass Market', strength: 0.1 });
    const counterprogrammed = shift({ releaseDay: base, genre: 'Romance', targetAudience: 'Adults', strength: 0.9 });
    expect(weak).toBe(strong);
    expect(counterprogrammed).toBe(strong);
  });
});
