// Dev utility for bulk-adding real-life actors to
// src/data/handcraftedTalents.ts's HANDCRAFTED_ACTORS array.
//
// Usage: fill in the NEW_ACTORS table below, then run:
//   node scripts/addHandcraftedActors.mjs           (dry run - prints the generated block)
//   node scripts/addHandcraftedActors.mjs --write    (inserts into the real file)
//
// Each row: [slug, tier, name, fame, reliability, ego, salaryMillions,
//   characterTransformation, emotionalPerformance, charisma, comedy, physicalPerformance]
// tier is 'lead' or 'supporting' - purely a naming convention (both become
// plain ActorTalent objects with role: 'Actor'), used to keep ids readable.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const NEW_ACTORS = [
  ['', 'lead', 'Casper Van Dien', 42, 82, 22, 0.25, 30, 42, 68, 20, 55],
  ['', 'lead', 'Steven Seagal', 45, 55, 45, 0.3, 20, 32, 55, 10, 60],
  ['', 'supporting', 'Vinnie Jones', 45, 82, 25, 0.25, 30, 38, 62, 20, 65],
  ['', 'supporting', 'Luke Goss', 32, 85, 15, 0.15, 35, 42, 60, 15, 50],
  ['', 'supporting', 'Cam Gigandet', 35, 82, 18, 0.2, 32, 42, 65, 15, 40],
  ['', 'supporting', 'C. Thomas Howell', 32, 85, 15, 0.15, 40, 48, 60, 20, 30],
  ['', 'supporting', 'Costas Mandylor', 30, 85, 15, 0.15, 32, 40, 58, 10, 35],
  ['', 'supporting', 'Tobin Bell', 42, 90, 12, 0.25, 55, 55, 58, 10, 20],
  ['', 'supporting', 'Shawnee Smith', 32, 88, 12, 0.15, 38, 48, 60, 20, 25],
  ['', 'supporting', 'Robert Englund', 48, 88, 15, 0.2, 45, 50, 68, 25, 30],
  ['', 'supporting', 'Doug Bradley', 30, 88, 12, 0.1, 40, 45, 55, 5, 20],
  ['', 'supporting', 'Bill Moseley', 30, 82, 18, 0.1, 42, 45, 55, 15, 25],
  ['', 'supporting', 'Heather Langenkamp', 30, 88, 10, 0.1, 32, 42, 55, 10, 20],
  ['', 'supporting', 'Amanda Wyss', 22, 85, 10, 0.08, 25, 35, 50, 10, 20],
  ['', 'supporting', 'Kane Hodder', 32, 88, 12, 0.1, 20, 28, 50, 5, 55],
  ['', 'supporting', 'Corey Feldman', 40, 55, 30, 0.12, 30, 40, 60, 30, 25],
  ['', 'supporting', 'Judge Reinhold', 32, 85, 15, 0.15, 32, 42, 62, 45, 20],
  ['', 'supporting', 'Ione Skye', 25, 85, 12, 0.1, 35, 45, 55, 15, 15],
  ['', 'supporting', 'Ally Sheedy', 32, 82, 18, 0.12, 42, 50, 58, 15, 15],
  ['', 'supporting', 'Molly Ringwald', 42, 88, 15, 0.2, 42, 55, 70, 30, 15],
  ['', 'supporting', 'Anthony Michael Hall', 35, 80, 20, 0.15, 38, 48, 62, 40, 20],
  ['', 'supporting', 'Andrew McCarthy', 32, 85, 15, 0.12, 35, 45, 62, 25, 15],
  ['', 'supporting', 'Emilio Estevez', 38, 85, 20, 0.2, 42, 50, 68, 20, 30],
  ['', 'lead', 'Lacey Chabert', 38, 92, 12, 0.2, 32, 45, 70, 35, 15],
  ['', 'supporting', 'Danica McKellar', 32, 90, 10, 0.12, 28, 40, 65, 25, 15],
  ['', 'supporting', 'Autumn Reeser', 25, 90, 10, 0.1, 30, 42, 62, 25, 15],
  ['', 'supporting', 'Alicia Witt', 28, 88, 12, 0.12, 40, 50, 62, 20, 15],
  ['', 'supporting', 'Ashley Williams', 25, 90, 10, 0.1, 30, 42, 65, 30, 15],
  ['', 'supporting', 'Andrew Walker', 22, 90, 10, 0.1, 25, 38, 65, 20, 15],
  ['', 'supporting', 'Paul Campbell', 20, 88, 10, 0.08, 25, 38, 62, 20, 15],
  ['', 'supporting', 'Tyler Hynes', 22, 90, 10, 0.1, 28, 40, 65, 25, 15],
  ['', 'supporting', 'Luke Macfarlane', 25, 90, 10, 0.12, 32, 42, 65, 20, 15],
  ['', 'lead', 'Chad Michael Murray', 42, 82, 22, 0.25, 32, 45, 72, 25, 25],
  ['', 'supporting', 'Colin Egglesfield', 20, 88, 12, 0.08, 25, 38, 60, 15, 15],
  ['', 'lead', 'Kirk Cameron', 35, 78, 30, 0.15, 25, 38, 65, 30, 15],
  ['', 'lead', 'Kevin Sorbo', 35, 75, 28, 0.15, 25, 38, 62, 20, 45],
  ['', 'supporting', 'David A.R. White', 22, 88, 15, 0.08, 28, 40, 58, 15, 15],
  ['', 'lead', 'Candace Cameron Bure', 40, 88, 15, 0.2, 30, 45, 72, 35, 15],
  ['', 'supporting', 'Alexa PenaVega', 28, 88, 12, 0.12, 32, 45, 65, 25, 20],
  ['', 'supporting', 'Carlos PenaVega', 25, 88, 12, 0.1, 28, 40, 65, 25, 20],
  ['', 'supporting', 'Kellan Lutz', 42, 78, 25, 0.2, 25, 38, 68, 15, 45],
  ['', 'supporting', 'Peter Facinelli', 38, 85, 18, 0.18, 38, 48, 68, 25, 20],
  ['', 'supporting', 'Ashley Greene', 35, 85, 18, 0.15, 30, 42, 65, 15, 20],
  ['', 'supporting', 'Nikki Reed', 32, 85, 15, 0.12, 35, 45, 62, 15, 15],
  ['', 'supporting', 'Jackson Rathbone', 30, 85, 15, 0.12, 32, 42, 62, 20, 20],
  ['', 'supporting', 'Booboo Stewart', 25, 85, 12, 0.1, 28, 38, 58, 15, 30],
  ['', 'supporting', 'BD Wong', 35, 92, 12, 0.15, 55, 58, 58, 15, 15],
  ['', 'supporting', 'Kelli Giddish', 30, 90, 10, 0.15, 42, 50, 60, 15, 20],
  ['', 'lead', 'Chris Meloni', 45, 90, 18, 0.3, 55, 58, 74, 20, 40],
  ['', 'lead', 'Mariska Hargitay', 50, 92, 15, 0.35, 55, 62, 74, 15, 20],
  ['', 'supporting', 'Peter Bergman', 22, 92, 10, 0.08, 38, 45, 60, 15, 10],
  ['', 'supporting', 'Eric Braeden', 25, 92, 15, 0.1, 42, 48, 62, 10, 10],
  ['', 'lead', 'Susan Lucci', 38, 92, 20, 0.2, 45, 55, 72, 15, 10],
  ['', 'supporting', 'Maura West', 20, 92, 10, 0.08, 40, 48, 58, 10, 10],
  ['', 'supporting', 'Michael Trevino', 25, 85, 15, 0.1, 28, 38, 62, 15, 30],
  ['', 'lead', 'Ian Somerhalder', 45, 82, 25, 0.3, 35, 48, 78, 15, 30],
  ['', 'lead', 'Nina Dobrev', 45, 88, 18, 0.3, 42, 52, 76, 25, 25],
  ['', 'supporting', 'Paul Wesley', 38, 88, 15, 0.2, 38, 48, 70, 15, 25],
  ['', 'supporting', 'Zach Roerig', 22, 85, 12, 0.08, 25, 35, 60, 15, 20],
  ['', 'supporting', 'Candice King', 22, 88, 10, 0.08, 28, 38, 62, 15, 15],
  ['', 'supporting', 'Kat Graham', 30, 85, 15, 0.12, 30, 42, 68, 20, 25],
  ['', 'supporting', 'Steven R. McQueen', 25, 85, 15, 0.1, 25, 35, 62, 15, 30],
  ['', 'supporting', 'Matt Davis', 20, 88, 10, 0.08, 25, 35, 60, 15, 15],
  ['', 'supporting', 'Torrey DeVitto', 20, 88, 10, 0.08, 28, 38, 58, 10, 15],
  ['', 'supporting', 'Claire Holt', 28, 85, 12, 0.1, 30, 40, 65, 15, 25],
  ['', 'supporting', 'Phoebe Tonkin', 30, 85, 15, 0.12, 32, 42, 68, 15, 25],
  ['', 'supporting', 'Joseph Morgan', 30, 85, 18, 0.12, 38, 48, 68, 15, 20],
  ['', 'supporting', 'Daniel Gillies', 25, 85, 15, 0.1, 32, 42, 62, 15, 20],
  ['', 'supporting', 'Charles Michael Davis', 22, 85, 12, 0.08, 28, 38, 62, 15, 25],
  ['', 'supporting', 'Riley Voelkel', 18, 85, 10, 0.06, 25, 35, 58, 10, 15],
  ['', 'supporting', 'Danielle Campbell', 20, 85, 12, 0.08, 25, 35, 58, 15, 15],
  ['', 'supporting', 'Yusuf Gatewood', 15, 85, 10, 0.06, 28, 35, 55, 10, 15],
  ['', 'supporting', 'Freya Tingley', 15, 85, 10, 0.06, 25, 32, 52, 10, 15],
  ['', 'supporting', 'Christian Kane', 28, 85, 15, 0.12, 32, 42, 65, 20, 30],
  ['', 'supporting', 'Adrianne Palicki', 32, 82, 18, 0.15, 32, 42, 68, 15, 35],
  ['', 'supporting', 'Rachael Taylor', 25, 85, 12, 0.1, 30, 40, 62, 15, 20],
  ['', 'lead', 'Sarah Michelle Gellar', 55, 88, 20, 0.4, 42, 55, 78, 25, 45],
  ['', 'supporting', 'Alyson Hannigan', 45, 90, 15, 0.25, 35, 48, 72, 40, 15],
  ['', 'supporting', 'Nicholas Brendon', 30, 68, 20, 0.1, 30, 40, 65, 45, 15],
  ['', 'supporting', 'James Marsters', 35, 85, 18, 0.15, 42, 50, 70, 20, 25],
  ['', 'supporting', 'Amber Benson', 20, 88, 10, 0.08, 32, 42, 58, 20, 10],
  ['', 'supporting', 'Charisma Carpenter', 32, 85, 18, 0.15, 30, 42, 72, 25, 15],
  ['', 'supporting', 'Emma Caulfield', 22, 85, 12, 0.08, 28, 38, 62, 30, 10],
  ['', 'lead', 'David Boreanaz', 42, 88, 18, 0.25, 38, 50, 74, 15, 25],
  ['', 'supporting', 'Julie Benz', 25, 88, 12, 0.1, 32, 42, 62, 15, 15],
  ['', 'supporting', 'J. August Richards', 20, 90, 10, 0.08, 35, 42, 60, 15, 20],
  ['', 'supporting', 'Amy Acker', 22, 90, 10, 0.1, 40, 48, 60, 15, 15],
  ['', 'supporting', 'Tom Lenk', 15, 88, 10, 0.05, 28, 35, 55, 45, 10],
  ['', 'supporting', 'Iyari Limon', 12, 85, 10, 0.05, 22, 30, 52, 10, 20],
  ['', 'supporting', 'Kristy Swanson', 25, 82, 15, 0.1, 28, 38, 62, 20, 20],
  ['', 'supporting', 'Jason Priestley', 32, 85, 15, 0.15, 32, 42, 65, 15, 15],
  ['', 'supporting', 'Jennie Garth', 30, 85, 18, 0.12, 28, 40, 65, 20, 15],
  ['', 'supporting', 'Tori Spelling', 30, 70, 30, 0.1, 22, 35, 62, 20, 10],
  ['', 'supporting', 'Ian Ziering', 28, 78, 20, 0.1, 22, 32, 62, 20, 25],
  ['', 'supporting', 'Brian Austin Green', 28, 80, 20, 0.1, 25, 35, 62, 15, 15],
  ['', 'supporting', 'Gabrielle Carteris', 18, 88, 10, 0.06, 28, 38, 55, 10, 10],
  ['', 'supporting', 'Vivica A. Fox', 35, 82, 22, 0.15, 30, 42, 72, 20, 30],
  ['', 'supporting', 'Loretta Devine', 35, 92, 12, 0.15, 45, 55, 70, 30, 10],
  ['', 'supporting', 'Tia Mowry', 30, 88, 15, 0.12, 25, 38, 70, 40, 15],
  ['', 'supporting', 'Tichina Arnold', 30, 90, 15, 0.12, 30, 40, 70, 55, 15],
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

