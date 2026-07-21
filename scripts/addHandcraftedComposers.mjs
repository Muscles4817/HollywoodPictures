// Dev utility for bulk-adding real-life composers to
// src/data/handcraftedTalents.ts's HANDCRAFTED_COMPOSERS array.
//
// Usage: fill in NEW_COMPOSERS below, then:
//   node scripts/addHandcraftedComposers.mjs           (dry run)
//   node scripts/addHandcraftedComposers.mjs --write    (insert into the file)
//
// Each row: [slug, name, gender, age, fame, reliability, ego, salaryMillions, skill]
//   - slug '' auto-derives -> real-composer-<slug>; gender -> dateOfBirth.year=-age.
//
// Derived like engine/talentGenerator.ts:generateTalent's crew path:
// professionalism/industryRespect mirror reliability; prestige/currentHeat/
// roleReputation mirror fame; experience mirrors skill.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const NEW_COMPOSERS = [
  ['', 'A.R. Rahman', 'Male', 59, 55, 90, 20, 2, 92],
  ['', 'Alan Silvestri', 'Male', 75, 48, 92, 15, 2.5, 92],
  ['', 'Amie Doherty', 'Female', 40, 20, 90, 10, 0.4, 72],
  ['', 'Anne Dudley', 'Female', 69, 30, 90, 12, 0.8, 82],
  ['', 'Atticus Ross', 'Male', 57, 42, 88, 18, 1.5, 85],
  ['', 'Basil Poledouris', 'Male', 66, 32, 88, 15, 1, 82],
  ['', 'Benjamin Wallfisch', 'Male', 45, 38, 90, 15, 1.2, 82],
  ['', 'Bernard Herrmann', 'Male', 63, 40, 90, 20, 1.5, 95],
  ['', 'Brian Tyler', 'Male', 53, 40, 90, 15, 1.5, 82],
  ['', 'Carter Burwell', 'Male', 70, 42, 92, 12, 1.5, 88],
  ['', 'Cliff Martinez', 'Male', 71, 38, 88, 15, 1.2, 82],
  ['', 'Clint Mansell', 'Male', 62, 45, 88, 15, 1.2, 85],
  ['', 'Craig Armstrong', 'Male', 66, 35, 90, 12, 1, 82],
  ['', 'Cristobal Tapia de Veer', 'Male', 51, 35, 85, 18, 1, 82],
  ['', 'Dario Marianelli', 'Male', 62, 38, 90, 12, 1.2, 85],
  ['', 'David Newman', 'Male', 71, 32, 90, 12, 1, 80],
  ['', 'Debbie Wiseman', 'Female', 62, 28, 90, 10, 0.8, 80],
  ['', 'Elliot Goldenthal', 'Male', 71, 35, 88, 18, 1.2, 85],
  ['', 'Elmer Bernstein', 'Male', 64, 42, 90, 15, 1.5, 92],
  ['', 'Emile Mosseri', 'Male', 40, 30, 88, 12, 0.8, 80],
  ['', 'Ennio Morricone', 'Male', 70, 60, 92, 22, 3, 98],
  ['', 'Fil Eisler', 'Male', 48, 22, 88, 12, 0.6, 75],
  ['', 'Gabriel Yared', 'Male', 76, 40, 90, 15, 1.5, 88],
  ['', 'George Fenton', 'Male', 75, 32, 90, 12, 1, 82],
  ['', 'Germaine Franco', 'Female', 62, 32, 90, 12, 1, 80],
  ['', 'Graeme Revell', 'Male', 70, 30, 88, 12, 1, 78],
  ['', 'Harry Gregson-Williams', 'Male', 63, 45, 92, 15, 2, 85],
  ['', 'Henry Jackman', 'Male', 51, 42, 90, 15, 1.5, 82],
  ['', 'James Horner', 'Male', 61, 55, 90, 20, 3, 95],
  ['', 'Jeff Russo', 'Male', 55, 35, 90, 12, 1.2, 80],
  ['', 'Jerry Goldsmith', 'Male', 68, 48, 92, 20, 2.5, 95],
  ['', 'Joe Hisaishi', 'Male', 74, 55, 92, 18, 2.5, 95],
  ['', 'John Barry', 'Male', 66, 50, 90, 20, 2.5, 95],
  ['', 'Jon Batiste', 'Male', 39, 55, 88, 18, 1.5, 85],
  ['', 'Jonny Greenwood', 'Male', 54, 52, 85, 20, 1.5, 88],
  ['', 'Justin Hurwitz', 'Male', 40, 45, 90, 15, 1.5, 85],
  ['', 'Jóhann Jóhannsson', 'Male', 50, 42, 88, 18, 1.5, 90],
  ['', 'Kris Bowers', 'Male', 36, 40, 90, 12, 1.2, 82],
  ['', 'Lorne Balfe', 'Male', 49, 42, 90, 15, 1.8, 82],
  ['', 'Marco Beltrami', 'Male', 59, 40, 90, 15, 1.5, 85],
  ['', 'Max Richter', 'Male', 59, 48, 88, 18, 1.5, 88],
  ['', 'Mica Levi', 'NonBinary', 38, 40, 85, 20, 1, 85],
  ['', 'Natalie Holt', 'Female', 47, 30, 88, 12, 0.9, 80],
  ['', 'Nicholas Britell', 'Male', 45, 50, 90, 15, 2, 90],
  ['', 'Patrick Doyle', 'Male', 72, 38, 92, 12, 1.5, 88],
  ['', 'Pinar Toprak', 'Female', 44, 38, 90, 12, 1.2, 82],
  ['', 'Rachel Portman', 'Female', 65, 38, 92, 12, 1.5, 88],
  ['', 'Rael Jones', 'Male', 45, 20, 88, 10, 0.5, 75],
  ['', 'Randy Newman', 'Male', 81, 52, 88, 20, 2.5, 90],
  ['', 'Rupert Gregson-Williams', 'Male', 59, 38, 90, 15, 1.5, 82],
];

