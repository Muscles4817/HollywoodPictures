// Corpus integrity checks for data/premises.ts.
//
// These exist ahead of any corpus expansion, and they are deliberately written
// BEFORE new entries rather than after: a validator proven only against content
// it was written alongside is fitted to its author's assumptions and will wave
// anything through. The test of a validator is whether it finds real problems in
// text a human wrote and other humans reviewed. Every check below is derivable
// from an entry's own fields - none of them asks a reader for a judgement,
// because a field only a human can verify is a field that drifts at scale.
//
// See docs/DESIGN_REVIEW_premise_corpus_expansion.md for why this ordering
// matters more than it looks.
import { describe, it, expect } from 'vitest';
import { PREMISE_BANKS, STORY_TYPE_PREMISES, type Premise } from './premises';
import { render } from '../engine/premiseGenerator';

/** Every authored entry, with a label naming where it lives, so a failure points at the bank. */
function allEntries(): Array<{ where: string; premise: Premise }> {
  const out: Array<{ where: string; premise: Premise }> = [];
  for (const [genre, bank] of Object.entries(PREMISE_BANKS)) {
    for (const [tone, entries] of Object.entries(bank)) {
      for (const premise of entries as Premise[]) out.push({ where: `${genre}.${tone}`, premise });
    }
  }
  for (const [storyType, entries] of Object.entries(STORY_TYPE_PREMISES)) {
    for (const premise of (entries ?? []) as Premise[]) out.push({ where: `story:${storyType}`, premise });
  }
  return out;
}

const ENTRIES = allEntries();
const fail = (rows: string[], what: string) => expect(rows, `${rows.length} ${what}:\n  ${rows.join('\n  ')}`).toEqual([]);