function formatEntry([slug, tier, name, fame, reliability, ego, salaryM, ct, ep, ch, co, pp]) {
  const id = `real-${tier}-actor-${slug || toSlug(name)}`;
  const escapedName = name.replace(/'/g, "\\'");
  const salary = Math.round(salaryM * 1_000_000)
    .toLocaleString('en-US')
    .replace(/,/g, '_');
  return [
    `    {`,
    `        id: '${id}',`,
    `        name: '${escapedName}',`,
    `        role: 'Actor',`,
    `        fame: ${fame},`,
    `        reliability: ${reliability},`,
    `        ego: ${ego},`,
    `        salary: ${salary},`,
    `        actingStyle: {`,
    `            characterTransformation: ${ct},`,
    `            emotionalPerformance: ${ep},`,
    `            charisma: ${ch},`,
    `            comedy: ${co},`,
    `            physicalPerformance: ${pp},`,
    `        },`,
    `    },`,
  ].join('\r\n');
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

  const generated = NEW_ACTORS.map(formatEntry).join('\r\n');

  if (!process.argv.includes('--write')) {
    console.log(generated);
    console.error(`\n(dry run - ${NEW_ACTORS.length} entries. Re-run with --write to insert into the file.)`);
    return;
  }

  const marker = '];\r\n\r\nexport const HANDCRAFTED_WRITERS';
  const idx = content.indexOf(marker);
  if (idx === -1) throw new Error('Could not find HANDCRAFTED_ACTORS closing bracket - file structure may have changed.');

  const updated = content.slice(0, idx) + generated + '\r\n' + content.slice(idx);
  writeFileSync(TARGET_FILE, updated, 'utf8');
  console.error(`Inserted ${NEW_ACTORS.length} actors into ${TARGET_FILE}`);
}

main();
