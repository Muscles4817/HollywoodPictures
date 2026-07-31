// Ancillary revenue - a film's post-theatrical life (home entertainment,
// television/streaming licensing, merchandising, long-tail catalogue).
//
// Stage 1 of docs/DESIGN_REVIEW_studio_financial_model.md: this is the DERIVED,
// INERT layer. Nothing here credits cash or mutates state - it reads a film's
// existing attributes and computes its ancillary *potential* on demand, exactly
// the "derive, don't store" pattern deriveCommercialProfile / deriveMarketability
// already follow (engine/commercialProfile.ts; SIMULATION_PHILOSOPHY Principle 8).
// Later stages will schedule real payouts from this and pay backend deals out of
// it; this stage only computes and presents.
//
// Two layers, deliberately separated:
//  - MULTIPLIERS are attribute-only, so they are usable BEFORE release (there is
//    no box office yet) to power the pre-release qualitative outlook.
//  - The DOLLAR profile layers a reach base (from realised worldwide gross) on
//    top of the multipliers, for the post-theatrical waterfall/pipeline to come.
import type {
  AncillaryPayout,
  AncillaryWindow,
  AwardsCeremony,
  CashLedgerCategory,
  Film,
  Genre,
  ReleaseWindow,
  ScriptCharacter,
  TargetAudience,
} from '../types';
import { ANCILLARY_TIMING, GENRE_ANCILLARY, WINDOW_BASE_RATES, CATALOGUE, REACH_BASE } from '../data/ancillary';
import { deriveCommercialProfile } from './commercialProfile';
import { clamp } from './random';

// --- Tunable weights (rebalance here, not in the formulas) -----------------

const AWARDS = { winWeight: 0.25, nominationWeight: 0.05 } as const;

const LONGEVITY_WEIGHTS = {
  awards: 0.4,
  belovedAudience: 0.25, // share of how far audienceScore clears the "beloved" line (75)
  franchise: 0.15,
  genreBias: 0.1,
  holidayFamily: 0.1,
  cultBonus: 0.15, // additive, on top of the weighted sum
} as const;

const BELOVED_AUDIENCE_FLOOR = 75; // audienceScore above which a film reads as "beloved"
const CULT = { originalityFloor: 70, accessibilityCeiling: 45, audienceFloor: 65 } as const;

// Multiplier clamps - keep the mainstream windows in a believable band; merch is
// allowed to run much higher because a true franchise toy line dwarfs an adult
// drama's (near-zero) merch by design.
const MULT_CLAMP = { min: 0.25, max: 2.8 } as const;
const MERCH_CLAMP = { min: 0, max: 18 } as const;

// --- Inputs (plain data in) ------------------------------------------------

export interface AncillaryAwards {
  wins: number;
  nominations: number;
}

/** Everything the ancillary model reads - all attributes a film already carries, plus the two cross-entity facts (studio prestige, awards) the caller supplies so this module stays pure. */
export interface AncillaryAttributes {
  genre: Genre;
  targetAudience: TargetAudience;
  audienceScore: number; // 0-100
  criticScore: number; // 0-100
  accessibility: number; // 0-100, deriveCommercialProfile(script).accessibility
  franchiseRecognition: number; // 0-100 (0 = original)
  leadMerchandisePotential: number; // 0-100, mean over Lead characters
  originality: number; // 0-100
  studioPrestige: number; // 0-100
  releaseWindow: ReleaseWindow;
  awards: AncillaryAwards;
}

// --- Outputs ----------------------------------------------------------------

export interface AncillaryMultipliers {
  homeEntertainment: number;
  licensing: number;
  merchandising: number;
  /** 0-1: drives both the catalogue annual rate and how many years the tail survives. */
  longevity: number;
}

export interface AncillaryCatalogue {
  annualFirstYear: number;
  years: number;
  total: number;
}

export interface AncillaryProfile {
  /** Audience-engagement base every window scales off (gross + word-of-mouth lift). Internal, never shown. */
  reachBase: number;
  homeEntertainment: number;
  licensing: number;
  merchandising: number;
  catalogue: AncillaryCatalogue;
  /** Sum of every window incl. the whole catalogue tail. */
  lifetimeTotal: number;
  multipliers: AncillaryMultipliers;
}

export type AncillaryTier = 'negligible' | 'limited' | 'moderate' | 'strong' | 'exceptional';

export interface AncillaryOutlook {
  homeEntertainment: AncillaryTier;
  licensing: AncillaryTier;
  merchandising: AncillaryTier;
  catalogue: AncillaryTier;
  /** One-line player-facing prose - qualitative only, never a number (CLAUDE.md presentation rule). */
  headline: string;
}

