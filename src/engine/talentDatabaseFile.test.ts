// A database file is arbitrary JSON off a player's disk. These pin that bad
// input produces a message rather than a crash or - worse - a half-loaded
// roster, which would look like a game bug rather than a bad file.
import { describe, it, expect } from 'vitest';
import {
  parseTalentDatabaseFile,
  serializeTalentDatabase,
  talentDatabaseSize,
  TALENT_DATABASE_FORMAT_VERSION,
} from './talentDatabaseFile';
import { REAL_WORLD_TALENT_DB } from '../data/talentDatabases';
import type { Person, TalentProfession } from '../types';

function person(id: string, name = 'A Person'): Person {
  return { id, identity: { name }, careers: { director: {} } } as unknown as Person;
}

function file(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    formatVersion: 1,
    name: 'Test Roster',
    peopleByRole: { Director: [person('d1'), person('d2')] },
    ...over,
  });
}

describe('parseTalentDatabaseFile - rejects bad input with a message', () => {
  it('rejects text that is not JSON', () => {
    const r = parseTalentDatabaseFile('not json {', 'x');
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toMatch(/not valid JSON/i);
  });

  it('rejects JSON that is not an object', () => {
    expect(parseTalentDatabaseFile('[1,2,3]', 'x').ok).toBe(false);
    expect(parseTalentDatabaseFile('"hello"', 'x').ok).toBe(false);
  });

  it('rejects a file with no name', () => {
    const r = parseTalentDatabaseFile(file({ name: '   ' }), 'x');
    expect(r.ok === false && r.error).toMatch(/name/i);
  });

  it('rejects a file with no peopleByRole', () => {
    const r = parseTalentDatabaseFile(JSON.stringify({ name: 'X' }), 'x');
    expect(r.ok === false && r.error).toMatch(/peopleByRole/i);
  });

  it('rejects a newer format version rather than guessing at it', () => {
    const r = parseTalentDatabaseFile(file({ formatVersion: TALENT_DATABASE_FORMAT_VERSION + 1 }), 'x');
    expect(r.ok === false && r.error).toMatch(/format version/i);
  });

  it('rejects a person missing an id or a name, naming where it is', () => {
    const bad = parseTalentDatabaseFile(
      file({ peopleByRole: { Director: [person('d1'), { identity: { name: 'No Id' } }] } }), 'x');
    expect(bad.ok).toBe(false);
    expect(bad.ok === false && bad.error).toMatch(/Director.*entry 1/i);
  });

  it('rejects a duplicate id within one profession', () => {
    const r = parseTalentDatabaseFile(file({ peopleByRole: { Director: [person('d1'), person('d1')] } }), 'x');
    expect(r.ok === false && r.error).toMatch(/twice/i);
  });

  it('rejects a database that ends up with nobody in it', () => {
    const r = parseTalentDatabaseFile(file({ peopleByRole: { Sorcerer: [person('s1')] } }), 'x');
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toMatch(/no people/i);
  });

  it('never returns a partially-valid database', () => {
    // One bad entry fails the whole import rather than silently dropping it.
    const r = parseTalentDatabaseFile(
      file({ peopleByRole: { Director: [person('d1'), null, person('d3')] } }), 'x');
    expect(r.ok).toBe(false);
  });
});

describe('parseTalentDatabaseFile - accepts good input', () => {
  it('parses a minimal valid file', () => {
    const r = parseTalentDatabaseFile(file(), 'fallback-id');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.database.name).toBe('Test Roster');
    expect(r.database.peopleByRole.Director).toHaveLength(2);
  });

  it('falls back to the caller-supplied id when the file names none', () => {
    const r = parseTalentDatabaseFile(file(), 'fallback-id');
    expect(r.ok && r.database.id).toBe('fallback-id');
  });

  it('prefers an id the file names itself', () => {
    const r = parseTalentDatabaseFile(file({ id: 'my-roster' }), 'fallback-id');
    expect(r.ok && r.database.id).toBe('my-roster');
  });

  it('skips professions this build does not have, and says so', () => {
    const r = parseTalentDatabaseFile(
      file({ peopleByRole: { Director: [person('d1')], Sorcerer: [person('s1')] } }), 'x');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings.join(' ')).toMatch(/Sorcerer/);
    expect(r.database.peopleByRole).not.toHaveProperty('Sorcerer');
  });

  it('assumes a roster contains real people unless it says otherwise', () => {
    // The flag exists to warn. Defaulting an unknown to "fictional" would hide
    // exactly the case the warning is for.
    expect(parseTalentDatabaseFile(file(), 'x')).toMatchObject({ database: { containsRealPeople: true } });
    expect(parseTalentDatabaseFile(file({ containsRealPeople: false }), 'x'))
      .toMatchObject({ database: { containsRealPeople: false } });
  });
});

describe('round trip', () => {
  it('serializes and re-parses the real-world roster losslessly', () => {
    const text = serializeTalentDatabase(REAL_WORLD_TALENT_DB);
    const r = parseTalentDatabaseFile(text, 'unused');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.database.id).toBe(REAL_WORLD_TALENT_DB.id);
    expect(r.database.containsRealPeople).toBe(true);
    expect(talentDatabaseSize(r.database)).toBe(talentDatabaseSize(REAL_WORLD_TALENT_DB));
    for (const [role, people] of Object.entries(REAL_WORLD_TALENT_DB.peopleByRole)) {
      expect(r.database.peopleByRole[role as TalentProfession]).toHaveLength(people!.length);
    }
  });

  it('counts a multi-career person once', () => {
    const shared = person('both', 'Writer Director');
    const size = talentDatabaseSize({
      id: 'x', name: 'x', description: '', containsRealPeople: false,
      peopleByRole: { Director: [shared], Writer: [shared] },
    });
    expect(size).toBe(1);
  });
});