describe('premise corpus integrity', () => {
  it('has entries to check at all', () => {
    expect(ENTRIES.length).toBeGreaterThan(300);
  });

  it('opens every synopsis with the protagonist placeholder', () => {
    // render() capitalises the substituted protagonist, which is only correct if
    // it is the first thing in the sentence.
    fail(
      ENTRIES.filter(({ premise }) => !premise.synopsis.startsWith('{protagonist}')).map(({ where, premise }) => `${where}: ${premise.synopsis.slice(0, 60)}`),
      'synopses do not start with {protagonist}',
    );
  });

  it('leaves no placeholder unsubstituted once rendered', () => {
    // render() knows exactly two placeholders. Anything else brace-delimited -
    // {nemesis}, {Antagonist}, {setting} - survives substitution and reaches the
    // player as literal braces on a card. Deliberately NOT the null-antagonist
    // case: render() substitutes '' for that, so nothing is left to find here
    // and it is the antagonist-declaration check below that catches it.
    fail(
      ENTRIES.filter(({ premise }) => /\{[^}]*\}/.test(render(premise))).map(({ where, premise }) => `${where}: ${render(premise).slice(0, 70)}`),
      'rendered log-lines still contain a placeholder',
    );
  });

  it('uses the antagonist it declares, and declares the antagonist it uses', () => {
    const unused = ENTRIES.filter(({ premise }) => premise.antagonist !== null && !premise.synopsis.includes('{antagonist}'));
    const undeclared = ENTRIES.filter(({ premise }) => premise.antagonist === null && premise.synopsis.includes('{antagonist}'));
    fail(unused.map(({ where, premise }) => `${where}: declares "${premise.antagonist}" but never uses it`), 'entries carry a dead antagonist');
    fail(undeclared.map(({ where, premise }) => `${where}: ${premise.synopsis.slice(0, 60)}`), 'entries reference an antagonist they do not declare');
  });

  it('writes protagonists lowercase, since rendering capitalises them', () => {
    fail(
      ENTRIES.filter(({ premise }) => /^[A-Z]/.test(premise.protagonist)).map(({ where, premise }) => `${where}: ${premise.protagonist.slice(0, 60)}`),
      'protagonists start capitalised and will render as double capitals',
    );
  });

  it('renders as one clean sentence', () => {
    const problems: string[] = [];
    for (const { where, premise } of ENTRIES) {
      const text = render(premise);
      if (/ {2,}/.test(text)) problems.push(`${where}: double space`);
      if (/\s[.,;]/.test(text)) problems.push(`${where}: space before punctuation`);
      if (!/[.!?]$/.test(text)) problems.push(`${where}: no terminal punctuation - "${text.slice(-40)}"`);
      if (/\.\./.test(text)) problems.push(`${where}: doubled full stop`);
    }
    fail(problems, 'rendered log-lines have punctuation faults');
  });

  it('holds no two entries that render identically', () => {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const { where, premise } of ENTRIES) {
      const text = render(premise);
      if (seen.has(text)) dupes.push(`${where} duplicates ${seen.get(text)}: ${text.slice(0, 60)}`);
      else seen.set(text, where);
    }
    fail(dupes, 'entries are exact duplicates of another');
  });

  it('holds no two entries sharing a protagonist', () => {
    // Not fatal, but two log-lines about "a disavowed special forces operative"
    // read as the same idea twice however different their second halves are -
    // and perceived repetition is what the corpus work is actually fighting.
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const { where, premise } of ENTRIES) {
      const key = premise.protagonist.toLowerCase();
      if (seen.has(key)) dupes.push(`${where} shares a protagonist with ${seen.get(key)}: "${premise.protagonist.slice(0, 55)}"`);
      else seen.set(key, where);
    }
    fail(dupes, 'entries share a protagonist with another');
  });

  it('keeps every rendered log-line inside the length the corpus has established', () => {
    // A RATCHET, not a measured UI constraint - I do not know what the card can
    // actually fit, and pretending a number is derived when it is chosen is how
    // the rest of this project went wrong. Set just above the current longest
    // entry so the corpus cannot quietly balloon as it grows; if a genuine
    // layout limit is ever established, replace this with it.
    const LIMIT = 260;
    fail(
      ENTRIES.filter(({ premise }) => render(premise).length > LIMIT).map(({ where, premise }) => `${where}: ${render(premise).length} chars`),
      `rendered log-lines exceed ${LIMIT} characters`,
    );
  });

  it('agrees with its own leads count wherever the subject is grammatically plural', () => {
    // The reverse direction of the guard in scriptGenerator.test.ts, which only
    // catches multi-subject entries carrying NO count. This catches the other
    // half: a subject written as several people whose verb is written for one.
    //
    // Restricted to GRAMMATICALLY plural subjects, and that restriction is the
    // whole correctness of the check rather than a convenience. A collective noun
    // takes a singular verb in American usage - "a family that has never once
    // agreed on anything IS forced into one holiday" is correct English about
    // three people - and a two-hander written from one character's point of view
    // does the same. Applied indiscriminately this flagged five entries that were
    // all perfectly good prose, which is the validator being wrong rather than
    // the data.
    const NUMBER_WORD = /^(two|three|four|twin|both)\b/i;
    // Compound only when the "and" joins the HEAD nouns - which is to say, when
    // no preposition has intervened to subordinate what follows. "a bakery owner
    // and the health inspector" is two subjects; "a former court wizard stripped
    // OF his title and his magic" and "a translator caught BETWEEN the army she
    // serves and the people she is from" are one subject with a coordinated
    // object, and reading them as plural is how this check first went wrong.
    const PREPOSITION = /\b(of|between|with|from|in|on|for|to|at|by|against|about|through|over|under|into|amid|beneath)\b/i;
    const compoundSubject = (protagonist: string): boolean => {
      const at = protagonist.toLowerCase().indexOf(' and ');
      if (at === -1) return false;
      const head = protagonist.slice(0, at);
      return !PREPOSITION.test(head) && /\s+and\s+(the|a|an|his|her|their)\b/i.test(protagonist);
    };
    const ADVERB = /^(never|only|just|still|already|\w+ly)$/;
    const INCONCLUSIVE = /^(must|can|cannot|can't|will|won't|would|could|should|may|might|and|or|both)$/;
    const IRREGULAR_PAST = /^(had|went|was|were|took|saw|made|kept|told|gave|wrote|ran|found|left|held|met|lost|won|paid|sold|built|knew|grew|drew|flew|fell|broke|spoke|chose|rose|drove|struck|swore)$/;

    const problems: string[] = [];
    for (const { where, premise } of ENTRIES) {
      const grammaticallyPlural = NUMBER_WORD.test(premise.protagonist) || compoundSubject(premise.protagonist);
      if (!grammaticallyPlural) continue;

      const after = premise.synopsis.match(/^\{protagonist\}\s+(.*)$/);
      if (!after) continue;
      const words = after[1].split(/\s+/).map((w) => w.replace(/[^a-z']/gi, '').toLowerCase());
      const verb = words.find((w) => w.length > 0 && !ADVERB.test(w));
      if (!verb || INCONCLUSIVE.test(verb) || verb.endsWith('ed') || IRREGULAR_PAST.test(verb) || verb.length <= 1) continue;

      const readsPlural = verb.endsWith('ss') || !verb.endsWith('s');
      if (!readsPlural) problems.push(`${where}: "${premise.protagonist.slice(0, 50)}" is plural but "${verb}" is singular`);
      if ((premise.leads ?? 1) < 2) problems.push(`${where}: "${premise.protagonist.slice(0, 50)}" is plural but declares ${premise.leads ?? 1} lead`);
    }
    fail(problems, 'entries disagree with their own subject');
  });
});
