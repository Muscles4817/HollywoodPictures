import { useEffect } from 'react';
import { useStudio } from '../../state/StudioContext';
import { EDIT_STYLE_PROFILES, MUSIC_FOCUS_PROFILES, TEST_SCREENING_PROFILES, FINAL_CUT_FOCUS_PROFILES } from '../../data/postProduction';
import { pluckDescriptions } from '../../data/describe';
import { ChoiceGroup } from '../common/ChoiceGroup';
import { Button } from '../common/Button';
import { Money } from '../common/Money';
import { WizardHeader } from '../common/WizardHeader';
import type { EditStyle, FinalCutFocus, MusicFocus, PostProductionChoices, TestScreeningResponse } from '../../types';

const EDIT_STYLES = Object.keys(EDIT_STYLE_PROFILES) as EditStyle[];
const MUSIC_FOCUSES = Object.keys(MUSIC_FOCUS_PROFILES) as MusicFocus[];
const TEST_SCREENING_RESPONSES = Object.keys(TEST_SCREENING_PROFILES) as TestScreeningResponse[];
const FINAL_CUT_FOCUSES = Object.keys(FINAL_CUT_FOCUS_PROFILES) as FinalCutFocus[];

const EDIT_STYLE_DESCRIPTIONS = pluckDescriptions(EDIT_STYLE_PROFILES);
const MUSIC_FOCUS_DESCRIPTIONS = pluckDescriptions(MUSIC_FOCUS_PROFILES);
const TEST_SCREENING_DESCRIPTIONS = pluckDescriptions(TEST_SCREENING_PROFILES);
const FINAL_CUT_FOCUS_DESCRIPTIONS = pluckDescriptions(FINAL_CUT_FOCUS_PROFILES);

const DEFAULT_CHOICES: PostProductionChoices = {
  editStyle: 'Balanced',
  musicFocus: 'Standard',
  testScreeningResponse: 'Minor Changes',
  finalCutFocus: 'Trailer-focused',
};

export function PostProduction() {
  const { state, dispatch } = useStudio();
  const draft = state.draft!;
  const choices = draft.postProductionChoices ?? DEFAULT_CHOICES;

  useEffect(() => {
    if (!draft.postProductionChoices) {
      dispatch({ type: 'SET_POST_PRODUCTION_CHOICES', choices: DEFAULT_CHOICES });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update<K extends keyof PostProductionChoices>(key: K, value: PostProductionChoices[K]) {
    dispatch({ type: 'SET_POST_PRODUCTION_CHOICES', choices: { ...choices, [key]: value } });
  }

  const testScreeningCost = TEST_SCREENING_PROFILES[choices.testScreeningResponse].cost;

  return (
    <div className="stack">
      <WizardHeader current="post-production" />
      <h1>Post-Production</h1>

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
        label="Test Screening Response"
        options={TEST_SCREENING_RESPONSES}
        value={choices.testScreeningResponse}
        onChange={(v) => update('testScreeningResponse', v)}
        hint="Acting on test screening feedback costs money but improves quality."
        descriptions={TEST_SCREENING_DESCRIPTIONS}
      />
      <ChoiceGroup
        label="Final Marketing Cut"
        options={FINAL_CUT_FOCUSES}
        value={choices.finalCutFocus}
        onChange={(v) => update('finalCutFocus', v)}
        descriptions={FINAL_CUT_FOCUS_DESCRIPTIONS}
      />

      <div className="card">
        <div className="stat-label">Test Screening Cost</div>
        <div className="stat-value"><Money amount={testScreeningCost} /></div>
      </div>

      <div className="row-between">
        <div className="row">
          <Button onClick={() => dispatch({ type: 'GO_TO_STEP', step: 'production' })}>Back</Button>
          <Button onClick={() => dispatch({ type: 'RETURN_TO_DASHBOARD' })}>Back to Dashboard</Button>
        </div>
        <Button variant="primary" onClick={() => dispatch({ type: 'GO_TO_STEP', step: 'marketing' })}>Continue to Marketing</Button>
      </div>
    </div>
  );
}
