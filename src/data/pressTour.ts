// Press Tours - tunable numbers (docs/DESIGN_REVIEW_marketing_campaign.md,
// "press tours" / D). Sending cast on tour builds pre-release Buzz; each person
// is a fame-vs-risk-vs-cost bet. Pure logic lives in engine/pressTour.ts,
// charged out of cash at release alongside marketing. Same "plain data here,
// wired in via the engine" discipline as data/producers.ts.

// Buzz points a perfectly media-safe, A-list (fame 100) tourer contributes
// before diminishing-returns stacking. A person's fame scales this linearly.
export const PRESS_TOUR_BUZZ_PER_PERSON = 14;

// How hard media risk bites: contribution = fameUpside * (1 - SENSITIVITY * risk).
// Above risk 1/SENSITIVITY (~0.63) a tourer is a net *liability* - a famous
// loose cannon whose bad press outweighs their draw.
export const PRESS_TOUR_RISK_SENSITIVITY = 1.6;

// Relative weights of the three personality stats that make someone a media
// risk (high controversy, low professionalism, low pressure-handling).
// Normalized internally, so only the ratios matter.
export const PRESS_TOUR_RISK_WEIGHTS = { controversy: 0.5, professionalism: 0.3, pressureHandling: 0.2 };

// Geometric decay when stacking multiple tourers, strongest first - a six-person
// tour isn't six solo tours (the same discipline producer stacking uses).
export const PRESS_TOUR_STACK_DECAY = 0.7;

// Clamp on the net Buzz swing a tour can produce, either direction.
export const PRESS_TOUR_MAX_BUZZ_SWING = 30;

// Cash cost per tourer: a flat base plus a fame-scaled premium (a marquee name's
// junket circuit costs far more than a supporting player's).
export const PRESS_TOUR_BASE_COST_PER_PERSON = 300_000;
export const PRESS_TOUR_FAME_COST_AT_100 = 2_000_000; // premium added at fame 100, linear from 0
