import type { Clef } from './pitch';

export interface ClefRange {
  clef: Clef;
  /** Bornes naturelles incluses, ex. "C4". */
  low: string;
  high: string;
}

export interface NoteLevel {
  id: string;
  title: string;
  description: string;
  ranges: ClefRange[];
  accidentals: boolean;
}

export const NOTE_LEVELS: NoteLevel[] = [
  {
    id: 'n1',
    title: 'Premiers pas — clé de sol',
    description: 'Du Do central au Sol.',
    ranges: [{ clef: 'treble', low: 'C4', high: 'G4' }],
    accidentals: false,
  },
  {
    id: 'n2',
    title: 'Portée de sol',
    description: 'Toute la portée en clé de sol, du Do central au Sol aigu.',
    ranges: [{ clef: 'treble', low: 'C4', high: 'G5' }],
    accidentals: false,
  },
  {
    // Identifiant hors séquence : la progression est enregistrée par id, on ne renumérote pas.
    id: 'n2e',
    title: 'Clé de sol étendue',
    description: 'Du La grave au Do aigu, avec 2 lignes supplémentaires en dessous et au-dessus.',
    ranges: [{ clef: 'treble', low: 'A3', high: 'C6' }],
    accidentals: false,
  },
  {
    id: 'n3',
    title: 'Portée de fa',
    description: 'Toute la portée en clé de fa, du Sol grave au La.',
    ranges: [{ clef: 'bass', low: 'G2', high: 'A3' }],
    accidentals: false,
  },
  {
    id: 'n4',
    title: 'Clé de fa étendue',
    description: 'Du Do grave au Do central, avec lignes supplémentaires.',
    ranges: [{ clef: 'bass', low: 'C2', high: 'C4' }],
    accidentals: false,
  },
  {
    id: 'n5',
    title: 'Grand-portée',
    description: 'Les deux clés mélangées, jusqu’à 2 lignes supplémentaires.',
    ranges: [
      { clef: 'treble', low: 'A3', high: 'C6' },
      { clef: 'bass', low: 'E2', high: 'E4' },
    ],
    accidentals: false,
  },
  {
    id: 'n6',
    title: 'Altérations',
    description: 'Grand-portée avec dièses et bémols.',
    ranges: [
      { clef: 'treble', low: 'A3', high: 'C6' },
      { clef: 'bass', low: 'E2', high: 'E4' },
    ],
    accidentals: true,
  },
  {
    id: 'n7',
    title: 'Virtuose',
    description: 'Jusqu’à 4 lignes supplémentaires, deux clés, altérations.',
    ranges: [
      { clef: 'treble', low: 'D3', high: 'A6' },
      { clef: 'bass', low: 'E1', high: 'C5' },
    ],
    accidentals: true,
  },
];

export const CUSTOM_LEVEL_ID = 'custom';

export function getNoteLevel(id: string, custom: NoteLevel): NoteLevel {
  if (id === CUSTOM_LEVEL_ID) return custom;
  return NOTE_LEVELS.find((l) => l.id === id) ?? NOTE_LEVELS[0];
}

export const DEFAULT_CUSTOM_LEVEL: NoteLevel = {
  id: CUSTOM_LEVEL_ID,
  title: 'Personnalisé',
  description: 'Votre propre sélection de clés, de plage et d’altérations.',
  ranges: [{ clef: 'treble', low: 'C4', high: 'C6' }],
  accidentals: false,
};
