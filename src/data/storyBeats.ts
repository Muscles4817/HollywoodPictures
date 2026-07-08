// Phrase banks for the Results screen's "Studio Report" - a narrated
// summary sitting above the critic-quote-style blurbs in data/reviewBlurbs.ts,
// read in an omniscient trade-press voice rather than an in-world quote.
// Each beat is picked *conditionally* on what actually happened (not
// randomly) - see engine/storyReport.ts - so this is closer to a sports
// commentary generator than a random flavor-text table.

export type OpeningTier = 'quiet' | 'modest' | 'big';
export type ReceptionTier = 'panned' | 'mixed' | 'beloved';

/** How big a splash the opening made - driven by Buzz Score, not raw currency, since a Niche release maxing Buzz is still a "big" opening for what it is. */
export function openingTier(buzzScore: number): OpeningTier {
  if (buzzScore < 35) return 'quiet';
  if (buzzScore < 65) return 'modest';
  return 'big';
}

/** How the film actually landed once people saw it - audience-weighted, the same way legs are (see engine/boxOffice.ts:reviewLegsFactor). */
export function receptionTier(criticScore: number, audienceScore: number): ReceptionTier {
  const weighted = audienceScore * 0.65 + criticScore * 0.35;
  if (weighted < 40) return 'panned';
  if (weighted < 65) return 'mixed';
  return 'beloved';
}

// {title} is substituted with the film's title in engine/storyReport.ts.
export const TRAJECTORY_BEATS: Record<OpeningTier, Record<ReceptionTier, string[]>> = {
  quiet: {
    panned: [
      '{title} opened to nearly empty houses and never found an audience.',
      '{title} came and went almost unnoticed, and the reviews did nothing to change that.',
    ],
    mixed: [
      '{title} opened quietly and stayed that way through its run.',
      '{title} came and went without much fanfare either way.',
    ],
    beloved: [
      '{title} opened modestly, but strong word of mouth turned it into a real sleeper hit.',
      "{title} started small - but everyone who saw it couldn't stop talking about it, and it built from there.",
    ],
  },
  modest: {
    panned: [
      '{title} had a respectable opening weekend, but word got around fast and audiences turned on it.',
      '{title} opened decently, then watched its audience evaporate once the reviews landed.',
    ],
    mixed: [
      '{title} held reasonably steady through its run - a dependable, if unspectacular, performer.',
      '{title} did solid business without ever really catching fire.',
    ],
    beloved: [
      '{title} built real momentum as word of mouth spread, growing well beyond its opening weekend.',
      '{title} kept finding its audience week after week.',
    ],
  },
  big: {
    panned: [
      '{title} opened huge on hype alone, then collapsed once audiences caught up with what critics already knew.',
      '{title} had a massive opening weekend that evaporated almost as fast as it arrived.',
    ],
    mixed: [
      '{title} opened big and held on reasonably well through its run.',
      '{title} had a strong debut and settled into a steady, respectable run.',
    ],
    beloved: [
      '{title} was a hit from the opening bell and only grew from there.',
      "{title} opened huge and just kept climbing - the rare film that lives up to its own hype.",
    ],
  },
};
