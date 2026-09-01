// Ancillary revenue at settlement time - the pure, calendar-driven glue between
// a film's derived AncillaryProfile (engine/ancillary.ts) and the studios' books.
// Extracted from studioReducer.ts so it can be unit-tested directly. Every
// function is pure: plain data in, new studio/rivals/films out.
//
// Four steps, run each ADVANCE_DAY pass from runCalendarSettlement:
//  - scheduleFinishedFilmAncillary  (Stage 2) materialise a player film's payouts
//    the pass its run finishes, once.
//  - accrueAncillaryAwardsPremium   (Stage 4) top up the awards-sensitive windows
//    when a film wins AFTER its schedule was fixed.
//  - drainAncillaryPipeline         (Stage 2) pay out anything now due, into cash
//    via the ledger.
//  - accrueRivalAncillary           (Stage 4) credit a rival film's whole afterlife
//    as a lump to its studio's books (rivals don't plan cash flow, so no pipeline).
import type { AncillaryPayout, AwardsCeremony, Film, RivalStudio, Studio } from '../types';
import {
  ANCILLARY_LEDGER_CATEGORY,
  ANCILLARY_LEDGER_LABEL,
  ancillaryAttributesFromFilm,
  buildAncillarySchedule,
  deriveAncillaryProfile,
  summariseFilmAwards,
  type AncillaryAwards,
} from '../engine/ancillary';
import { buildBackendLiabilities } from '../engine/backend';
import { studioShareOf } from '../engine/rivalStudios';
import { recordCashChange } from '../engine/cashLedger';
import { AWARDS_PREMIUM_TIMING } from '../data/ancillary';

const NO_AWARDS: AncillaryAwards = { wins: 0, nominations: 0 };

/** The backend deals stamped on a film's talent (engine/backend.ts) - present only where a star signed for points instead of full cash. */
function backendDealsFor(film: Film) {
  return (film.talent ?? []).map((t) => t.backendDeal).filter((d): d is NonNullable<typeof d> => d != null);
}

function isFinishedWithGross(film: Film): boolean {
  return film.boxOfficeRun.status === 'finished' && film.results.totalBoxOffice != null;
}

/**
 * Schedule the post-theatrical payouts of any player film whose run just
 * finished. Marks the run (ancillaryScheduled) so it happens exactly once, and
 * stamps the awards baked in (ancillaryAwards) so a later win can top up the
 * difference. Awards known now feed the profile; a win after this doesn't
 * retroactively rewrite these payouts - accrueAncillaryAwardsPremium handles that.
 */
export function scheduleFinishedFilmAncillary(
  studio: Studio,
  playerFilms: Film[],
  awardsHistory: AwardsCeremony[],
  day: number,
): { studio: Studio; films: Film[] } {
  let nextStudio = studio;
  const films = playerFilms.map((film) => {
    if (!isFinishedWithGross(film) || film.boxOfficeRun.ancillaryScheduled) return film;

    const awards = summariseFilmAwards(awardsHistory, film.id);
    const attrs = ancillaryAttributesFromFilm(film, { studioPrestige: studio.prestige, awards });
    const profile = deriveAncillaryProfile(attrs, film.results.totalBoxOffice!);
    const payouts = buildAncillarySchedule(profile, { filmId: film.id, filmTitle: film.title, anchorDay: day });
    if (payouts.length > 0) {
      nextStudio = { ...nextStudio, ancillaryPipeline: [...(nextStudio.ancillaryPipeline ?? []), ...payouts] };
    }

    // Backend participation (engine/backend.ts): a star's points/escalators are
    // materialised into dated liabilities the same moment - theatrical receipts
    // are known now, and the ancillary payouts just scheduled give the tail its
    // share rides on. Phased to arrive with that revenue, drained below.
    const deals = backendDealsFor(film);
    if (deals.length > 0) {
      const liabilities = buildBackendLiabilities({
        filmId: film.id,
        filmTitle: film.title,
        deals,
        theatricalStudioRevenue: film.results.studioRevenue ?? 0,
        worldwideGross: film.results.totalBoxOffice!,
        ancillaryPayouts: payouts.map((p) => ({ dueDay: p.dueDay, amount: p.amount })),
        finishDay: day,
      });
      if (liabilities.length > 0) {
        nextStudio = { ...nextStudio, backendLiabilities: [...(nextStudio.backendLiabilities ?? []), ...liabilities] };
      }
    }

    return { ...film, boxOfficeRun: { ...film.boxOfficeRun, ancillaryScheduled: true, ancillaryAwards: awards } };
  });
  return { studio: nextStudio, films };
}

/**
 * Retroactive awards premium (Stage 4). A film's ancillary is scheduled when its
 * run ends - usually before awards season. When the film later wins or is
 * nominated, the awards-sensitive windows (licensing carries a `1 + awardsLift`
 * factor; catalogue longevity a `0.40 * awardsLift` term) are worth more than was
 * scheduled. This pays the *incremental* value as follow-on payouts and re-stamps
 * the baked-in awards, so it applies each new accolade exactly once and never
 * double-counts. Prestige growth is deliberately held constant (both profiles use
 * the current prestige) so this isolates the awards effect alone.
 */
