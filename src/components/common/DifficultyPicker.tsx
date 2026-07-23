import { useState } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { Money } from './Money';

/** A starting position for a fresh studio - cash plus the Brand/Prestige a studio of that stature would already carry. */
export interface DifficultyTier {
  id: string;
  label: string;
  cash: number;
  brand: number;
  prestige: number;
  description: string;
}

// Ordered hardest -> easiest. Calibrated against the game's own economics
// rather than picked out of the air: a single Big/tentpole film's total
// commitment runs up to ~£200M (engine/rivalStudios.ts's own diagnostic:
// Big averages ~£70M, tops out near £172M), and the AI Major rival starts on
// £260M cash with Brand 70 / Prestige 55. So the player's own tiers ladder up
// to genuine studio scale - the old flat £25M "Major" couldn't fund even one
// blockbuster. Brand/Prestige climb with the label too (mirroring
// STARTING_BRAND/PRESTIGE_BY_TIER for rivals, extended below Indie and above
// Major), and the mid tiers lean prestige-forward the way a real boutique
// (an A24) trades on critical standing ahead of its balance sheet.
const DIFFICULTY_TIERS: DifficultyTier[] = [
  { id: 'garage', label: 'Garage Outfit', cash: 500_000, brand: 3, prestige: 4, description: 'An unknown name and pocket change - one microbudget film is all you can risk. Brutal.' },
  { id: 'grassroots', label: 'Grassroots Indie', cash: 2_000_000, brand: 10, prestige: 14, description: 'Barely enough for one small film at a time. High risk, high reward.' },
  { id: 'indie', label: 'Established Indie', cash: 8_000_000, brand: 24, prestige: 30, description: 'A modest catalogue and a cult following - room for a few missteps.' },
  { id: 'boutique', label: 'Boutique Studio', cash: 25_000_000, brand: 34, prestige: 48, description: 'A tastemaker\'s name ahead of its balance sheet - critics already respect you.' },
  { id: 'midmajor', label: 'Mid-Major Studio', cash: 80_000_000, brand: 52, prestige: 50, description: 'A recognised name with real resources - you can mount an ambitious film from the off.' },
  { id: 'major', label: 'Major Studio', cash: 200_000_000, brand: 72, prestige: 60, description: 'A household name with deep pockets - a genuine tentpole is within reach on day one.' },
  { id: 'legacy', label: 'Legacy Powerhouse', cash: 500_000_000, brand: 92, prestige: 80, description: 'A century of hits and awards behind you - fund blockbusters and prestige plays at will.' },
];

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
}

/** Shown before RESET_SAVE actually fires - lets the player pick a starting stature (cash + the Brand/Prestige that stature implies) instead of always getting the same default (see docs/DESIGN.md). */
export function DifficultyPicker({ studioName, onConfirm, onCancel }: DifficultyPickerProps) {
  const [selectedId, setSelectedId] = useState(DEFAULT_TIER_ID);
  const selected = DIFFICULTY_TIERS.find((t) => t.id === selectedId)!;

  return (
    <div className="modal-overlay">
      <div className="modal-content stack">
        <h2 style={{ margin: 0 }}>Reset {studioName}?</h2>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>
          This wipes all cash, Brand, Prestige, and film history and starts a brand new studio. This can't be undone.
          Pick where your studio starts - a bigger name opens with deeper pockets and more standing:
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
          <Button onClick={onCancel}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => onConfirm({ startingCash: selected.cash, brand: selected.brand, prestige: selected.prestige })}
          >
            Start New Studio
          </Button>
        </div>
      </div>
    </div>
  );
}
