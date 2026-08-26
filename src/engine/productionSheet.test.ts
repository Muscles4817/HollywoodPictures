import { describe, it, expect } from 'vitest';
import { deriveProductionSheet, deskRead, readFilledSlot, readOpenSlot, summariseSheet } from './productionSheet';
import { keyCreativePairs } from './creativeTension';
import { deriveProjectReadiness } from './projectReadiness';
import { buildReadyDraft } from '../state/testFixtures';
import { withRng } from './random';
import { MANDATORY_TALENT_ROLES } from '../data/talentGeneration';
import { TALENT_PRESENTATION } from '../data/talentPresentation';

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

describe('what an empty slot says', () => {
  it('counts exactly the pairings the engine would gain by filling the slot', () => {
    // The load-bearing test of the whole reading: partnersFor() is a hand-written
    // mirror of creativeTension.ts's pairing rules, and a mirror drifts. Rather
    // than trust it, actually fill each open slot with a borrowed person and
    // diff keyCreativePairs() before and after.
    const draft = readyDraft();
    const stand_in = draft.talent[0].person;
    for (const slot of deriveProductionSheet(draft).flatMap((g) => g.slots)) {
      const reading = readOpenSlot(slot, draft, 100);
      if (!reading || !slot.role) continue;
      const before = keyCreativePairs(draft.talent).length;
      const after = keyCreativePairs([...draft.talent, { role: slot.role, person: stand_in }]).length;
      expect(reading.unreadablePairs).toBe(after - before);
    }
  });

  it('says a mandatory slot holds the shoot, and an optional one does not', () => {
    const draft = readyDraft();
    const slots = deriveProductionSheet(draft).flatMap((g) => g.slots);
    const composer = slots.find((s) => s.label === 'Composer' && s.state === 'open');
    expect(readOpenSlot(composer!, draft, 100)?.blocks).toBe('Holds the shoot');

    const optional = slots.find((s) => s.state === 'optional' && s.role);
    expect(readOpenSlot(optional!, draft, 100)?.blocks).not.toBe('Holds the shoot');
  });

  it('gives a deadline only when the film has actually claimed a date', () => {
    const draft = readyDraft();
    const open = deriveProductionSheet(draft).flatMap((g) => g.slots).find((s) => s.state === 'open')!;
    expect(readOpenSlot(open, draft, 100)?.offerNeededBy).toBeNull();

    // Claim a date far enough out that there is real slack to report.
    const announced = { ...draft, announcedReleaseDay: 100 + 900 };
    const withDate = readOpenSlot(open, announced, 100);
    expect(withDate?.offerNeededBy).not.toBeNull();
    expect(withDate!.offerNeededBy!).toBeGreaterThan(100);
  });

  it('says nothing about a slot that is already filled', () => {
    const draft = readyDraft();
    const filled = deriveProductionSheet(draft).flatMap((g) => g.slots).find((s) => s.state === 'set')!;
    expect(readOpenSlot(filled, draft, 100)).toBeNull();
  });
});

describe('what a filled slot says', () => {
  it('reads a filled slot against the people already attached, never as a number', () => {
    const draft = readyDraft();
    const director = deriveProductionSheet(draft).flatMap((g) => g.slots).find((s) => s.label === 'Director' && s.state === 'set');
    const reading = readFilledSlot(director!, draft, []);
    expect(reading).not.toBeNull();
    // Qualitative by house rule: a name and a direction, never the scalar.
    if (reading?.chemistry) expect(reading.chemistry).not.toMatch(/\d/);
  });

  it('has nothing to say about an empty slot', () => {
    const draft = readyDraft();
    const open = deriveProductionSheet(draft).flatMap((g) => g.slots).find((s) => s.state === 'open')!;
    expect(readFilledSlot(open, draft, [])).toBeNull();
  });
});

describe("the desk's read", () => {
  it('never claims a package is finished while the form still shows blank lines', () => {
    const draft = readyDraft();
    const groups = deriveProductionSheet(draft);
    const read = deskRead(draft, groups);
    expect(summariseSheet(groups).open).toBeGreaterThan(0);
    expect(read).not.toMatch(/every line/i);
  });

  it('says so plainly when nothing is attached at all', () => {
    const draft = { ...readyDraft(), talent: [], title: '', targetAudience: null, productionChoices: null };
    expect(deskRead(draft, deriveProductionSheet(draft))).toMatch(/blank call sheet/i);
  });

  it('names a director with nobody to point at', () => {
    const draft = readyDraft();
    const directorOnly = { ...draft, talent: draft.talent.filter((a) => a.role === 'Director') };
    expect(deskRead(directorOnly, deriveProductionSheet(directorOnly))).toMatch(/no one in it/i);
  });

  it('names a cast with nobody directing them', () => {
    const draft = readyDraft();
    const castOnly = { ...draft, talent: draft.talent.filter((a) => a.role !== 'Director') };
    expect(deskRead(castOnly, deriveProductionSheet(castOnly))).toMatch(/nobody is sitting in/i);
  });

  it('never states a count, because the meter directly above already owns it', () => {
    // The first cut said "6 of 13 lines filled" beside a meter reading "6 of
    // 21 set" - the voice was counting only required slots. Two denominators
    // on one screen is worse than one.
    const draft = readyDraft();
    for (const variant of [draft, { ...draft, announcedReleaseDay: 900 }, { ...draft, talent: [] }]) {
      const read = deskRead(variant, deriveProductionSheet(variant));
      expect(read).not.toMatch(/\d/);
      expect(read.length).toBeLessThan(120);
    }
  });
});

describe('optional slots read as prose, not as mangled copy', () => {
  it('quotes the role hook verbatim rather than rewording it into an absence', () => {
    // The first cut lowercased and truncated the hook to force it into a "No
    // one ..." sentence, which produced "No one optional - only matters for
    // effects-heavy films" for the roles whose hook is a caveat, not a verb.
    const draft = readyDraft();
    for (const slot of deriveProductionSheet(draft).flatMap((g) => g.slots)) {
      if (slot.state !== 'optional' || !slot.role) continue;
      const blocks = readOpenSlot(slot, draft, 100)?.blocks;
      expect(blocks).toBe(TALENT_PRESENTATION[slot.role].hook);
      expect(blocks).not.toMatch(/^No one/);
    }
  });
});
