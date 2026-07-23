// Press Tour Moments - tunable numbers + the moment pool
// (docs/DESIGN_REVIEW_marketing_campaign.md, "press tours" / D2, lean pass).
// Most tours produce nothing: a moment only *maybe* fires, and only because a
// specific tourer is a genuine liability (or, rarely, a standout). Never a
// single scripted event - a varied pool keyed to *why* that person is risky.
// Pure logic lives in engine/pressTourMoments.ts.

// Which stat drove a moment - negatives are gated on the matching liability,
// the lone positive on charisma (high fame + low risk).
export type MomentDriver = 'controversy' | 'pressure' | 'professionalism' | 'charisma';
export type MomentPolarity = 'positive' | 'negative';

export interface PressTourMomentTemplate {
  id: string;
  driver: MomentDriver;
  polarity: MomentPolarity;
  /** Short headline for a notification/summary - `{name}` is replaced with the tourer's name. */
  headline: string;
  /** The sentence appended to the film's story report - `{name}` replaced likewise. */
  story: string;
  /** Applied to the film's Buzz at release (negative for a gaffe, positive for a breakout). */
  buzzDelta: number;
  // Effect on the tourer's own standing - carried here now, applied to the
  // talent pool in D2b (fame/currentHeat are reputation, controversy is
  // personality; see engine/pressTourMoments.ts).
  fameDelta: number;
  heatDelta: number;
  controversyDelta: number;
}

// A maxed-out liability gives at most this chance of a negative moment; a
// media-safe tourer sits near zero (chance scales with the driving stat).
export const PRESS_TOUR_MOMENT_NEGATIVE_SCALE = 0.35;

// A famous, media-safe tourer's chance of a positive breakout, at fame 100 /
// zero risk. Small - breakouts are the exception, not a reward you can plan on.
export const PRESS_TOUR_MOMENT_POSITIVE_SCALE = 0.12;

// Baseline currentHeat a tourer gains just from the exposure of touring - the
// deterministic post-tour reward, applied even to a completely quiet tour.
// Scales from the floor (an unknown) to the fame-100 ceiling (a marquee name
// runs hotter for having been everywhere).
export const PRESS_TOUR_BASELINE_HEAT_FLOOR = 2;
export const PRESS_TOUR_BASELINE_HEAT_AT_100 = 8;

// --- Interactive layer: how the player can respond when a moment fires DURING
// the release window (docs/DESIGN_REVIEW_marketing_campaign.md, "press tours" /
// D interactive). A response applies deterministic multipliers to the base
// moment's effects and adds a narrative clause - the variance was already spent
// on the window roll, so responding is a pure, known trade.
export type PressTourResponseId = 'ignore' | 'apologize' | 'double-down' | 'stay-humble' | 'capitalize';

export interface PressTourResponse {
  id: PressTourResponseId;
  /** Which incidents offer this response. */
  polarity: MomentPolarity;
  label: string;
  description: string;
  // Multipliers on the base moment's effects. For a negative moment buzzDelta is
  // negative, so buzzMult < 1 softens the hit and > 1 deepens it.
  buzzMult: number;
  heatMult: number;
  controversyMult: number;
  fameMult: number;
  /** Appended to the story to reflect the choice - `{name}` replaced with the tourer's name. */
  clause: string;
}