// --- Derivations ------------------------------------------------------------

/** 0-1: how much awards success lifts licensing and catalogue longevity. A Best-Picture-and-Actor sweep is a large lift; a lone craft nod a small one. */
export function awardsLift(awards: AncillaryAwards): number {
  return clamp(awards.wins * AWARDS.winWeight + awards.nominations * AWARDS.nominationWeight, 0, 1);
}

function isFamilyOrTeen(audience: TargetAudience): boolean {
  return audience === 'Families' || audience === 'Teens';
}

/** 0-1: a Christmas (or, less so, Halloween) release aimed at families reads as a seasonal perennial. */
function holidayFamilyScore(releaseWindow: ReleaseWindow, audience: TargetAudience): number {
  const seasonal = releaseWindow === 'Christmas' ? 1 : releaseWindow === 'Halloween' ? 0.5 : 0;
  if (seasonal === 0) return 0;
  return seasonal * (audience === 'Families' ? 1 : 0.4);
}

/** 0-0.15: a bold, narrow-appeal film that a devoted audience adores earns a cult tail. */
function cultBonus(a: AncillaryAttributes): number {
  const cult =
    a.originality >= CULT.originalityFloor && a.accessibility < CULT.accessibilityCeiling && a.audienceScore >= CULT.audienceFloor;
  return cult ? LONGEVITY_WEIGHTS.cultBonus : 0;
}

/**
 * Attribute-only window multipliers - the heart of "genres feel different",
 * computed without any box-office figure so the pre-release outlook can use them.
 * Each factor reads a field that already exists; see the design doc §3.3/§3.5 for
 * the reasoning behind each term.
 */
export function deriveAncillaryMultipliers(a: AncillaryAttributes): AncillaryMultipliers {
  const aud = a.audienceScore / 100;
  const crit = a.criticScore / 100;
  const fr = a.franchiseRecognition / 100;
  const access = a.accessibility / 100;
  const merch = a.leadMerchandisePotential / 100;
  const prestige = a.studioPrestige / 100;
  const famTeen = isFamilyOrTeen(a.targetAudience) ? 1 : 0;
  const genre = GENRE_ANCILLARY[a.genre];
  const lift = awardsLift(a.awards);

  const homeEntertainment = clamp(
    genre.homeEnt * (0.4 + 1.0 * aud) * (0.9 + 0.4 * famTeen) * (0.9 + 0.35 * fr),
    MULT_CLAMP.min,
    MULT_CLAMP.max,
  );

  const licensing = clamp(
    (0.5 + 0.7 * access) *
      (0.55 + 0.8 * aud) *
      (0.85 + 0.3 * crit) *
      (0.9 + 0.3 * fr) *
      (1 + lift) *
      (0.95 + 0.1 * prestige),
    MULT_CLAMP.min,
    MULT_CLAMP.max,
  );

  const merchandising = clamp(
    genre.merch * (0.3 + 1.4 * merch) * (0.5 + 1.5 * fr) * (0.8 + 0.5 * famTeen),
    MERCH_CLAMP.min,
    MERCH_CLAMP.max,
  );

  const longevity = clamp(
    LONGEVITY_WEIGHTS.awards * lift +
      LONGEVITY_WEIGHTS.belovedAudience * clamp((aud - BELOVED_AUDIENCE_FLOOR / 100) / (1 - BELOVED_AUDIENCE_FLOOR / 100), 0, 1) +
      LONGEVITY_WEIGHTS.franchise * fr +
      LONGEVITY_WEIGHTS.genreBias * genre.catalogueBias +
      LONGEVITY_WEIGHTS.holidayFamily * holidayFamilyScore(a.releaseWindow, a.targetAudience) +
      cultBonus(a),
    0,
    1,
  );

  return { homeEntertainment, licensing, merchandising, longevity };
}

function catalogueFromLongevity(reachBase: number, longevity: number): AncillaryCatalogue {
  if (longevity < CATALOGUE.minLongevity) return { annualFirstYear: 0, years: 0, total: 0 };
  const years = Math.round(CATALOGUE.minYears + CATALOGUE.spanYears * longevity);
  const annualFirstYear = reachBase * WINDOW_BASE_RATES.catalogueAnnual * (0.5 + longevity);
  let total = 0;
  let annual = annualFirstYear;
  for (let n = 0; n < years; n++) {
    total += annual;
    annual *= CATALOGUE.decay;
  }
  return { annualFirstYear: Math.round(annualFirstYear), years, total: Math.round(total) };
}

