import { describe, it, expect } from 'vitest';
import { studioReducer } from './studioReducer';
import { buildStateWithReadyDraft } from './testFixtures';
import { asPlayerDraft, findProject, announcedPlayerDrafts } from '../engine/project';
import { announcedAsUpcomingRelease, playerCalendarPresence } from '../engine/scheduledReleases';
import { chooseReleaseDay } from '../engine/rivalStudios';
import type { UpcomingRelease } from '../engine/releaseCrowding';
import { deriveKnownCalendar, deriveUpcomingReleaseEntries } from './selectors';
import { computeMarketingCost } from '../engine/cost';
import { pressTourCost } from '../engine/pressTour';
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

  it('scales its response to the threat, rather than fleeing any competitor alike', () => {
    // This is what the delay cost bought (engine/rivalStudios.ts:
    // SCHEDULING_DELAY_COST_PER_DAY). Previously the score was seasonal
    // desirability minus crowding with nothing charged for waiting, so any
    // non-zero crowding made stepping forward strictly better and every rival
    // fled the whole 45-day window by an identical distance - which meant
    // counterprogramming never happened and a rival never collided with anyone.
    const claimedDay = 300;
    const candidate = { genre: 'Action' as const, targetAudience: 'Mass Market' as const };
    const base = chooseReleaseDay(claimedDay, candidate, [], 0.5);
    const shift = (other: UpcomingRelease) => chooseReleaseDay(claimedDay, candidate, [other], 0.5) - base;
    const versus = (genre: string, audience: string, strength: number) =>
      shift({ releaseDay: base, genre: genre as never, targetAudience: audience as never, strength });

    // A genuine same-audience threat still clears the window entirely.
    expect(versus('Action', 'Mass Market', 0.9)).toBeGreaterThan(45);
    // A weak claim is not worth delaying for - the rival opens against it.
    expect(versus('Action', 'Mass Market', 0.1)).toBe(0);
    // Nor is a film chasing a different audience: counterprogramming is fine,
    // and the 0.15 genre-mismatch weight now survives into the day choice
    // instead of being flattened by a free delay.
    expect(versus('Romance', 'Adults', 0.9)).toBe(0);
  });
});

describe('an announcement made before the project is planned', () => {
  it('is still visible to rivals - the window the feature exists for', () => {
    // Regression: announcedAsUpcomingRelease used to bail on a null
    // productionChoices, which is null until Production Planning. Every
    // announcement made pre-greenlight - the whole point of announcing - was
    // therefore invisible on rivals' calendars. The original tests missed it
    // because buildStateWithReadyDraft is a fully-planned draft.
    const base = buildStateWithReadyDraft(6);
    const focusedDraft = focused(base);
    const unplanned: GameState = {
      ...base,
      projects: base.projects.map((p) =>
        p.kind === 'player-in-progress' && p.draft.id === focusedDraft.id
          ? { ...p, draft: { ...p.draft, productionChoices: null, marketingChoices: null, greenlitOnDay: null } }
          : p,
      ),
    };
    const day = unplanned.totalDays + 300;
    const announced = studioReducer(unplanned, { type: 'ANNOUNCE_RELEASE_DATE', releaseDay: day });

    const presence = playerCalendarPresence([], announcedPlayerDrafts(announced.projects), () => 0);
    expect(presence).toHaveLength(1);
    expect(presence[0].releaseDay).toBe(day);
    expect(presence[0].strength).toBeGreaterThan(0);
  });

  it('reads an epic as a stronger claim than an intimate one, before any budget exists', () => {
    // With no production budget to read, the screenplay's own scale is what a
    // trade announcement conveys.
    const base = buildStateWithReadyDraft(7);
    const draft = focused(base);
    const unplanned = { ...draft, productionChoices: null, marketingChoices: null, announcedReleaseDay: base.totalDays + 200 };
    const epic = announcedAsUpcomingRelease({ ...unplanned, script: { ...draft.script!, scale: 'Epic' } }, 0)!;
    const intimate = announcedAsUpcomingRelease({ ...unplanned, script: { ...draft.script!, scale: 'Intimate' } }, 0)!;
    expect(epic.strength).toBeGreaterThan(intimate.strength);
  });
});

