/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The design system's rules, made mechanical.
 *
 * `docs/ART_DIRECTION.md` states its palette and corner discipline as prose,
 * and prose does not survive fourteen screens of implementation - `--radius`
 * spent months claiming the hard-corners decision was "reversible in one
 * place rather than 78 components" while 94 sites hardcoded a pixel value
 * against 36 that used the token. These tests are the move `ec14e43` made
 * for the data corpus, applied to the stylesheet: a rule review has to
 * remember becomes one the suite enforces.
 *
 * Sources are read off disk rather than through `import.meta.glob(?raw)`,
 * which silently returns empty strings here - Vite's CSS transform wins over
 * the raw query, so a glob-based version of this file passed by scanning
 * nothing. The node types are pulled in by the reference above rather than
 * by widening tsconfig.app.json's `types`, so app source stays free of node
 * globals; this file is the only one that touches the filesystem.
 */

const SRC = new URL('.', import.meta.url).pathname;

function read(ext: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith(ext)) out['./' + full.slice(SRC.length)] = readFileSync(full, 'utf8');
    }
  };
  walk(SRC);
  return out;
}

const CSS = read('.css');
const TSX = read('.tsx');

const HEX = /#[0-9a-fA-F]{3,8}\b/;

/**
 * A colour written as rgb()/rgba()/hsl() rather than as hex. The first cut of
 * this file only looked for `#`, and eleven hardcoded hues were sitting in
 * rgba() the whole time - a blue focus ring, a green status badge, grey
 * borders and tracks - mostly in AssetLibrary.css, left over from when that
 * screen rendered on a hardcoded dark panel.
 *
 * Black-alpha is exempt: a drop shadow or a scrim is genuinely not a palette
 * decision, and it reads correctly on either theme.
 *
 * White-alpha is NOT exempt, which is the asymmetry worth explaining. It is a
 * perfectly good way to draw borders and surfaces on a panel you know is dark,
 * and it is never right in an app with two themes - AssetLibrary drew every
 * border and inset surface with it, which resolved to white-on-bone the moment
 * that screen joined the theme system in bfd2bb8. Any hue is out for the
 * ordinary reason.
 */
const NON_TOKEN_COLOUR = /(?:rgba?|hsla?)\(\s*(?!0\s*,\s*0\s*,\s*0\s*[,)])[0-9]/;

/**
 * The one stylesheet allowed its own colours: the generated one-sheet's genre
 * gradients are the SPECTACLE register (ART_DIRECTION.md 2.2) and the contrast
 * with the desk palette is the entire point, which the file itself says in a
 * comment. The poster also keeps a soft corner - a poster is an object, not a
 * data surface. Adding a second entry here should require the same argument.
 */
const SPECTACLE = './components/common/GenrePoster.css';

function offenders(files: Record<string, string>, test: (line: string) => string | null): string[] {
  const found: string[] = [];
  for (const [path, source] of Object.entries(files)) {
    if (path === SPECTACLE) continue;
    source.split('\n').forEach((line, i) => {
      const hit = test(line);
      if (hit !== null) found.push(`${path}:${i + 1}  ${hit}`);
    });
  }
  return found;
}

