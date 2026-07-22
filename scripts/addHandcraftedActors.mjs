// Dev utility for bulk-adding real-life actors to
// src/data/handcraftedTalents.ts's HANDCRAFTED_ACTORS array.
//
// Usage: fill in the NEW_ACTORS table below, then run:
//   node scripts/addHandcraftedActors.mjs           (dry run - prints the generated block)
//   node scripts/addHandcraftedActors.mjs --write    (inserts into the real file)
//
// Each row: [slug, tier, name, gender, age, fame, reliability, ego,
//   salaryMillions, characterTransformation, emotionalPerformance, charisma,
//   comedy, physicalPerformance]
//   - slug: '' auto-derives a kebab id from the name.
//   - tier: 'lead' or 'supporting' - purely a naming convention (both become
//     plain Actor Person objects with careers.actor.role 'Actor'), used to keep
//     ids readable.
//   - gender: 'Male' | 'Female' | 'NonBinary'.
//   - age: real-ish age; becomes identity.dateOfBirth.year = -age (Year 1 is
//     "now", same convention engine/talentGenerator.ts uses).
//   - fame/reliability/ego and the five acting axes are 1-100.
//   - salaryMillions is the actor's typical (and minimum) per-film fee.
//
// The full Person object is derived the same way a generated one is
// (engine/talentGenerator.ts:generateTalent): professionalism/industryRespect
// mirror reliability; prestige/currentHeat/roleReputation mirror fame;
// experience is the mean of the five acting axes; the remaining personality
// axes take the generator's neutral defaults.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const NEW_ACTORS = [
  ['', 'supporting', 'Aaron Paul', 'Male', 46, 52, 88, 15, 2, 60, 70, 65, 35, 40],
  ['', 'lead', 'Amy Poehler', 'Female', 54, 62, 88, 15, 4, 40, 50, 78, 85, 25],
  ['', 'supporting', 'Ana de la Reguera', 'Female', 48, 38, 85, 15, 1.2, 45, 52, 65, 35, 35],
  ['', 'supporting', 'Anna Gunn', 'Female', 57, 42, 88, 15, 1.5, 58, 65, 60, 25, 25],
  ['', 'supporting', 'Anya Chalotra', 'Female', 29, 42, 85, 15, 1.5, 48, 55, 65, 25, 40],
  ['', 'lead', 'Aubrey Plaza', 'Female', 41, 58, 85, 18, 2.5, 55, 58, 70, 78, 30],
  ['', 'lead', 'Ayo Edebiri', 'Female', 30, 55, 88, 12, 2, 52, 60, 70, 78, 25],
  ['', 'supporting', 'Betsy Brandt', 'Female', 52, 32, 90, 10, 1, 45, 55, 60, 40, 20],
  ['', 'lead', 'Bill Nighy', 'Male', 75, 62, 92, 15, 2.5, 72, 74, 78, 60, 30],
  ['', 'lead', 'Bob Odenkirk', 'Male', 63, 58, 90, 15, 2.5, 68, 70, 70, 68, 35],
  ['', 'lead', 'Brendan Fraser', 'Male', 57, 65, 85, 15, 3, 62, 72, 72, 55, 50],
  ['', 'supporting', 'Charles Melton', 'Male', 34, 42, 85, 15, 1.5, 52, 62, 68, 30, 40],
  ['', 'lead', 'Charlie Cox', 'Male', 43, 50, 90, 12, 2, 55, 62, 70, 35, 50],
  ['', 'supporting', 'Cheech Marin', 'Male', 79, 45, 85, 15, 1, 40, 45, 68, 78, 25],
  ['', 'supporting', "D'Arcy Carden", 'Female', 45, 40, 88, 12, 1.2, 45, 50, 68, 75, 25],
  ['', 'supporting', "Da'Vine Joy Randolph", 'Female', 39, 52, 90, 12, 2, 62, 72, 68, 55, 25],
  ['', 'supporting', 'Dean Norris', 'Male', 62, 42, 88, 12, 1.2, 52, 58, 62, 35, 40],
  ['', 'supporting', 'Deborah Ann Woll', 'Female', 40, 38, 88, 12, 1.2, 48, 58, 62, 25, 35],
  ['', 'supporting', 'Dominic Sessa', 'Male', 23, 32, 85, 12, 0.8, 52, 60, 58, 40, 25],
  ['', 'supporting', 'Ebon Moss-Bachrach', 'Male', 48, 45, 88, 15, 1.5, 58, 62, 62, 45, 35],
  ['', 'supporting', 'Elden Henson', 'Male', 48, 32, 88, 12, 1, 42, 50, 60, 35, 35],
  ['', 'supporting', 'Franz Rogowski', 'Male', 39, 42, 88, 12, 1.2, 68, 70, 60, 30, 40],
  ['', 'supporting', 'Freya Allan', 'Female', 24, 35, 85, 12, 1, 45, 52, 60, 25, 40],
  ['', 'lead', 'Jacob Elordi', 'Male', 28, 58, 82, 20, 2.5, 50, 58, 75, 30, 45],
  ['', 'supporting', 'Jaime Camil', 'Male', 52, 35, 85, 15, 1, 40, 48, 70, 60, 30],
  ['', 'lead', 'Jeff Goldblum', 'Male', 73, 72, 85, 25, 3, 58, 60, 82, 68, 35],
  ['', 'supporting', 'Jenna Coleman', 'Female', 39, 42, 88, 12, 1.5, 50, 58, 68, 35, 30],
  ['', 'lead', 'Jeremy Allen White', 'Male', 34, 58, 85, 15, 2.5, 62, 72, 68, 40, 40],
  ['', 'lead', 'Jesse Eisenberg', 'Male', 42, 58, 85, 18, 2.5, 62, 62, 60, 55, 30],
  ['', 'supporting', "Jim O'Heir", 'Male', 62, 28, 90, 8, 0.8, 32, 40, 58, 68, 20],
  ['', 'supporting', 'Joaquim de Almeida', 'Male', 68, 35, 88, 15, 1, 52, 55, 65, 25, 40],
  ['', 'lead', 'Jodie Comer', 'Female', 32, 62, 90, 15, 3, 72, 75, 72, 40, 45],
  ['', 'supporting', 'Joey Batey', 'Male', 36, 30, 88, 10, 0.9, 45, 52, 65, 50, 30],
  ['', 'supporting', 'John Leguizamo', 'Male', 61, 52, 85, 18, 1.5, 55, 58, 72, 72, 40],
  ['', 'lead', 'Jon Bernthal', 'Male', 49, 55, 88, 15, 2.5, 60, 65, 68, 30, 62],
  ['', 'lead', 'Jonah Hill', 'Male', 41, 62, 82, 22, 4, 58, 60, 65, 78, 30],
  ['', 'supporting', 'Jonathan Banks', 'Male', 78, 45, 90, 12, 1.5, 62, 62, 62, 30, 30],
  ['', 'supporting', 'Justin Min', 'Male', 35, 35, 88, 12, 1, 50, 58, 62, 40, 35],
  ['', 'supporting', 'Justin Theroux', 'Male', 54, 45, 85, 18, 1.5, 52, 55, 70, 45, 40],
  ['', 'lead', 'Karen Gillan', 'Female', 38, 58, 85, 15, 2.5, 48, 55, 72, 45, 55],
  ['', 'lead', 'Kristin Scott Thomas', 'Female', 65, 55, 92, 15, 2, 72, 75, 70, 35, 25],
  ['', 'supporting', 'Krysten Ritter', 'Female', 44, 45, 85, 15, 1.5, 50, 55, 68, 45, 40],
  ['', 'supporting', 'Luis Guzmán', 'Male', 68, 42, 88, 12, 1, 45, 50, 68, 55, 35],
  ['', 'supporting', 'Manny Jacinto', 'Male', 38, 40, 88, 12, 1.2, 45, 52, 68, 55, 40],
  ['', 'supporting', 'Marc Evan Jackson', 'Male', 55, 30, 90, 10, 0.9, 38, 45, 60, 68, 20],
  ['', 'lead', 'Martin Freeman', 'Male', 54, 60, 90, 15, 2.5, 62, 68, 68, 58, 30],
  ['', 'lead', 'Maya Rudolph', 'Female', 53, 60, 88, 15, 3, 45, 55, 75, 85, 25],
  ['', 'lead', 'Melanie Lynskey', 'Female', 48, 55, 90, 12, 2, 65, 75, 65, 50, 25],
  ['', 'lead', 'Mia Goth', 'Female', 32, 52, 85, 18, 2, 65, 68, 62, 25, 45],
  ['', 'supporting', 'Michael Cera', 'Male', 37, 52, 85, 15, 2, 50, 55, 58, 70, 25],
];

