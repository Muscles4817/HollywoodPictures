import { useState } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { Money } from './Money';

interface DifficultyTier {
  id: string;
  label: string;
  cash: number;
  description: string;
}

const DIFFICULTY_TIERS: DifficultyTier[] = [
  { id: 'grassroots', label: 'Grassroots Indie', cash: 1_000_000, description: 'Barely enough to get one small film off the ground at a time. High risk, high reward.' },
  { id: 'indie', label: 'Indie', cash: 3_000_000, description: 'A modest cushion - room for a few missteps without going under.' },
  { id: 'mid', label: 'Mid-Level', cash: 10_000_000, description: 'Comfortable room to make ambitious choices early on.' },
  { id: 'major', label: 'Major Studio', cash: 25_000_000, description: 'Deep pockets from day one.' },
];

interface DifficultyPickerProps {
  studioName: string;
  onConfirm: (startingCash: number) => void;
  onCancel: () => void;
}

/** Shown before RESET_SAVE actually fires - lets the player pick a starting budget instead of always getting the same default (see docs/DESIGN.md). */
export function DifficultyPicker({ studioName, onConfirm, onCancel }: DifficultyPickerProps) {
  const [selectedId, setSelectedId] = useState(DIFFICULTY_TIERS[2].id);
  const selected = DIFFICULTY_TIERS.find((t) => t.id === selectedId)!;

  return (
    <div className="modal-overlay">
      <div className="modal-content stack">
        <h2 style={{ margin: 0 }}>Reset {studioName}?</h2>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>
          This wipes all cash, Brand, Prestige, and film history and starts a brand new studio. This can't be undone.
          Pick a starting budget:
        </p>
        <div className="grid">
          {DIFFICULTY_TIERS.map((tier) => (
            <Card key={tier.id} selectable selected={tier.id === selectedId} onClick={() => setSelectedId(tier.id)}>
              <div className="card-title">{tier.label}</div>
              <div className="card-subtitle"><Money amount={tier.cash} /></div>
              <p style={{ margin: '6px 0 0', fontSize: '0.85em' }}>{tier.description}</p>
            </Card>
          ))}
        </div>
        <div className="row-between">
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="primary" onClick={() => onConfirm(selected.cash)}>Start New Studio</Button>
        </div>
      </div>
    </div>
  );
}
