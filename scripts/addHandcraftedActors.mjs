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
  ['', 'lead', 'Tom Holland', 'Male', 29, 82, 88, 20, 8, 55, 62, 80, 55, 70],
  ['', 'lead', 'Tobey Maguire', 'Male', 50, 78, 82, 25, 6, 62, 68, 68, 40, 55],
  ['', 'supporting', 'Tom Hollander', 'Male', 58, 48, 90, 15, 1.5, 68, 68, 68, 55, 25],
  ['', 'supporting', 'Adam Devine', 'Male', 42, 45, 82, 20, 1.5, 30, 38, 68, 72, 30],
  ['', 'supporting', 'Adria Arjona', 'Female', 33, 45, 85, 15, 1.5, 45, 52, 70, 30, 40],
  ['', 'supporting', 'Aldis Hodge', 'Male', 39, 50, 88, 15, 2, 58, 62, 70, 30, 55],
  ['', 'supporting', 'Alfred Molina', 'Male', 72, 58, 92, 12, 2, 75, 72, 70, 40, 35],
  ['', 'supporting', 'Amy Ryan', 'Female', 57, 48, 90, 12, 1.5, 65, 72, 62, 45, 25],
  ['', 'supporting', 'Andre Braugher', 'Male', 62, 55, 92, 15, 2, 72, 75, 72, 55, 30],
  ['', 'supporting', 'Andre Holland', 'Male', 46, 45, 90, 12, 1.5, 62, 70, 65, 30, 30],
  ['', 'supporting', 'Andrew Rannells', 'Male', 47, 42, 88, 15, 1.2, 45, 52, 70, 62, 25],
  ['', 'lead', 'Andy Samberg', 'Male', 47, 60, 85, 18, 3, 38, 45, 72, 82, 35],
  ['', 'supporting', 'Angela Kinsey', 'Female', 54, 38, 90, 10, 1, 35, 42, 62, 68, 15],
  ['', 'supporting', 'Anthony Ramos', 'Male', 34, 48, 85, 15, 1.5, 52, 60, 70, 40, 40],
  ['', 'supporting', 'Ashton Sanders', 'Male', 30, 38, 88, 12, 1, 60, 65, 58, 20, 30],
  ['', 'supporting', 'Ben Platt', 'Male', 32, 48, 85, 18, 1.5, 55, 68, 62, 55, 20],
  ['', 'supporting', 'Ben Schwartz', 'Male', 44, 48, 85, 15, 1.5, 38, 45, 70, 78, 30],
  ['', 'supporting', 'Ben Whishaw', 'Male', 45, 55, 92, 10, 2, 72, 78, 65, 40, 30],
  ['', 'supporting', 'Bokeem Woodbine', 'Male', 52, 42, 85, 15, 1.2, 55, 58, 65, 30, 45],
  ['', 'supporting', 'Brian Baumgartner', 'Male', 52, 35, 90, 10, 1, 30, 38, 60, 70, 20],
  ['', 'supporting', 'Charlie Plummer', 'Male', 26, 35, 85, 12, 1, 55, 62, 55, 25, 30],
  ['', 'supporting', 'Chelsea Peretti', 'Female', 47, 40, 82, 18, 1.2, 32, 40, 65, 75, 20],
  ['', 'supporting', 'Chris Cooper', 'Male', 74, 55, 92, 12, 2, 75, 75, 62, 35, 35],
  ['', 'supporting', 'Chris Sullivan', 'Male', 45, 40, 88, 12, 1.2, 52, 62, 62, 45, 35],
  ['', 'supporting', 'Christopher Jackson', 'Male', 50, 38, 88, 12, 1.2, 45, 55, 68, 40, 30],
  ['', 'supporting', 'Coby Bell', 'Male', 50, 32, 88, 12, 1, 40, 48, 62, 30, 35],
  ['', 'supporting', 'Cole Sprouse', 'Male', 33, 55, 80, 20, 1.5, 38, 45, 68, 45, 30],
  ['', 'lead', 'Connie Britton', 'Female', 58, 55, 90, 15, 2.5, 55, 68, 75, 45, 25],
  ['', 'supporting', 'Corey Hawkins', 'Male', 37, 45, 88, 15, 1.5, 55, 62, 68, 30, 45],
  ['', 'supporting', 'Corey Stoll', 'Male', 49, 45, 90, 12, 1.5, 62, 65, 65, 35, 40],
  ['', 'supporting', 'Creed Bratton', 'Male', 82, 32, 85, 15, 0.8, 40, 42, 60, 72, 20],
  ['', 'supporting', 'Dacre Montgomery', 'Male', 31, 45, 85, 18, 1.5, 45, 52, 68, 30, 45],
  ['', 'lead', 'Dakota Fanning', 'Female', 31, 60, 90, 12, 2.5, 60, 68, 68, 35, 35],
  ['', 'lead', 'Dan Stevens', 'Male', 43, 55, 90, 15, 2.5, 62, 65, 75, 45, 45],
  ['', 'supporting', 'Daniel Dae Kim', 'Male', 57, 50, 90, 15, 2, 55, 60, 70, 30, 45],
  ['', 'supporting', 'Daveed Diggs', 'Male', 43, 48, 88, 15, 1.5, 55, 60, 72, 55, 40],
  ['', 'supporting', 'David Strathairn', 'Male', 76, 50, 92, 10, 1.5, 72, 75, 62, 30, 25],
  ['', 'supporting', 'Delroy Lindo', 'Male', 73, 52, 90, 18, 1.8, 70, 74, 72, 30, 40],
  ['', 'supporting', 'Dirk Blocker', 'Male', 68, 25, 88, 10, 0.7, 32, 38, 55, 60, 20],
  ['', 'supporting', 'Domhnall Gleeson', 'Male', 42, 55, 90, 12, 2, 65, 68, 65, 50, 35],
  ['', 'supporting', 'Dominic Cooper', 'Male', 47, 52, 85, 18, 2, 55, 60, 72, 35, 45],
  ['', 'supporting', 'Douglas Booth', 'Male', 33, 42, 85, 15, 1.2, 45, 50, 72, 25, 35],
  ['', 'supporting', 'Dylan Sprouse', 'Male', 33, 48, 80, 18, 1.2, 35, 42, 65, 45, 30],
  ['', 'supporting', 'Eddie Marsan', 'Male', 57, 48, 92, 10, 1.5, 72, 72, 60, 40, 35],
  ['', 'supporting', 'Eiza González', 'Female', 35, 52, 82, 20, 2, 42, 50, 75, 30, 45],
  ['', 'supporting', 'Elizabeth Mitchell', 'Female', 55, 45, 88, 15, 1.5, 55, 62, 65, 25, 30],
  ['', 'lead', 'Elle Fanning', 'Female', 27, 62, 90, 12, 3, 65, 72, 70, 40, 35],
  ['', 'supporting', 'Ellie Kemper', 'Female', 45, 48, 88, 12, 1.5, 38, 48, 68, 78, 25],
  ['', 'supporting', 'Emilie de Ravin', 'Female', 43, 35, 85, 12, 1, 42, 50, 62, 25, 30],
  ['', 'supporting', 'Evangeline Lilly', 'Female', 46, 55, 82, 20, 2.5, 45, 52, 70, 30, 50],
  ['', 'supporting', 'Florence Kasumba', 'Female', 49, 38, 88, 12, 1, 45, 50, 62, 25, 45],
  ['', 'supporting', 'Garret Dillahunt', 'Male', 61, 42, 92, 10, 1.2, 68, 65, 62, 50, 40],
  ['', 'supporting', 'Giovanni Ribisi', 'Male', 51, 48, 82, 18, 1.5, 65, 65, 60, 35, 35],
  ['', 'supporting', 'Griffin Dunne', 'Male', 70, 38, 88, 12, 1, 55, 58, 62, 55, 25],
  ['', 'lead', 'Hailee Steinfeld', 'Female', 29, 62, 88, 15, 3, 55, 62, 75, 50, 45],
  ['', 'lead', 'Hayley Atwell', 'Female', 43, 55, 90, 15, 2.5, 58, 65, 75, 40, 45],
  ['', 'supporting', 'Henry Ian Cusick', 'Male', 58, 35, 88, 12, 1, 50, 55, 62, 25, 35],
  ['', 'supporting', 'Idina Menzel', 'Female', 54, 58, 88, 18, 2, 48, 62, 72, 45, 25],
  ['', 'supporting', 'Iko Uwais', 'Male', 43, 42, 85, 15, 1.2, 35, 40, 58, 20, 88],
  ['', 'supporting', 'Jacob Batalon', 'Male', 29, 48, 88, 12, 1.5, 35, 45, 68, 68, 30],
  ['', 'supporting', 'Jared Harris', 'Male', 64, 55, 92, 12, 2, 75, 74, 68, 40, 30],
  ['', 'supporting', 'Jason Mantzoukas', 'Male', 53, 45, 85, 15, 1.2, 40, 45, 65, 82, 30],
  ['', 'lead', 'Jason Segel', 'Male', 46, 58, 85, 15, 3, 48, 58, 72, 78, 35],
  ['', 'supporting', 'Jermaine Fowler', 'Male', 37, 38, 82, 15, 1, 35, 42, 65, 72, 25],
  ['', 'supporting', 'Jesse Spencer', 'Male', 46, 42, 88, 12, 1.2, 42, 50, 65, 30, 35],
  ['', 'supporting', 'Jesse Williams', 'Male', 44, 48, 85, 18, 1.5, 45, 52, 72, 30, 35],
  ['', 'supporting', 'Jim Broadbent', 'Male', 76, 60, 92, 10, 2, 78, 75, 68, 55, 25],
  ['', 'supporting', 'Joe Lo Truglio', 'Male', 55, 40, 88, 12, 1, 38, 45, 62, 75, 25],
  ['', 'supporting', 'Joel McKinnon Miller', 'Male', 71, 25, 90, 8, 0.7, 32, 38, 55, 62, 20],
  ['', 'lead', 'Jon Favreau', 'Male', 59, 62, 90, 18, 3, 48, 55, 70, 68, 40],
  ['', 'supporting', 'Jon Huertas', 'Male', 56, 32, 88, 12, 1, 40, 48, 62, 35, 35],
  ['', 'supporting', 'Jonathan Groff', 'Male', 40, 52, 90, 15, 2, 60, 68, 68, 45, 30],
  ['', 'lead', 'Jonathan Majors', 'Male', 36, 55, 68, 30, 3, 70, 72, 72, 30, 55],
  ['', 'supporting', 'Jorge Garcia', 'Male', 52, 40, 85, 12, 1, 40, 48, 65, 62, 25],
  ['', 'supporting', 'Josh Gad', 'Male', 44, 55, 85, 15, 2, 42, 52, 70, 80, 25],
  ['', 'lead', 'Josh Holloway', 'Male', 56, 48, 85, 18, 2, 45, 52, 75, 35, 50],
  ['', 'supporting', 'Josh Lucas', 'Male', 54, 45, 85, 15, 1.5, 48, 55, 70, 30, 40],
  ['', 'supporting', 'Josh Radnor', 'Male', 51, 45, 88, 12, 1.2, 45, 55, 68, 55, 25],
  ['', 'supporting', 'Jovan Adepo', 'Male', 37, 42, 88, 12, 1.2, 58, 62, 62, 25, 40],
  ['', 'lead', 'Justin Hartley', 'Male', 48, 52, 85, 18, 2, 45, 55, 75, 35, 45],
  ['', 'supporting', 'Kate Flannery', 'Female', 61, 30, 88, 12, 0.8, 32, 40, 62, 70, 15],
  ['', 'supporting', 'Kelvin Harrison Jr.', 'Male', 31, 45, 90, 12, 1.5, 62, 68, 65, 25, 40],
  ['', 'supporting', 'Ken Marino', 'Male', 57, 42, 88, 12, 1.2, 38, 45, 68, 75, 25],
  ['', 'lead', 'Kristen Bell', 'Female', 45, 65, 90, 15, 3, 45, 55, 78, 75, 30],
  ['', 'lead', 'Kyle Chandler', 'Male', 60, 55, 90, 12, 2.5, 60, 68, 72, 35, 40],
  ['', 'lead', 'Lakeith Stanfield', 'Male', 34, 55, 82, 18, 2.5, 68, 70, 68, 45, 35],
  ['', 'supporting', 'Leslie David Baker', 'Male', 67, 28, 88, 10, 0.7, 32, 40, 60, 65, 20],
  ['', 'supporting', 'Leslie Odom Jr.', 'Male', 44, 52, 90, 15, 2, 58, 65, 72, 40, 30],
  ['', 'supporting', 'Lil Rel Howery', 'Male', 46, 45, 85, 15, 1.2, 38, 45, 65, 75, 25],
  ['', 'supporting', 'Lucas Hedges', 'Male', 29, 45, 88, 12, 1.5, 62, 70, 58, 30, 25],
  ['', 'lead', 'Mandy Moore', 'Female', 41, 58, 90, 15, 2.5, 48, 62, 72, 40, 25],
  ['', 'lead', 'Marisa Tomei', 'Female', 60, 62, 90, 15, 3, 62, 70, 74, 55, 35],
  ['', 'supporting', 'Matthew Goode', 'Male', 47, 50, 90, 12, 2, 58, 62, 75, 40, 35],
  ['', 'supporting', 'Melissa Fumero', 'Female', 47, 42, 88, 12, 1.2, 38, 48, 68, 65, 25],
  ['', 'supporting', 'Michael Emerson', 'Male', 71, 48, 92, 10, 1.5, 70, 68, 62, 35, 20],
  ['', 'supporting', 'Michael Kenneth Williams', 'Male', 58, 55, 88, 15, 1.8, 72, 74, 70, 30, 45],
  ['', 'lead', 'Michael Sheen', 'Male', 56, 60, 90, 15, 2.5, 78, 74, 72, 50, 30],
  ['', 'lead', 'Millie Bobby Brown', 'Female', 21, 68, 85, 18, 3, 55, 65, 70, 40, 40],
  ['', 'supporting', 'Nat Faxon', 'Male', 50, 38, 88, 12, 1, 35, 42, 62, 72, 25],
  ['', 'supporting', 'Naveen Andrews', 'Male', 56, 45, 85, 15, 1.5, 55, 60, 68, 30, 40],
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
