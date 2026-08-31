/// <reference types="node" />
//
// Not an assertion suite - a way to get a populated save out of the simulation
// and into a browser, so a screen can be judged against real content instead of
// against the empty states an unpopulated fixture produces.
//
//   DUMP_FIXTURE=1 DUMP_PATH=/tmp/pop.json npx vitest run \
//     src/state/renderFixtures.diagnostic.test.ts --disable-console-intercept
//
// Then inject the file as localStorage['hollywood-pictures-save-v89'] before
// the app loads. Skipped in the normal suite; see renderFixtures.test.ts for
// the assertions about what the fixture actually contains.
import { describe, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { buildPopulatedStudio } from './renderFixtures';

describe.runIf(process.env.DUMP_FIXTURE)('populated save dump', () => {
  it('writes a studio with a history to DUMP_PATH', () => {
    const state = buildPopulatedStudio(Number(process.env.DUMP_SEED ?? 42));
    const path = process.env.DUMP_PATH ?? 'populated-save.json';
    writeFileSync(path, JSON.stringify(state));

    const byKind: Record<string, number> = {};
    for (const project of state.projects) byKind[project.kind] = (byKind[project.kind] ?? 0) + 1;
    console.log(
      `${path}: projects ${JSON.stringify(byKind)}`,
      `· rivals ${state.rivalStudios.length}`,
      `· assets ${state.studio.assets.length}`,
      `· market ${state.opportunities.length}`,
      `· day ${state.totalDays}`,
    );
  });
});
