import { describe, it, expect } from 'vitest';
import { deriveFranchiseTalentHistory, findDraftFranchiseIp } from './franchiseTalent';
import type { Film, FilmDraft, IntellectualProperty, Studio } from '../types';

interface Assignment {
  personId: string;
  personName: string;
  role: string;
  characterId?: string;
  characterName?: string;
}

function film(id: string, title: string, releasedOnDay: number, assignments: Assignment[]): Film {
  const cast = assignments
    .filter((a) => a.characterId)
    .map((a) => ({ id: a.characterId, name: a.characterName }));
  const talent = assignments.map((a) => ({
    role: a.role,
    person: { id: a.personId, identity: { name: a.personName } },
    characterId: a.characterId,
  }));
  return { id, title, releasedOnDay, script: { cast }, talent, releasedBy: undefined } as unknown as Film;
}

const ip = { id: 'ip-1', name: 'Nightfall', filmIds: ['f1', 'f2'] } as IntellectualProperty;

describe('deriveFranchiseTalentHistory', () => {
  it('maps a returning character to whoever most recently played them', () => {
    const films = [
      film('f1', 'Nightfall', 100, [
        { personId: 'a1', personName: 'Ava Reed', role: 'Lead Actor', characterId: 'f1-c0', characterName: 'Kade' },
        { personId: 'd1', personName: 'Dara Cole', role: 'Director' },
      ]),
      // Kade is recast in the second entry - the reprisal must point at the newer actor.
      film('f2', 'Nightfall 2', 400, [
        { personId: 'a2', personName: 'Noor Vale', role: 'Lead Actor', characterId: 'f2-c0', characterName: 'Kade' },
      ]),
    ];

    const history = deriveFranchiseTalentHistory(ip, films);

    expect(history.reprisalByCharacterName.get('Kade')).toMatchObject({ personId: 'a2', personName: 'Noor Vale', filmTitle: 'Nightfall 2' });
    // Both actors and the director are flagged as franchise contributors.
    expect(history.byPersonId.get('a1')).toMatchObject({ role: 'Lead Actor', characterName: 'Kade' });
    expect(history.byPersonId.get('d1')).toMatchObject({ role: 'Director' });
    expect(history.byPersonId.has('a2')).toBe(true);
  });

  it('ignores films that are not part of the IP', () => {
    const films = [
      film('f1', 'Nightfall', 100, [{ personId: 'a1', personName: 'Ava Reed', role: 'Lead Actor', characterId: 'f1-c0', characterName: 'Kade' }]),
      film('other', 'Unrelated', 200, [{ personId: 'z9', personName: 'Someone Else', role: 'Lead Actor', characterId: 'o-c0', characterName: 'Ghost' }]),
    ];

    const history = deriveFranchiseTalentHistory(ip, films);

    expect(history.byPersonId.has('z9')).toBe(false);
    expect(history.reprisalByCharacterName.has('Ghost')).toBe(false);
  });
});

describe('findDraftFranchiseIp', () => {
  const studio = {
    assets: [
      { id: 'asset-seq', ipId: 'ip-1' },
      { id: 'asset-orig' },
    ],
    intellectualProperties: [ip],
  } as unknown as Studio;

  it('resolves the IP a sequel draft belongs to via its Asset', () => {
    const draft = { assetId: 'asset-seq' } as FilmDraft;
    expect(findDraftFranchiseIp(draft, studio)?.id).toBe('ip-1');
  });

  it('returns null for an original (no ipId on the Asset)', () => {
    const draft = { assetId: 'asset-orig' } as FilmDraft;
    expect(findDraftFranchiseIp(draft, studio)).toBeNull();
  });
});
