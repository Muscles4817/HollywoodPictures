import { describe, it, expect } from 'vitest';
import {
  projectId,
  playerDraftToProject,
  scheduledDraftToProject,
  rivalProductionToProject,
  filmToProject,
  asPlayerDraft,
  asRivalProduction,
  asFilm,
  playerReleasedFilms,
  deriveInboxItems,
  inboxBadgeCount,
  isParkedActionable,
} from './project';
import { studioReducer } from '../state/studioReducer';
import { buildStateWithReadyDraft, buildReadyDraft, buildReadyAsset } from '../state/testFixtures';
import { openCastingCall } from './castingCalls';
import { generateDirectorPitch } from './directorPitch';
import { generateTestScreeningPendingChoice } from './testScreening';
import { withRng } from './random';
import type { Film, FilmDraft, RivalProductionInProgress } from '../types';

function sampleDraft(): FilmDraft {
  return withRng(1, (rng) => buildReadyDraft(rng)).result;
}

function sampleFilm(): Film {
  const released = studioReducer(buildStateWithReadyDraft(2), { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
  return playerReleasedFilms(released.projects)[0];
}

function sampleRivalProduction(): RivalProductionInProgress {
  const draft = sampleDraft();
  return {
    id: 'rival-prod-sample-1',
    rivalStudioId: 'rival-studio-0',
    scale: 'Medium',
    genre: draft.genre!,
    script: draft.script!,
    talent: draft.talent,
    productionChoices: draft.productionChoices!,
    postProductionChoices: draft.postProductionChoices!,
    marketingChoices: draft.marketingChoices!,
    targetAudience: draft.targetAudience!,
    releaseDay: 120,
  };
}

describe('project.ts - wrapping is a pure, lossless round trip', () => {
  it('playerDraftToProject/asPlayerDraft round-trips a FilmDraft exactly, and projectId is the draft id', () => {
    const draft = sampleDraft();
    const project = playerDraftToProject(draft);
    expect(project.kind).toBe('player-in-progress');
    expect(asPlayerDraft(project)).toBe(draft); // same reference - wrapping copies nothing
    expect(projectId(project)).toBe(draft.id);
  });

  it('rivalProductionToProject/asRivalProduction round-trips a RivalProductionInProgress exactly, and projectId is the production id', () => {
    const production = sampleRivalProduction();
    const project = rivalProductionToProject(production);
    expect(project.kind).toBe('rival-in-progress');
    expect(asRivalProduction(project)).toBe(production);
    expect(projectId(project)).toBe(production.id);
  });

  it('filmToProject/asFilm round-trips a Film exactly, and projectId is the film id', () => {
    const film = sampleFilm();
    const project = filmToProject(film);
    expect(project.kind).toBe('released');
    expect(asFilm(project)).toBe(film);
    expect(projectId(project)).toBe(film.id);
  });

  it('narrowing to the wrong shape returns null, not a crash or a silently-wrong value', () => {
    const draftProject = playerDraftToProject(sampleDraft());
    expect(asRivalProduction(draftProject)).toBeNull();
    expect(asFilm(draftProject)).toBeNull();

    const rivalProject = rivalProductionToProject(sampleRivalProduction());
    expect(asPlayerDraft(rivalProject)).toBeNull();
    expect(asFilm(rivalProject)).toBeNull();

    const filmProject = filmToProject(sampleFilm());
    expect(asPlayerDraft(filmProject)).toBeNull();
    expect(asRivalProduction(filmProject)).toBeNull();
  });
});

/** An uncast draft (buildReadyDraft's own cast cleared - a filled slot would make the call's Character read as already-cast and inert) with one Open Casting call already carrying an applicant, on its Lead Character. */
function draftWithPendingCastingApplicant(seed: number, id: string): FilmDraft {
  const asset = withRng(seed, (rng) => buildReadyAsset(rng)).result;
  const base = withRng(seed, (rng) => buildReadyDraft(rng)).result;
  const [applicant] = withRng(seed + 100, (rng) => buildReadyDraft(rng)).result.talent.map((a) => a.person);
  const leadCharacter = asset.script.cast.find((c) => c.prominence === 'Lead')!;
  const call = { ...openCastingCall(leadCharacter.id, 'Lead Actor', 1), applicants: [{ person: applicant, appliedOnDay: 1, channel: 'OpenCasting' as const }] };
  // buildReadyDraft sets photography to a finished shoot (it's meant for
  // release-flow tests) - castingCallsAwaitingReview is scoped to
  // still-in-Development drafts, so this needs clearing back to null.
  return { ...base, id, script: asset.script, talent: [], photography: null, castingCalls: [call] };
}

// deriveInboxItems/inboxBadgeCount is the one canonical derivation both
// components/common/Header.tsx's badge and components/common/Inbox.tsx's
// own rendering read - added after the two briefly drifted apart (the
// badge undercounted new Casting Redesign applicants because Inbox.tsx
// grew its own local 'casting' category without this shared function
// knowing about it).
describe('deriveInboxItems / inboxBadgeCount', () => {
  it('counts a backgrounded, still-in-Development draft with a new casting applicant', () => {
    const draft = draftWithPendingCastingApplicant(1, 'draft-uncast');
    const projects = [playerDraftToProject(draft)];
    const items = deriveInboxItems(projects, null);
    expect(items.casting).toHaveLength(1);
    expect(items.casting[0].production.id).toBe(draft.id);
    expect(inboxBadgeCount(projects, null)).toBe(1);
  });

  // Deliberately UNLIKE the other categories (wrapped/parked/awaiting-choice),
  // which route to the very screen a focused project is already showing. The
  // casting beat points at a per-Character drawer that isn't on screen just
  // because the project is, and it clears on read rather than on casting
  // somebody - so hiding it while the player is inside the project only meant
  // the message vanished and then came back unchanged.
  it('still surfaces the focused draft, since the beat clears on read rather than on focus', () => {
    const draft = draftWithPendingCastingApplicant(2, 'draft-focused');
    const projects = [playerDraftToProject(draft)];
    expect(deriveInboxItems(projects, draft.id).casting).toHaveLength(1);
    expect(inboxBadgeCount(projects, draft.id)).toBe(1);
  });

  it('drops a call once its applicants have been seen, and pings again when a new one arrives', () => {
    const draft = draftWithPendingCastingApplicant(7, 'draft-seen');
    const seen: FilmDraft = {
      ...draft,
      castingCalls: draft.castingCalls.map((call) => ({
        ...call,
        applicants: call.applicants.map((a) => ({ ...a, acknowledged: true })),
      })),
    };
    expect(deriveInboxItems([playerDraftToProject(seen)], null).casting).toEqual([]);
    expect(inboxBadgeCount([playerDraftToProject(seen)], null)).toBe(0);

    // A fresh applicant next week is news again.
    const newArrival = { ...seen.castingCalls[0].applicants[0], acknowledged: undefined, appliedOnDay: 8 };
    const pinging: FilmDraft = {
      ...seen,
      castingCalls: [{ ...seen.castingCalls[0], applicants: [...seen.castingCalls[0].applicants, newArrival] }],
    };
    expect(deriveInboxItems([playerDraftToProject(pinging)], null).casting).toHaveLength(1);
  });

  it('counts one badge point per casting CALL, since each is its own card routing to its own Character', () => {
    const draft = draftWithPendingCastingApplicant(8, 'draft-two-calls');
    const applicant = draft.castingCalls[0].applicants[0];
    const supporting = draft.script!.cast.find((c) => c.prominence === 'Supporting')!;
    const secondCall = {
      ...openCastingCall(supporting.id, 'Supporting Actor', 1),
      applicants: [{ person: applicant.person, appliedOnDay: 1, channel: 'OpenCasting' as const }],
    };
    const projects = [playerDraftToProject({ ...draft, castingCalls: [...draft.castingCalls, secondCall] })];
    expect(deriveInboxItems(projects, null).casting).toHaveLength(1); // one production...
    expect(deriveInboxItems(projects, null).casting[0].calls).toHaveLength(2); // ...two roles waiting
    expect(inboxBadgeCount(projects, null)).toBe(2);
  });

  // The bake-off's pitches land on their own due-days during the background
  // tick - before this category existed there was no notification at all, so a
  // whole round could come in and sit unread.
  function draftWithLandedPitch(seed: number, id: string, opts: { acknowledged?: boolean } = {}): FilmDraft {
    const asset = withRng(seed, (rng) => buildReadyAsset(rng)).result;
    const base = withRng(seed, (rng) => buildReadyDraft(rng)).result;
    const director = base.talent.find((a) => a.role === 'Director')!.person;
    const pitch = { ...generateDirectorPitch(director, asset.script), acknowledged: opts.acknowledged };
    return {
      ...base,
      id,
      script: asset.script,
      talent: [],
      photography: null,
      directorPitches: { openedOnDay: 1, advertisedFee: 1_000_000, pending: [], submitted: [pitch] },
    };
  }

  // A greenlit film has no reachable Cast & Crew section (its screen is
  // pre-production/production), so a card routing there would have nowhere to
  // go - these beats stop once prep starts, even though photography hasn't.
  it('stops surfacing casting beats once the project is greenlit and in prep', () => {
    const draft = draftWithPendingCastingApplicant(10, 'draft-prepping');
    const greenlit: FilmDraft = { ...draft, preProduction: { status: 'scheduled' } as FilmDraft['preProduction'] };
    const projects = [playerDraftToProject(greenlit)];
    expect(deriveInboxItems(projects, null).casting).toEqual([]);
    expect(inboxBadgeCount(projects, null)).toBe(0);
  });

  it('surfaces a landed director pitch until the player has read it', () => {
    const projects = [playerDraftToProject(draftWithLandedPitch(9, 'draft-pitch'))];
    const items = deriveInboxItems(projects, null);
    expect(items.directorPitches).toHaveLength(1);
    expect(items.directorPitches[0].pitches).toHaveLength(1);
    expect(inboxBadgeCount(projects, null)).toBe(1);

    const read = [playerDraftToProject(draftWithLandedPitch(9, 'draft-pitch', { acknowledged: true }))];
    expect(deriveInboxItems(read, null).directorPitches).toEqual([]);
    expect(inboxBadgeCount(read, null)).toBe(0);
  });

  function draftWithAudition(seed: number, id: string, opts: { readyOnDay?: number; acknowledged?: boolean } = {}): FilmDraft {
    const asset = withRng(seed, (rng) => buildReadyAsset(rng)).result;
    const base = withRng(seed, (rng) => buildReadyDraft(rng)).result;
    const lead = asset.script.cast.find((c) => c.prominence === 'Lead')!;
    const audition = { characterId: lead.id, personId: 'aud-person', role: 'Lead Actor' as const, requestedOnDay: 1, readyOnDay: opts.readyOnDay ?? 10, acknowledged: opts.acknowledged };
    return { ...base, id, script: asset.script, talent: [], photography: null, auditions: [audition] };
  }

  it('surfaces a completed, unacknowledged screen test once the day has passed its readyOnDay', () => {
    const projects = [playerDraftToProject(draftWithAudition(5, 'draft-aud'))];
    // Not ready yet (or no day given) -> nothing.
    expect(deriveInboxItems(projects, null).auditionsReady).toEqual([]);
    expect(deriveInboxItems(projects, null, 5).auditionsReady).toEqual([]);
    // Ready -> surfaced and counted.
    const ready = deriveInboxItems(projects, null, 15);
    expect(ready.auditionsReady).toHaveLength(1);
    expect(ready.auditionsReady[0].auditions).toHaveLength(1);
    expect(inboxBadgeCount(projects, null, 15)).toBe(1);
  });

  it('does not surface an already-acknowledged screen test', () => {
    const projects = [playerDraftToProject(draftWithAudition(6, 'draft-aud-ack', { acknowledged: true }))];
    expect(deriveInboxItems(projects, null, 15).auditionsReady).toEqual([]);
    expect(inboxBadgeCount(projects, null, 15)).toBe(0);
  });

  it('inboxBadgeCount sums the actionable categories - actionable parked, plus nowPlaying, never the non-actionable waiting parked', () => {
    const projects = [playerDraftToProject(draftWithPendingCastingApplicant(3, 'draft-a')), playerDraftToProject(sampleDraft())];
    const items = deriveInboxItems(projects, null);
    const total =
      items.awaitingChoice.length +
      items.wrapped.length +
      items.parked.filter(isParkedActionable).length +
      items.casting.reduce((sum, entry) => sum + entry.calls.length, 0) +
      items.directorPitches.length +
      items.pressTourIncidents.length +
      items.nowPlaying.length;
    expect(inboxBadgeCount(projects, null)).toBe(total);
  });

  // Part 1 fix: a parked film still waiting on its test screening (or mid-recut)
  // is not actionable - it shows an informational Inbox card but must NOT keep
  // the badge lit, because there is nothing the player can do about it.
  it('a parked film waiting on its test screening is listed but does NOT light the badge', () => {
    const base = sampleDraft();
    const waiting = { ...base, id: 'draft-waiting', testScreeningResolved: false, testScreeningPendingChoice: null, postProductionEditingUntilDay: null };
    const projects = [playerDraftToProject(waiting)];
    const items = deriveInboxItems(projects, null);
    expect(items.parked.map((p) => p.id)).toContain('draft-waiting'); // still shown
    expect(isParkedActionable(waiting)).toBe(false);
    expect(inboxBadgeCount(projects, null)).toBe(0); // but the badge stays dark
  });

  it('a parked film whose screening has resolved IS actionable and lights the badge', () => {
    const base = sampleDraft();
    const ready = { ...base, id: 'draft-ready', testScreeningResolved: true, testScreeningPendingChoice: null, postProductionEditingUntilDay: null };
    const projects = [playerDraftToProject(ready)];
    expect(isParkedActionable(ready)).toBe(true);
    expect(inboxBadgeCount(projects, null)).toBe(1);
  });

  // Part 2: a player film that has opened but whose Premiere Reveal is unseen
  // surfaces under nowPlaying and lights the badge; once seen it clears.
  it('an opened player film with an unwatched premiere surfaces under nowPlaying (and clears once seen)', () => {
    const film = sampleFilm();
    const unseen = { ...film, boxOfficeRun: { ...film.boxOfficeRun, premiereSeen: false } };
    const projects = [filmToProject(unseen)];
    const items = deriveInboxItems(projects, null);
    expect(items.nowPlaying.map((f) => f.id)).toContain(film.id);
    expect(inboxBadgeCount(projects, null)).toBe(1);

    const seen = { ...film, boxOfficeRun: { ...film.boxOfficeRun, premiereSeen: true } };
    const seenProjects = [filmToProject(seen)];
    expect(deriveInboxItems(seenProjects, null).nowPlaying).toEqual([]);
    expect(inboxBadgeCount(seenProjects, null)).toBe(0);
  });

  it('surfaces a scheduled film with a fired press-tour incident under pressTourIncidents', () => {
    const base = sampleDraft();
    const incident = {
      base: { personId: 'p1', personName: 'Kip Danger', templateId: 'controversy-viral-remark', headline: 'h', story: 's', buzzDelta: -9, fameDelta: 2, heatDelta: 16, controversyDelta: 8 },
      situation: 's',
      polarity: 'negative' as const,
    };
    const draft = { ...base, id: 'draft-tour', pressTourWindowRolled: true, pressTourIncident: incident };
    const projects = [scheduledDraftToProject(draft, 999)];
    const items = deriveInboxItems(projects, null);
    expect(items.pressTourIncidents.map((p) => p.id)).toContain('draft-tour');
    expect(inboxBadgeCount(projects, null)).toBe(1);
  });

  // Post-Production Redesign, Phase B - a pending test screening surfaces
  // through the same awaitingChoice category an on-set pendingChoice
  // already uses (components/common/Inbox.tsx picks whichever of the two a
  // given production actually has), even though buildReadyDraft's draft
  // already has postProductionChoices set (the screening is calendar-driven,
  // independent of whether the player ever opened Post-Production) - so it
  // must NOT also land in `parked`.
  it('counts a backgrounded draft with a pending test screening under awaitingChoice, not parked', () => {
    const base = sampleDraft();
    const pendingChoice = withRng(4, (rng) => generateTestScreeningPendingChoice(base, rng)).result;
    const draft = { ...base, id: 'draft-screening', testScreeningPendingChoice: pendingChoice };
    const projects = [playerDraftToProject(draft)];
    const items = deriveInboxItems(projects, null);
    expect(items.awaitingChoice.map((p) => p.id)).toContain('draft-screening');
    expect(items.parked.map((p) => p.id)).not.toContain('draft-screening');
    expect(items.wrapped.map((p) => p.id)).not.toContain('draft-screening');
  });
});
