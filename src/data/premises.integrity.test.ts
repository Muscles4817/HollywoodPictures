// Corpus integrity checks for data/premises.ts.
//
// These exist ahead of any corpus expansion, and they are deliberately written
// BEFORE new entries rather than after: a validator proven only against content
// it was written alongside is fitted to its author's assumptions and will wave
// anything through. The test of a validator is whether it finds real problems in
// text a human wrote and other humans reviewed.
//
// Most checks below are mechanical - derivable from an entry's own fields, with
// no reader judgement involved, because a field only a human can verify is a
// field that drifts at scale. Two are NOT, and say so where they live: the
// length limit is a chosen ratchet rather than a measured constraint, and the
// subject/leads check reads English well enough to be wrong. Both are scoped
// down to where they can be trusted - as is the total-entry floor, which has
// slack in it by choice. Every OTHER check here is mechanical, and
// that distinction is the point - a suite that claimed uniform rigour it did
// not have would be trusted uniformly, which is exactly the failure it exists
// to prevent.
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
  it('has entries to check at all, in every bank it declares', () => {
    // The total is a floor with slack in it, so on its own it would not notice a
    // whole bank disappearing - deleting the five-entry Superhero story bank left
    // the suite green. What actually catches that is asserting each declared bank
    // is populated: `entries ?? []` in allEntries() otherwise swallows a bank set
    // to undefined without a word.
    expect(ENTRIES.length).toBeGreaterThan(300);

    // No check here can see a genre's `straight` bucket go empty, and pretending
    // otherwise would be worse than the gap. premises.ts:1137 merges
    // ADDITIONAL_STRAIGHT into every genre at module load, so by the time this
    // runs each genre has a populated `straight` whatever the literal above it
    // said - which also made an earlier "genre with no tones at all" branch here
    // unreachable code presenting coverage it did not have. Deleting a genre's
    // hand-written straight entries is therefore silent. Catching that needs
    // ADDITIONAL_STRAIGHT exported and checked separately.
    const empty: string[] = [];
    for (const [genre, bank] of Object.entries(PREMISE_BANKS)) {
      for (const [tone, entries] of Object.entries(bank)) {
        if (!entries || (entries as Premise[]).length === 0) empty.push(`${genre}.${tone}`);
      }
    }
    for (const [storyType, entries] of Object.entries(STORY_TYPE_PREMISES)) {
      if (!entries || (entries as Premise[]).length === 0) empty.push(`story:${storyType}`);
    }
    fail(empty, 'declared banks are empty or undefined');
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

  it('uses no invisible or ambiguous whitespace', () => {
    // Every character here is indistinguishable from a normal space, or from
    // nothing at all, when read - which is why review does not catch them and a
    // test has to. A leading space on a protagonist is the nastiest: render()
    // capitalises character 0, so " a retired thief" comes back still lowercase
    // and slips past both the placeholder check and the lowercase check.
    // Typographic characters (curly quotes, em dashes) are deliberately NOT
    // flagged - they are legible and may well be wanted. The corpus is currently
    // 100% ASCII, so none of this is live today; it is guarding the generated
    // entries, where a stray U+00A0 is exactly the kind of thing that arrives.
    // Alternation rather than a character class: a class holding \u200c and
    // \u200d side by side reads as a joiner sequence to the linter.
    const INVISIBLE = /\u00a0|\t|\n|\r|\u200b|\u200c|\u200d|\ufeff|\u2060|\u2028|\u2029|\u00ad/;
    const problems: string[] = [];
    for (const { where, premise } of ENTRIES) {
      for (const [field, value] of [['protagonist', premise.protagonist], ['synopsis', premise.synopsis], ['antagonist', premise.antagonist ?? '']] as const) {
        if (INVISIBLE.test(value)) problems.push(`${where}: ${field} contains an invisible or non-breaking whitespace character`);
        if (value !== value.trim()) problems.push(`${where}: ${field} has leading or trailing whitespace`);
      }
    }
    fail(problems, 'entries contain invisible or edge whitespace');
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
    // Exact match on the trimmed, lowercased string, and nothing cleverer. Two
    // log-lines opening on the identical character read as the same idea twice
    // however different their second halves are, and perceived repetition is
    // what the corpus work is actually fighting.
    //
    // Be clear about what this does NOT do: the near-duplicates already in the
    // corpus - two defense attorneys whose clients are innocent, two sets of
    // rival food-truck owners sharing a pitch - all pass it. Catching those needs
    // a similarity measure and a threshold nobody has justified yet, so this
    // check is a floor, not the answer to repetition.
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const { where, premise } of ENTRIES) {
      const key = premise.protagonist.trim().toLowerCase();
      if (seen.has(key)) dupes.push(`${where} shares a protagonist with ${seen.get(key)}: "${premise.protagonist.slice(0, 55)}"`);
      else seen.set(key, where);
    }
    fail(dupes, 'entries share a protagonist with another');
  });

  it('keeps every rendered log-line inside the length the corpus has established', () => {
    // A RATCHET, not a measured UI constraint - I do not know what the card can
    // actually fit, and pretending a number is derived when it is chosen is how
    // the rest of this project went wrong.
    //
    // It sat at 260 first, which was three characters above the longest entry in
    // the corpus (257). That is not a ratchet, it is a freeze: the next perfectly
    // good long log-line would have broken the build for no stated reason. 320
    // leaves real room to write while still catching an entry that has run away
    // to paragraph length. If a genuine layout limit is ever measured off the
    // card, replace this with it and delete this comment.
    const LIMIT = 320;
    fail(
      ENTRIES.filter(({ premise }) => render(premise).length > LIMIT).map(({ where, premise }) => `${where}: ${render(premise).length} chars`),
      `rendered log-lines exceed ${LIMIT} characters`,
    );
  });

  it('counts a numbered subject correctly', () => {
    // SCOPE, and the scope is the whole correctness of this check.
    //
    // It fires only on subjects opening with a number word - "two rival
    // auctioneers", "three siblings" - and it asserts ONE thing: that the number
    // agrees with the leads count beside it. No grammar. No verbs.
    //
    // Two grammar heuristics have been cut from this check, both after they
    // accused ordinary English of being broken:
    //
    // 1. Compound-subject detection ("a bakery owner AND the health inspector").
    //    Wrong three times - collective nouns taking correct singular verbs, then
    //    coordinated objects ("stripped OF his title and his magic"), then
    //    objects with no preposition at all ("sold her house AND her business").
    // 2. Verb agreement. It read the first non-adverb token as the verb, but the
    //    scan ADVANCED past skipped tokens rather than stopping, so putting
    //    \w+ly in the adverb list - which skips the real verbs "supply", "rally",
    //    "apply", "imply" - handed the accusation to the following noun: "two
    //    arms brokers SUPPLY arms to both sides" was reported as "arms is
    //    singular". A comment above it asserted that over-including an adverb was
    //    a safe silent miss. That was backwards, and it was the justification for
    //    the list being long.
    //
    // Four wrong versions in the same place is the answer. Detecting English
    // subject-verb agreement with regular expressions is not a thing this file
    // can do correctly, and a validator that tells an author their good log-line
    // is broken is worse than no validator during a corpus expansion, because the
    // author edits the good log-line.
    //
    // What is lost, stated plainly rather than waved away: a compound or numbered
    // subject written with a singular verb and no leads count is now caught by
    // nothing - not here, and not by scriptGenerator.test.ts:329, whose own
    // comment says it cannot see that class. All 12 compound-subject entries
    // currently in the corpus already carry leads: 2, so the gap is entirely
    // forward-looking. That is a real gap in exactly the population this file
    // exists to guard, and closing it needs a parser, not another regex.
    //
    // What remains earns its place: scriptGenerator.test.ts:329 checks that a
    // multi-subject log-line HAS a count, but nothing anywhere checks that the
    // count is the RIGHT one. "two rival auctioneers" declaring 3 leads is the
    // too-high direction on the only mechanically load-bearing field here.
    const NUMBERS: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, twin: 2, twins: 2, both: 2 };

    const problems: string[] = [];
    for (const { where, premise } of ENTRIES) {
      // Anchored on a following SPACE, not a word boundary. "two-bit hustler" and
      // "twin-engine bush pilot" are one person each, and \b happily matched the
      // hyphen - so much for the number word being the one plural signal in
      // English that cannot be misread.
      const opener = premise.protagonist.trim().toLowerCase().match(/^([a-z]+)\s/);
      const promised = opener ? NUMBERS[opener[1]] : undefined;
      if (promised === undefined) continue;

      const declared = premise.leads;
      const expected = Math.min(promised, 3); // capped: the generator tops out at 3 leads.
      if (declared === undefined) problems.push(`${where}: "${premise.protagonist.slice(0, 50)}" names ${promised} but declares no leads count`);
      else if (declared !== expected) problems.push(`${where}: "${premise.protagonist.slice(0, 50)}" names ${promised} but declares ${declared} leads`);
    }
    fail(problems, 'entries disagree with their own numbered subject');
  });

  it('keeps every declared leads count an integer the generator can use', () => {
    // scriptGenerator.test.ts:408 already bounds this, and already reads the banks
    // directly - so the earlier claim here that this one worked "at the data layer
    // rather than through a generated script" described a difference that does not
    // exist. The actual delta is Number.isInteger: :408 catches `leads: 0` but lets
    // `leads: 2.5` through, and a fractional count reaches Math.max in the
    // generator and produces a cast size no one asked for.
    fail(
      ENTRIES.filter(({ premise }) => premise.leads !== undefined && (!Number.isInteger(premise.leads) || premise.leads < 1 || premise.leads > 3)).map(
        ({ where, premise }) => `${where}: leads = ${premise.leads}`,
      ),
      'entries declare a leads count outside 1-3',
    );
  });
});
