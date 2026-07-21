// Dev utility for bulk-adding real-life directors to
// src/data/handcraftedTalents.ts's HANDCRAFTED_DIRECTORS array.
//
// Usage: fill in NEW_DIRECTORS below, then:
//   node scripts/addHandcraftedDirectors.mjs           (dry run - prints the block)
//   node scripts/addHandcraftedDirectors.mjs --write    (inserts into the real file)
//
// Each row: [slug, name, gender, age, fame, reliability, ego, salaryMillions,
//   skill,
//   tone: action, comedy, romance, suspense, drama, spectacle,   (0-100 each)
//   env: studio, location, digital,        (raw weights, normalised to a Distribution)
//   fx:  practical, digital]                (raw weights, normalised to a Distribution)
//   - slug: '' auto-derives a kebab id from the name -> real-director-<slug>.
//   - gender: 'Male' | 'Female' | 'NonBinary'; age -> dateOfBirth.year = -age.
//
// The full Person is derived exactly the way engine/talentGenerator.ts:generateTalent
// builds a director: professionalism/industryRespect mirror reliability;
// prestige/currentHeat/roleReputation mirror fame; experience mirrors skill;
// toneProfile is the six tone axes; productionStyle holds the two normalised
// leaning distributions. Remaining personality axes take neutral defaults.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const NEW_DIRECTORS = [
  ['', 'A.V. Rockwell', 'Female', 39, 25, 85, 15, 1, 68, 20, 25, 45, 40, 78, 30, 25, 65, 10, 70, 30],
  ['', 'Adam McKay', 'Male', 57, 55, 85, 25, 6, 78, 35, 85, 30, 40, 62, 40, 40, 45, 15, 60, 40],
  ['', 'Alex Garland', 'Male', 55, 52, 88, 20, 8, 82, 55, 20, 30, 80, 70, 80, 45, 30, 25, 40, 60],
  ['', 'Andrea Arnold', 'Female', 64, 35, 88, 15, 2, 80, 20, 25, 55, 45, 85, 20, 10, 85, 5, 80, 20],
  ['', 'Andy Muschietti', 'Male', 52, 45, 85, 18, 8, 75, 50, 30, 25, 82, 45, 75, 45, 25, 30, 45, 55],
  ['', 'Anurag Kashyap', 'Male', 53, 40, 82, 25, 2, 80, 60, 35, 35, 78, 78, 45, 20, 70, 10, 65, 35],
  ['', 'Asghar Farhadi', 'Male', 53, 45, 90, 15, 2, 88, 15, 20, 45, 75, 92, 15, 20, 75, 5, 85, 15],
  ['', 'Bennett Miller', 'Male', 58, 42, 88, 15, 4, 82, 25, 20, 30, 65, 88, 25, 35, 55, 10, 80, 20],
  ['', 'Cathy Yan', 'Female', 40, 35, 82, 18, 6, 65, 65, 55, 30, 45, 50, 70, 45, 25, 30, 40, 60],
  ['', 'Chad Stahelski', 'Male', 57, 48, 88, 18, 10, 82, 92, 30, 20, 65, 35, 80, 45, 30, 25, 70, 30],
  ['', 'Charlotte Wells', 'Female', 38, 30, 88, 12, 1.5, 78, 15, 25, 50, 40, 88, 20, 15, 80, 5, 82, 18],
  ['', 'Cooper Raiff', 'Male', 28, 30, 85, 15, 1.5, 65, 15, 65, 72, 30, 70, 15, 30, 60, 10, 80, 20],
  ['', 'Coralie Fargeat', 'Female', 49, 40, 82, 20, 6, 75, 70, 40, 25, 80, 45, 72, 40, 35, 25, 55, 45],
  ['', 'Cord Jefferson', 'Male', 43, 35, 88, 15, 3, 72, 20, 70, 35, 40, 78, 25, 45, 45, 10, 75, 25],
  ['', 'David Gordon Green', 'Male', 50, 45, 82, 18, 6, 72, 45, 60, 35, 72, 65, 45, 40, 45, 15, 55, 45],
  ['', 'David Leitch', 'Male', 49, 48, 85, 18, 12, 78, 90, 45, 25, 60, 35, 82, 45, 30, 25, 65, 35],
  ['', 'David O. Russell', 'Male', 66, 55, 65, 45, 8, 82, 35, 68, 55, 50, 82, 40, 45, 45, 10, 78, 22],
  ['', 'Denis Côté', 'Male', 51, 25, 85, 15, 1, 75, 20, 25, 30, 55, 85, 20, 20, 75, 5, 85, 15],
  ['', 'Destin Daniel Cretton', 'Male', 46, 45, 88, 15, 10, 75, 70, 45, 40, 50, 70, 75, 40, 30, 30, 40, 60],
  ['', 'Doug Liman', 'Male', 59, 50, 82, 22, 10, 78, 85, 45, 40, 70, 45, 72, 45, 35, 20, 60, 40],
  ['', 'Duncan Jones', 'Male', 54, 42, 82, 18, 6, 75, 55, 30, 35, 70, 65, 78, 45, 25, 30, 45, 55],
  ['', 'Emerald Fennell', 'Female', 40, 55, 85, 20, 5, 80, 30, 65, 55, 78, 78, 40, 45, 45, 10, 72, 28],
  ['', 'Ethan Coen', 'Male', 68, 62, 90, 20, 6, 90, 45, 82, 35, 80, 82, 40, 40, 50, 10, 78, 22],
  ['', 'Fede Álvarez', 'Male', 47, 45, 85, 18, 8, 75, 60, 25, 20, 88, 40, 65, 40, 40, 20, 55, 45],
  ['', 'Feng Xiaogang', 'Male', 67, 40, 82, 25, 4, 78, 55, 55, 45, 50, 75, 60, 40, 45, 15, 55, 45],
  ['', 'Gareth Edwards', 'Male', 50, 48, 85, 15, 10, 76, 70, 25, 30, 65, 50, 90, 40, 25, 35, 30, 70],
  ['', 'Gina Prince-Bythewood', 'Female', 56, 48, 90, 15, 8, 78, 72, 35, 65, 55, 75, 70, 40, 40, 20, 55, 45],
  ['', 'Halina Reijn', 'Female', 50, 35, 82, 18, 4, 72, 30, 70, 45, 72, 62, 35, 45, 40, 15, 68, 32],
  ['', 'J.J. Abrams', 'Male', 59, 68, 85, 25, 12, 80, 80, 45, 40, 75, 55, 88, 45, 25, 30, 45, 55],
  ['', 'James Gunn', 'Male', 59, 65, 88, 20, 12, 82, 78, 80, 40, 50, 60, 88, 40, 25, 35, 40, 60],
  ['', 'Jean-Marc Vallée', 'Male', 60, 45, 85, 18, 5, 82, 25, 35, 50, 60, 88, 30, 25, 65, 10, 82, 18],
  ['', 'Jennifer Kent', 'Female', 56, 38, 85, 15, 3, 80, 25, 15, 30, 88, 75, 35, 45, 40, 15, 78, 22],
  ['', 'Jia Zhangke', 'Male', 55, 40, 88, 18, 2, 85, 25, 25, 40, 50, 90, 30, 15, 80, 5, 82, 18],
  ['', 'Joel Coen', 'Male', 71, 62, 90, 22, 6, 92, 45, 80, 35, 82, 85, 42, 40, 50, 10, 78, 22],
  ['', 'Johnnie To', 'Male', 70, 42, 85, 20, 3, 82, 85, 40, 35, 80, 55, 60, 35, 55, 10, 70, 30],
  ['', 'Jon M. Chu', 'Male', 46, 55, 88, 18, 10, 76, 55, 60, 65, 40, 60, 82, 45, 25, 30, 45, 55],
  ['', 'Jon Watts', 'Male', 44, 50, 88, 15, 10, 74, 75, 60, 35, 55, 50, 85, 40, 25, 35, 40, 60],
  ['', 'Jonathan Glazer', 'Male', 60, 48, 85, 22, 5, 88, 30, 15, 35, 82, 85, 50, 40, 45, 15, 65, 35],
  ['', 'Judd Apatow', 'Male', 58, 58, 85, 20, 6, 76, 25, 88, 55, 30, 58, 25, 45, 45, 10, 82, 18],
  ['', 'Julia Ducournau', 'Female', 41, 42, 82, 22, 4, 78, 40, 20, 30, 82, 65, 55, 45, 40, 15, 60, 40],
  ['', 'Justine Triet', 'Female', 47, 40, 88, 18, 3, 82, 20, 35, 45, 72, 88, 25, 30, 60, 10, 82, 18],
  ['', 'Karan Johar', 'Male', 53, 48, 85, 30, 4, 74, 35, 60, 85, 35, 72, 60, 45, 35, 20, 60, 40],
  ['', 'Karyn Kusama', 'Female', 56, 40, 85, 18, 5, 74, 60, 35, 35, 80, 58, 55, 45, 35, 20, 55, 45],
  ['', 'Kelly Reichardt', 'Female', 61, 38, 90, 12, 2, 84, 15, 25, 35, 50, 90, 15, 10, 85, 5, 85, 15],
  ['', 'Kenneth Branagh', 'Male', 65, 60, 88, 30, 8, 80, 55, 50, 55, 65, 82, 70, 45, 35, 20, 60, 40],
  ['', 'Kim Jee-woon', 'Male', 61, 45, 85, 18, 4, 82, 80, 45, 35, 85, 60, 70, 40, 40, 20, 60, 40],
  ['', 'Kogonada', 'Male', 45, 32, 88, 12, 2, 78, 15, 25, 45, 40, 85, 35, 40, 45, 15, 65, 35],
  ['', 'Leigh Whannell', 'Male', 48, 45, 88, 15, 6, 76, 60, 30, 25, 88, 45, 60, 45, 35, 20, 55, 45],
  ['', 'Luca Guadagnino', 'Male', 54, 55, 88, 20, 6, 84, 30, 40, 78, 60, 85, 40, 25, 65, 10, 78, 22],
  ['', 'Lulu Wang', 'Female', 42, 40, 88, 15, 3, 76, 15, 45, 45, 35, 85, 25, 35, 55, 10, 80, 20],
];

