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
// down to where they can be trusted. Every OTHER check here is mechanical, and
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

    const empty: string[] = [];
    for (const [genre, bank] of Object.entries(PREMISE_BANKS)) {
      if (Object.keys(bank).length === 0) empty.push(`${genre}: no tones at all`);
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
    const INVISIBLE = /\u00a0|\t|\n|\r|\u200b|\u200c|\u200d|\ufeff|\u2060/;
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

  it('conjugates and counts a numbered subject correctly', () => {
    // SCOPE, and the scope is the whole correctness of this check.
    //
    // It fires only on subjects opening with a number word - "two rival
    // auctioneers", "three siblings". That is the one plural signal in English
    // that cannot be misread, and it covers the real entries that matter.
    //
    // An earlier version also tried to detect compound subjects ("a bakery owner
    // and the health inspector") by looking for an "and" with no preposition
    // before it. It was wrong three times running: first flagging collective
    // nouns taking correct singular verbs, then coordinated objects ("a former
    // court wizard stripped OF his title and his magic"), then - after the
    // preposition guard - ordinary prose where the object simply had no
    // preposition in it ("a widow who sold her house AND her business"). Telling
    // an author their good log-line is ungrammatical is worse than saying
    // nothing, because they will edit the good log-line. That heuristic is gone
    // rather than iterated a fourth time.
    //
    // Nothing is lost by dropping it. scriptGenerator.test.ts:329 already carries
    // a far better plural-subject parser for the "several subjects, no leads
    // count" direction, and :408 already bounds the range. This check earns its
    // place on the one thing neither does: that a number word AGREES with the
    // count beside it, which catches "two X" declaring 3 leads - the too-high
    // direction, otherwise unchecked on the only mechanically load-bearing field
    // in the file.
    const NUMBERS: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, twin: 2, both: 2 };

    // A skip-list, and deliberately generous. Over-including a word here means a
    // silent miss; under-including it means accusing an adverb of being a badly
    // conjugated verb. Only one of those is recoverable, so this list errs long -
    // and the -s adverbs are here precisely because the rule below would
    // otherwise read "always" as a third-person singular.
    const ADVERB = /^(never|only|just|still|already|always|often|sometimes|soon|then|now|once|again|each|both|together|first|instead|also|even|finally|eventually|immediately|later|suddenly|somehow|nearly|almost|barely|hardly|perhaps|besides|afterwards|nowadays|\w+ly)$/;

    // English forms the third-person singular by adding -s, so a verb already
    // ending in a sibilant takes -es instead: "focus" -> "focuses", "pass" ->
    // "passes", "canvas" -> "canvases". A bare verb ending in -ss/-us/-as/-is/-os
    // is therefore NOT a singular form, whatever the trailing s suggests - which
    // is what made "two accountants FOCUS on one transaction" read as an error.
    // The four irregulars below are the exception: they are conclusively singular
    // despite the ending, and "two accountants IS" is exactly the fault worth
    // catching. Past tenses and modals need no special case at all - none of them
    // ends in -s, so the rule passes them over on its own.
    const CONCLUSIVELY_SINGULAR = /^(is|has|does|was)$/;
    const SIBILANT_STEM = /(ss|us|as|is|os)$/;
    const readsSingular = (verb: string): boolean =>
      CONCLUSIVELY_SINGULAR.test(verb) || (verb.endsWith('s') && !SIBILANT_STEM.test(verb));

    const problems: string[] = [];
    for (const { where, premise } of ENTRIES) {
      const opener = premise.protagonist.trim().toLowerCase().match(/^([a-z]+)\b/);
      const promised = opener ? NUMBERS[opener[1]] : undefined;
      if (promised === undefined) continue;

      // The count assertion runs on its own, gated on nothing. An earlier version
      // sat it below the verb analysis, so a subject opening "two rival
      // auctioneers MUST decide" skipped the verb as inconclusive and skipped the
      // count with it - for a check that never needed a verb in the first place.
      const declared = premise.leads;
      const expected = Math.min(promised, 3); // capped: the generator tops out at 3 leads.
      if (declared === undefined) problems.push(`${where}: "${premise.protagonist.slice(0, 50)}" names ${promised} but declares no leads count`);
      else if (declared !== expected) problems.push(`${where}: "${premise.protagonist.slice(0, 50)}" names ${promised} but declares ${declared} leads`);

      const after = premise.synopsis.match(/^\{protagonist\}\s+(.*)$/);
      if (!after) continue;
      const verb = after[1]
        .split(/\s+/)
        .map((w) => w.replace(/[^a-z']/gi, '').toLowerCase())
        .find((w) => w.length > 1 && !ADVERB.test(w));
      if (verb && readsSingular(verb)) problems.push(`${where}: "${premise.protagonist.slice(0, 50)}" is plural but "${verb}" is singular`);
    }
    fail(problems, 'entries disagree with their own numbered subject');
  });

  it('keeps every declared leads count an integer the generator can use', () => {
    // Mirrors scriptGenerator.test.ts:408 at the data layer rather than through a
    // generated script, so a `leads: 0` or `leads: 2.5` typo names the entry that
    // has it instead of surfacing as a downstream cast-count oddity.
    fail(
      ENTRIES.filter(({ premise }) => premise.leads !== undefined && (!Number.isInteger(premise.leads) || premise.leads < 1 || premise.leads > 3)).map(
        ({ where, premise }) => `${where}: leads = ${premise.leads}`,
      ),
      'entries declare a leads count outside 1-3',
    );
  });
});
