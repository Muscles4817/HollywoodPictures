// Offline analysis of a whole-market box-office dump
// (docs/DESIGN_REVIEW_box_office_variance_diagnosis.md). Produce the dump with:
//
//   DUMP_OUT=/tmp/bo.json BOX_OFFICE_DIAGNOSTIC=1 npx vitest run \
//     src/engine/boxOfficeDistribution.diagnostic.test.ts --disable-console-intercept
//   node scripts/analyseBoxOfficeDump.mjs /tmp/bo.json
//
// Prints: the fine-grained return distribution for major wide releases, the
// audience-score S-curve, opening vs reception, return by scale, who clears
// $500M/$1B, and lead-actor fame at matched cost. Read-only; no assertions.
import { readFileSync } from 'node:fs';

const path = process.argv[2] ?? '/tmp/bo.json';
const all = JSON.parse(readFileSync(path, 'utf8'));
const wide = all.filter((r) => r.releaseType === 'Wide');
const majorWide = wide.filter((r) => r.tier === 'Major');
const seedYears = new Set(all.map((r) => `${r.seed}-${r.year}`)).size;

const median = (xs) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const med = (rows, f) => median(rows.map(f));
const pct = (n, d) => (d ? (100 * n) / d : 0);
const d = (r) => r.detail;
const f0 = (x) => x.toFixed(0);
const f2 = (x) => x.toFixed(2);

console.log(`films ${all.length}, wide ${wide.length}, major wide ${majorWide.length}, ${seedYears} industry-years`);

console.log('\n== Return multiple, major wide - fine histogram (share, and density per 0.1x) ==');
const edges = [0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3, 4, 5, Infinity];
for (let i = 0; i < edges.length - 1; i++) {
  const [a, b] = [edges[i], edges[i + 1]];
  const share = pct(majorWide.filter((r) => r.returnMultiple >= a && r.returnMultiple < b).length, majorWide.length);
  const density = share / ((Math.min(b, 6) - a) * 10);
  console.log(`  [${String(a).padStart(4)}, ${String(b).padStart(4)})  ${share.toFixed(1).padStart(5)}%  ${density.toFixed(2).padStart(5)}  ${'#'.repeat(Math.round(density * 4))}`);
}

console.log('\n== The S-curve: audience score vs share of reachable audience sold (wide) ==');
for (let a = 30; a < 95; a += 5) {
  const g = wide.filter((r) => d(r).aud >= a && d(r).aud < a + 5);
  if (!g.length) continue;
  console.log(`  aud ${a}-${a + 4}  n=${String(g.length).padStart(4)}  sold ${f2(med(g, (r) => d(r).soldShare))}  total/opening ${f2(med(g, (r) => r.openingMultiple))}  return ${f2(med(g, (r) => r.returnMultiple))}  gross $${f0(med(g, (r) => r.grossM))}M`);
}

console.log('\n== Opening vs reception (wide) ==');
for (let a = 30; a < 100; a += 10) {
  const g = wide.filter((r) => d(r).aud >= a && d(r).aud < a + 10);
  if (!g.length) continue;
  console.log(`  aud ${a}-${a + 9}  buzz ${f0(med(g, (r) => d(r).buzz))}  critic ${f0(med(g, (r) => d(r).critic))}  opening $${f0(med(g, (r) => d(r).openingM))}M`);
}

console.log('\n== Return by scale (major wide) ==');
for (const sc of [...new Set(majorWide.map((r) => d(r).scale))].sort()) {
  const g = majorWide.filter((r) => d(r).scale === sc);
  console.log(`  ${sc.padEnd(9)} n=${String(g.length).padStart(4)}  cost $${f0(med(g, (r) => d(r).costM))}M  gross $${f0(med(g, (r) => r.grossM))}M  return ${f2(med(g, (r) => r.returnMultiple))}  unprofitable ${f0(pct(g.filter((r) => !r.profitable).length, g.length))}%`);
}

console.log('\n== Return vs total cost within scale (wide) - where does more money stop paying? ==');
for (const sc of ['Intimate', 'Medium', 'Epic']) {
  console.log(`  ${sc}`);
  for (const [a, b] of [[0, 40], [40, 80], [80, 150], [150, 250], [250, Infinity]]) {
    const g = wide.filter((r) => d(r).scale === sc && d(r).costM >= a && d(r).costM < b);
    if (g.length < 15) continue;
    console.log(`    cost $${a}-${b}M  n=${String(g.length).padStart(4)}  return ${f2(med(g, (r) => r.returnMultiple))}  sold ${f2(med(g, (r) => d(r).soldShare))}  lead fame ${f0(med(g, (r) => d(r).leadFame))}`);
  }
}

console.log('\n== Who clears $500M / $1B (wide) ==');
for (const thr of [500, 1000]) {
  const g = wide.filter((r) => r.grossM > thr);
  console.log(`  > $${thr}M: ${g.length} films = ${pct(g.length, wide.length).toFixed(1)}% of wide, ${(g.length / seedYears).toFixed(1)} per industry-year`);
}
console.log(`  wide releases per industry-year: ${(wide.length / seedYears).toFixed(1)}`);

console.log('\n== Lead fame at matched cost and scale (wide): what does a star buy? ==');
for (const sc of ['Intimate', 'Medium', 'Epic']) {
  for (const [a, b] of [[40, 80], [80, 150], [150, 250]]) {
    const g = wide.filter((r) => d(r).scale === sc && d(r).costM >= a && d(r).costM < b);
    const lo = g.filter((r) => d(r).leadFame < 60);
    const hi = g.filter((r) => d(r).leadFame >= 75);
    if (lo.length < 10 || hi.length < 10) continue;
    const show = (grp) => `n=${String(grp.length).padStart(3)} talent ${f2(med(grp, (r) => d(r).talentCostM / d(r).costM))} of cost, opening $${f0(med(grp, (r) => d(r).openingM))}M, gross $${f0(med(grp, (r) => r.grossM))}M, return ${f2(med(grp, (r) => r.returnMultiple))}`;
    console.log(`  ${sc} $${a}-${b}M\n    lead fame <60:  ${show(lo)}\n    lead fame >=75: ${show(hi)}`);
  }
}
