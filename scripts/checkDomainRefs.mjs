#!/usr/bin/env node
/**
 * Cross-reference integrity check for docs/domain/.
 *
 * The domain library cites itself by section number - `07` §3 or
 * `07-postproduction.md` §3. Those numbers are load-bearing: the library is
 * ~240k words across 17 files and the pointers are the only navigation
 * between them. Inserting a section in the middle of a document silently
 * breaks every inbound reference past it, and nothing else in the repo would
 * notice.
 *
 * This asserts every reference resolves to a heading that actually exists.
 * It does NOT check that the section is the *right* one - only that it is
 * real. Prose accuracy is still a human's job.
 *
 * Usage:  node scripts/checkDomainRefs.mjs
 * Exit 0 = all references resolve. Exit 1 = at least one is broken.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DOMAIN_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'domain');

/** `01-industry-structure.md` and friends - the numbered library files only. */
const DOC_RE = /^\d\d-.*\.md$/;

/**
 * A reference: a backticked two-digit doc number, optionally with the rest of
 * the filename, followed by one or more section marks and a number.
 * Matches `07` §3, `07` §§3, and `07-postproduction.md` §3.1.
 */
const REF_RE = /`(\d\d)(?:-[a-z0-9-]+\.md)?`\s*§+\s*(\d+(?:\.\d+)?)/g;

/** Headings are `## 3. Title` or `### 3.1 Title`. */
const HEADING_RE = /^#{2,3}\s+(\d+(?:\.\d+)?)\.?\s/gm;

const files = readdirSync(DOMAIN_DIR).filter((f) => DOC_RE.test(f)).sort();
if (files.length === 0) {
  console.error(`No domain documents found in ${DOMAIN_DIR}`);
  process.exit(1);
}

const byNumber = new Map(files.map((f) => [f.slice(0, 2), f]));
const sections = new Map(
  files.map((f) => {
    const text = readFileSync(join(DOMAIN_DIR, f), 'utf8');
    return [f, new Set(Array.from(text.matchAll(HEADING_RE), (m) => m[1]))];
  }),
);

const broken = [];
let checked = 0;

for (const file of files) {
  const lines = readFileSync(join(DOMAIN_DIR, file), 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const [text, num, section] of line.matchAll(REF_RE)) {
      checked++;
      const target = byNumber.get(num);
      if (!target) {
        broken.push({ file, line: i + 1, text, why: `no document numbered ${num}` });
      } else if (!sections.get(target).has(section)) {
        broken.push({ file, line: i + 1, text, why: `${target} has no §${section}` });
      }
    }
  });
}

console.log(`checked ${checked} cross-references across ${files.length} documents`);

if (broken.length === 0) {
  console.log('all references resolve');
  process.exit(0);
}

console.error(`\n${broken.length} broken:\n`);
for (const b of broken) {
  console.error(`  ${b.file}:${b.line}  ${b.text}  ->  ${b.why}`);
}
console.error(
  '\nSection numbers are referenced across documents. Append new sections ' +
    'rather than renumbering existing ones, or update every inbound reference.',
);
process.exit(1);
