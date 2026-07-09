import type { Tone, ToneProfile } from '../types';

export const TONES: Tone[] = ['action', 'comedy', 'romance', 'suspense', 'drama', 'spectacle'];

export const TONE_LABELS: Record<Tone, string> = {
  action: 'Action',
  comedy: 'Comedy',
  romance: 'Romance',
  suspense: 'Suspense',
  drama: 'Drama',
  spectacle: 'Spectacle',
};

/** A ToneProfile as a labeled breakdown list, the shape CompatibilityBadge expects - shared by anywhere a script or director's own tone profile is shown on its own (no talent to compare against yet). */
export function toneProfileBreakdown(toneProfile: ToneProfile): Array<{ label: string; value: number }> {
  return TONES.map((tone) => ({ label: TONE_LABELS[tone], value: toneProfile[tone] }));
}
