import { useStudio } from '../../state/StudioContext';
import { deriveFocusedDraft } from '../../state/selectors';
import { deriveProjectReadiness, type SectionReadiness } from '../../engine/projectReadiness';
import { Button } from '../common/Button';
import type { ProjectWorkspaceSection } from '../../types';

const SECTION_LABELS: Record<ProjectWorkspaceSection, string> = {
  overview: 'Overview',
  'cast-and-crew': 'Cast & Crew',
  production: 'Production',
  finance: 'Finance',
};

// Maps engine/projectReadiness.ts's per-section status onto the small
// leading glyph shown next to each tab label - the same at-a-glance signal
// the old wizard's disabled-Continue-button gave one screen at a time, now
// visible for every section regardless of which one is showing.
const STATUS_GLYPH: Record<SectionReadiness['status'], string> = {
  complete: '✓',
  warning: '!',
  incomplete: '·',
};

/**
 * Free navigation between the pre-greenlight sections
 * (PRODUCER_WORKSPACE_DESIGN.md) - dispatches OPEN_PROJECT_WORKSPACE_SECTION,
 * which (unlike the old wizard's GO_TO_STEP) never advances the calendar.
 * Overview has no readiness section of its own (it's the summary/landing
 * page, not something to individually complete), so it never shows a glyph.
 */
export function ProjectWorkspaceNav({ active }: { active: ProjectWorkspaceSection }) {
  const { state, dispatch } = useStudio();
  const draft = deriveFocusedDraft(state);
  if (!draft) return null;

  const readiness = deriveProjectReadiness(draft, state.studio.cash);
  const statusFor = (section: ProjectWorkspaceSection): SectionReadiness['status'] | null => {
    if (section === 'overview') return null;
    if (section === 'cast-and-crew') return readiness.sections.castAndCrew.status;
    if (section === 'production') return readiness.sections.production.status;
    return readiness.sections.finance.status;
  };

  return (
    <div className="row" style={{ gap: 8 }}>
      {(Object.keys(SECTION_LABELS) as ProjectWorkspaceSection[]).map((section) => {
        const status = statusFor(section);
        return (
          <Button
            key={section}
            variant={active === section ? 'primary' : 'secondary'}
            onClick={() => dispatch({ type: 'OPEN_PROJECT_WORKSPACE_SECTION', section })}
          >
            {status && <span className={`workspace-nav-status workspace-nav-status-${status}`}>{STATUS_GLYPH[status]}</span>}
            {SECTION_LABELS[section]}
          </Button>
        );
      })}
    </div>
  );
}