const __dirname = dirname(fileURLToPath(import.meta.url));
const TARGET_FILE = resolve(__dirname, '../src/data/handcraftedTalents.ts');

function toSlug(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function formatEntry([slug, tier, name, gender, age, fame, reliability, ego, salaryM, ct, ep, ch, co, pp]) {
  const id = `real-${tier}-actor-${slug || toSlug(name)}`;
  const escapedName = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const salary = Math.round(salaryM * 1_000_000)
    .toLocaleString('en-US')
    .replace(/,/g, '_');
  // Same derivations engine/talentGenerator.ts:generateTalent uses so a
  // handcrafted actor is shaped identically to a generated one.
  const experience = Math.round((ct + ep + ch + co + pp) / 5);
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
    `        primaryRole: 'Actor',`,
    `        careers: {`,
    `            actor: {`,
    `                role: 'Actor',`,
    `                active: true,`,
    `                experience: ${experience},`,
    `                roleReputation: ${fame},`,
    `                minimumSalary: ${salary},`,
    `                typicalSalary: ${salary},`,
    `                actingStyle: {`,
    `                    characterTransformation: ${ct},`,
    `                    emotionalPerformance: ${ep},`,
    `                    charisma: ${ch},`,
    `                    comedy: ${co},`,
    `                    physicalPerformance: ${pp},`,
    `                },`,
    `            },`,
    `        },`,
    `        availability: { commitments: [] },`,
    `        traits: [],`,
    `    },`,
  ].join('\n');
}

