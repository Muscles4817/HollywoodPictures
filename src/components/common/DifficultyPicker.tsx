import { DIFFICULTY_TIERS } from '../../data/difficulty';
import { useState } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { Money } from './Money';

/** A starting position for a fresh studio - cash plus the Brand/Prestige a studio of that stature would already carry. */
export 
// Established Indie - a fair, still-challenging default, roughly where the old
// picker's mid-choice sat before the ladder was widened at both ends.
const DEFAULT_TIER_ID = 'indie';

export interface DifficultyChoice {
  startingCash: number;
  brand: number;
  prestige: number;
}

interface DifficultyPickerProps {
  studioName: string;
  onConfirm: (choice: DifficultyChoice) => void;
  onCancel: () => void;
  /**
   * A brand-new launch rather than a mid-game reset. Same tier choice either
   * way (that's the point - the player picks their start on day one just as a
   * Reset lets them), but the surrounding copy adapts: there's no cash, Brand,
   * Prestige, or film history to wipe yet, so the reset warning would be
   * misleading. Defaults to false so every existing Reset caller is unchanged.
   */
  firstRun?: boolean;
}

/** Shown before RESET_SAVE actually fires - lets the player pick a starting stature (cash + the Brand/Prestige that stature implies) instead of always getting the same default (see docs/DESIGN.md). Also offered on first launch (App.tsx) so a new player starts how they want. */
export function DifficultyPicker({ studioName, onConfirm, onCancel, firstRun = false }: DifficultyPickerProps) {
  const [selectedId, setSelectedId] = useState(DEFAULT_TIER_ID);
  const selected = DIFFICULTY_TIERS.find((t) => t.id === selectedId)!;

  return (
    <div className="modal-overlay">
      <div className="modal-content stack">
        <h2 style={{ margin: 0 }}>{firstRun ? `Welcome to ${studioName}` : `Reset ${studioName}?`}</h2>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>
          {firstRun
            ? 'Pick where your studio starts - a bigger name opens with deeper pockets and more standing:'
            : "This wipes all cash, Brand, Prestige, and film history and starts a brand new studio. This can't be undone. Pick where your studio starts - a bigger name opens with deeper pockets and more standing:"}
        </p>
        <div className="grid">
          {DIFFICULTY_TIERS.map((tier) => (
            <Card key={tier.id} selectable selected={tier.id === selectedId} onClick={() => setSelectedId(tier.id)}>
              <div className="card-title">{tier.label}</div>
              <div className="card-subtitle"><Money amount={tier.cash} /></div>
              <div style={{ fontSize: '0.8em', color: 'var(--text-muted)', marginBottom: 4 }}>
                Brand {tier.brand} &middot; Prestige {tier.prestige}
              </div>
              <p style={{ margin: '6px 0 0', fontSize: '0.85em' }}>{tier.description}</p>
            </Card>
          ))}
        </div>
        <div className="row-between">
          <Button onClick={onCancel}>{firstRun ? 'Skip' : 'Cancel'}</Button>
          <Button
            variant="primary"
            onClick={() => onConfirm({ startingCash: selected.cash, brand: selected.brand, prestige: selected.prestige })}
          >
            {firstRun ? 'Start Studio' : 'Start New Studio'}
          </Button>
        </div>
      </div>
    </div>
  );
}
