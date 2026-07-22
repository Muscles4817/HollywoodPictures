import { type ReactNode } from 'react';
import { useStudio } from '../state/StudioContext';
import { Button } from './common/Button';
import { Money } from './common/Money';
import { playerReleasedFilms } from '../engine/project';
import {
  canUnlockDistributionArm,
  distributionArmTier,
  distributionArmUpgradeCost,
  internationalReachForTier,
  internationalTier,
  internationalUpgradeCost,
  isDistributionArmUnlocked,
  nextDistributionArmTier,
  nextInternationalTier,
} from '../engine/distribution';
import {
  DISTRIBUTION_ARM_UNLOCK_BRAND,
  DISTRIBUTION_ARM_UNLOCK_FILMS_RELEASED,
  INTERNATIONAL_DISTRIBUTION_MAX_TIER,
  INTERNATIONAL_KEEP_SHARE,
  SELF_DISTRIBUTION_WIDE_CEILING_BY_TIER,
} from '../data/distribution';
import './ProductionOfficeCard.css';

/** A percent readout of the Wide screen reach a given self-distribution tier can command. */
function reachPct(tier: number): number {
  return Math.round((SELF_DISTRIBUTION_WIDE_CEILING_BY_TIER[tier] ?? 0) * 100);
}

/**
 * The Distribution Arm facility on the Dashboard - the studio's own theatrical
 * distribution operation. Locked until its milestone; once open, self-
 * distributing a Wide release is unlocked and the screen reach it can command
 * scales with tier (engine/distribution.ts). Until then, going Wide means
 * renting a major's distribution at a cut, chosen on the Marketing screen.
 */
export function DistributionArmCard() {
  const { state, dispatch } = useStudio();
  const { studio } = state;

  if (!isDistributionArmUnlocked(studio)) {
    const filmsReleased = playerReleasedFilms(state.projects).length;
    const canUnlock = canUnlockDistributionArm(studio.brand, filmsReleased);
    return (
      <section className="dashboard-card dashboard-sidebar-card">
        <ArmHeading />
        <p className="dashboard-sidebar-empty">
          Stand up your own Distribution Arm to self-distribute Wide releases. Until then a Wide release means renting a
          major's distribution — they take a cut of your box office.
        </p>
        <p className="office-milestone">
          Unlock by releasing {DISTRIBUTION_ARM_UNLOCK_FILMS_RELEASED} films ({filmsReleased}/{DISTRIBUTION_ARM_UNLOCK_FILMS_RELEASED}) or reaching Brand {DISTRIBUTION_ARM_UNLOCK_BRAND} ({studio.brand}/{DISTRIBUTION_ARM_UNLOCK_BRAND}).
        </p>
        <Button variant="primary" disabled={!canUnlock} onClick={() => dispatch({ type: 'UNLOCK_DISTRIBUTION_ARM' })}>
          {canUnlock ? 'Build the Distribution Arm' : 'Milestone not met'}
        </Button>
      </section>
    );
  }

  const tier = distributionArmTier(studio);
  const next = nextDistributionArmTier(studio);
  const upgradeCost = distributionArmUpgradeCost(studio);

  return (
    <section className="dashboard-card dashboard-sidebar-card">
      <ArmHeading trailing={<span className="office-tier-pill">Tier {tier}</span>} />

      <p className="office-research-blurb">
        Self-distribute Wide releases, commanding up to <strong>{reachPct(tier)}%</strong> of screens (the market still
        decides how many of those actually book you). You keep your full box-office share — no distributor's cut.
      </p>

      <div className="office-actions">
        {next != null && upgradeCost != null ? (
          <Button
            className="btn-sm"
            disabled={studio.cash < upgradeCost}
            onClick={() => dispatch({ type: 'UPGRADE_DISTRIBUTION_ARM' })}
          >
            Upgrade to Tier {next} ({reachPct(next)}% reach) — <Money amount={upgradeCost} />
          </Button>
        ) : (
          <p className="office-research-maxed">Fully expanded — the widest reach a studio can command.</p>
        )}
      </div>

      <InternationalDistributionSection />
    </section>
  );
}

/** A percent readout of the international pool a given International Distribution tier reaches. */
function intlReachPct(tier: number): number {
  return Math.round(internationalReachForTier(tier) * 100);
}

/**
 * The International Distribution track - an independent upgrade track ON the arm
 * (mirroring the Production Office's Market Research track). Tier 0 is the hard
 * gate: a film with no international distribution earns domestic box office only.
 * Each tier widens the overseas pool the studio actually reaches.
 */
function InternationalDistributionSection() {
  const { state, dispatch } = useStudio();
  const { studio } = state;
  const tier = internationalTier(studio);
  const next = nextInternationalTier(studio);
  const upgradeCost = internationalUpgradeCost(studio);
  const keepPct = Math.round(INTERNATIONAL_KEEP_SHARE * 100);

  return (
    <div className="office-research">
      <div className="office-research-head">
        <span className="dashboard-section-kicker">International Distribution</span>
        <span className="office-tier-pill">Tier {tier}/{INTERNATIONAL_DISTRIBUTION_MAX_TIER}</span>
      </div>
      <p className="office-research-blurb">
        {tier === 0
          ? 'No overseas distribution — your films earn domestic box office only. Buy in to open international markets.'
          : `Reaching ${intlReachPct(tier)}% of the international audience, keeping ${keepPct}% of overseas gross.`}
      </p>
      {next != null && upgradeCost != null ? (
        <Button
          className="btn-sm"
          disabled={studio.cash < upgradeCost}
          onClick={() => dispatch({ type: 'UPGRADE_INTERNATIONAL_DISTRIBUTION' })}
        >
          {tier === 0 ? 'Open international' : `Upgrade to Tier ${next}`} ({intlReachPct(next)}% reach) — <Money amount={upgradeCost} />
        </Button>
      ) : (
        <p className="office-research-maxed">Full international reach — every market you can play.</p>
      )}
    </div>
  );
}

function ArmHeading({ trailing }: { trailing?: ReactNode }) {
  return (
    <div className="dashboard-card-heading dashboard-sidebar-heading">
      <div>
        <span className="dashboard-section-kicker">Facilities</span>
        <h2>Distribution Arm</h2>
      </div>
      {trailing}
    </div>
  );
}