export function accrueAncillaryAwardsPremium(
  studio: Studio,
  playerFilms: Film[],
  awardsHistory: AwardsCeremony[],
  day: number,
): { studio: Studio; films: Film[] } {
  let nextStudio = studio;
  const films = playerFilms.map((film) => {
    if (!isFinishedWithGross(film) || !film.boxOfficeRun.ancillaryScheduled) return film;

    const nowAwards = summariseFilmAwards(awardsHistory, film.id);
    const bakedAwards = film.boxOfficeRun.ancillaryAwards ?? NO_AWARDS;
    if (nowAwards.wins === bakedAwards.wins && nowAwards.nominations === bakedAwards.nominations) return film;

    const gross = film.results.totalBoxOffice!;
    const profileFor = (awards: AncillaryAwards) =>
      deriveAncillaryProfile(ancillaryAttributesFromFilm(film, { studioPrestige: studio.prestige, awards }), gross);
    const now = profileFor(nowAwards);
    const baked = profileFor(bakedAwards);

    const topUps: AncillaryPayout[] = [];
    const deltaLicensing = Math.round(now.licensing - baked.licensing);
    const deltaCatalogue = Math.round(now.catalogue.total - baked.catalogue.total);
    if (deltaLicensing > 0) {
      topUps.push({ filmId: film.id, filmTitle: film.title, window: 'licensing', dueDay: day + AWARDS_PREMIUM_TIMING.licensingOffset, amount: deltaLicensing });
    }
    if (deltaCatalogue > 0) {
      topUps.push({ filmId: film.id, filmTitle: film.title, window: 'catalogue', dueDay: day + AWARDS_PREMIUM_TIMING.catalogueOffset, amount: deltaCatalogue });
    }
    if (topUps.length > 0) {
      nextStudio = { ...nextStudio, ancillaryPipeline: [...(nextStudio.ancillaryPipeline ?? []), ...topUps] };
    }
    // Re-stamp even when the delta rounded to zero, so we don't recompute this
    // same accolade every pass forever.
    return { ...film, boxOfficeRun: { ...film.boxOfficeRun, ancillaryAwards: nowAwards } };
  });
  return { studio: nextStudio, films };
}

/** Credit every ancillary payout now due into cash through the ledger, and drop it from the pipeline. */
export function drainAncillaryPipeline(studio: Studio, day: number): Studio {
  const pipeline = studio.ancillaryPipeline ?? [];
  const due = pipeline.filter((p) => p.dueDay <= day);
  if (due.length === 0) return studio;

  let next: Studio = { ...studio, ancillaryPipeline: pipeline.filter((p) => p.dueDay > day) };
  for (const payout of due) {
    next = recordCashChange(
      next,
      day,
      payout.amount,
      ANCILLARY_LEDGER_CATEGORY[payout.window],
      `${ANCILLARY_LEDGER_LABEL[payout.window]} — ${payout.filmTitle}`,
    );
  }
  return next;
}

/** Pay every backend liability now due out of cash through the ledger, and drop it from the list. The amounts are negative (money out to the participant). */
export function drainBackendLiabilities(studio: Studio, day: number): Studio {
  const liabilities = studio.backendLiabilities ?? [];
  const due = liabilities.filter((l) => l.dueDay <= day);
  if (due.length === 0) return studio;

  let next: Studio = { ...studio, backendLiabilities: liabilities.filter((l) => l.dueDay > day) };
  for (const liability of due) {
    next = recordCashChange(next, day, liability.amount, 'backend', `Backend participation — ${liability.personName}: ${liability.filmTitle}`);
  }
  return next;
}

/**
 * Rival ancillary (Stage 4). When a rival's film finishes its run, credit its
 * whole post-theatrical lifetime to that studio at once - rivals don't plan cash
 * flow, so a lump keeps their books simple while making their economics reflect
 * the full business, not just theatrical. Marks the run (reusing
 * ancillaryScheduled) so each rival film is credited exactly once. Awards known
 * at finish feed the profile; rival awards retroactivity is out of scope.
 */
export function accrueRivalAncillary(
  rivals: RivalStudio[],
  rivalFilms: Film[],
  awardsHistory: AwardsCeremony[],
): { rivals: RivalStudio[]; films: Film[] } {
  const creditByRival = new Map<string, number>();
  const films = rivalFilms.map((film) => {
    if (!isFinishedWithGross(film) || film.boxOfficeRun.ancillaryScheduled || film.releasedBy == null) return film;

    const rival = rivals.find((r) => r.name === film.releasedBy);
    const attrs = ancillaryAttributesFromFilm(film, {
      studioPrestige: rival?.prestige ?? 20,
      awards: summariseFilmAwards(awardsHistory, film.id),
    });
    const profile = deriveAncillaryProfile(attrs, film.results.totalBoxOffice!);
    // The co-financier's share comes off the afterlife too - §7.1's SPV takes its
    // percentage of the picture's "defined revenue", not of its theatrical
    // receipts alone (engine/rivalStudios.ts:CO_FINANCED_SHARE_BY_TIER).
    const credit = profile.lifetimeTotal * studioShareOf(rival ?? {});
    if (credit > 0) {
      creditByRival.set(film.releasedBy, (creditByRival.get(film.releasedBy) ?? 0) + credit);
    }
    return { ...film, boxOfficeRun: { ...film.boxOfficeRun, ancillaryScheduled: true } };
  });

  const nextRivals = rivals.map((rival) => {
    const credit = creditByRival.get(rival.name);
    if (!credit) return rival;
    return { ...rival, cash: rival.cash + credit, lifetimeRevenue: rival.lifetimeRevenue + credit };
  });
  return { rivals: nextRivals, films };
}
