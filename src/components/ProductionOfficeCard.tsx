import { useState, type ReactNode } from 'react';
import { useStudio } from '../state/StudioContext';
import { Button } from './common/Button';
import { Money } from './common/Money';
import { playerReleasedFilms } from '../engine/project';
import {
  benchCapacity,
  benchProducerIds,
  canUnlockOffice,
  getProducerCareer,
  isOfficeUnlocked,
  isProducer,
  nextOfficeTier,
  officeTier,
  officeUpgradeCost,
  producerHiringFee,
  producerPerFilmFee,
  producersByIds,
} from '../engine/producers';
import {
  OFFICE_UNLOCK_BRAND,
  OFFICE_UNLOCK_FILMS_RELEASED,
  PRODUCER_SPECIALTY_BLURB,
  PRODUCER_SPECIALTY_LABEL,
} from '../data/producers';
import {
  bandFractionForTier,
  marketResearchTier,
  marketResearchUpgradeCost,
  nextMarketResearchTier,
} from '../engine/marketResearch';
import { MARKET_RESEARCH_TIER_LABEL } from '../data/marketResearch';
import type { Person } from '../types';
import './ProductionOfficeCard.css';

/**
 * The Production Office facility on the Dashboard (docs/DESIGN_REVIEW_production_office.md,
 * increment 4). Locked until its milestone; once open, shows the bench and
 * opens a modal to hire/fire Producers. Attaching them to a film happens on
 * that film's Producer Workspace, not here.
 */
export function ProductionOfficeCard() {
  const { state, dispatch } = useStudio();
  const { studio } = state;
  const [managing, setManaging] = useState(false);

  if (!isOfficeUnlocked(studio)) {
    const filmsReleased = playerReleasedFilms(state.projects).length;
    const canUnlock = canUnlockOffice(studio.brand, filmsReleased);
    return (
      <section className="dashboard-card dashboard-sidebar-card">
        <OfficeHeading />
        <p className="dashboard-sidebar-empty">
          Open a Production Office to hire Producers and attach them to your films for real, in-production boosts.
        </p>
        <p className="office-milestone">
          Unlock by releasing {OFFICE_UNLOCK_FILMS_RELEASED} films ({filmsReleased}/{OFFICE_UNLOCK_FILMS_RELEASED}) or reaching Brand {OFFICE_UNLOCK_BRAND} ({studio.brand}/{OFFICE_UNLOCK_BRAND}).
        </p>
        <Button variant="primary" disabled={!canUnlock} onClick={() => dispatch({ type: 'UNLOCK_PRODUCTION_OFFICE' })}>
          {canUnlock ? 'Open the Production Office' : 'Milestone not met'}
        </Button>
      </section>
    );
  }

  const tier = officeTier(studio);
  const cap = benchCapacity(studio);
  const benchIds = benchProducerIds(studio);
  const bench = producersByIds(state.producerPool ?? [], benchIds);
  const next = nextOfficeTier(studio);
  const upgradeCost = officeUpgradeCost(studio);

  return (
    <section className="dashboard-card dashboard-sidebar-card">
      <OfficeHeading trailing={<span className="office-tier-pill">Tier {tier}</span>} />

      <p className="office-bench-count">
        <strong>{benchIds.length} / {cap}</strong> producers on the bench
      </p>

      {bench.length === 0 ? (
        <p className="dashboard-sidebar-empty">No producers hired yet.</p>
      ) : (
        <ul className="office-bench-list">
          {bench.map((person) => {
            const career = getProducerCareer(person);
            return (
              <li key={person.id} className="office-bench-row">
                <strong>{person.identity.name}</strong>
                {career && <small>{PRODUCER_SPECIALTY_LABEL[career.specialty]}</small>}
              </li>
            );
          })}
        </ul>
      )}

      <div className="office-actions">
        <Button className="btn-sm" variant="primary" onClick={() => setManaging(true)}>Manage producers</Button>
        {next != null && upgradeCost != null && (
          <Button
            className="btn-sm"
            disabled={studio.cash < upgradeCost}
            onClick={() => dispatch({ type: 'UPGRADE_PRODUCTION_OFFICE' })}
          >
            Upgrade to Tier {next} — <Money amount={upgradeCost} />
          </Button>
        )}
      </div>

      <MarketResearchSection />

      {managing && <ProducerHireModal onClose={() => setManaging(false)} />}
    </section>
  );
}

/**
 * The Market Research department - a second, independently-bought upgrade track
 * housed in the office (docs/DESIGN_REVIEW_marketing_campaign.md,
 * tracking-as-a-service). Every studio gets the free baseline projection band;
 * each level here narrows a film's Projected Opening readout toward the true
 * figure (surfaced on the Marketing screen in F3).
 */
