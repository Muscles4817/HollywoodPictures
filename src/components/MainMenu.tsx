import { useRef, useState } from 'react';
import type { TalentDatabase } from '../types';
import {
  BUILT_IN_TALENT_DATABASES,
  GENERATED_TALENT_DB,
} from '../data/talentDatabases';
import { parseTalentDatabaseFile, serializeTalentDatabase, talentDatabaseSize } from '../engine/talentDatabaseFile';
import { Button } from './common/Button';
import './MainMenu.css';

// The title screen and the roster picker.
//
// The roster choice lives here rather than mid-game because it is the one
// decision a game cannot change once started: the whole talent pool is built
// from it at RESET_SAVE and then persisted (state/persistence.ts), so choosing
// it later would mean rebuilding the industry underneath a running studio.

interface MainMenuProps {
  hasSave: boolean;
  onContinue: () => void;
  onNewGame: (database: TalentDatabase) => void;
}

export function MainMenu({ hasSave, onContinue, onNewGame }: MainMenuProps) {
  const [databases, setDatabases] = useState<TalentDatabase[]>(BUILT_IN_TALENT_DATABASES);
  const [selectedId, setSelectedId] = useState(GENERATED_TALENT_DB.id);
  const [importError, setImportError] = useState<string | null>(null);
  const [importNote, setImportNote] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const selected = databases.find((db) => db.id === selectedId) ?? GENERATED_TALENT_DB;

  async function handleFile(file: File) {
    setImportError(null);
    setImportNote(null);
    const text = await file.text();
    // A stable-ish id for this import, so a save records which roster built it.
    const fallbackId = `imported:${file.name.replace(/\.json$/i, '')}`;
    const result = parseTalentDatabaseFile(text, fallbackId);

    if (!result.ok) {
      setImportError(result.error);
      return;
    }
    // Replace rather than append when the same id comes back, so re-importing a
    // corrected file does not leave the broken one in the list.
    setDatabases((current) => [
      ...current.filter((db) => db.id !== result.database.id),
      result.database,
    ]);
    setSelectedId(result.database.id);
    setImportNote(
      [`Loaded ${talentDatabaseSize(result.database).toLocaleString()} people.`, ...result.warnings].join(' '),
    );
  }

  function handleExport() {
    const blob = new Blob([serializeTalentDatabase(selected)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selected.id}.talentdb.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="main-menu">
      <div className="main-menu__marquee">
        <p className="main-menu__now-showing">Now Showing</p>
        <h1 className="main-menu__title">Hollywood Pictures</h1>
        <p className="main-menu__tagline">
          The film industry as a living market
        </p>
      </div>

      <div className="main-menu__panel">
        <div className="main-menu__actions">
          {hasSave && (
            <Button variant="primary" onClick={onContinue}>Continue</Button>
          )}
          <Button
            variant={hasSave ? undefined : 'primary'}
            onClick={() => onNewGame(selected)}
          >
            New Studio
          </Button>
        </div>

        <section className="main-menu__section">
          <h2 className="main-menu__section-title">Talent Database</h2>
          <p className="main-menu__section-note">
            Who works in your industry. Chosen once, when a studio is founded &mdash; the whole
            talent pool is built from it.
          </p>

          <div className="main-menu__db-list" role="radiogroup" aria-label="Talent database">
            {databases.map((db) => (
              <button
                key={db.id}
                type="button"
                role="radio"
                aria-checked={db.id === selectedId}
                className={`main-menu__db${db.id === selectedId ? ' main-menu__db--selected' : ''}`}
                onClick={() => setSelectedId(db.id)}
              >
                <span className="main-menu__db-head">
                  <span className="main-menu__db-name typed">{db.name}</span>
                  {db.containsRealPeople && (
                    <span className="main-menu__db-flag">Real people</span>
                  )}
                </span>
                <span className="main-menu__db-desc">{db.description}</span>
              </button>
            ))}
          </div>

          {selected.containsRealPeople && (
            <p className="main-menu__warning">
              This roster names real public figures and gives them invented statistics and
              personalities. It is fine for your own play, and is not something to distribute.
            </p>
          )}

          <div className="main-menu__db-actions">
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="main-menu__file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                // Clear, so picking the same file twice still fires a change.
                e.target.value = '';
              }}
            />
            <Button onClick={() => fileInput.current?.click()}>Load a database&hellip;</Button>
            <Button onClick={handleExport}>Export &ldquo;{selected.name}&rdquo;</Button>
          </div>

          {importError && <p className="main-menu__error" role="alert">{importError}</p>}
          {importNote && !importError && <p className="main-menu__note">{importNote}</p>}
        </section>
      </div>
    </div>
  );
}
