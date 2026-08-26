import { describe, it, expect } from 'vitest';
import { deriveProductionSheet, summariseSheet } from './productionSheet';
import { deriveProjectReadiness } from './projectReadiness';
import { buildReadyDraft } from '../state/testFixtures';
import { withRng } from './random';
import { MANDATORY_TALENT_ROLES } from '../data/talentGeneration';

/** One seeded, fully-packaged draft - the same fixture the rest of the suite uses. */
const readyDraft = (seed = 1) => withRng(seed, (rng) => buildReadyDraft(rng)).result;

describe('deriveProductionSheet', () => {
  it('shows every slot, filled or not - the whole point of a sheet over tabs', () => {
    const draft = readyDraft();
    const groups = deriveProductionSheet(draft);
    const slots = groups.flatMap((g) => g.slots);
    // Ten production roles (with Lead/Supporting expanded per character),
    // plus stunts, producers, and the plan and release decisions.
    expect(slots.length).toBeGreaterThanOrEqual(15);
    expect(groups.map((g) => g.title).sort()).toEqual(['Above the line', 'Below the line', 'The plan', 'The release']);
    // Both columns carry work: a form that printed everything in one column
    // would waste half the page at the width the sheet actually gets.
    expect(groups.filter((g) => g.column === 1).length).toBeGreaterThan(0);
    expect(groups.filter((g) => g.column === 2).length).toBeGreaterThan(0);
  });

  it('shows an unfilled mandatory role as open, with a blank occupant', () => {
    const draft = readyDraft();
    const stripped = { ...draft, talent: draft.talent.filter((a) => a.role !== 'Composer') };
    const composer = deriveProductionSheet(stripped).flatMap((g) => g.slots).find((s) => s.label === 'Composer');
    expect(composer).toMatchObject({ state: 'open', occupant: null });
  });

  it('marks a role that is allowed to stay empty as optional, not open', () => {
    const draft = readyDraft();
    const stripped = { ...draft, talent: draft.talent.filter((a) => a.role !== 'Casting Director') };
    const slot = deriveProductionSheet(stripped).flatMap((g) => g.slots).find((s) => s.label === 'Casting Director');
    expect(slot?.state).toBe('optional');
    expect(MANDATORY_TALENT_ROLES).not.toContain('Casting Director');
  });

  it('gives each written character its own cast slot, named after the character', () => {
    const draft = readyDraft();
    const leads = (draft.script?.cast ?? []).filter((c) => c.prominence === 'Lead');
    const slots = deriveProductionSheet(draft).flatMap((g) => g.slots);
    for (const character of leads) {
      expect(slots.find((s) => s.characterId === character.id)?.label).toBe(character.name);
    }
  });

  it('carries what a filled slot cost, so the sheet can total the package', () => {
    const draft = readyDraft();
    const director = deriveProductionSheet(draft).flatMap((g) => g.slots).find((s) => s.label === 'Director');
    expect(director?.state).toBe('set');
    expect(director?.occupant).toBeTruthy();
    expect(director?.cost).toBeGreaterThan(0);
  });

  it('routes every slot to a section that actually owns its decision', () => {
    const sections = new Set(['overview', 'cast-and-crew', 'production', 'producers', 'finance']);
    for (const slot of deriveProductionSheet(readyDraft()).flatMap((g) => g.slots)) {
      expect(sections.has(slot.section)).toBe(true);
    }
  });
});

describe('summariseSheet', () => {
  it('counts the three states and totals them', () => {
    const summary = summariseSheet(deriveProductionSheet(readyDraft()));
    expect(summary.set + summary.open + summary.optional).toBe(summary.total);
    expect(summary.total).toBeGreaterThan(0);
  });

  it('agrees with the readiness engine about whether anything is still open', () => {
    // The sheet and engine/projectReadiness.ts must not be able to tell the
    // player different stories about whether a package is done. Note the
    // fixture is *plan-and-finance* ready, not fully cast - it deliberately
    // still carries cast and crew blockers, and the sheet should show exactly
    // that many holes rather than none.
    const draft = readyDraft();
    const readiness = deriveProjectReadiness(draft, 100_000_000);
    const summary = summariseSheet(deriveProductionSheet(draft));
    expect(readiness.ready).toBe(summary.open === 0);
    expect(summary.open).toBeGreaterThan(0);
    expect(readiness.blockers.map((b) => b.code)).toContain('missing-mandatory-crew');
  });

  it('counts a hire with no character binding as filling its slot', () => {
    // Legacy and rival assignments carry no characterId; readiness counts them
    // by number, so the sheet must too or it shows a hole for somebody cast.
    const draft = readyDraft();
    const leadSlots = deriveProductionSheet(draft)
      .flatMap((g) => g.slots)
      .filter((s) => s.role === 'Lead Actor');
    const hiredLeads = draft.talent.filter((a) => a.role === 'Lead Actor');
    expect(hiredLeads.every((a) => a.characterId === undefined)).toBe(true);
    expect(leadSlots.filter((s) => s.state === 'set')).toHaveLength(hiredLeads.length);
  });
});

describe('player-facing text', () => {
  it('never shows a raw archetype enum on a cast slot', () => {
    // CLAUDE.md: presentation is qualitative, never raw internal values. The
    // first cut of the sheet printed `TragicVillain` and `LoveInterest`
    // straight out of the enum.
    const draft = readyDraft();
    const notes = deriveProductionSheet(draft)
      .flatMap((g) => g.slots)
      .filter((s) => s.role === 'Lead Actor' || s.role === 'Supporting Actor')
      .map((s) => s.note)
      .filter((n): n is string => n !== null);
    expect(notes.length).toBeGreaterThan(0);
    for (const note of notes) expect(note).not.toMatch(/[a-z][A-Z]/);
  });
});