const __dirname = dirname(fileURLToPath(import.meta.url));
const TARGET_FILE = resolve(__dirname, '../src/data/handcraftedTalents.ts');

function toSlug(name) {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/** Normalise raw weights to 2-decimal fractions summing to exactly 1 (last absorbs rounding). */
function dist(weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => Math.round((w / total) * 100) / 100);
  const drift = Math.round((1 - raw.reduce((a, b) => a + b, 0)) * 100) / 100;
  raw[raw.length - 1] = Math.round((raw[raw.length - 1] + drift) * 100) / 100;
  return raw;
}

function formatEntry(row) {
  const [slug, name, gender, age, fame, reliability, ego, salaryM, skill,
    tAction, tComedy, tRomance, tSuspense, tDrama, tSpectacle,
    envS, envL, envD, fxP, fxD] = row;
  const id = `real-director-${slug || toSlug(name)}`;
  const escapedName = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const salary = Math.round(salaryM * 1_000_000).toLocaleString('en-US').replace(/,/g, '_');
  const [es, el, ed] = dist([envS, envL, envD]);
  const [fp, fd] = dist([fxP, fxD]);
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
    `        primaryRole: 'Director',`,
    `        careers: {`,
    `            director: {`,
    `                role: 'Director',`,
    `                active: true,`,
    `                experience: ${skill},`,
    `                roleReputation: ${fame},`,
    `                minimumSalary: ${salary},`,
    `                typicalSalary: ${salary},`,
    `                skill: ${skill},`,
    `                toneProfile: {`,
    `                    action: ${tAction},`,
    `                    comedy: ${tComedy},`,
    `                    romance: ${tRomance},`,
    `                    suspense: ${tSuspense},`,
    `                    drama: ${tDrama},`,
    `                    spectacle: ${tSpectacle},`,
    `                },`,
    `                productionStyle: {`,
    `                    environmentStrategy: {`,
    `                        studio: ${es},`,
    `                        location: ${el},`,
    `                        digital: ${ed},`,
    `                    },`,
    `                    effectsStrategy: {`,
    `                        practical: ${fp},`,
    `                        digital: ${fd},`,
    `                    },`,
    `                },`,
    `            },`,
    `        },`,
    `        availability: { commitments: [] },`,
    `        traits: [],`,
    `    },`,
  ].join('\n');
}

