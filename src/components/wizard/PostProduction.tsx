import { useEffect } from 'react';
import { useStudio } from '../../state/StudioContext';
import { EDIT_STYLE_PROFILES, MUSIC_FOCUS_PROFILES, FINAL_CUT_FOCUS_PROFILES, DEFAULT_POST_PRODUCTION_CHOICES } from '../../data/postProduction';
import { pluckDescriptions } from '../../data/describe';
import { ChoiceGroup } from '../common/ChoiceGroup';
import { Button } from '../common/Button';
import { WizardHeader } from '../common/WizardHeader';
import { ScriptSummaryCard } from '../common/ScriptSummaryCard';
import { OnSetDecisionCard } from '../common/OnSetDecisionCard';
import { deriveFocusedDraft } from '../../state/selectors';
import { formatGameDateWithMonth } from '../../engine/calendar';
import { derivePostProductionStatus, describePostProductionWait, type PostProductionStatus } from '../../engine/postProductionStatus';
import type { EditStyle, FinalCutFocus, MusicFocus, PostProductionChoices } from '../../types';

const EDIT_STYLES = Object.keys(EDIT_STYLE_PROFILES) as EditStyle[];
const MUSIC_FOCUSES = Object.keys(MUSIC_FOCUS_PROFILES) as MusicFocus[];
const FINAL_CUT_FOCUSES = Object.keys(FINAL_CUT_FOCUS_PROFILES) as FinalCutFocus[];

const EDIT_STYLE_DESCRIPTIONS = pluckDescriptions(EDIT_STYLE_PROFILES);
const MUSIC_FOCUS_DESCRIPTIONS = pluckDescriptions(MUSIC_FOCUS_PROFILES);
const FINAL_CUT_FOCUS_DESCRIPTIONS = pluckDescriptions(FINAL_CUT_FOCUS_PROFILES);

/**
 * The live "edit bay" status for a film whose cut is still being assembled - the
 * initial edit or a recut heading to its next test screening. Unlike the old
 * bounce-to-Dashboard card, this is a real progress read: a bar that fills
 * toward the screening as days pass. Time genuinely advances while this screen
 * is open (App.tsx:computeTicking lets the shared clock tick through an active
 * editing window), so the bar moves on its own here the same way Principal
 * Photography's does - the player can watch it, or step back to the Dashboard
 * and keep running the studio while it finishes.
 */
function EditBayPanel({ status, onLeave }: { status: Extract<PostProductionStatus, { phase: 'editing' | 'recutting' }>; onLeave: () => void }) {
  const { progress } = status;
  const pct = Math.round(progress.fraction * 100);
  const recut = status.phase === 'recutting';
  return (
    <div className={`edit-bay card edit-bay--${status.phase}`}>
      <div className="edit-bay__head">
        <span className="edit-bay__eyebrow">🎬 {recut ? 'Re-cut in progress' : 'In the edit'}</span>
        <span className="edit-bay__countdown">{describePostProductionWait(status)}</span>
      </div>
      <div className="edit-bay__bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Editing progress">
        <span style={{ width: `${pct}%` }} />
      </div>
      <div className="edit-bay__meta">
        Day {progress.daysElapsed} of ~{progress.daysTotal} · the calendar is running while the {recut ? 're-cut' : 'cut'} comes together
      </div>
      <p className="edit-bay__note">
        When the {recut ? 're-cut' : 'cut'} is ready, a test screening surfaces here and in your Inbox with real
        audience reactions and your next decision. No need to wait on this screen - step back to the Dashboard and
        keep running the studio; it'll finish either way, and you'll be notified the moment it's in.
      </p>
      <p className="edit-bay__forecast">
        Timing is a forecast from this film's runtime, VFX ambition, and your Editor / VFX Supervisor's skill.
      </p>
      <div className="row" style={{ marginTop: '10px' }}>
        <Button variant="secondary" onClick={onLeave}>Back to the Dashboard</Button>
      </div>
    </div>
  );
}