describe('committing a campaign against the date', () => {
  const announced = (seed: number, offset = 400) => {
    const base = buildStateWithReadyDraft(seed);
    return studioReducer(base, { type: 'ANNOUNCE_RELEASE_DATE', releaseDay: base.totalDays + offset });
  };

  it('books a campaign without moving cash - media is paid close to air', () => {
    const s = announced(20);
    const after = studioReducer(s, { type: 'COMMIT_CAMPAIGN', amount: 8_000_000 });
    expect(focused(after).campaignCommitment?.amount).toBe(8_000_000);
    expect(after.studio.cash).toBe(s.studio.cash); // charged at release, with the rest of marketing
  });

  it('refuses a campaign with no date to point at', () => {
    const base = buildStateWithReadyDraft(21);
    expect(studioReducer(base, { type: 'COMMIT_CAMPAIGN', amount: 5_000_000 })).toBe(base);
  });

  it('makes the claim read stronger to rivals than a bare announcement', () => {
    // The staging that makes committing early a decision rather than
    // bookkeeping: a named date deters nobody, a funded one does.
    const s = announced(22);
    const bare = announcedAsUpcomingRelease(focused(s), 0)!;
    const funded = announcedAsUpcomingRelease(focused(studioReducer(s, { type: 'COMMIT_CAMPAIGN', amount: 40_000_000 })), 0)!;
    expect(funded.strength).toBeGreaterThan(bare.strength);
  });
});

describe('moving a date the campaign was booked against', () => {
  const withCampaign = (seed: number, offset: number, amount = 20_000_000) => {
    const base = buildStateWithReadyDraft(seed);
    const s = studioReducer(base, { type: 'ANNOUNCE_RELEASE_DATE', releaseDay: base.totalDays + offset });
    return studioReducer(s, { type: 'COMMIT_CAMPAIGN', amount });
  };

  it('charges the write-off in cash, so the shuffle is visible', () => {
    const s = withCampaign(23, 300);
    const moved = studioReducer(s, { type: 'ANNOUNCE_RELEASE_DATE', releaseDay: s.totalDays + 500 });
    const spent = s.studio.cash - moved.studio.cash;
    expect(spent).toBeGreaterThan(0);
    // The campaign is re-pointed at the new date, not abandoned.
    const commitment = focused(moved).campaignCommitment!;
    expect(commitment.forReleaseDay).toBe(s.totalDays + 500);
    expect(commitment.amount).toBeLessThan(20_000_000);
    expect(commitment.writtenOff).toBe(spent);
  });

  it('costs far more to move a date that is nearly here', () => {
    const near = withCampaign(24, 30);
    const far = withCampaign(24, 400);
    const cost = (s: GameState) => s.studio.cash - studioReducer(s, { type: 'ANNOUNCE_RELEASE_DATE', releaseDay: s.totalDays + 600 }).studio.cash;
    expect(cost(near)).toBeGreaterThan(cost(far) * 3);
  });

  it('costs nothing to re-announce the same day, or to move with no campaign booked', () => {
    const s = withCampaign(25, 300);
    const same = studioReducer(s, { type: 'ANNOUNCE_RELEASE_DATE', releaseDay: focused(s).announcedReleaseDay! });
    expect(same.studio.cash).toBe(s.studio.cash);

    const base = buildStateWithReadyDraft(26);
    const uncommitted = studioReducer(base, { type: 'ANNOUNCE_RELEASE_DATE', releaseDay: base.totalDays + 300 });
    const moved = studioReducer(uncommitted, { type: 'ANNOUNCE_RELEASE_DATE', releaseDay: base.totalDays + 500 });
    expect(moved.studio.cash).toBe(uncommitted.studio.cash);
  });

  it('refuses the move when the studio cannot cover the write-off', () => {
    // The bind the whole phase is for: the date is wrong, and you cannot afford
    // to be right about it.
    const s = withCampaign(27, 30, 40_000_000);
    const broke: GameState = { ...s, studio: { ...s.studio, cash: 1_000 } };
    expect(studioReducer(broke, { type: 'ANNOUNCE_RELEASE_DATE', releaseDay: broke.totalDays + 400 })).toBe(broke);
  });
});

