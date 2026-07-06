import { useState } from 'react';
import { useStudio } from '../../state/StudioContext';
import { EDIT_STYLE_PROFILES, MUSIC_FOCUS_PROFILES, TEST_SCREENING_PROFILES, FINAL_CUT_FOCUS_PROFILES } from '../../data/postProduction';
import { computeCommittedSpend } from '../../state/selectors';
import { ChoiceGroup } from '../common/ChoiceGroup';
import { Button } from '../common/Button';
import { Money } from '../common/Money';
import { WizardSteps } from '../common/WizardSteps';
import type { EditStyle, FinalCutFocus, MusicFocus, PostProductionChoices, TestScreeningResponse } from '../../types';

const EDIT_STYLES = Object.keys(EDIT_STYLE_PROFILES) as EditStyle[];
const MUSIC_FOCUSES = Object.keys(MUSIC_FOCUS_PROFILES) as MusicFocus[];
const TEST_SCREENING_RESPONSES = Object.keys(TEST_SCREENING_PROFILES) as TestScreeningResponse[];
const FINAL_CUT_FOCUSES = Object.keys(FINAL_CUT_FOCUS_PROFILES) as FinalCutFocus[];

const DEFAULT_CHOICES: PostProductionChoices = {
  editStyle: 'Balanced',
  musicFocus: 'Standard',
  testScreeningResponse: 'Minor Changes',
  finalCutFocus: 'Trailer-focused',
};

export function PostProduction() {
  const { state, dispatch } = useStudio();
  const draft = state.draft!;
  const [choices, setChoices] = useState<PostProductionChoices>(draft.postProductionChoices ?? DEFAULT_CHOICES);

  function update<K extends keyof PostProductionChoices>(key: K, value: PostProductionChoices[K]) {
    setChoices((prev) => ({ ...prev, [key]: value }));
  }

  const testScreeningCost = TEST_SCREENING_PROFILES[choices.testScreeningResponse].cost;
  const committedSoFar = computeCommittedSpend(draft); // includes prior stages, not this screen's test-screening cost yet
  const projectedCash = state.studio.cash - committedSoFar - testScreeningCost;

  function handleContinue() {
    dispatch({ type: 'SET_POST_PRODUCTION_CHOICES', choices });
    dispatch({ type: 'GO_TO_STEP', step: 'marketing' });
  }

  return (
    <div className="stack">
      <WizardSteps current="post-production" />
      <h1>Post-Production</h1>

      <div className="card stack">
        <ChoiceGroup label="Edit Style" options={EDIT_STYLES} value={choices.editStyle} onChange={(v) => update('editStyle', v)} hint="Artistic wins over critics; Commercial wins over audiences." />
        <ChoiceGroup label="Music Focus" options={MUSIC_FOCUSES} value={choices.musicFocus} onChange={(v) => update('musicFocus', v)} />
        <ChoiceGroup label="Test Screening Response" options={TEST_SCREENING_RESPONSES} value={choices.testScreeningResponse} onChange={(v) => update('testScreeningResponse', v)} hint="Acting on test screening feedback costs money but improves quality." />
        <ChoiceGroup label="Final Marketing Cut" options={FINAL_CUT_FOCUSES} value={choices.finalCutFocus} onChange={(v) => update('finalCutFocus', v)} />
      </div>

      <div className="card row-between">
        <div>
          <div className="stat-label">Test Screening Cost</div>
          <div className="stat-value"><Money amount={testScreeningCost} /></div>
        </div>
        <div>
          <div className="stat-label">Cash After This Film So Far</div>
          <div className="stat-value">
            <Money amount={projectedCash} signColor />
          </div>
        </div>
      </div>

      <div className="row-between">
        <Button onClick={() => dispatch({ type: 'GO_TO_STEP', step: 'production' })}>Back</Button>
        <Button variant="primary" onClick={handleContinue}>Continue to Marketing</Button>
      </div>
    </div>
  );
}
