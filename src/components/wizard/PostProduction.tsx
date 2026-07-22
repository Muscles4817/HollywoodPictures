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
import type { EditStyle, FinalCutFocus, MusicFocus, PostProductionChoices } from '../../types';

const EDIT_STYLES = Object.keys(EDIT_STYLE_PROFILES) as EditStyle[];
const MUSIC_FOCUSES = Object.keys(MUSIC_FOCUS_PROFILES) as MusicFocus[];
const FINAL_CUT_FOCUSES = Object.keys(FINAL_CUT_FOCUS_PROFILES) as FinalCutFocus[];

const EDIT_STYLE_DESCRIPTIONS = pluckDescriptions(EDIT_STYLE_PROFILES);
const MUSIC_FOCUS_DESCRIPTIONS = pluckDescriptions(MUSIC_FOCUS_PROFILES);
const FINAL_CUT_FOCUS_DESCRIPTIONS = pluckDescriptions(FINAL_CUT_FOCUS_PROFILES);

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

  return (
    <div className="stack">
      <WizardHeader current="post-production" />
      <h1>Post-Production</h1>
      {draft.script && <ScriptSummaryCard script={draft.script} />}

      {draft.postProductionScreeningReadyDay !== null && !draft.testScreeningResolved && !pendingScreeningChoice && draft.postProductionEditingUntilDay === null && (
        <div className="card" style={{ borderColor: 'var(--primary)' }}>
          <div className="stat-label">Test Screening (preview)</div>
          <div className="stat-value">Ready around {formatGameDateWithMonth(draft.postProductionScreeningReadyDay)}</div>
          {draft.postProductionScreeningReadyDay > state.totalDays && (
            <div style={{ fontSize: '0.8em', fontWeight: 600, color: 'var(--text-muted)' }}>
              about {draft.postProductionScreeningReadyDay - state.totalDays} days out
            </div>
          )}
          <p style={{ margin: '6px 0 0', fontSize: '0.85em', color: 'var(--text-muted)' }}>
            A forecast based on this film's runtime, VFX ambition, and your Editor/VFX Supervisor's skill - once
            reached, a test screening will surface here (and in the Inbox/Dashboard if you've moved on) with real
            audience feedback and a decision on how to respond. You'll need to respond to it before the film can be
            scheduled for release.
          </p>
        </div>
      )}

      {draft.postProductionEditingUntilDay !== null && !pendingScreeningChoice && (
        <div className="card" style={{ borderColor: 'var(--primary)' }}>
          <div className="stat-label">Re-cut in progress</div>
          <div className="stat-value">Next screening around {formatGameDateWithMonth(draft.postProductionEditingUntilDay)}</div>
          {draft.postProductionEditingUntilDay > state.totalDays && (
            <div style={{ fontSize: '0.8em', fontWeight: 600, color: 'var(--text-muted)' }}>
              about {draft.postProductionEditingUntilDay - state.totalDays} days out
            </div>
          )}
          <p style={{ margin: '6px 0 0', fontSize: '0.85em', color: 'var(--text-muted)' }}>
            The editing bay is working on your notes. When the re-cut is done, a fresh test screening will surface
            here (and in the Inbox/Dashboard if you've moved on) with the new reactions and another decision.
          </p>
        </div>
      )}

      {draft.testScreeningResolved && draft.postProductionFinalReadyDay !== null && (
        <div className="card" style={{ borderColor: 'var(--primary)' }}>
          <div className="stat-label">Post-Production</div>
          <div className="stat-value">Wraps around {formatGameDateWithMonth(draft.postProductionFinalReadyDay)}</div>
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
