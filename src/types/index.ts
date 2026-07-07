// Core domain types for the studio management game.
// Kept in one file for MVP; split by domain (film.ts, talent.ts, ...) if it grows.

export type Genre =
  | 'Action'
  | 'Comedy'
  | 'Drama'
  | 'Horror'
  | 'Romance'
  | 'Sci-Fi'
  | 'Fantasy'
  | 'Thriller';

export type TargetAudience =
  | 'Mass Market'
  | 'Critics'
  | 'Teens'
  | 'Families'
  | 'Adults'
  | 'Niche';

export type TalentRole =
  | 'Director'
  | 'Lead Actor'
  | 'Supporting Actor'
  | 'Writer'
  | 'Composer'
  | 'Editor'
  | 'VFX Supervisor';

export interface Talent {
  id: string;
  name: string;
  role: TalentRole;
  fame: number; // 1-100
  skill: number; // 1-100
  reliability: number; // 1-100
  ego: number; // 1-100
  salary: number;
  genreAffinities: Partial<Record<Genre, number>>; // 1-100 per genre, missing = neutral (50)
}

export interface Script {
  id: string;
  title: string;
  genre: Genre;
  genreFit: number; // 1-100, how well the script suits the chosen genre
  originality: number; // 1-100
  structure: number; // 1-100
  dialogue: number; // 1-100
  marketability: number; // 1-100
  complexity: number; // 1-100, drives production difficulty/risk
  cost: number;
}

// Every production dial is continuous rather than a fixed tier: the four
// spend dials are plain currency amounts (interpreted on a log scale - see
// engine/productionDials.ts), and the two "pace" dials are a 0-1 intensity
// from their low extreme (Fast / Short) to their high extreme (Perfectionist
// / Long).
export interface ProductionChoices {
  budgetAmount: number;
  shootingIntensity: number; // 0 = Fast, 1 = Perfectionist
  setQualityAmount: number;
  practicalEffectsAmount: number;
  vfxAmount: number;
  runtimeIntensity: number; // 0 = Short, 1 = Long
}

export interface ProductionEvent {
  id: string;
  description: string;
  costDelta: number; // absolute currency change
  qualityDelta: number; // -100..100 scale applied to production score
  buzzDelta: number; // -100..100
  delayRiskDelta: number; // -100..100, informational for MVP
}

export type EditStyle = 'Commercial' | 'Artistic' | 'Balanced';
export type MusicFocus = 'Minimal' | 'Standard' | 'Heavy';
export type TestScreeningResponse = 'Ignore' | 'Minor Changes' | 'Major Changes';
export type FinalCutFocus = 'Trailer-focused' | 'Critic-focused' | 'Star-focused' | 'Mystery-focused';

export interface PostProductionChoices {
  editStyle: EditStyle;
  musicFocus: MusicFocus;
  testScreeningResponse: TestScreeningResponse;
  finalCutFocus: FinalCutFocus;
}

export type MarketingSpend = 'None' | 'Low' | 'Medium' | 'High' | 'Huge';
export type ReleaseType = 'Limited' | 'Wide' | 'Streaming' | 'Festival First';
export type ReleaseWindow = 'Quiet Month' | 'Summer' | 'Awards Season' | 'Halloween' | 'Christmas';

export interface MarketingChoices {
  marketingSpend: MarketingSpend;
  releaseType: ReleaseType;
  releaseWindow: ReleaseWindow;
}

export type OutcomeLabel =
  | 'Flop'
  | 'Cult Hit'
  | 'Modest Success'
  | 'Hit'
  | 'Blockbuster'
  | 'Masterpiece';

export interface FilmResults {
  productionCost: number;
  marketingCost: number;
  totalCost: number;
  openingWeekend: number;
  totalBoxOffice: number;
  profit: number;
  criticScore: number; // 0-100
  audienceScore: number; // 0-100
  buzzScore: number; // 0-100
  qualityScore: number; // 0-100, internal weighted quality
  reputationChange: number;
  reviewBlurbs: string[];
  outcome: OutcomeLabel;
}

// A film record that has been fully cast/produced/released and lives in studio history.
export interface Film {
  id: string;
  title: string;
  genre: Genre;
  targetAudience: TargetAudience;
  script: Script;
  talent: Talent[];
  productionChoices: ProductionChoices;
  postProductionChoices: PostProductionChoices;
  marketingChoices: MarketingChoices;
  events: ProductionEvent[];
  results: FilmResults;
  yearReleased: number;
}

export interface Studio {
  name: string;
  cash: number;
  reputation: number; // 0-100
  year: number;
  filmsReleased: Film[];
}

// The film currently being built in the wizard; fields fill in progressively.
export interface FilmDraft {
  title: string;
  genre: Genre | null;
  targetAudience: TargetAudience | null;
  scriptOptions: Script[];
  script: Script | null;
  talent: Talent[];
  productionChoices: ProductionChoices | null;
  events: ProductionEvent[];
  postProductionChoices: PostProductionChoices | null;
  marketingChoices: MarketingChoices | null;
  results: FilmResults | null;
}

export type WizardStep =
  | 'develop'
  | 'talent'
  | 'production-planning'
  | 'production'
  | 'post-production'
  | 'marketing'
  | 'results';

export type Screen = 'dashboard' | WizardStep;
