import { describe, it, expect } from 'vitest';
import { studioReducer } from './studioReducer';
import { buildStateWithReadyDraft } from './testFixtures';
import { playerReleasedFilms } from '../engine/project';
import { SEQUEL_DEVELOPMENT_SETUP_DAYS } from '../engine/sequelDevelopment';
import type { GameState } from './gameState';

// Franchise stage 2: turning an owned IP into a new entry. Kicking off a
// development is a deliberate one-click action that takes real time before a
// screenplay exists - the inverse of the instant COMMISSION_SCREENPLAY.
function ipState(seed: number): { state: GameState; ipId: string; genre: string } {
  const released = studioReducer(buildStateWithReadyDraft(seed), { type: 'SCHEDULE_RELEASE', releaseDay: 1 });
  const film = playerReleasedFilms(released.projects)[0];
  const chosen = film.script.cast.slice(0, 2).map((c) => c.id);
  const withIp = studioReducer(released, { type: 'PROMOTE_FILM_TO_IP', filmId: film.id, characterIds: chosen, name: 'Nightfall' });
  return { state: withIp, ipId: withIp.studio.intellectualProperties[0].id, genre: film.script.genre };
}

describe('DEVELOP_SEQUEL', () => {
  it('books a timed development that inherits the IP world, cast, recognition, and source genre', () => {
    const { state, ipId, genre } = ipState(1);
    const ip = state.studio.intellectualProperties[0];
    const after = studioReducer(state, { type: 'DEVELOP_SEQUEL', ipId });

    expect(after.studio.pendingSequelDevelopments).toHaveLength(1);
    const dev = after.studio.pendingSequelDevelopments![0];
    expect(dev.ipId).toBe(ipId);
    expect(dev.ipName).toBe('Nightfall');
    expect(dev.readyOnDay).toBe(state.totalDays + SEQUEL_DEVELOPMENT_SETUP_DAYS);
    // The sequel inherits the franchise's pre-sold draw and its source film's genre.
    expect(dev.script.franchiseRecognition).toBe(ip.recognition);
    expect(dev.script.genre).toBe(genre);
    expect(dev.script.primarySetting).toBe(ip.setting.archetype);
    // Not yet an owned Asset - it is property-in-the-making.
    expect(after.studio.assets.some((a) => a.id === dev.id)).toBe(false);
  });

  it('delivers the sequel as an IP-linked owned Asset when the setup completes', () => {
    const { state, ipId } = ipState(2);
    let s = studioReducer(state, { type: 'DEVELOP_SEQUEL', ipId });
    const dev = s.studio.pendingSequelDevelopments![0];

    for (let day = s.totalDays; day <= dev.readyOnDay + 1; day++) s = studioReducer(s, { type: 'ADVANCE_DAY' });

    expect(s.studio.pendingSequelDevelopments ?? []).toHaveLength(0);
    const delivered = s.studio.assets.find((a) => a.id === dev.id);
    expect(delivered).toBeDefined();
    expect(delivered!.ipId).toBe(ipId); // the flywheel link home
    expect(delivered!.provenance).toBe('Commissioned');
    expect(delivered!.developmentHistory?.[0].kind).toBe('developed');
  });

  it('is a no-op for an unknown IP and never books two developments for one IP at once', () => {
    const { state, ipId } = ipState(3);
    expect(studioReducer(state, { type: 'DEVELOP_SEQUEL', ipId: 'no-such-ip' })).toBe(state);

    const once = studioReducer(state, { type: 'DEVELOP_SEQUEL', ipId });
    const twice = studioReducer(once, { type: 'DEVELOP_SEQUEL', ipId });
    expect(twice).toBe(once);
    expect(twice.studio.pendingSequelDevelopments).toHaveLength(1);
  });
});
