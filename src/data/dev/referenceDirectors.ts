import type { DirectorTalent } from '../../types';

// Ten real directors, hand-authored rather than procedurally generated -
// see referenceScripts.ts for why. productionStyle values are a deliberate
// judgment call about each director's real body of work (Nolan's
// practical/location leanings, Cameron's digital-pioneer leanings, Wes
// Anderson's meticulous studio-built worlds), not derived from anything
// else. Illustrative for calibration purposes only - not a factual claim
// about any real person, and never imported by anything the player's own
// save touches.

export const REFERENCE_DIRECTORS: DirectorTalent[] = [
  {
    id: 'ref-director-nolan',
    name: 'Christopher Nolan',
    role: 'Director',
    fame: 95,
    reliability: 88,
    ego: 60,
    salary: 9_000_000,
    skill: 92,
    toneProfile: { action: 60, comedy: 15, romance: 15, suspense: 85, drama: 55, spectacle: 75 },
    productionStyle: {
      environmentStrategy: { studio: 0.35, location: 0.55, digital: 0.1 },
      effectsStrategy: { practical: 0.8, digital: 0.2 },
    },
  },
  {
    id: 'ref-director-anderson',
    name: 'Wes Anderson',
    role: 'Director',
    fame: 82,
    reliability: 85,
    ego: 55,
    salary: 6_000_000,
    skill: 88,
    toneProfile: { action: 10, comedy: 75, romance: 30, suspense: 25, drama: 50, spectacle: 55 },
    productionStyle: {
      environmentStrategy: { studio: 0.75, location: 0.15, digital: 0.1 },
      effectsStrategy: { practical: 0.7, digital: 0.3 },
    },
  },
  {
    id: 'ref-director-cameron',
    name: 'James Cameron',
    role: 'Director',
    fame: 96,
    reliability: 75,
    ego: 80,
    salary: 11_000_000,
    skill: 95,
    toneProfile: { action: 80, comedy: 15, romance: 25, suspense: 55, drama: 40, spectacle: 90 },
    productionStyle: {
      environmentStrategy: { studio: 0.45, location: 0.25, digital: 0.3 },
      effectsStrategy: { practical: 0.35, digital: 0.65 },
    },
  },
  {
    id: 'ref-director-gerwig',
    name: 'Greta Gerwig',
    role: 'Director',
    fame: 78,
    reliability: 90,
    ego: 40,
    salary: 5_000_000,
    skill: 85,
    toneProfile: { action: 10, comedy: 50, romance: 45, suspense: 25, drama: 65, spectacle: 25 },
    productionStyle: {
      environmentStrategy: { studio: 0.25, location: 0.65, digital: 0.1 },
      effectsStrategy: { practical: 0.6, digital: 0.4 },
    },
  },
  {
    id: 'ref-director-del-toro',
    name: 'Guillermo del Toro',
    role: 'Director',
    fame: 85,
    reliability: 82,
    ego: 50,
    salary: 5_500_000,
    skill: 90,
    toneProfile: { action: 35, comedy: 20, romance: 25, suspense: 65, drama: 50, spectacle: 70 },
    productionStyle: {
      environmentStrategy: { studio: 0.6, location: 0.2, digital: 0.2 },
      effectsStrategy: { practical: 0.75, digital: 0.25 },
    },
  },
  {
    id: 'ref-director-bay',
    name: 'Michael Bay',
    role: 'Director',
    fame: 88,
    reliability: 70,
    ego: 85,
    salary: 7_000_000,
    skill: 70,
    toneProfile: { action: 90, comedy: 30, romance: 15, suspense: 40, drama: 20, spectacle: 85 },
    productionStyle: {
      environmentStrategy: { studio: 0.2, location: 0.6, digital: 0.2 },
      effectsStrategy: { practical: 0.45, digital: 0.55 },
    },
  },
  {
    id: 'ref-director-coppola',
    name: 'Sofia Coppola',
    role: 'Director',
    fame: 75,
    reliability: 88,
    ego: 35,
    salary: 4_000_000,
    skill: 82,
    toneProfile: { action: 5, comedy: 30, romance: 40, suspense: 25, drama: 60, spectacle: 20 },
    productionStyle: {
      environmentStrategy: { studio: 0.15, location: 0.78, digital: 0.07 },
      effectsStrategy: { practical: 0.7, digital: 0.3 },
    },
  },
  {
    id: 'ref-director-villeneuve',
    name: 'Denis Villeneuve',
    role: 'Director',
    fame: 84,
    reliability: 85,
    ego: 55,
    salary: 6_500_000,
    skill: 93,
    toneProfile: { action: 45, comedy: 5, romance: 15, suspense: 70, drama: 55, spectacle: 75 },
    productionStyle: {
      environmentStrategy: { studio: 0.3, location: 0.4, digital: 0.3 },
      effectsStrategy: { practical: 0.35, digital: 0.65 },
    },
  },
  {
    id: 'ref-director-lumet',
    name: 'Sidney Lumet',
    role: 'Director',
    fame: 70,
    reliability: 92,
    ego: 30,
    salary: 3_000_000,
    skill: 89,
    toneProfile: { action: 10, comedy: 15, romance: 10, suspense: 55, drama: 80, spectacle: 10 },
    productionStyle: {
      environmentStrategy: { studio: 0.7, location: 0.25, digital: 0.05 },
      effectsStrategy: { practical: 0.65, digital: 0.35 },
    },
  },
  {
    id: 'ref-director-spielberg',
    name: 'Steven Spielberg',
    role: 'Director',
    fame: 98,
    reliability: 90,
    ego: 55,
    salary: 12_000_000,
    skill: 96,
    toneProfile: { action: 55, comedy: 35, romance: 25, suspense: 60, drama: 50, spectacle: 75 },
    productionStyle: {
      environmentStrategy: { studio: 0.3, location: 0.5, digital: 0.2 },
      effectsStrategy: { practical: 0.55, digital: 0.45 },
    },
  },
];