export function PostProduction() {
  const { state, dispatch } = useStudio();
  const draft = deriveFocusedDraft(state)!;
  const choices = draft.postProductionChoices ?? DEFAULT_POST_PRODUCTION_CHOICES;

  useEffect(() => {
    if (!draft.postProductionChoices) {
      dispatch({ type: 'SET_POST_PRODUCTION_CHOICES', choices: DEFAULT_POST_PRODUCTION_CHOICES });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update<K extends keyof PostProductionChoices>(key: K, value: PostProductionChoices[K]) {
    dispatch({ type: 'SET_POST_PRODUCTION_CHOICES', choices: { ...choices, [key]: value } });
  }

  const pendingScreeningChoice = draft.testScreeningPendingChoice;
  const status = derivePostProductionStatus(draft, state.totalDays);

  return (
    <div className="stack">
      <WizardHeader current="post-production" />
      <h1>Post-Production</h1>
      {draft.script && <ScriptSummaryCard script={draft.script} />}

      {!pendingScreeningChoice && (status.phase === 'editing' || status.phase === 'recutting') && (
        <EditBayPanel status={status} onLeave={() => dispatch({ type: 'RETURN_TO_DASHBOARD' })} />
      )}

      {status.phase === 'complete' && (
        <div className="edit-bay edit-bay--complete card">
          <div className="edit-bay__head">
            <span className="edit-bay__eyebrow">✓ Post-production complete</span>
            {status.finalReadyDay !== null && (
              <span className="edit-bay__countdown">Final cut locked {formatGameDateWithMonth(status.finalReadyDay)}</span>
            )}
          </div>
          <div className="edit-bay__bar" aria-hidden="true"><span style={{ width: '100%' }} /></div>
          <p className="edit-bay__note">
            The screening's been answered and every editing round has played out - there's nothing left to wait on
            here. The film is ready to take to market whenever you are: continue to Marketing below, or head back to
            the Dashboard and pick it up later.
          </p>
          <div className="row" style={{ marginTop: '10px' }}>
            <Button onClick={() => dispatch({ type: 'RETURN_TO_DASHBOARD' })}>Back to the Dashboard</Button>
          </div>
        </div>
      )}

      {pendingScreeningChoice && (
        <OnSetDecisionCard
          pendingChoice={pendingScreeningChoice}
          talent={draft.talent.map((a) => a.person)}
          talentPool={state.talentPool}
          script={draft.script}
          totalDays={state.totalDays}
          pausedMessage="Marketing can't begin until you respond to the test screening."
          showChoiceCosts
          onChoose={(choiceId) => dispatch({ type: 'RESOLVE_TEST_SCREENING_CHOICE', choiceId, productionId: draft.id })}
        />
      )}

      <ChoiceGroup
        label="Edit Style"
        options={EDIT_STYLES}
        value={choices.editStyle}
        onChange={(v) => update('editStyle', v)}
        hint="Artistic wins over critics; Commercial wins over audiences."
        descriptions={EDIT_STYLE_DESCRIPTIONS}
      />
      <ChoiceGroup
        label="Music Focus"
        options={MUSIC_FOCUSES}
        value={choices.musicFocus}
        onChange={(v) => update('musicFocus', v)}
        descriptions={MUSIC_FOCUS_DESCRIPTIONS}
      />
      <ChoiceGroup
        label="Final Marketing Cut"
        options={FINAL_CUT_FOCUSES}
        value={choices.finalCutFocus}
        onChange={(v) => update('finalCutFocus', v)}
        descriptions={FINAL_CUT_FOCUS_DESCRIPTIONS}
      />

      <div className="row-between">
        <Button onClick={() => dispatch({ type: 'GO_TO_STEP', step: 'production' })}>Back</Button>
        <Button
          variant="primary"
          disabled={!!pendingScreeningChoice}
          onClick={() => dispatch({ type: 'GO_TO_STEP', step: 'marketing' })}
        >
          Continue to Marketing
        </Button>
      </div>
    </div>
  );
}