export const PRESS_TOUR_RESPONSES: PressTourResponse[] = [
  // Negative incidents - a PR crisis to manage.
  {
    id: 'apologize', polarity: 'negative', label: 'Issue an apology',
    description: 'Get ahead of it. Recovers much of the buzz hit and cools the heat - but no upside for {name}.',
    buzzMult: 0.4, heatMult: 0.5, controversyMult: 0.3, fameMult: 0.5,
    clause: 'A swift, public apology contained the fallout.',
  },
  {
    id: 'ignore', polarity: 'negative', label: 'Let it blow over',
    description: 'Say nothing and hope the cycle moves on. The moment lands exactly as it happened.',
    buzzMult: 1, heatMult: 1, controversyMult: 1, fameMult: 1,
    clause: 'The studio said nothing and let the cycle move on.',
  },
  {
    id: 'double-down', polarity: 'negative', label: 'Double down',
    description: 'Refuse to back down. A bigger buzz hit to the film - but the notoriety runs {name} hotter and more famous.',
    buzzMult: 1.5, heatMult: 1.4, controversyMult: 1.4, fameMult: 1.6,
    clause: '{name} refused to back down, and the row - and the notoriety - only grew.',
  },
  // Positive breakouts - a good moment to ride or play cool.
  {
    id: 'capitalize', polarity: 'positive', label: 'Lean into it',
    description: 'Ride the wave. A bigger buzz lift and more shine for {name}.',
    buzzMult: 1.4, heatMult: 1.3, controversyMult: 1, fameMult: 1.4,
    clause: 'The studio leaned all the way into the moment.',
  },
  {
    id: 'stay-humble', polarity: 'positive', label: 'Stay gracious',
    description: 'Play it cool and let the work speak. A gentler lift, no risk of overexposure.',
    buzzMult: 0.7, heatMult: 0.7, controversyMult: 1, fameMult: 0.8,
    clause: '{name} kept it gracious and let the work speak for itself.',
  },
];

// The pool. Several cases per negative driver so a loose cannon doesn't produce
// the same headline twice, plus a couple of positive breakouts.
export const PRESS_TOUR_MOMENTS: PressTourMomentTemplate[] = [
  {
    id: 'controversy-viral-remark', driver: 'controversy', polarity: 'negative',
    headline: '{name}’s off-the-cuff remark goes viral',
    story: 'At a junket stop, {name} made an off-message remark that went viral for all the wrong reasons, and the campaign spent days on damage control.',
    buzzDelta: -9, fameDelta: 2, heatDelta: 16, controversyDelta: 8,
  },
  {
    id: 'controversy-costar-feud', driver: 'controversy', polarity: 'negative',
    headline: '{name} feuds with a co-star on tour',
    story: '{name} aired a very public grudge against a co-star mid-tour, and the press ran the feud instead of the film.',
    buzzDelta: -6, fameDelta: 1, heatDelta: 11, controversyDelta: 6,
  },
  {
    id: 'pressure-live-meltdown', driver: 'pressure', polarity: 'negative',
    headline: '{name} unravels in a live interview',
    story: '{name} froze and visibly unravelled during a live interview, and the clip did the rounds for the wrong reasons.',
    buzzDelta: -5, fameDelta: 0, heatDelta: 7, controversyDelta: 2,
  },
  {
    id: 'pressure-conference-walkout', driver: 'pressure', polarity: 'negative',
    headline: '{name} walks out of a press conference',
    story: '{name} cut a press conference short and walked, leaving a room of reporters with an easy story.',
    buzzDelta: -6, fameDelta: 0, heatDelta: 9, controversyDelta: 3,
  },
  {
    id: 'professionalism-no-show', driver: 'professionalism', polarity: 'negative',
    headline: '{name} no-shows a string of appearances',
    story: '{name} quietly skipped a run of scheduled appearances, and the empty chairs did the campaign no favours.',
    buzzDelta: -5, fameDelta: -1, heatDelta: 3, controversyDelta: 2,
  },
  {
    id: 'professionalism-checked-out', driver: 'professionalism', polarity: 'negative',
    headline: '{name} phones in the whole circuit',
    story: '{name} looked bored and checked-out through the entire press circuit, and the indifference read on camera.',
    buzzDelta: -3, fameDelta: -1, heatDelta: 1, controversyDelta: 1,
  },
  {
    id: 'charisma-circuit-breakout', driver: 'charisma', polarity: 'positive',
    headline: '{name} charms the entire press circuit',
    story: '{name} charmed the entire press circuit - one clip went genuinely viral and pulled the whole campaign along with it.',
    buzzDelta: 9, fameDelta: 4, heatDelta: 12, controversyDelta: 0,
  },
  {
    id: 'charisma-heartfelt-moment', driver: 'charisma', polarity: 'positive',
    headline: '{name} wins the room with a heartfelt moment',
    story: '{name} shared a heartfelt, unguarded story on the circuit that won the room over and gave the film a warm run of coverage.',
    buzzDelta: 6, fameDelta: 2, heatDelta: 8, controversyDelta: 0,
  },
];
