// Dev utility for bulk-adding real-life cinematographers to
// src/data/handcraftedTalents.ts's HANDCRAFTED_CINEMATOGRAPHERS array.
//
// Usage: fill in NEW_CINEMATOGRAPHERS below, then:
//   node scripts/addHandcraftedCinematographers.mjs           (dry run)
//   node scripts/addHandcraftedCinematographers.mjs --write    (insert into the file)
//
// Each row: [slug, name, gender, age, fame, reliability, ego, salaryMillions, skill]
//   - slug '' auto-derives -> real-cinematographer-<slug>; gender -> dateOfBirth.year=-age.
//
// Derived like engine/talentGenerator.ts:generateTalent's crew path:
// professionalism/industryRespect mirror reliability; prestige/currentHeat/
// roleReputation mirror fame; experience mirrors skill.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const NEW_CINEMATOGRAPHERS = [
  ['', 'Adam Arkapaw', 'Male', 41, 35, 90, 12, 1.2, 85],
  ['', 'Adam Newport-Berra', 'Male', 40, 22, 88, 10, 0.7, 78],
  ['', 'Affonso Beato', 'Male', 79, 25, 88, 12, 0.8, 80],
  ['', 'Agnès Godard', 'Female', 74, 28, 90, 12, 0.8, 85],
  ['', 'Amir Mokri', 'Male', 68, 30, 88, 15, 1.2, 80],
  ['', 'Andrew Lesnie', 'Male', 59, 40, 90, 12, 1.5, 90],
  ['', 'Ari Wegner', 'Female', 41, 40, 90, 12, 1.5, 88],
  ['', 'Autumn Durald Arkapaw', 'Female', 42, 35, 90, 12, 1.2, 85],
  ['', 'Ava Berkofsky', 'Female', 42, 20, 88, 10, 0.6, 78],
  ['', 'Ben Davis', 'Male', 57, 35, 90, 12, 1.8, 85],
  ['', 'Ben Seresin', 'Male', 68, 30, 88, 12, 1.5, 80],
  ['', 'Benjamin Kračun', 'Male', 42, 25, 88, 12, 0.8, 80],
  ['', 'Benoît Delhomme', 'Male', 64, 30, 88, 12, 1.2, 84],
  ['', 'Bill Pope', 'Male', 73, 42, 90, 15, 2, 90],
  ['', 'Bojan Bazelli', 'Male', 68, 32, 88, 15, 1.5, 82],
  ['', 'Caroline Champetier', 'Female', 71, 28, 90, 12, 0.8, 85],
  ['', 'Chayse Irvin', 'Male', 38, 28, 88, 12, 1, 82],
  ['', 'Checco Varese', 'Male', 58, 25, 88, 12, 1, 80],
  ['', 'Claire Mathon', 'Female', 49, 38, 90, 12, 1.2, 90],
  ['', 'Danny Cohen', 'Male', 60, 32, 90, 12, 1.2, 84],
  ['', 'Dean Cundey', 'Male', 79, 42, 90, 15, 1.5, 88],
  ['', 'Don Burgess', 'Male', 69, 32, 90, 12, 1.5, 85],
  ['', 'Don McAlpine', 'Male', 88, 30, 90, 12, 1, 85],
  ['', 'Enrique Chediak', 'Male', 58, 30, 88, 12, 1.2, 82],
  ['', 'Eric Steelberg', 'Male', 50, 28, 88, 12, 1, 80],
  ['', 'Erik Messerschmidt', 'Male', 47, 40, 90, 12, 1.5, 88],
  ['', 'Florian Hoffmeister', 'Male', 55, 32, 90, 12, 1.2, 86],
  ['', 'Guillermo Navarro', 'Male', 70, 38, 90, 15, 1.5, 88],
  ['', 'Haris Zambarloukos', 'Male', 55, 32, 90, 12, 1.5, 84],
  ['', 'Hong Kyung-pyo', 'Male', 62, 35, 90, 12, 1.2, 90],
  ['', 'Hélène Louvart', 'Female', 65, 30, 90, 12, 0.9, 86],
  ['', 'Igor Jadue-Lillo', 'Male', 55, 22, 88, 10, 0.7, 78],
  ['', 'James Friend', 'Male', 50, 38, 90, 12, 1.5, 88],
  ['', 'Jas Shelton', 'Male', 52, 20, 88, 10, 0.6, 76],
  ['', 'John Mathieson', 'Male', 67, 42, 90, 15, 2, 90],
  ['', 'John Schwartzman', 'Male', 65, 38, 90, 15, 2, 86],
  ['', 'John Seale', 'Male', 83, 45, 92, 12, 2, 92],
  ['', 'Joshua James Richards', 'Male', 40, 32, 90, 12, 1.2, 85],
  ['', 'Jörg Widmer', 'Male', 65, 22, 90, 10, 0.8, 82],
  ['', 'Kim Ji-yong', 'Male', 50, 25, 88, 12, 0.9, 82],
  ['', 'Lawrence Sher', 'Male', 55, 38, 90, 12, 1.8, 85],
  ['', 'László Kovács', 'Male', 66, 35, 90, 15, 1.2, 90],
  ['', 'Manuel Alberto Claro', 'Male', 52, 25, 88, 12, 0.9, 82],
  ['', 'Maryse Alberti', 'Female', 71, 30, 90, 12, 1, 84],
  ['', 'Masanobu Takayanagi', 'Male', 56, 32, 90, 12, 1.5, 86],
  ['', 'Mauro Fiore', 'Male', 61, 38, 90, 12, 1.8, 86],
  ['', 'Michael Seresin', 'Male', 83, 32, 90, 12, 1.2, 85],
  ['', 'Mihai Mălaimare Jr.', 'Male', 50, 32, 90, 12, 1.2, 86],
  ['', 'Natasha Braier', 'Female', 49, 32, 88, 12, 1.2, 85],
  ['', 'Newton Thomas Sigel', 'Male', 65, 38, 90, 12, 1.8, 86],
];

