import { describe, it, expect } from 'vitest';
import {
  SEQUEL_DEVELOPMENT_SETUP_DAYS,
  makePendingSequelDevelopment,
  settlePendingSequelDevelopments,
  sequelDevelopmentProgress,
} from './sequelDevelopment';
import { generateSequelScript } from './scriptGenerator';
import { createRng } from './random';
import type { CharacterTraitProfile, IntellectualProperty, IpCharacter, PendingSequelDevelopment } from '../types';

const traits: CharacterTraitProfile = {
  dramaticDepth: 60, charismaDemand: 70, comedyDemand: 30, emotionalDemand: 55,
  physicalDemand: 65, transformationDemand: 40, audienceAccessibility: 70, distinctiveness: 80, merchandisePotential: 75,
};

function ipChar(name: string): IpCharacter {
  return {
    id: `ipc-${name}`, sourceFilmId: 'film-1', sourceCharacterId: `sc-${name}`,
    name, prominence: 'Lead', archetype: 'ReluctantHero', traits,
    standing: { recognition: 80, popularity: 75 },
  };
}

function ip(): IntellectualProperty {
  return {
    id: 'ip-1', name: 'Nightfall', createdOnDay: 100, sourceFilmId: 'film-1',
    filmIds: ['film-1'], characters: [ipChar('Kade')],
    setting: { id: 'ips-1', sourceFilmId: 'film-1', archetype: 'AlienWorld' },
    recognition: 82, prestige: 60,
  };
}

function pending(startedOnDay = 100, readyOnDay = 160): PendingSequelDevelopment {
  const script = generateSequelScript(ip(), 'Sci-Fi', createRng(1));
  return makePendingSequelDevelopment(ip(), startedOnDay, readyOnDay, script);
}

describe('makePendingSequelDevelopment', () => {
  it('links the development to its IP and carries the ready date, no path/writer/brief seams filled', () => {
    const dev = pending(100, 160);
    expect(dev.ipId).toBe('ip-1');
    expect(dev.ipName).toBe('Nightfall');
    expect(dev.startedOnDay).toBe(100);
    expect(dev.readyOnDay).toBe(160);
    expect(dev.id).toBe(`sequel-${dev.script.id}`);
    // The MVP is one-click open development - the richer-path seams are untouched.
    expect(dev.path).toBeUndefined();
    expect(dev.writerId).toBeUndefined();
    expect(dev.brief).toBeUndefined();
    expect(dev.pitchId).toBeUndefined();
  });
});

describe('SEQUEL_DEVELOPMENT_SETUP_DAYS', () => {
  it('is a real span - developing a sequel takes time (legal/rights/greenlight setup)', () => {
    expect(SEQUEL_DEVELOPMENT_SETUP_DAYS).toBeGreaterThan(0);
  });
});

describe('sequelDevelopmentProgress', () => {
  it('runs 0 at kickoff to 1 at delivery', () => {
    const dev = pending(100, 200);
    expect(sequelDevelopmentProgress(dev, 100)).toBe(0);
    expect(sequelDevelopmentProgress(dev, 150)).toBeCloseTo(0.5);
    expect(sequelDevelopmentProgress(dev, 200)).toBe(1);
    expect(sequelDevelopmentProgress(dev, 999)).toBe(1); // never overshoots
  });
});

describe('settlePendingSequelDevelopments', () => {
  it('leaves a development in flight before its ready day', () => {
    const dev = pending(100, 160);
    const result = settlePendingSequelDevelopments([dev], 159);
    expect(result.delivered).toEqual([]);
    expect(result.pendingSequelDevelopments).toEqual([dev]);
  });

  it('delivers a franchise-linked owned Asset on the ready day', () => {
    const dev = pending(100, 160);
    const result = settlePendingSequelDevelopments([dev], 160);
    expect(result.pendingSequelDevelopments).toEqual([]);
    expect(result.delivered).toHaveLength(1);
    const asset = result.delivered[0];
    expect(asset.id).toBe(dev.id);
    expect(asset.script).toBe(dev.script);
    expect(asset.ipId).toBe('ip-1'); // the flywheel link home
    expect(asset.provenance).toBe('Commissioned');
    expect(asset.acquisitionCost).toBe(0); // the MVP one-click development is free
    expect(asset.acquiredOnDay).toBe(160);
    expect(asset.developmentHistory).toEqual([
      { day: 160, kind: 'developed', summary: 'Sequel screenplay developed for Nightfall' },
    ]);
  });

  it('settles a mixed batch - only the arrived ones deliver', () => {
    const ready = pending(100, 160);
    const later = pending(100, 300);
    const result = settlePendingSequelDevelopments([ready, later], 160);
    expect(result.delivered.map((a) => a.id)).toEqual([ready.id]);
    expect(result.pendingSequelDevelopments).toEqual([later]);
  });
});