/**
 * The full dollar profile - multipliers plus a reach base drawn from realised
 * worldwide gross. `worldwideGross` is FilmResults.totalBoxOffice; pass 0
 * pre-release to get a pure potential read (all dollar figures 0, multipliers
 * still meaningful). Derived on demand, never stored.
 */
export function deriveAncillaryProfile(a: AncillaryAttributes, worldwideGross: number): AncillaryProfile {
  const multipliers = deriveAncillaryMultipliers(a);
  const reachBase = Math.max(0, worldwideGross) * (REACH_BASE.floor + REACH_BASE.audienceLift * (a.audienceScore / 100));

  const homeEntertainment = Math.round(reachBase * WINDOW_BASE_RATES.homeEntertainment * multipliers.homeEntertainment);
  const licensing = Math.round(reachBase * WINDOW_BASE_RATES.licensing * multipliers.licensing);
  const merchandising = Math.round(reachBase * WINDOW_BASE_RATES.merchandising * multipliers.merchandising);
  const catalogue = catalogueFromLongevity(reachBase, multipliers.longevity);

  return {
    reachBase,
    homeEntertainment,
    licensing,
    merchandising,
    catalogue,
    lifetimeTotal: homeEntertainment + licensing + merchandising + catalogue.total,
    multipliers,
  };
}

// --- Qualitative presentation (from multipliers, so usable pre-release) ------

function tier(value: number, bands: [number, number, number, number]): AncillaryTier {
  if (value < bands[0]) return 'negligible';
  if (value < bands[1]) return 'limited';
  if (value < bands[2]) return 'moderate';
  if (value < bands[3]) return 'strong';
  return 'exceptional';
}

const TIER_ADJECTIVE: Record<AncillaryTier, string> = {
  negligible: 'negligible',
  limited: 'limited',
  moderate: 'moderate',
  strong: 'strong',
  exceptional: 'exceptional',
};

const WINDOW_LABEL: Record<'homeEntertainment' | 'licensing' | 'merchandising' | 'catalogue', string> = {
  homeEntertainment: 'home-video',
  licensing: 'TV & streaming',
  merchandising: 'merchandising',
  catalogue: 'catalogue',
};

/**
 * Player-facing outlook derived from the attribute-only multipliers - readable
 * before release, and free of raw numbers per the presentation rule. The
 * headline names the film's strongest one or two revenue windows in prose.
 */
export function ancillaryOutlook(m: AncillaryMultipliers): AncillaryOutlook {
  const homeEntertainment = tier(m.homeEntertainment, [0.5, 0.9, 1.3, 1.8]);
  const licensing = tier(m.licensing, [0.5, 0.9, 1.3, 1.8]);
  const merchandising = tier(m.merchandising, [0.3, 1, 2.5, 5]);
  const catalogue = tier(m.longevity, [0.25, 0.45, 0.65, 0.85]);

  const windows = [
    { key: 'merchandising' as const, tier: merchandising, rank: rankOf(merchandising) },
    { key: 'homeEntertainment' as const, tier: homeEntertainment, rank: rankOf(homeEntertainment) },
    { key: 'licensing' as const, tier: licensing, rank: rankOf(licensing) },
    { key: 'catalogue' as const, tier: catalogue, rank: rankOf(catalogue) },
  ];
  const strong = windows.filter((w) => w.rank >= 3).sort((a, b) => b.rank - a.rank);

  let headline: string;
  if (strong.length === 0) {
    headline = 'Little post-theatrical potential — this film lives or dies in cinemas.';
  } else {
    const named = strong.slice(0, 2).map((w) => `${TIER_ADJECTIVE[w.tier]} ${WINDOW_LABEL[w.key]}`);
    headline = `${capitalise(named.join(' and '))} potential.`;
  }

  return { homeEntertainment, licensing, merchandising, catalogue, headline };
}

function rankOf(t: AncillaryTier): number {
  return { negligible: 0, limited: 1, moderate: 2, strong: 3, exceptional: 4 }[t];
}

