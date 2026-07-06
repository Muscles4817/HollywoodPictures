import type { Talent, TalentRole } from '../types';

// Static hireable roster for the MVP. Every talent is always "available" -
// scheduling conflicts are a natural extension point later. Genre affinities
// are intentionally sparse; the scoring engine treats a missing genre as a
// neutral 50.
export const TALENT_POOL: Talent[] = [
  // --- Directors ---
  {
    id: 'dir-1', name: 'Marla Voss', role: 'Director',
    fame: 78, skill: 88, reliability: 70, ego: 82, salary: 4_500_000,
    genreAffinities: { Drama: 90, Thriller: 75, Romance: 60 },
  },
  {
    id: 'dir-2', name: 'Theo Bright', role: 'Director',
    fame: 55, skill: 70, reliability: 88, ego: 40, salary: 1_800_000,
    genreAffinities: { Comedy: 85, Romance: 70 },
  },
  {
    id: 'dir-3', name: 'Priya Anand', role: 'Director',
    fame: 62, skill: 80, reliability: 75, ego: 55, salary: 2_600_000,
    genreAffinities: { 'Sci-Fi': 88, Action: 72, Fantasy: 80 },
  },
  {
    id: 'dir-4', name: 'Duke Callahan', role: 'Director',
    fame: 40, skill: 60, reliability: 60, ego: 65, salary: 700_000,
    genreAffinities: { Horror: 82, Thriller: 68 },
  },
  {
    id: 'dir-5', name: 'Elena Frost', role: 'Director',
    fame: 90, skill: 94, reliability: 65, ego: 95, salary: 9_000_000,
    genreAffinities: { Drama: 95, Thriller: 85, 'Sci-Fi': 70 },
  },

  // --- Lead Actors ---
  {
    id: 'lead-1', name: 'Jax Rivera', role: 'Lead Actor',
    fame: 92, skill: 75, reliability: 60, ego: 90, salary: 8_000_000,
    genreAffinities: { Action: 88, Thriller: 70 },
  },
  {
    id: 'lead-2', name: 'Sasha Wren', role: 'Lead Actor',
    fame: 85, skill: 88, reliability: 80, ego: 60, salary: 6_500_000,
    genreAffinities: { Drama: 90, Romance: 82 },
  },
  {
    id: 'lead-3', name: 'Cole Bennett', role: 'Lead Actor',
    fame: 60, skill: 72, reliability: 90, ego: 35, salary: 2_200_000,
    genreAffinities: { Comedy: 80, Drama: 55 },
  },
  {
    id: 'lead-4', name: 'Nadia Okafor', role: 'Lead Actor',
    fame: 70, skill: 85, reliability: 75, ego: 55, salary: 3_800_000,
    genreAffinities: { 'Sci-Fi': 78, Fantasy: 80, Action: 60 },
  },
  {
    id: 'lead-5', name: 'Ronan Pierce', role: 'Lead Actor',
    fame: 45, skill: 65, reliability: 85, ego: 30, salary: 800_000,
    genreAffinities: { Horror: 75, Thriller: 68 },
  },

  // --- Supporting Actors ---
  {
    id: 'sup-1', name: 'Fiona Marsh', role: 'Supporting Actor',
    fame: 50, skill: 78, reliability: 85, ego: 40, salary: 900_000,
    genreAffinities: { Drama: 82, Romance: 70 },
  },
  {
    id: 'sup-2', name: 'Benji Kaur', role: 'Supporting Actor',
    fame: 35, skill: 68, reliability: 90, ego: 25, salary: 350_000,
    genreAffinities: { Comedy: 85 },
  },
  {
    id: 'sup-3', name: 'Otis Grant', role: 'Supporting Actor',
    fame: 55, skill: 60, reliability: 60, ego: 70, salary: 1_200_000,
    genreAffinities: { Action: 72, Thriller: 65 },
  },
  {
    id: 'sup-4', name: 'Ivy Chen', role: 'Supporting Actor',
    fame: 40, skill: 75, reliability: 80, ego: 45, salary: 700_000,
    genreAffinities: { Horror: 70, 'Sci-Fi': 65 },
  },
  {
    id: 'sup-5', name: 'Marcus Doyle', role: 'Supporting Actor',
    fame: 65, skill: 70, reliability: 70, ego: 55, salary: 1_500_000,
    genreAffinities: { Fantasy: 75, Drama: 55 },
  },

  // --- Writers / Script Doctors ---
  {
    id: 'wri-1', name: 'Harriet Solano', role: 'Writer',
    fame: 45, skill: 90, reliability: 82, ego: 50, salary: 900_000,
    genreAffinities: { Drama: 92, Thriller: 78 },
  },
  {
    id: 'wri-2', name: 'Deshawn Miles', role: 'Writer',
    fame: 38, skill: 78, reliability: 75, ego: 40, salary: 550_000,
    genreAffinities: { Comedy: 88, Romance: 65 },
  },
  {
    id: 'wri-3', name: 'Yuki Tanaka', role: 'Writer',
    fame: 50, skill: 82, reliability: 70, ego: 60, salary: 1_000_000,
    genreAffinities: { 'Sci-Fi': 85, Fantasy: 80 },
  },
  {
    id: 'wri-4', name: 'Callum Ashe', role: 'Writer',
    fame: 30, skill: 65, reliability: 85, ego: 30, salary: 280_000,
    genreAffinities: { Horror: 78, Thriller: 60 },
  },

  // --- Composers ---
  {
    id: 'com-1', name: 'Selin Kaya', role: 'Composer',
    fame: 60, skill: 85, reliability: 80, ego: 45, salary: 700_000,
    genreAffinities: { Drama: 85, Romance: 80, Fantasy: 70 },
  },
  {
    id: 'com-2', name: 'Reggie Stone', role: 'Composer',
    fame: 40, skill: 70, reliability: 88, ego: 30, salary: 280_000,
    genreAffinities: { Comedy: 75, Action: 60 },
  },
  {
    id: 'com-3', name: 'Nova Blackwood', role: 'Composer',
    fame: 55, skill: 80, reliability: 65, ego: 65, salary: 600_000,
    genreAffinities: { Horror: 82, Thriller: 75, 'Sci-Fi': 70 },
  },
  {
    id: 'com-4', name: 'Adrian Voss', role: 'Composer',
    fame: 75, skill: 90, reliability: 70, ego: 70, salary: 1_500_000,
    genreAffinities: { Action: 85, 'Sci-Fi': 80, Fantasy: 78 },
  },

  // --- Editors ---
  {
    id: 'edi-1', name: 'Rosa Delgado', role: 'Editor',
    fame: 20, skill: 88, reliability: 90, ego: 30, salary: 400_000,
    genreAffinities: { Drama: 80, Thriller: 82 },
  },
  {
    id: 'edi-2', name: 'Kenji Osei', role: 'Editor',
    fame: 15, skill: 70, reliability: 85, ego: 25, salary: 180_000,
    genreAffinities: { Comedy: 78, Action: 65 },
  },
  {
    id: 'edi-3', name: 'Willa Frank', role: 'Editor',
    fame: 25, skill: 82, reliability: 75, ego: 40, salary: 500_000,
    genreAffinities: { Horror: 80, 'Sci-Fi': 70 },
  },
  {
    id: 'edi-4', name: 'Tomas Reyes', role: 'Editor',
    fame: 30, skill: 90, reliability: 80, ego: 50, salary: 650_000,
    genreAffinities: { Action: 85, Fantasy: 75 },
  },

  // --- VFX Supervisors (optional depending on genre) ---
  {
    id: 'vfx-1', name: 'Grace Lindqvist', role: 'VFX Supervisor',
    fame: 45, skill: 92, reliability: 78, ego: 55, salary: 2_200_000,
    genreAffinities: { 'Sci-Fi': 95, Fantasy: 90, Action: 85 },
  },
  {
    id: 'vfx-2', name: 'Hassan Farouk', role: 'VFX Supervisor',
    fame: 30, skill: 75, reliability: 85, ego: 35, salary: 900_000,
    genreAffinities: { Horror: 70, Thriller: 60 },
  },
  {
    id: 'vfx-3', name: 'Petra Novak', role: 'VFX Supervisor',
    fame: 60, skill: 88, reliability: 65, ego: 75, salary: 3_500_000,
    genreAffinities: { Action: 90, Fantasy: 88, 'Sci-Fi': 88 },
  },
];

export const TALENT_BY_ROLE = TALENT_POOL.reduce<Record<TalentRole, Talent[]>>(
  (acc, t) => {
    (acc[t.role] ??= []).push(t);
    return acc;
  },
  {} as Record<TalentRole, Talent[]>,
);
