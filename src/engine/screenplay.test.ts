import { describe, it, expect } from 'vitest';
import { createRng } from './random';
import { estimateScriptCost, generateScriptOptions, newScriptId } from './scriptGenerator';
import { acquisitionEvent, appendDevelopmentEvent, reviseScript, scriptRevisionHistory } from './screenplay';
import { SCRIPT_CONCEPT_KEYS, SCRIPT_CRAFT_KEYS } from '../types';
import type { Asset, Script } from '../types';

function sampleScript(seed = 42): Script {
  return generateScriptOptions('Drama', createRng(seed), 1)[0];
}

function assetFrom(script: Script): Asset {
  return {
    id: `asset-${script.id}`,
    script,
    source: 'Spec Screenplay',
    acquisitionCost: script.cost,
    acquiredOnDay: 5,
    developmentHistory: [acquisitionEvent(5, 'Spec Screenplay', script.cost)],
  };
}

describe('save-stable identity', () => {
  it('mints distinct script ids across calls (no reload-resettable counter)', () => {
    const ids = new Set(Array.from({ length: 200 }, () => newScriptId()));
    expect(ids.size).toBe(200);
  });

  it('generated scripts have unique ids, and cast ids unique within (and derived from) each script', () => {
    const slate = generateScriptOptions('Action', createRng(9), 12);
    expect(new Set(slate.map((s) => s.id)).size).toBe(slate.length);
    for (const script of slate) {
      const castIds = script.cast.map((c) => c.id);
      expect(new Set(castIds).size).toBe(castIds.length); // unique within the script
      for (const id of castIds) expect(id.startsWith(`${script.id}-c`)).toBe(true); // derived from the owning script's id
    }
  });
});

describe('the concept/execution partition', () => {
  it('is disjoint and covers only the intended fields', () => {
    const concept = new Set<string>(SCRIPT_CONCEPT_KEYS);
    const craft = new Set<string>(SCRIPT_CRAFT_KEYS);
    for (const k of craft) expect(concept.has(k)).toBe(false);
    expect([...concept].sort()).toEqual(['archetype', 'genre', 'primarySetting', 'scale', 'storyType']);
    expect([...craft].sort()).toEqual(['characters', 'complexity', 'dialogue', 'originality', 'structure', 'toneProfile']);
  });
});

describe('acquisitionEvent', () => {
  it('records a spend for a bought Asset', () => {
    const e = acquisitionEvent(12, 'Agent Package', 420_000);
    expect(e).toMatchObject({ day: 12, kind: 'acquired', costDelta: -420_000 });
  });

  it('records no cash movement for a free founding script', () => {
    const e = acquisitionEvent(1, 'Studio Original', 0);
    expect(e.kind).toBe('acquired');
    expect(e.costDelta).toBeUndefined();
  });
});

describe('appendDevelopmentEvent', () => {
  it('appends without mutating the original Asset', () => {
    const asset = assetFrom(sampleScript());
    const before = asset.developmentHistory!.length;
    const next = appendDevelopmentEvent(asset, { day: 20, kind: 'note', summary: 'Producer note' });
    expect(next.developmentHistory).toHaveLength(before + 1);
    expect(next.developmentHistory!.at(-1)!.summary).toBe('Producer note');
    expect(asset.developmentHistory).toHaveLength(before); // original untouched
  });
});

describe('reviseScript', () => {
  it('keeps the concept fixed while improving craft, on a brand-new immutable head', () => {
    const original = assetFrom(sampleScript());
    const head = original.script;

    const revised = reviseScript(original, { dialogue: 99, structure: 99, originality: 99, characters: 99 }, { day: 30, kind: 'rewrite' });

    // Concept survives verbatim.
    for (const key of SCRIPT_CONCEPT_KEYS) {
      expect(revised.script[key]).toEqual(head[key]);
    }
    // Craft applied.
    expect(revised.script.dialogue).toBe(99);
    expect(revised.script.structure).toBe(99);
    // A new snapshot, not the same object or id.
    expect(revised.script).not.toBe(head);
    expect(revised.script.id).not.toBe(head.id);
    // Cost is recomputed from the new craft, not carried over.
    expect(revised.script.cost).toBe(estimateScriptCost(revised.script));
    expect(revised.script.cost).toBeGreaterThan(head.cost);
  });

  it('pushes the previous head into the revision lineage and logs the pass', () => {
    const original = assetFrom(sampleScript());
    const head = original.script;

    const revised = reviseScript(original, { dialogue: 80 }, { day: 30, kind: 'polish', writerIds: ['person-1'], note: 'Dialogue polish' });

    expect(revised.revisions).toEqual([head]);
    expect(scriptRevisionHistory(revised)).toEqual([head, revised.script]); // oldest first, head last
    expect(revised.writerIds).toEqual(['person-1']);
    expect(revised.developmentHistory!.at(-1)).toMatchObject({ day: 30, kind: 'polish', summary: 'Dialogue polish' });
  });

  it('does not mutate the Asset or Script it was given', () => {
    const original = assetFrom(sampleScript());
    const headId = original.script.id;
    const headDialogue = original.script.dialogue;

    reviseScript(original, { dialogue: (headDialogue + 10) % 100 }, { day: 30, kind: 'rewrite' });

    expect(original.script.id).toBe(headId);
    expect(original.script.dialogue).toBe(headDialogue);
    expect(original.revisions).toBeUndefined();
  });

  it('accumulates a multi-draft lineage across successive passes', () => {
    let asset = assetFrom(sampleScript());
    const draft1 = asset.script;
    asset = reviseScript(asset, { structure: 70 }, { day: 30, kind: 'rewrite' });
    const draft2 = asset.script;
    asset = reviseScript(asset, { dialogue: 70 }, { day: 40, kind: 'polish' });

    expect(scriptRevisionHistory(asset)).toEqual([draft1, draft2, asset.script]);
    expect(asset.revisions).toHaveLength(2);
  });
});