function main() {
  if (NEW_ACTORS.length === 0) {
    console.error('NEW_ACTORS is empty - fill in the table at the top of this script first.');
    process.exit(1);
  }

  const content = readFileSync(TARGET_FILE, 'utf8');
  const existingNames = new Set([...content.matchAll(/name: '((?:[^'\\]|\\.)*)'/g)].map((m) => m[1].replace(/\\'/g, "'")));

  const newNames = NEW_ACTORS.map((row) => row[2]);
  const dupesAgainstFile = newNames.filter((n) => existingNames.has(n));
  const dupesWithinBatch = newNames.filter((n, i) => newNames.indexOf(n) !== i);
  if (dupesAgainstFile.length > 0) {
    console.error('Already in the file, remove from NEW_ACTORS:', dupesAgainstFile);
    process.exit(1);
  }
  if (dupesWithinBatch.length > 0) {
    console.error('Duplicated within NEW_ACTORS itself:', [...new Set(dupesWithinBatch)]);
    process.exit(1);
  }

  const generated = NEW_ACTORS.map(formatEntry).join('\n');

  if (!process.argv.includes('--write')) {
    console.log(generated);
    console.error(`\n(dry run - ${NEW_ACTORS.length} entries. Re-run with --write to insert into the file.)`);
    return;
  }

  const marker = '];\n\nexport const HANDCRAFTED_WRITERS';
  const idx = content.indexOf(marker);
  if (idx === -1) throw new Error('Could not find HANDCRAFTED_ACTORS closing bracket - file structure may have changed.');

  const updated = content.slice(0, idx) + generated + '\n' + content.slice(idx);
  writeFileSync(TARGET_FILE, updated, 'utf8');
  console.error(`Inserted ${NEW_ACTORS.length} actors into ${TARGET_FILE}`);
}

main();