function MarketResearchSection() {
  const { state, dispatch } = useStudio();
  const { studio } = state;
  const tier = marketResearchTier(studio);
  const next = nextMarketResearchTier(studio);
  const upgradeCost = marketResearchUpgradeCost(studio);
  const currentBand = Math.round(bandFractionForTier(tier) * 100);

  return (
    <div className="office-research">
      <div className="office-research-head">
        <span className="dashboard-section-kicker">Market Research</span>
        <span className="office-tier-pill">{MARKET_RESEARCH_TIER_LABEL[tier]}</span>
      </div>
      <p className="office-research-blurb">
        {tier === 0
          ? `Opening projections come in as a wide ±${currentBand}% gut-feel range. Buy in to tighten them.`
          : `Opening projections tracked to within ±${currentBand}% of the real figure.`}
      </p>
      {next != null && upgradeCost != null ? (
        <Button
          className="btn-sm"
          disabled={studio.cash < upgradeCost}
          onClick={() => dispatch({ type: 'UPGRADE_MARKET_RESEARCH' })}
        >
          {tier === 0 ? 'Buy' : 'Upgrade to'} {MARKET_RESEARCH_TIER_LABEL[next]} (±{Math.round(bandFractionForTier(next) * 100)}%) — <Money amount={upgradeCost} />
        </Button>
      ) : (
        <p className="office-research-maxed">Fully upgraded — projections as sharp as they get.</p>
      )}
    </div>
  );
}

function OfficeHeading({ trailing }: { trailing?: ReactNode }) {
  return (
    <div className="dashboard-card-heading dashboard-sidebar-heading">
      <div>
        <span className="dashboard-section-kicker">Facilities</span>
        <h2>Production Office</h2>
      </div>
      {trailing}
    </div>
  );
}

/** Modal to hire onto / fire from the bench. Attaching to a film lives on the Producer Workspace. */
function ProducerHireModal({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useStudio();
  const { studio } = state;
  const benchIds = benchProducerIds(studio);
  const cap = benchCapacity(studio);
  const benchFull = benchIds.length >= cap;
  const pool = state.producerPool ?? [];
  const bench = producersByIds(pool, benchIds);
  const available = pool.filter((p) => isProducer(p) && !benchIds.includes(p.id));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content stack office-modal" style={{ maxWidth: 760 }} onClick={(e) => e.stopPropagation()}>
        <div className="office-modal-head">
          <div>
            <h2>Production Office — Producers</h2>
            <p className="dashboard-muted">
              Bench {benchIds.length} / {cap}. Hire specialists here, then attach them to a film from its workspace.
            </p>
          </div>
          <Button className="btn-sm" onClick={onClose}>Close</Button>
        </div>

        <h3 className="office-modal-subhead">On your bench</h3>
        {bench.length === 0 ? (
          <p className="dashboard-muted">Nobody hired yet — hire a specialist below.</p>
        ) : (
          <div className="producer-card-list">
            {bench.map((person) => (
              <ProducerCard
                key={person.id}
                person={person}
                action={
                  <Button className="btn-sm" onClick={() => dispatch({ type: 'FIRE_PRODUCER', producerId: person.id })}>
                    Fire
                  </Button>
                }
              />
            ))}
          </div>
        )}

        <h3 className="office-modal-subhead">Available to hire</h3>
        <div className="producer-card-list">
          {available.map((person) => {
            const fee = producerHiringFee(person);
            const affordable = studio.cash >= fee;
            const disabled = benchFull || !affordable;
            return (
              <ProducerCard
                key={person.id}
                person={person}
                action={
                  <Button
                    className="btn-sm"
                    variant="primary"
                    disabled={disabled}
                    onClick={() => dispatch({ type: 'HIRE_PRODUCER', producerId: person.id })}
                  >
                    {benchFull ? 'Bench full' : !affordable ? 'Too expensive' : <>Hire — <Money amount={fee} /></>}
                  </Button>
                }
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ProducerCard({ person, action }: { person: Person; action: ReactNode }) {
  const career = getProducerCareer(person);
  if (!career) return null;
  return (
    <div className="producer-card">
      <div className="producer-card-body">
        <div className="producer-card-title">
          <strong>{person.identity.name}</strong>
          <span className="badge">{PRODUCER_SPECIALTY_LABEL[career.specialty]}</span>
        </div>
        <p className="producer-card-blurb">{PRODUCER_SPECIALTY_BLURB[career.specialty]}</p>
        <div className="producer-card-meta">
          <span>Skill {career.skill}</span>
          {career.genreAffinity.length > 0 && <span className="producer-card-affinity">♦ {career.genreAffinity.join(', ')}</span>}
          <span>Per film <Money amount={producerPerFilmFee(person)} /></span>
        </div>
      </div>
      <div className="producer-card-action">{action}</div>
    </div>
  );
}
