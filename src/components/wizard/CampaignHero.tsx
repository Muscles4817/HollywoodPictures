import { GenrePoster } from '../common/GenrePoster';
import { formatGameDateWithMonth } from '../../engine/calendar';
import type { FilmDraft } from '../../types';

/**
 * The campaign's SPECTACLE band (docs/ART_DIRECTION.md §2.2, §6 — "the
 * campaign is the poster").
 *
 * Everything below it on this screen is decisions: spend, channels,
 * distributor, release type. Those are a surface the player reads figures off
 * and they stay in the desk register. What is genuinely the event here is the
 * picture itself - the thing being sold - so the band is the one-sheet, and
 * the desk resumes underneath it.
 *
 * Its one neon is magenta, the marquee secondary. It carries no controls on
 * purpose: a hero that also asks for a decision is a decision surface.
 *
 * The title is the screen's `h1`: this band replaced the plain "Marketing &
 * Release" heading, and a page with no h1 is a page with no name.
 */
export function CampaignHero({ draft, studioName }: { draft: FilmDraft; studioName: string }) {
  const title = draft.title || draft.script?.title || 'Untitled Film';
  const genre = draft.genre ?? 'Drama';

  return (
    <section className="spectacle campaign-hero" aria-label="The campaign">
      <div className="spectacle-wrap campaign-hero__wrap">
        <GenrePoster title={title} genre={genre} studio={studioName} size="large" />
        <div className="campaign-hero__billing">
          <p className="spectacle-eyebrow campaign-hero__eyebrow">Now selling</p>
          <h1 className="spectacle-title campaign-hero__title">{title}</h1>
          <p className="spectacle-sub campaign-hero__sub">
            {genre}
            {draft.announcedReleaseDay !== undefined
              ? ` · Opens ${formatGameDateWithMonth(draft.announcedReleaseDay)}`
              : ' · No date announced'}
          </p>
        </div>
      </div>
    </section>
  );
}
