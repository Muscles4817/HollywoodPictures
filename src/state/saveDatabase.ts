import type { GameState } from './gameState';
import type { Project } from '../types';
import { projectId } from '../engine/project';

/**
 * The studio save, stored in IndexedDB.
 *
 * Why a database and not localStorage (where the save lived until v98):
 * localStorage holds about 5 million characters per origin, and a studio
 * outgrew that roughly one in-game year in - a new studio is already ~2.2 MB
 * (the talent pool), every released film adds ~21 kB and is never pruned.
 * Past the quota `setItem` throws, the old code swallowed it, and the player
 * kept playing an unsaved game. IndexedDB's quota is a share of free disk
 * (hundreds of MB at least) and it stores structured data without a JSON pass
 * on the main thread.
 *
 * The save is split into records rather than written as one blob, because the
 * reducer is immutable: data that did not change keeps its reference. So each
 * write compares against what was last written and only puts the records that
 * differ. A released film whose run has ended is written exactly once, however
 * long the studio lives - which is what keeps the cost of a save flat as the
 * back catalogue grows.
 *
 * The comparison is `sameContent`, not `===`: the day tick rebuilds every
 * project's outer wrapper ({ kind, film }) even when the film inside is
 * untouched, so plain reference equality would call all of them changed. A
 * structural compare that stops at the first shared reference sees through
 * that in a couple of hundred node visits for the whole slate.
 *
 *   meta/'main'   everything in GameState except the two big collections,
 *                 plus the ordered list of project keys and the schema version
 *   projects/<k>  one Project each
 *   talent/<p>    one profession's roster each
 *
 * One readwrite transaction covers all three stores, so a save lands whole or
 * not at all.
 */

const DB_NAME = 'hollywood-pictures';
const DB_VERSION = 1;
const META = 'meta';
const PROJECTS = 'projects';
const TALENT = 'talent';
const SLOT = 'main';

interface SaveMeta {
  schemaVersion: number;
  savedAt: number;
  core: Omit<GameState, 'projects' | 'talentPool'>;
  projectKeys: string[];
  /** Roster order is kept explicitly: the database returns keys sorted, and iteration order over the pool must not change across a reload. */
  talentKeys: string[];
}

/** What the last successful read or write left in the database, by reference. */
interface WrittenSnapshot {
  projects: Map<string, Project>;
  talent: Map<string, unknown>;
}

let written: WrittenSnapshot = { projects: new Map(), talent: new Map() };

/** How many records the most recent write actually put or deleted - for tests and the soak check. */
export interface SaveWriteReport {
  projectsPut: number;
  projectsDeleted: number;
  talentPut: number;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('This browser has no IndexedDB storage available.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of [META, PROJECTS, TALENT]) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open the save database.'));
    request.onblocked = () => reject(new Error('The save database is held open by another tab.'));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('The save could not be written.'));
    tx.onabort = () => reject(tx.error ?? new Error('The save could not be written.'));
  });
}

/**
 * Structural equality that returns at once on a shared reference - cheap on
 * immutable state, where an unchanged subtree is the same object.
 */
export function sameContent(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a);
  if (keysA.length !== Object.keys(b).length) return false;
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!sameContent((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) return false;
  }
  return true;
}

/**
 * One storage key per project, in array order. Project ids are meant to be
 * unique, but nothing enforces it (some id counters are module-level), so a
 * repeat gets a suffix instead of silently overwriting its twin.
 */
function projectKeysFor(projects: Project[]): string[] {
  const seen = new Map<string, number>();
  return projects.map((project) => {
    const id = projectId(project);
    const count = (seen.get(id) ?? 0) + 1;
    seen.set(id, count);
    return count === 1 ? id : `${id}#${count}`;
  });
}

async function wipe(db: IDBDatabase): Promise<void> {
  const tx = db.transaction([META, PROJECTS, TALENT], 'readwrite');
  tx.objectStore(META).clear();
  tx.objectStore(PROJECTS).clear();
  tx.objectStore(TALENT).clear();
  await transactionDone(tx);
  written = { projects: new Map(), talent: new Map() };
}

/**
 * Read the stored studio, or null when there is none. A save written under a
 * different schema version is deleted and reads as none - the pre-launch
 * policy (CLAUDE.md): no migrations, a clean reset is acceptable.
 */
