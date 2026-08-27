import { useEffect, useMemo, useRef, useState } from 'react';
import { useStudio } from '../../state/StudioContext';
import { collectProjectCards } from '../../state/selectors';
import { projectOpenIntent } from '../../state/projectNavigation';
import { DESTINATIONS } from './destinations';
import type { GameAction } from '../../state/gameState';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

interface PaletteItem {
  id: string;
  kind: 'Go to' | 'Project' | 'Talent';
  name: string;
  meta: string;
  /** Empty means the item is real but not actionable from here. */
  actions: GameAction[];
  haystack: string;
}

const MAX_RESULTS = 8;

/**
 * Ctrl-K / Cmd-K. The chassis's answer to a problem a menu structurally cannot
 * solve: the roster runs to a couple of thousand people, so most of what the
 * player might want to reach has no menu entry and never will. Destinations
 * and films in flight are here too, because once a search box exists it is the
 * fastest route to those as well.
 *
 * Talent results deliberately route to the Talent Database rather than opening
 * a person: hiring is a decision that belongs to a project's own casting
 * drawer, and letting a palette bypass that would be a shortcut past the
 * negotiation the game is actually about.
 */
export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const { state, dispatch } = useStudio();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
      inputRef.current?.focus();
    }
  }, [open]);

  const items = useMemo<PaletteItem[]>(() => {
    // Closed is the normal state, and this component is always mounted and
    // subscribed to the studio - so without this guard the whole roster is
    // re-indexed on every tick of the clock, for nobody.
    if (!open) return [];

    const destinations: PaletteItem[] = DESTINATIONS.map((d) => ({
      id: `dest:${d.id}`,
      kind: 'Go to',
      name: d.label,
      meta: d.group,
      actions: [d.action],
      haystack: `${d.label} ${d.group} ${(d.keywords ?? []).join(' ')}`.toLowerCase(),
    }));

    const projects: PaletteItem[] = collectProjectCards(state).map((card) => {
      const intent = projectOpenIntent(card, state);
      return {
        id: `proj:${card.projectId}`,
        kind: 'Project',
        name: card.title,
        meta: card.director ? `${card.stage} · ${card.director}` : card.stage,
        actions: intent.kind === 'navigate' || intent.kind === 'resume' ? intent.actions : [{ type: 'VIEW_PROJECTS' }],
        haystack: `${card.title} ${card.genre} ${card.director ?? ''} ${card.leads.join(' ')}`.toLowerCase(),
      };
    });

    // talentPool is keyed by profession, so the professions are the natural
    // "meta" line - no need to re-derive a role from the person.
    const talent: PaletteItem[] = Object.entries(state.talentPool).flatMap(([profession, people]) =>
      people.map((person) => ({
        id: `talent:${profession}:${person.identity.name}`,
        kind: 'Talent' as const,
        name: person.identity.name,
        meta: profession,
        actions: [{ type: 'VIEW_TALENT_DATABASE' } as GameAction],
        haystack: `${person.identity.name} ${profession}`.toLowerCase(),
      })),
    );

    return [...destinations, ...projects, ...talent];
  }, [open, state]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    // With no query, offer the destinations rather than an arbitrary slice of
    // two thousand names - an empty palette should look like a menu.
    if (!q) return items.filter((i) => i.kind === 'Go to').slice(0, MAX_RESULTS);
    return items.filter((i) => i.haystack.includes(q)).slice(0, MAX_RESULTS);
  }, [items, query]);

  useEffect(() => setCursor(0), [query]);

  if (!open) return null;

  function run(item: PaletteItem) {
    item.actions.forEach(dispatch);
    onClose();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (e.key === 'Enter' && results[cursor]) { e.preventDefault(); run(results[cursor]); }
  }

  return (
    <div className="palette-scrim" onMouseDown={onClose}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Find anything" onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="palette__input typed"
          type="text"
          placeholder="Find a person, a film, or a place…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label="Search"
        />
        <div className="palette__list">
          {results.length === 0 ? (
            <p className="palette__empty">Nothing matches “{query}”.</p>
          ) : (
            results.map((item, i) => (
              <button
                key={item.id}
                type="button"
                className="palette__item"
                aria-current={i === cursor ? 'true' : undefined}
                onMouseEnter={() => setCursor(i)}
                onClick={() => run(item)}
              >
                <span className="palette__kind">{item.kind}</span>
                <span className="palette__name typed">{item.name}</span>
                <span className="palette__meta">{item.meta}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
