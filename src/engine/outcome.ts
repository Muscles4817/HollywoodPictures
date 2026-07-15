import type { OutcomeLabel } from '../types';

const BLOCKBUSTER_BOX_OFFICE = 250_000_000;
const PHENOMENON_BOX_OFFICE = 750_000_000;

/**
 * Profit after the studio's share of revenue, divided by the film's total
 * cost. A value of:
 *
 * -1.0 means the entire investment was lost.
 *  0.0 means the studio broke even.
 *  0.5 means a 50% return on the film's total cost.
 *  1.0 means the studio earned its cost again as profit.
 */
export function computeProfitRatio(
  profit: number,
  totalCost: number,
): number {
  return totalCost > 0
    ? profit / totalCost
    : 0;
}

type CommercialOutcome =
  | 'Flop'
  | 'Weak'
  | 'Modest Success'
  | 'Hit'
  | 'Blockbuster'
  | 'Phenomenon';

interface OutcomeInputs {
  profit: number;
  totalCost: number;
  totalBoxOffice: number;
  qualityScore: number;
  criticScore: number;
  audienceScore: number;
}

/**
 * Classifies the film's commercial performance before critical or audience
 * distinctions are considered.
 *
 * Profitability and absolute reach are intentionally separate:
 *
 * - A tiny film can be an exceptional return without being a blockbuster.
 * - A huge-grossing film can be culturally important while still providing
 *   a disappointing return against an enormous cost.
 */
export function determineCommercialOutcome(
  profit: number,
  totalCost: number,
  totalBoxOffice: number,
): CommercialOutcome {
  const profitRatio = computeProfitRatio(
    profit,
    totalCost,
  );

  if (profitRatio <= -0.5) {
    return 'Flop';
  }

  if (profitRatio < 0.1) {
    return 'Weak';
  }

  /*
   * Phenomenon requires both extraordinary reach and a strong return.
   * This prevents a massively expensive film that barely broke even from
   * receiving the game's highest commercial label.
   */
  if (
    totalBoxOffice >= PHENOMENON_BOX_OFFICE &&
    profitRatio >= 1
  ) {
    return 'Phenomenon';
  }

  /*
   * A Blockbuster must operate at genuine mainstream scale.
   *
   * The alternate route allows a somewhat smaller release to qualify if
   * its return is extraordinary, while still preventing tiny high-ROI
   * productions from being called blockbusters.
   */
  if (
    (
      totalBoxOffice >= BLOCKBUSTER_BOX_OFFICE &&
      profitRatio >= 0.5
    ) ||
    (
      totalBoxOffice >= 100_000_000 &&
      profitRatio >= 1.25
    )
  ) {
    return 'Blockbuster';
  }

  if (profitRatio >= 0.5) {
    return 'Hit';
  }

  return 'Modest Success';
}


/**
 * Produces the player's headline outcome label.
 *
 * Commercial performance is classified first. Exceptional critical or
 * audience reception can then produce one of the special labels, but the
 * most severe commercial failure remains visible rather than being hidden
 * beneath an accolade.
 */
export function determineOutcome({
  profit,
  totalCost,
  totalBoxOffice,
  qualityScore,
  criticScore,
  audienceScore,
}: OutcomeInputs): OutcomeLabel {
  const commercialOutcome =
    determineCommercialOutcome(
      profit,
      totalCost,
      totalBoxOffice,
    );

  /*
   * A catastrophic financial failure should remain labelled a Flop even
   * when critics admire it. Its critical standing can still build Prestige
   * independently.
   */
  if (commercialOutcome === 'Flop') {
    return 'Flop';
  }

  /*
   * Masterpiece is deliberately difficult to reach and requires agreement
   * between underlying quality, critics and audiences.
   */
  const isMasterpiece =
    qualityScore >= 85 &&
    criticScore >= 88 &&
    audienceScore >= 75;

  if (isMasterpiece) {
    return 'Masterpiece';
  }

  /*
   * Cult Hit represents a film that underperformed commercially but found
   * unusually strong audience affection. Critic approval helps, but audience
   * response is essential to the meaning of the label.
   */
  const isCultHit =
    (
      commercialOutcome === 'Weak' ||
      commercialOutcome === 'Modest Success'
    ) &&
    audienceScore >= 78 &&
    criticScore >= 60;

  if (isCultHit) {
    return 'Cult Hit';
  }

  return commercialOutcome;
}