function main() {
  if (NEW_DIRECTORS.length === 0) { console.error('NEW_DIRECTORS is empty.'); process.exit(1); }
  const content = readFileSync(TARGET_FILE, 'utf8');
  const existingNames = new Set([...content.matchAll(/name: '((?:[^'\\]|\\.)*)'/g)].map((m) => m[1].replace(/\\'/g, "'")));
  const newNames = NEW_DIRECTORS.map((r) => r[1]);
  const dupesFile = newNames.filter((n) => existingNames.has(n));
  const dupesBatch = newNames.filter((n, i) => newNames.indexOf(n) !== i);
  if (dupesFile.length) { console.error('Already in file:', dupesFile); process.exit(1); }
  if (dupesBatch.length) { console.error('Dup within batch:', [...new Set(dupesBatch)]); process.exit(1); }
  const generated = NEW_DIRECTORS.map(formatEntry).join('\n');
  if (!process.argv.includes('--write')) {
    console.log(generated);
    console.error(`\n(dry run - ${NEW_DIRECTORS.length} entries. Re-run with --write.)`);
    return;
  }
  const marker = '];\n\nexport const HANDCRAFTED_ACTORS';
  const idx = content.indexOf(marker);
  if (idx === -1) throw new Error('HANDCRAFTED_DIRECTORS close marker not found.');
  writeFileSync(TARGET_FILE, content.slice(0, idx) + generated + '\n' + content.slice(idx), 'utf8');
  console.error(`Inserted ${NEW_DIRECTORS.length} directors into ${TARGET_FILE}`);
}

main();