const __dirname = dirname(fileURLToPath(import.meta.url));
const TARGET_FILE = resolve(__dirname, '../src/data/handcraftedTalents.ts');

function toSlug(name) {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function formatEntry([slug, name, gender, age, fame, reliability, ego, salaryM, skill]) {
  const id = `real-cinematographer-${slug || toSlug(name)}`;
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
    `        primaryRole: 'Cinematographer',`,
    `        careers: {`,
    `            cinematographer: {`,
    `                role: 'Cinematographer',`,
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
  if (NEW_CINEMATOGRAPHERS.length === 0) { console.error('NEW_CINEMATOGRAPHERS is empty.'); process.exit(1); }
  const content = readFileSync(TARGET_FILE, 'utf8');
  const existingNames = new Set([...content.matchAll(/name: '((?:[^'\\]|\\.)*)'/g)].map((m) => m[1].replace(/\\'/g, "'")));
  const newNames = NEW_CINEMATOGRAPHERS.map((r) => r[1]);
  const dupesFile = newNames.filter((n) => existingNames.has(n));
  const dupesBatch = newNames.filter((n, i) => newNames.indexOf(n) !== i);
  if (dupesFile.length) { console.error('Already in file:', dupesFile); process.exit(1); }
  if (dupesBatch.length) { console.error('Dup within batch:', [...new Set(dupesBatch)]); process.exit(1); }
  const generated = NEW_CINEMATOGRAPHERS.map(formatEntry).join('\n');
  if (!process.argv.includes('--write')) {
    console.log(generated);
    console.error(`\n(dry run - ${NEW_CINEMATOGRAPHERS.length} entries. Re-run with --write.)`);
    return;
  }
  const marker = '];\n\nexport const HANDCRAFTED_COMPOSERS';
  const idx = content.indexOf(marker);
  if (idx === -1) throw new Error('HANDCRAFTED_CINEMATOGRAPHERS close marker not found.');
  writeFileSync(TARGET_FILE, content.slice(0, idx) + generated + '\n' + content.slice(idx), 'utf8');
  console.error(`Inserted ${NEW_CINEMATOGRAPHERS.length} cinematographers into ${TARGET_FILE}`);
}

main();