export async function readSave(schemaVersion: number): Promise<GameState | null> {
  const db = await openDatabase();
  try {
    const tx = db.transaction([META, PROJECTS, TALENT], 'readonly');
    const done = transactionDone(tx);
    const [meta, projectKeys, projectValues, talentKeys, talentValues] = await Promise.all([
      requestResult(tx.objectStore(META).get(SLOT) as IDBRequest<SaveMeta | undefined>),
      requestResult(tx.objectStore(PROJECTS).getAllKeys()),
      requestResult(tx.objectStore(PROJECTS).getAll() as IDBRequest<Project[]>),
      requestResult(tx.objectStore(TALENT).getAllKeys()),
      requestResult(tx.objectStore(TALENT).getAll()),
    ]);
    await done;

    if (!meta) return null;
    if (meta.schemaVersion !== schemaVersion || !meta.core?.studio) {
      await wipe(db);
      return null;
    }

    const projectsByKey = new Map<string, Project>();
    projectKeys.forEach((key, i) => projectsByKey.set(String(key), projectValues[i]));
    const projects: Project[] = [];
    for (const key of meta.projectKeys) {
      const project = projectsByKey.get(key);
      // A listed film with no record means the save is torn; refuse it rather
      // than load a studio with holes in its slate.
      if (!project) {
        await wipe(db);
        return null;
      }
      projects.push(project);
    }

    const storedTalent = new Map<string, unknown>();
    talentKeys.forEach((key, i) => storedTalent.set(String(key), talentValues[i]));
    const talentByKey = new Map<string, unknown>();
    for (const key of meta.talentKeys) {
      if (!storedTalent.has(key)) {
        await wipe(db);
        return null;
      }
      talentByKey.set(key, storedTalent.get(key));
    }

    written = {
      projects: new Map(meta.projectKeys.map((key, i) => [key, projects[i]])),
      talent: talentByKey,
    };
    return {
      ...meta.core,
      projects,
      talentPool: Object.fromEntries(talentByKey) as GameState['talentPool'],
    };
  } finally {
    db.close();
  }
}

/** Write the studio, putting only the records whose reference changed since the last read or write. */
export async function writeSave(state: GameState, schemaVersion: number): Promise<SaveWriteReport> {
  const db = await openDatabase();
  try {
    const { projects, talentPool, ...core } = state;
    const projectKeys = projectKeysFor(projects);
    const report: SaveWriteReport = { projectsPut: 0, projectsDeleted: 0, talentPut: 0 };

    const tx = db.transaction([META, PROJECTS, TALENT], 'readwrite');
    const done = transactionDone(tx);
    const projectStore = tx.objectStore(PROJECTS);
    const talentStore = tx.objectStore(TALENT);

    const nextProjects = new Map<string, Project>();
    projects.forEach((project, i) => {
      const key = projectKeys[i];
      nextProjects.set(key, project);
      if (!sameContent(written.projects.get(key), project)) {
        projectStore.put(project, key);
        report.projectsPut++;
      }
    });
    for (const key of written.projects.keys()) {
      if (!nextProjects.has(key)) {
        projectStore.delete(key);
        report.projectsDeleted++;
      }
    }

    const nextTalent = new Map<string, unknown>(Object.entries(talentPool));
    for (const [key, roster] of nextTalent) {
      if (!sameContent(written.talent.get(key), roster)) {
        talentStore.put(roster, key);
        report.talentPut++;
      }
    }
    for (const key of written.talent.keys()) {
      if (!nextTalent.has(key)) talentStore.delete(key);
    }

    const meta: SaveMeta = { schemaVersion, savedAt: Date.now(), core, projectKeys, talentKeys: [...nextTalent.keys()] };
    tx.objectStore(META).put(meta, SLOT);

    // Only once the transaction has committed does the snapshot move forward:
    // an aborted save wrote nothing, so the next attempt must retry the same records.
    await done;
    written = { projects: nextProjects, talent: nextTalent };
    return report;
  } finally {
    db.close();
  }
}

/** Remove the stored studio entirely. */
export async function deleteSave(): Promise<void> {
  const db = await openDatabase();
  try {
    await wipe(db);
  } finally {
    db.close();
  }
}

/** Test seam: forget what was last written, as a fresh page load would. */
export function resetWrittenSnapshotForTests(): void {
  written = { projects: new Map(), talent: new Map() };
}
