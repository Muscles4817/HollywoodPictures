import type { NormalizedScalar, Setting } from '../types';

// When and where the story takes place - independent of genre and story
// type (a Historical War film and a Historical Romance both need period
// costuming; a Sci-Fi Heist and a Space Heist both need very different
// production requirements from a Modern one). Read by
// engine/scriptGenerator.ts to bias ProductionRequirements and Environment
// Strategy.
export interface SettingProfile {
  description: string;
  periodSetting: boolean; // costume/production design has to recreate a real historical era
  vfxBias: NormalizedScalar; // added on top of story-type/scale vfx intensity
  practicalBias: NormalizedScalar; // added on top of story-type/scale practical-effects intensity
  vehiclesLikely: number; // added to story type's own vehiclesLikely probability
  digitalEnvironmentBias: NormalizedScalar; // pushes Environment Strategy toward 'digital'
}

export const SETTINGS: Setting[] = ['Modern', 'Historical', 'Fantasy', 'SciFi', 'Space'];

export const SETTING_PROFILES: Record<Setting, SettingProfile> = {
  Modern: {
    description: 'The present day.',
    periodSetting: false, vfxBias: 0, practicalBias: 0.05, vehiclesLikely: 0, digitalEnvironmentBias: 0,
  },
  Historical: {
    description: 'A recreated past era - real production design and costuming stand in for VFX.',
    periodSetting: true, vfxBias: 0.05, practicalBias: 0.25, vehiclesLikely: 0.1, digitalEnvironmentBias: 0,
  },
  Fantasy: {
    description: 'An invented, magical world - built largely through visual effects and world-building.',
    periodSetting: false, vfxBias: 0.35, practicalBias: 0.15, vehiclesLikely: 0, digitalEnvironmentBias: 0.3,
  },
  SciFi: {
    description: 'A speculative near- or far-future - heavier on visual effects than a contemporary setting.',
    periodSetting: false, vfxBias: 0.4, practicalBias: 0.1, vehiclesLikely: 0.1, digitalEnvironmentBias: 0.35,
  },
  Space: {
    description: 'Set beyond Earth entirely - the most visual-effects-dependent setting there is.',
    periodSetting: false, vfxBias: 0.5, practicalBias: 0.05, vehiclesLikely: 0.2, digitalEnvironmentBias: 0.45,
  },
};