const __dirname = dirname(fileURLToPath(import.meta.url));
const TARGET_FILE = resolve(__dirname, '../src/data/handcraftedTalents.ts');

function toSlug(name) {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function formatEntry([slug, name, gender, age, fame, reliability, ego, salaryM, skill]) {
  const id = `real-composer-${slug || toSlug(name)}`;
  const escapedName = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const salary = Math.round(salaryM * 1_000_000).toLocaleString('en-US').replace(/,/g, '_');
  return [
    `    {`,
    `        id: '${id}',`,
    `        identity: {`,
    `            name: '${escapedName}',`,
    `            appearanceTags: [],`,
    `            gender: '${gender}',`,
    `            dateOfBirth: { year: ${-age}, month: 7, day: 1 },`,
    `        },`,
    `        personality: {`,
    `            professionalism: ${reliability},`,
    `            ambition: 50,`,
    `            loyalty: 50,`,
    `            ego: ${ego},`,
    `            temperament: 50,`,
    `            pressureHandling: 50,`,
    `            controversy: 20,`,
    `            adaptability: 50,`,
    `        },`,
    `        reputation: {`,
    `            fame: ${fame},`,
    `            prestige: ${fame},`,
    `            industryRespect: ${reliability},`,
    `            reliability: ${reliability},`,
    `            currentHeat: ${fame},`,
    `        },`,
    `        primaryRole: 'Composer',`,
    `        careers: {`,
    `            composer: {`,
    `                role: 'Composer',`,
    `                active: true,`,
    `                experience: ${skill},`,
    `                roleReputation: ${fame},`,
    `                minimumSalary: ${salary},`,
    `                typicalSalary: ${salary},`,
    `                skill: ${skill},`,
    `            },`,
    `        },`,
    `        availability: { commitments: [] },`,
    `        traits: [],`,
    `    },`,
  ].join('\n');
}

function main() {
  if (NEW_COMPOSERS.length === 0) { console.error('NEW_COMPOSERS is empty.'); process.exit(1); }
  const content = readFileSync(TARGET_FILE, 'utf8');
  const existingNames = new Set([...content.matchAll(/name: '((?:[^'\\]|\\.)*)'/g)].map((m) => m[1].replace(/\\'/g, "'")));
  const newNames = NEW_COMPOSERS.map((r) => r[1]);
  const dupesFile = newNames.filter((n) => existingNames.has(n));
  const dupesBatch = newNames.filter((n, i) => newNames.indexOf(n) !== i);
  if (dupesFile.length) { console.error('Already in file:', dupesFile); process.exit(1); }
  if (dupesBatch.length) { console.error('Dup within batch:', [...new Set(dupesBatch)]); process.exit(1); }
  const generated = NEW_COMPOSERS.map(formatEntry).join('\n');
  if (!process.argv.includes('--write')) {
    console.log(generated);
    console.error(`\n(dry run - ${NEW_COMPOSERS.length} entries. Re-run with --write.)`);
    return;
  }
  // HANDCRAFTED_COMPOSERS is the last talent array - followed by the
  // HANDCRAFTED_TALENTS_BY_ROLE map's leading doc comment, not another export.
  const marker = '];\n\n/**\n * Partial on purpose';
  const idx = content.indexOf(marker);
  if (idx === -1) throw new Error('HANDCRAFTED_COMPOSERS close marker not found.');
  writeFileSync(TARGET_FILE, content.slice(0, idx) + generated + '\n' + content.slice(idx), 'utf8');
  console.error(`Inserted ${NEW_COMPOSERS.length} composers into ${TARGET_FILE}`);
}

main();