describe('opening on a day other than the announced one', () => {
  // The other half of the write-off. Without this a studio could name a date,
  // quietly blow through it, never re-announce, and open late with the campaign
  // whole - which would make the development-side warning
  // (engine/deliveryEstimate.ts) a warning about nothing.
  const withCampaign = (seed: number, offset: number, amount = 20_000_000) => {
    const base = buildStateWithReadyDraft(seed);
    const s = studioReducer(base, { type: 'ANNOUNCE_RELEASE_DATE', releaseDay: base.totalDays + offset });
    return studioReducer(s, { type: 'COMMIT_CAMPAIGN', amount });
  };

  const writeOffIn = (s: GameState) =>
    (s.studio.cashLedger ?? [])
      .filter((entry) => entry.reason.includes('announced date'))
      .reduce((sum, entry) => sum - entry.amount, 0);

  const writeOffCharged = (s: GameState) =>
    writeOffIn(studioReducer(s, { type: 'SCHEDULE_RELEASE', releaseDay: s.totalDays + 40 }));

  it('charges the write-off when the film slips past the date it claimed', () => {
    expect(writeOffCharged(withCampaign(30, 20))).toBeGreaterThan(0);
  });

  it('charges nothing when the film opens exactly on the date it claimed', () => {
    const s = withCampaign(31, 40);
    const onTime = studioReducer(s, { type: 'SCHEDULE_RELEASE', releaseDay: focused(s).announcedReleaseDay! });
    expect((onTime.studio.cashLedger ?? []).some((entry) => entry.reason.includes('announced date'))).toBe(false);
  });

  it('charges nothing when no campaign was ever booked against the date', () => {
    const base = buildStateWithReadyDraft(32);
    const announced = studioReducer(base, { type: 'ANNOUNCE_RELEASE_DATE', releaseDay: base.totalDays + 300 });
    expect(writeOffCharged(announced)).toBe(0);
  });

  it('still lets the film out when the studio cannot cover the write-off', () => {
    // Refusing to release a finished film over a shortfall would be a trap, so
    // unlike the campaign charge (which SCHEDULE_RELEASE does gate on) the
    // write-off is taken on top and the studio runs its cash down. Cash is set
    // to exactly the campaign SCHEDULE_RELEASE demands, so the only thing that
    // could push the release out of reach is the write-off itself.
    const s = withCampaign(33, 20, 60_000_000);
    const d = focused(s);
    const affordable = computeMarketingCost(d.marketingChoices!) + pressTourCost(d.talent, d.marketingChoices!.pressTourCast);
    const tight: GameState = { ...s, studio: { ...s.studio, cash: affordable } };
    const after = studioReducer(tight, { type: 'SCHEDULE_RELEASE', releaseDay: tight.totalDays + 40 });
    expect(after).not.toBe(tight);
    expect(writeOffIn(after)).toBeGreaterThan(0);
  });
});


describe('what the PLAYER can see of their own claim', () => {
  // Rivals have always weighed an outstanding announcement
  // (engine/scheduledReleases.ts:playerCalendarPresence). The player could not:
  // the planning board only showed films whose release was already locked, so
  // the one party who had to plan around the claim was the one who could not
  // see it.
  const announced = (seed: number, offset = 400) => {
    const base = buildStateWithReadyDraft(seed);
    return studioReducer(base, { type: 'ANNOUNCE_RELEASE_DATE', releaseDay: base.totalDays + offset });
  };

  const entriesOf = (s: GameState) =>
    deriveUpcomingReleaseEntries(s.projects, s.rivalStudios, s.studio.name, s.totalDays, s.studio.genreIdentity ?? {});

  it('puts an outstanding announcement on the planning board, marked as a claim', () => {
    const s = announced(40);
    const mine = entriesOf(s).filter((entry) => entry.isPlayer);
    expect(mine).toHaveLength(1);
    expect(mine[0].isClaim).toBe(true);
    expect(mine[0].releaseDay).toBe(focused(s).announcedReleaseDay);
    // It must carry a real strength, or the board's crowding read is blind to it.
    expect(mine[0].strength).toBeGreaterThan(0);
  });

  it('shows nothing of a project that has announced nothing', () => {
    expect(entriesOf(buildStateWithReadyDraft(41)).filter((entry) => entry.isPlayer)).toHaveLength(0);
  });

  it('gives every entry the strength the crowding computation needs', () => {
    const s = announced(42);
    for (const entry of entriesOf(s)) expect(entry.strength).toBeGreaterThan(0);
  });
});

describe('deriveKnownCalendar', () => {
  it('never lets a film crowd itself', () => {
    const base = buildStateWithReadyDraft(43);
    const s = studioReducer(base, { type: 'ANNOUNCE_RELEASE_DATE', releaseDay: base.totalDays + 300 });
    const draftId = focused(s).id;
    expect(deriveKnownCalendar(s.projects, s.studio.genreIdentity ?? {}, draftId)).toHaveLength(0);
    // ...but it is genuinely on the calendar for anything else choosing a date.
    expect(deriveKnownCalendar(s.projects, s.studio.genreIdentity ?? {})).toHaveLength(1);
  });
});
