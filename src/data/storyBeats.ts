// Phrase banks for the Results screen's "Studio Report" - a narrated
// summary sitting above the critic-quote-style blurbs in data/reviewBlurbs.ts,
// read in an omniscient trade-press voice rather than an in-world quote.
// Each beat is picked *conditionally* on what actually happened (not
// randomly) - see engine/storyReport.ts - so this is closer to a sports
// commentary generator than a random flavor-text table.

import type { Department } from './reviewBlurbs';

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
      '{title} slipped in and out of theaters with barely a ripple.',
      '{title} never got off the ground, and poor word of mouth sealed it.',
    ],
    mixed: [
      '{title} opened quietly and stayed that way through its run.',
      '{title} came and went without much fanfare either way.',
      '{title} did quiet, unremarkable business from start to finish.',
      '{title} played out its run to polite, half-full houses.',
    ],
    beloved: [
      '{title} opened modestly, but strong word of mouth turned it into a real sleeper hit.',
      "{title} started small - but everyone who saw it couldn't stop talking about it, and it built from there.",
      '{title} was the quiet surprise of the season, growing steadily on pure word of mouth.',
      '{title} snuck out with little fanfare and became a genuine word-of-mouth darling.',
    ],
  },
  modest: {
    panned: [
      '{title} had a respectable opening weekend, but word got around fast and audiences turned on it.',
      '{title} opened decently, then watched its audience evaporate once the reviews landed.',
      '{title} started fine, but the bad word travelled faster than the good.',
      '{title} had a passable debut that curdled the moment audiences weighed in.',
    ],
    mixed: [
      '{title} held reasonably steady through its run - a dependable, if unspectacular, performer.',
      '{title} did solid business without ever really catching fire.',
      '{title} turned in a steady, middle-of-the-road run.',
      '{title} was a dependable earner that never quite broke out.',
    ],
    beloved: [
      '{title} built real momentum as word of mouth spread, growing well beyond its opening weekend.',
      '{title} kept finding its audience week after week.',
      '{title} opened solidly and only got stronger as the good word spread.',
      '{title} turned a decent start into a genuine hit on the strength of its reception.',
    ],
  },
  big: {
    panned: [
      '{title} opened huge on hype alone, then collapsed once audiences caught up with what critics already knew.',
      '{title} had a massive opening weekend that evaporated almost as fast as it arrived.',
      '{title} front-loaded everything into opening night and cratered the week after.',
      '{title} drew a huge crowd on hype, then emptied out just as fast.',
    ],
    mixed: [
      '{title} opened big and held on reasonably well through its run.',
      '{title} had a strong debut and settled into a steady, respectable run.',
      '{title} launched big and cooled to a dependable, if unspectacular, hold.',
      '{title} came out swinging and kept a respectable pace through its run.',
    ],
    beloved: [
      '{title} was a hit from the opening bell and only grew from there.',
      "{title} opened huge and just kept climbing - the rare film that lives up to its own hype.",
      '{title} delivered on every bit of its hype and then some.',
      '{title} was an event from day one and never let up.',
    ],
  },
};

// A second, optional beat naming the department that reviewers kept coming back
// to - the omniscient trade-press mirror of the in-quote department callouts in
// data/reviewBlurbs.ts. Added only when one department clearly stands apart
// (engine/storyReport.ts), so the studio report teaches the same lesson the
// reviews do: strong or weak, the pattern has a name.
export const DEPARTMENT_HIGHLIGHTS: Record<Department, Record<'praise' | 'criticism', string[]>> = {
  script: {
    praise: ['Critics singled out the screenplay above all else.', 'The writing drew the film’s strongest notices.'],
    criticism: ['Reviewers kept returning to the thinness of the script.', 'The screenplay took the brunt of the criticism.'],
  },
  direction: {
    praise: ['The assured direction drew particular praise.', 'Reviewers kept crediting the confident direction.'],
    criticism: ['The direction took most of the blame for the film’s problems.', 'Uneven direction was the note that kept coming up.'],
  },
  acting: {
    praise: ['The performances earned the film its warmest notices.', 'The cast drew the lion’s share of the praise.'],
    criticism: ['The performances came in for repeated criticism.', 'The casting was widely questioned.'],
  },
  production: {
    praise: ['Its production values were widely admired.', 'The look of the film drew real admiration.'],
    criticism: ['Its budget-conscious look drew unfavourable notice.', 'The effects work was a recurring complaint.'],
  },
  postProduction: {
    praise: ['The sharp editing and score won quiet praise.', 'The film’s polish in the edit was widely noted.'],
    criticism: ['A ragged edit was the note that kept coming up.', 'The choppy pacing drew repeated criticism.'],
  },
};

// A closing beat for when the two audiences clearly disagreed - the studio-report
// version of the "Reaction" card's divergence line.
export const DIVERGENCE_BEATS: Record<'audienceAhead' | 'criticAhead', string[]> = {
  audienceAhead: [
    'Audiences took to it far more warmly than the critics did.',
    'The reviews ran cool, but ticket-buyers didn’t seem to mind.',
  ],
  criticAhead: [
    'Critics rated it well above the general public.',
    'A critics’ favourite that the wider crowd met with a shrug.',
  ],
};
