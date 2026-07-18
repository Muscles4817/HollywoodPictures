import { useStudio } from '../../state/StudioContext';
import { deriveFocusedDraft } from '../../state/selectors';
import { Button } from '../common/Button';
import { Money } from '../common/Money';
import {
  benchProducerIds,
  computeProducerEffects,
  getProducerCareer,
  isOfficeUnlocked,
  producerPerFilmFee,
  producersByIds,
  totalAttachedPerFilmFees,
  type ProducerEffects,
} from '../../engine/producers';
import { PRODUCER_SPECIALTY_BLURB, PRODUCER_SPECIALTY_LABEL } from '../../data/producers';
import type { Genre, Person } from '../../types';

/**
 * The per-film attach/detach surface (docs/DESIGN_REVIEW_production_office.md,
 * increment 4b) - a Producer Workspace section where the player puts bench
 * producers onto the active film. Charges nothing here; each attached
 * producer's per-film fee lands at release, folded into the film's cost.
 */
export function ProjectProducers() {
  const { state, dispatch } = useStudio();
  const draft = deriveFocusedDraft(state);
  if (!draft) return null;

  const { studio } = state;
  const pool = state.producerPool ?? [];
  const genre = draft.genre;
  const attachedIds = draft.attachedProducerIds ?? [];
  const bench = producersByIds(pool, benchProducerIds(studio));
  const attached = producersByIds(pool, attachedIds);
  const combined = computeProducerEffects(attached, genre);
  const totalFee = totalAttachedPerFilmFees(pool, attachedIds);

  if (!isOfficeUnlocked(studio)) {
    return (
      <div className="stack">
        <h1>Producers</h1>
        <p className="choice-description">
          Open a Production Office (from the Dashboard) and hire Producers to attach them to this film for real,
          in-production boosts.
        </p>
      </div>
    );
  }

  if (bench.length === 0) {
    return (
      <div className="stack">
        <h1>Producers</h1>
        <p className="choice-description">
          Your Production Office bench is empty. Hire specialists from the Dashboard, then attach the right ones to
          this film here.
        </p>
      </div>
    );
  }

  return (
    <div className="stack">
      <h1>Producers</h1>
      <p className="choice-description">
        Attach bench producers to this film. Nothing is charged now - each attached producer's per-film fee is added
        to the film's cost at release. Genre affinity (♦) amplifies a producer's boost.
      </p>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Attached — combined effect</h2>
        {attached.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>No producers attached yet.</p>
        ) : (
          <>
            <ul className="producer-effect-lines">
              {describeEffects(combined).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <div className="row-between" style={{ borderTop: '1px solid var(--border)', paddingTop: 8, fontWeight: 600 }}>
              <span>Total per-film fee (charged at release)</span>
              <Money amount={totalFee} />
            </div>
          </>
        )}
      </div>

      <div className="stack">
        {bench.map((person) => {
          const isAttached = attachedIds.includes(person.id);
          return (
            <ProducerAttachRow
              key={person.id}
              person={person}
              genre={genre}
              attached={isAttached}
              onToggle={() =>
                dispatch({ type: isAttached ? 'DETACH_PRODUCER' : 'ATTACH_PRODUCER', producerId: person.id })
              }
            />
          );
        })}
      </div>
    </div>
  );
}

function ProducerAttachRow({
  person,
  genre,
  attached,
  onToggle,
}: {
  person: Person;
  genre: Genre | null;
  attached: boolean;
  onToggle: () => void;
}) {
  const career = getProducerCareer(person);
  if (!career) return null;
  const affinityHit = genre != null && career.genreAffinity.includes(genre);
  // Single-producer effect against this film's genre, so the row's preview
  // already reflects affinity and reliability.
  const soloEffect = computeProducerEffects([person], genre);

  return (
    <div className="card row-between" style={{ alignItems: 'center', gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <strong>{person.identity.name}</strong>
          <span className="badge">{PRODUCER_SPECIALTY_LABEL[career.specialty]}</span>
          {affinityHit && <span className="badge" style={{ color: 'var(--primary)' }}>♦ {genre}</span>}
        </div>
        <p style={{ margin: '4px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {PRODUCER_SPECIALTY_BLURB[career.specialty]} {describeEffects(soloEffect)[0]}
        </p>
        <small style={{ color: 'var(--text-muted)' }}>
          Per film <Money amount={producerPerFilmFee(person)} />
        </small>
      </div>
      <Button variant={attached ? 'secondary' : 'primary'} onClick={onToggle}>
        {attached ? 'Detach' : 'Attach'}
      </Button>
    </div>
  );
}

/** Turn a combined/solo ProducerEffects into short human-readable lines, one per non-neutral lever. */
function describeEffects(effects: ProducerEffects): string[] {
  const lines: string[] = [];
  const costCut = Math.round((1 - effects.productionCostMultiplier) * 100);
  if (costCut > 0) lines.push(`−${costCut}% production budget`);
  if (effects.postProductionDelta > 0) lines.push(`+${effects.postProductionDelta.toFixed(1)} post-production`);
  const mktg = Math.round((effects.marketingEfficiencyMultiplier - 1) * 100);
  if (mktg > 0) lines.push(`+${mktg}% marketing efficiency`);
  if (effects.flatBuzzDelta > 0) lines.push(`+${effects.flatBuzzDelta.toFixed(1)} buzz`);
  const eventCut = Math.round((1 - effects.eventNegativeImpactMultiplier) * 100);
  if (eventCut > 0) lines.push(`−${eventCut}% on-set disaster impact`);
  return lines.length > 0 ? lines : ['No active boost.'];
}