describe('colour lives in the token layer', () => {
  it('defines every colour in index.css, or in a declared SPECTACLE sheet', () => {
    const sheets = Object.fromEntries(Object.entries(CSS).filter(([p]) => p !== './index.css'));
    expect(offenders(sheets, (line) => line.match(HEX)?.[0] ?? line.match(NON_TOKEN_COLOUR)?.[0] ?? null)).toEqual([]);
  });

  it('never hardcodes a colour in a component, not even as a var() fallback', () => {
    // A `var(--token, #hex)` fallback is worse than a bare hex, because it
    // looks themed and silently is not. Three of them named tokens that had
    // never existed at all - --warn, --positive and --negative - so the
    // light-theme colour they hardcoded rendered on the dark theme too.
    const components = Object.fromEntries(Object.entries(TSX).filter(([p]) => !p.includes('.test.')));
    expect(offenders(components, (line) => line.match(HEX)?.[0] ?? line.match(NON_TOKEN_COLOUR)?.[0] ?? null)).toEqual([]);
  });

  it('resolves every var() a stylesheet asks for', () => {
    // The fault bfd2bb8 found: --surface and --accent were referenced across
    // two stylesheets and defined nowhere, so every fallback fired and the
    // Dashboard ignored the chosen theme entirely. Definitions are collected
    // from every sheet, since component files legitimately scope their own
    // locals; what this catches is a name referenced somewhere and defined
    // nowhere.
    const defined = new Set<string>();
    for (const source of Object.values(CSS)) {
      for (const m of source.matchAll(/(--[a-z0-9-]+)\s*:/g)) defined.add(m[1]);
    }
    const missing = new Set<string>();
    for (const source of Object.values(CSS)) {
      for (const m of source.matchAll(/var\(\s*(--[a-z0-9-]+)/g)) {
        if (!defined.has(m[1])) missing.add(m[1]);
      }
    }
    expect([...missing].sort()).toEqual([]);
  });
});

describe('corners route through the radius tokens', () => {
  it('never hardcodes a border-radius', () => {
    // --radius for surfaces, --radius-pill for the badge family. `50%` is a
    // circle - a shape rather than a softened corner - and `inherit` defers
    // to whichever of the two an ancestor set.
    const ALLOWED = /^(var\(--radius\)( var\(--radius\))?( 0)*|var\(--radius-pill\)|50%|inherit|0)$/;
    const found = offenders(CSS, (line) => {
      for (const m of line.matchAll(/border-radius:\s*([^;]+)/g)) {
        const value = m[1].trim();
        if (!ALLOWED.test(value)) return value;
      }
      return null;
    });
    expect(found).toEqual([]);
  });

  it('keeps both radius tokens defined', () => {
    expect(CSS['./index.css']).toMatch(/^\s*--radius:/m);
    expect(CSS['./index.css']).toMatch(/^\s*--radius-pill:/m);
  });
});

describe('SPECTACLE keeps to one accent per screen', () => {
  // ART_DIRECTION.md §11: "No more than one neon accent per SPECTACLE screen."
  // Structural rather than remembered: the named neons are assignable to
  // --spec-neon and never read directly, so a screen physically cannot wear
  // two. This test is what stops that convention decaying into a palette.
  const NAMED_NEONS = /var\(\s*(--neon-[a-z]+)/g;
  const ASSIGNMENT = /--spec-neon:\s*var\(\s*--neon-[a-z]+\s*\)/g;

  it('never reads a named neon except to assign the screen its one accent', () => {
    const offenders: string[] = [];
    for (const [path, source] of Object.entries(CSS)) {
      source.split('\n').forEach((line, i) => {
        if (!NAMED_NEONS.test(line)) return;
        NAMED_NEONS.lastIndex = 0;
        // The only legal reading of a named neon is the assignment itself.
        if (!/--spec-neon:/.test(line) && !/^\s*--neon-[a-z]+:/.test(line)) {
          offenders.push(`${path}:${i + 1}  ${line.trim()}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it('gives each SPECTACLE screen at most one accent', () => {
    for (const [path, source] of Object.entries(CSS)) {
      const assignments = [...source.matchAll(ASSIGNMENT)];
      // One per screen root; a stylesheet carrying two screens may hold two,
      // but never two on the same selector - which is what this catches, since
      // a second assignment in the same rule block would be a duplicate
      // declaration on one root.
      const perSelector = new Map<string, number>();
      let selector = '';
      source.split('\n').forEach((line) => {
        if (line.includes('{')) selector = line.split('{')[0].trim() || selector;
        if (/--spec-neon:\s*var\(/.test(line)) perSelector.set(selector, (perSelector.get(selector) ?? 0) + 1);
      });
      for (const [sel, count] of perSelector) {
        expect(`${path} ${sel}: ${count}`).toBe(`${path} ${sel}: 1`);
      }
      expect(assignments.length).toBeLessThanOrEqual(8);
    }
  });
});

describe('numeric table columns line up', () => {
  // The DESK register asks for "tabular figures everywhere" (ART_DIRECTION.md
  // §2.1), and the base `th, td` rule left-aligns every cell in the grotesque -
  // so a column of figures neither lined up nor read as figures. `.num` fixes
  // that per column.
  //
  // The failure mode this guards is subtler than a missing class: a header
  // marked numeric whose cells are not (or the reverse) right-aligns one and
  // not the other, so the heading stops sitting over the column it names. That
  // happened while writing this - StatsPage ended up with 19 marked headers
  // against 16 marked cells.
  const TSX_SOURCES = Object.entries(TSX).filter(([p]) => !p.includes('.test.') && !p.includes('/dev/'));

  it('marks the same number of headers and cells in every table-bearing screen', () => {
    const mismatched: string[] = [];
    for (const [path, source] of TSX_SOURCES) {
      if (!source.includes('<table')) continue;
      const headers = (source.match(/<th className="num"/g) ?? []).length;
      const cells = (source.match(/<td className="num"/g) ?? []).length;
      if (headers !== cells) mismatched.push(`${path}  ${headers} headers vs ${cells} cells`);
    }
    expect(mismatched).toEqual([]);
  });

  it('defines the numeric column treatment it depends on', () => {
    expect(CSS['./index.css']).toMatch(/th\.num,\s*\n\s*td\.num \{/);
    expect(CSS['./index.css']).toMatch(/font-variant-numeric: tabular-nums/);
  });

  // Right-aligning a column does nothing if the figure itself comes apart. The
  // browser will break a line after the sign, so "-£30,265,414" in a column
  // narrow enough to need it renders "-" on one line and the digits on the
  // next - measured on the Dashboard filmography, all four profit figures.
  // A currency figure is one word.
  it('keeps a currency figure on one line', () => {
    expect(CSS['./index.css']).toMatch(/\.money \{[^}]*white-space: nowrap/);
  });
});

describe('studio progression is shown in weight, not hue', () => {
  // ART_DIRECTION.md §9 asks for progression in Tier 1 - a grander letterhead
  // rather than an office that redraws itself. The cheap way to fake that is a
  // gold nameplate at Major, which would be the accent filling a surface: the
  // rationing rule (65173bd) reserves it for state, and a studio's size is not
  // a state. So the escalation is allowed rules, faces, spacing and weight,
  // and nothing that carries colour.
  const LETTERHEAD = /\.studio-letterhead\[data-tier=[^{]*\{([^}]*)\}/g;

  it('gives the letterhead no colour at any tier', () => {
    const css = CSS['./components/Dashboard.css'];
    const coloured: string[] = [];
    for (const [block, body] of [...css.matchAll(LETTERHEAD)].map((m) => [m[0], m[1]] as const)) {
      if (/(?:^|[;{\s])(?:color|background|background-color|border-color)\s*:/.test(body)) {
        coloured.push(block.split('{')[0].trim());
      }
    }
    expect(coloured).toEqual([]);
  });

  it('actually has tiers to escalate through', () => {
    // Guards the test above against passing because the selectors were renamed
    // out from under it and it is now scanning nothing.
    const tiers = [...CSS['./components/Dashboard.css'].matchAll(LETTERHEAD)];
    expect(tiers.length).toBeGreaterThanOrEqual(2);
  });
});

describe('the one-sheet holds its own layout', () => {
  // The studio credit sits above the monogram on generated key art, and the
  // studio name is player-chosen: "Silver Reel Pictures" already wraps to two
  // lines at the small size, while "Q" takes one. The monogram is placed
  // against a RESERVED height rather than a rendered one, so the clearance is
  // the same whatever the player typed - measured at three name lengths across
  // both sizes. Drop the reservation and the long names collide.
  it('reserves the credit space instead of letting it grow', () => {
    const css = CSS['./components/common/GenrePoster.css'];
    const credit = css.match(/\.genre-poster__studio \{([^}]*)\}/)?.[1] ?? '';
    // Not just /height:/ - `line-height` contains it, which made the first
    // version of this assertion pass with the reservation deleted.
    expect(credit).toMatch(/(?<!line-)height:/);
    expect(credit).toMatch(/-webkit-line-clamp:\s*2/);
  });
});
