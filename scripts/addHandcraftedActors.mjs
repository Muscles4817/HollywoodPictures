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
  ['', 'supporting', 'Abbie Cornish', 'Female', 43, 42, 85, 18, 2, 55, 60, 60, 25, 40],
  ['', 'supporting', 'Alicia Silverstone', 'Female', 49, 55, 80, 22, 2, 40, 48, 68, 60, 30],
  ['', 'supporting', 'Andie MacDowell', 'Female', 67, 62, 85, 20, 3, 45, 55, 70, 45, 30],
  ['', 'supporting', 'Angourie Rice', 'Female', 25, 35, 88, 12, 1, 45, 52, 58, 30, 25],
  ['', 'lead', 'Anjelica Huston', 'Female', 74, 72, 85, 35, 3, 72, 75, 75, 45, 35],
  ['', 'supporting', 'Anthony LaPaglia', 'Male', 66, 50, 85, 22, 2, 60, 62, 62, 40, 40],
  ['', 'supporting', 'Ashley Judd', 'Female', 57, 60, 78, 30, 3, 55, 62, 68, 30, 40],
  ['', 'supporting', 'Callum Turner', 'Male', 35, 42, 85, 18, 1.5, 50, 55, 68, 35, 45],
  ['', 'supporting', 'Carice van Houten', 'Female', 49, 48, 88, 18, 1.5, 62, 68, 65, 25, 30],
  ['', 'supporting', 'Catherine Keener', 'Female', 66, 55, 88, 15, 2, 68, 72, 65, 45, 25],
  ['', 'lead', 'Cynthia Erivo', 'Female', 39, 62, 90, 22, 3, 72, 82, 78, 35, 45],
  ['', 'supporting', 'Damson Idris', 'Male', 34, 50, 88, 18, 2, 55, 62, 72, 30, 45],
  ['', 'lead', 'David Oyelowo', 'Male', 50, 58, 90, 18, 3, 70, 78, 72, 30, 45],
  ['', 'supporting', 'David Wenham', 'Male', 60, 55, 88, 15, 2, 62, 65, 65, 40, 50],
  ['', 'lead', 'Demi Moore', 'Female', 63, 78, 80, 35, 5, 55, 68, 78, 35, 45],
  ['', 'supporting', 'Denise Richards', 'Female', 55, 50, 70, 30, 1.5, 25, 35, 65, 35, 35],
  ['', 'supporting', 'Devon Aoki', 'Female', 43, 38, 80, 18, 1, 30, 38, 62, 20, 45],
  ['', 'lead', 'Eric Bana', 'Male', 57, 62, 88, 18, 4, 62, 65, 72, 40, 55],
  ['', 'supporting', 'Fairuza Balk', 'Female', 51, 42, 78, 25, 1, 55, 55, 62, 30, 30],
  ['', 'supporting', 'Famke Janssen', 'Female', 61, 58, 85, 20, 3, 50, 55, 72, 25, 55],
  ['', 'lead', 'Fan Bingbing', 'Female', 44, 60, 72, 35, 4, 45, 52, 75, 30, 40],
  ['', 'supporting', 'Fionn Whitehead', 'Male', 28, 32, 85, 12, 0.8, 45, 52, 55, 20, 35],
  ['', 'lead', 'Geena Davis', 'Female', 70, 68, 85, 22, 3, 55, 62, 75, 62, 45],
  ['', 'supporting', 'Gemma Chan', 'Female', 43, 55, 90, 15, 3, 48, 55, 72, 30, 40],
  ['', 'lead', 'George MacKay', 'Male', 33, 45, 88, 12, 1.5, 60, 68, 60, 25, 55],
  ['', 'supporting', 'Greta Lee', 'Female', 42, 45, 90, 15, 1.5, 58, 70, 68, 45, 25],
  ['', 'supporting', 'Greta Scacchi', 'Female', 65, 45, 82, 18, 1, 58, 62, 65, 30, 25],
  ['', 'lead', 'Gugu Mbatha-Raw', 'Female', 42, 52, 90, 15, 2, 60, 70, 70, 30, 40],
  ['', 'lead', 'Guy Pearce', 'Male', 58, 65, 85, 20, 3, 78, 75, 70, 40, 50],
  ['', 'supporting', 'Gwendoline Christie', 'Female', 47, 58, 88, 18, 2, 60, 60, 70, 40, 55],
  ['', 'lead', 'Henry Golding', 'Male', 39, 55, 88, 18, 3, 42, 50, 80, 40, 45],
  ['', 'supporting', 'Himesh Patel', 'Male', 35, 42, 88, 12, 1.5, 50, 58, 62, 45, 30],
  ['', 'supporting', 'Hong Chau', 'Female', 46, 48, 90, 15, 1.5, 68, 72, 62, 45, 25],
  ['', 'supporting', 'Indira Varma', 'Female', 52, 48, 88, 15, 1.5, 58, 62, 68, 30, 35],
  ['', 'supporting', 'Jack Lowden', 'Male', 35, 45, 88, 12, 1.5, 58, 62, 62, 30, 45],
  ['', 'supporting', 'Jacki Weaver', 'Female', 78, 52, 88, 18, 1.5, 65, 70, 65, 45, 20],
  ['', 'supporting', 'Jai Courtney', 'Male', 39, 45, 82, 20, 2, 35, 42, 65, 30, 60],
  ['', 'lead', 'James Caan', 'Male', 82, 72, 78, 35, 4, 65, 70, 78, 45, 55],
  ['', 'supporting', 'Jennifer Beals', 'Female', 62, 48, 85, 18, 1.5, 48, 55, 70, 30, 35],
  ['', 'supporting', 'Jennifer Love Hewitt', 'Female', 46, 58, 82, 22, 2, 38, 48, 70, 45, 30],
  ['', 'lead', 'Jessica Lange', 'Female', 76, 72, 85, 30, 3, 82, 85, 72, 40, 30],
  ['', 'supporting', 'Joan Allen', 'Female', 69, 58, 90, 15, 2, 70, 75, 65, 30, 30],
  ['', 'supporting', 'Jodie Turner-Smith', 'Female', 39, 45, 82, 22, 2, 42, 50, 70, 25, 45],
  ['', 'lead', 'Joel Edgerton', 'Male', 51, 58, 90, 15, 3, 68, 70, 68, 35, 50],
  ['', 'supporting', 'Jordana Brewster', 'Female', 45, 52, 85, 18, 2, 35, 45, 68, 30, 40],
  ['', 'lead', "Josh O'Connor", 'Male', 35, 50, 90, 12, 1.5, 65, 72, 65, 35, 35],
  ['', 'supporting', 'Judy Davis', 'Female', 70, 50, 85, 25, 1.5, 72, 72, 65, 45, 25],
  ['', 'lead', 'Kathleen Turner', 'Female', 71, 65, 80, 30, 2, 60, 65, 80, 55, 35],
  ['', 'lead', 'Kathy Bates', 'Female', 77, 72, 90, 18, 3, 78, 80, 70, 50, 30],
  ['', 'supporting', 'Katie Holmes', 'Female', 47, 60, 82, 20, 2.5, 45, 55, 68, 40, 30],
  ['', 'supporting', 'Ke Huy Quan', 'Male', 54, 55, 88, 15, 2, 55, 65, 72, 60, 55],
  ['', 'lead', 'Kim Basinger', 'Female', 72, 65, 75, 30, 2, 50, 58, 78, 35, 35],
  ['', 'supporting', 'Kodi Smit-McPhee', 'Male', 29, 45, 88, 12, 1.5, 62, 68, 58, 25, 35],
  ['', 'lead', 'Laura Linney', 'Female', 61, 62, 92, 12, 3, 72, 82, 70, 45, 25],
  ['', 'lead', 'Lee Byung-hun', 'Male', 55, 62, 88, 20, 4, 70, 72, 78, 35, 62],
  ['', 'supporting', 'Lena Olin', 'Female', 70, 50, 85, 18, 1.5, 62, 68, 70, 25, 30],
  ['', 'supporting', 'Letitia Wright', 'Female', 32, 55, 85, 18, 2.5, 52, 60, 68, 35, 45],
  ['', 'supporting', 'Luke Hemsworth', 'Male', 45, 42, 82, 18, 1.5, 35, 45, 65, 30, 50],
  ['', 'supporting', 'Ma Dong-seok', 'Male', 55, 55, 85, 18, 2, 45, 50, 72, 55, 72],
  ['', 'supporting', 'Marianne Jean-Baptiste', 'Female', 58, 45, 90, 12, 1.5, 62, 70, 62, 30, 25],
  ['', 'lead', 'Meg Ryan', 'Female', 64, 70, 80, 25, 3, 45, 58, 82, 68, 25],
  ['', 'supporting', 'Melanie Griffith', 'Female', 68, 58, 72, 30, 1.5, 45, 55, 72, 45, 25],
  ['', 'supporting', 'Mia Wasikowska', 'Female', 36, 48, 88, 12, 1.5, 65, 70, 60, 30, 35],
  ['', 'supporting', 'Michiel Huisman', 'Male', 44, 42, 85, 15, 1.5, 45, 52, 68, 30, 45],
  ['', 'supporting', 'Miranda Otto', 'Female', 58, 48, 88, 15, 1.5, 55, 62, 65, 30, 40],
  ['', 'lead', 'Naomie Harris', 'Female', 49, 62, 90, 15, 3, 65, 72, 72, 30, 45],
  ['', 'supporting', 'Nathalie Emmanuel', 'Female', 36, 48, 85, 15, 2, 42, 50, 70, 30, 40],
  ['', 'lead', 'Nikolaj Coster-Waldau', 'Male', 55, 62, 88, 20, 3, 58, 62, 78, 40, 50],
  ['', 'supporting', 'Park So-dam', 'Female', 34, 45, 88, 12, 1, 60, 65, 65, 40, 30],
  ['', 'supporting', 'Patricia Clarkson', 'Female', 66, 55, 90, 15, 2, 68, 74, 70, 45, 25],
  ['', 'supporting', 'Pilou Asbæk', 'Male', 43, 45, 85, 18, 1.5, 55, 58, 65, 35, 45],
  ['', 'supporting', 'Piper Perabo', 'Female', 49, 45, 85, 15, 1.5, 42, 50, 68, 40, 40],
  ['', 'supporting', 'Rachel Griffiths', 'Female', 57, 48, 88, 15, 1.5, 62, 68, 65, 40, 25],
  ['', 'lead', 'Regé-Jean Page', 'Male', 37, 58, 85, 20, 2.5, 45, 55, 80, 30, 45],
  ['', 'supporting', 'Rene Russo', 'Female', 71, 60, 85, 20, 2, 48, 58, 75, 45, 40],
  ['', 'lead', 'Richard Madden', 'Male', 39, 60, 85, 20, 3, 52, 60, 75, 30, 50],
  ['', 'lead', 'Robert Duvall', 'Male', 94, 82, 88, 30, 4, 82, 85, 78, 50, 40],
  ['', 'lead', 'Robert Redford', 'Male', 89, 88, 88, 40, 5, 62, 78, 88, 45, 45],
  ['', 'supporting', 'Robin Tunney', 'Female', 53, 45, 85, 15, 1.5, 48, 55, 65, 30, 30],
  ['', 'supporting', 'Rory McCann', 'Male', 56, 42, 85, 15, 1, 45, 48, 58, 25, 65],
  ['', 'supporting', 'Rose McGowan', 'Female', 52, 50, 65, 35, 1, 42, 48, 68, 35, 40],
  ['', 'supporting', 'Ruth Negga', 'Female', 44, 52, 90, 12, 2, 68, 75, 68, 30, 35],
  ['', 'supporting', 'Ryan Kwanten', 'Male', 49, 42, 85, 15, 1.5, 42, 50, 68, 40, 50],
  ['', 'lead', 'Sally Field', 'Female', 79, 78, 92, 18, 3, 75, 85, 78, 55, 25],
  ['', 'supporting', 'Sela Ward', 'Female', 69, 50, 88, 18, 1.5, 50, 60, 72, 30, 25],
  ['', 'supporting', 'Selma Blair', 'Female', 53, 52, 78, 20, 1.5, 50, 58, 68, 45, 30],
  ['', 'supporting', 'Shannen Doherty', 'Female', 54, 55, 65, 35, 1.5, 40, 50, 68, 35, 30],
  ['', 'lead', 'Sharon Stone', 'Female', 68, 75, 78, 35, 4, 55, 62, 82, 40, 45],
  ['', 'lead', 'Simon Baker', 'Male', 56, 55, 88, 18, 2.5, 48, 55, 78, 40, 40],
  ['', 'lead', 'Sissy Spacek', 'Female', 76, 68, 90, 15, 2, 78, 82, 68, 40, 25],
  ['', 'supporting', 'Sophie Okonedo', 'Female', 57, 52, 90, 12, 2, 70, 76, 70, 35, 30],
  ['', 'supporting', 'Stephanie Hsu', 'Female', 35, 50, 88, 15, 1.5, 60, 65, 70, 62, 40],
  ['', 'supporting', 'Sung Kang', 'Male', 53, 45, 85, 15, 1.5, 38, 45, 65, 35, 45],
  ['', 'lead', 'Taron Egerton', 'Male', 36, 62, 88, 18, 3, 58, 65, 78, 50, 50],
  ['', 'supporting', 'Teresa Palmer', 'Female', 39, 45, 85, 15, 1.5, 45, 52, 68, 35, 40],
  ['', 'supporting', 'Thomasin McKenzie', 'Female', 25, 42, 88, 12, 1, 60, 68, 58, 25, 30],
  ['', 'supporting', 'Tom Wlaschiha', 'Male', 52, 38, 88, 12, 1, 50, 55, 62, 25, 35],
  ['', 'lead', 'Tony Leung', 'Male', 63, 68, 90, 18, 4, 80, 85, 82, 40, 50],
  ['', 'lead', 'Warren Beatty', 'Male', 88, 80, 80, 45, 4, 65, 72, 85, 50, 40],
  ['', 'supporting', 'Yoo Ah-in', 'Male', 39, 45, 60, 30, 1.5, 62, 65, 65, 30, 35],
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