function capitalise(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

// --- Assembling inputs from live entities (still pure) ----------------------

/** Mean merchandise potential across a script's Lead characters (0-100), falling back to the whole cast, then 0 - never a fabricated neutral value. */
export function leadMerchandisePotential(cast: ScriptCharacter[]): number {
  const leads = cast.filter((c) => c.prominence === 'Lead');
  const pool = leads.length > 0 ? leads : cast;
  if (pool.length === 0) return 0;
  return pool.reduce((sum, c) => sum + c.traits.merchandisePotential, 0) / pool.length;
}

/** Count a film's award wins and nominations across all recorded ceremonies (AwardsState.history), matched by filmId. */
export function summariseFilmAwards(history: AwardsCeremony[], filmId: string): AncillaryAwards {
  let wins = 0;
  let nominations = 0;
  for (const ceremony of history) {
    for (const noms of Object.values(ceremony.categories)) {
      if (!noms) continue;
      for (const nom of noms) {
        if (nom.filmId !== filmId) continue;
        nominations++;
        if (nom.won) wins++;
      }
    }
  }
  return { wins, nominations };
}

/**
 * Assemble AncillaryAttributes from a released Film plus the two cross-entity
 * facts it can't carry itself (the studio's current prestige, and its awards
 * record from world state). Keeps deriveAncillaryProfile a pure attribute read.
 */
export function ancillaryAttributesFromFilm(
  film: Film,
  ctx: { studioPrestige: number; awards: AncillaryAwards },
): AncillaryAttributes {
  const { accessibility } = deriveCommercialProfile(film.script);
  return {
    genre: film.genre,
    targetAudience: film.targetAudience,
    audienceScore: film.results.audienceScore,
    criticScore: film.results.criticScore,
    accessibility,
    franchiseRecognition: film.script.franchiseRecognition ?? 0,
    leadMerchandisePotential: leadMerchandisePotential(film.script.cast),
    originality: film.script.originality,
    studioPrestige: ctx.studioPrestige,
    releaseWindow: film.marketingChoices.releaseWindow,
    awards: ctx.awards,
  };
}

// --- Scheduling: materialise a profile into dated future payouts (Stage 2) ---
//
// The dollar profile above is derived; these payouts are the recorded FACTS it
// is materialised into once, when a film's theatrical run finishes, so income
// arrives over game time and the schedule never drifts if the formula changes.

/** Which cash-ledger category each window's income is booked under. */
export const ANCILLARY_LEDGER_CATEGORY: Record<AncillaryWindow, CashLedgerCategory> = {
  homeEntertainment: 'homeEntertainment',
  licensing: 'licensing',
  merchandising: 'merchandising',
  catalogue: 'catalogue',
};

/** Player-facing label for each window, used in the cash-ledger reason line. */
export const ANCILLARY_LEDGER_LABEL: Record<AncillaryWindow, string> = {
  homeEntertainment: 'Home entertainment',
  licensing: 'TV & streaming licensing',
  merchandising: 'Merchandising',
  catalogue: 'Catalogue',
};

function spreadWindow(
  window: AncillaryWindow,
  total: number,
  installments: ReadonlyArray<{ dayOffset: number; fraction: number }>,
  filmId: string,
  filmTitle: string,
  anchorDay: number,
): AncillaryPayout[] {
  return installments
    .map((i) => ({ filmId, filmTitle, window, dueDay: anchorDay + i.dayOffset, amount: Math.round(total * i.fraction) }))
    .filter((p) => p.amount > 0);
}

/**
 * Turn a film's dollar AncillaryProfile into its dated payout schedule, anchored
 * to the day its theatrical run finished. Each mainstream window is split into
 * its installments (data/ancillary.ts:ANCILLARY_TIMING); catalogue pays once a
 * year for its longevity span, each year decaying. Zero-value payments are
 * dropped, so a film with no catalogue tail simply schedules none.
 */
export function buildAncillarySchedule(
  profile: AncillaryProfile,
  opts: { filmId: string; filmTitle: string; anchorDay: number },
): AncillaryPayout[] {
  const { filmId, filmTitle, anchorDay } = opts;
  const payouts: AncillaryPayout[] = [
    ...spreadWindow('merchandising', profile.merchandising, ANCILLARY_TIMING.merchandising, filmId, filmTitle, anchorDay),
    ...spreadWindow('homeEntertainment', profile.homeEntertainment, ANCILLARY_TIMING.homeEntertainment, filmId, filmTitle, anchorDay),
    ...spreadWindow('licensing', profile.licensing, ANCILLARY_TIMING.licensing, filmId, filmTitle, anchorDay),
  ];

  let annual = profile.catalogue.annualFirstYear;
  for (let n = 0; n < profile.catalogue.years; n++) {
    const amount = Math.round(annual);
    if (amount > 0) {
      payouts.push({
        filmId,
        filmTitle,
        window: 'catalogue',
        dueDay: anchorDay + ANCILLARY_TIMING.catalogueFirstYearOffset + n * ANCILLARY_TIMING.catalogueYearLength,
        amount,
      });
    }
    annual *= CATALOGUE.decay;
  }

  return payouts;
}
