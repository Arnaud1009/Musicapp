import type { Clef } from '../music/pitch';
import { type Direction, type ScaleKey, type ScaleType, keysUpTo } from './scales';

export type ScaleMode = 'play' | 'recognize';

export interface ScaleLevel {
  id: string;
  title: string;
  description: string;
  maxAccidentals: number;
  types: ScaleType[];
  clefs: Clef[];
  direction: Direction;
}

const MINORS: ScaleType[] = ['naturalMinor', 'harmonicMinor', 'melodicMinor'];

export const SCALE_LEVELS: ScaleLevel[] = [
  {
    id: 's1',
    title: 'Premières gammes majeures',
    description: 'Do, Sol, Fa, Ré et Si♭ majeur, en clé de sol, en montant.',
    maxAccidentals: 2,
    types: ['major'],
    clefs: ['treble'],
    direction: 'up',
  },
  {
    id: 's2',
    title: 'Majeures jusqu’à 3 altérations',
    description: 'Jusqu’à La et Mi♭ majeur, clés de sol et de fa, montée et descente.',
    maxAccidentals: 3,
    types: ['major'],
    clefs: ['treble', 'bass'],
    direction: 'upDown',
  },
  {
    id: 's3',
    title: 'Premières mineures',
    description: 'Mineures naturelles et harmoniques jusqu’à 2 altérations.',
    maxAccidentals: 2,
    types: ['naturalMinor', 'harmonicMinor'],
    clefs: ['treble'],
    direction: 'up',
  },
  {
    id: 's4',
    title: 'Majeures et mineures',
    description: 'Les quatre types jusqu’à 3 altérations, montée et descente.',
    maxAccidentals: 3,
    types: ['major', ...MINORS],
    clefs: ['treble', 'bass'],
    direction: 'upDown',
  },
  {
    id: 's5',
    title: 'Majeures jusqu’à 5 altérations',
    description: 'Jusqu’à Si et Ré♭ majeur, montée et descente.',
    maxAccidentals: 5,
    types: ['major'],
    clefs: ['treble', 'bass'],
    direction: 'upDown',
  },
  {
    id: 's6',
    title: 'Mineures jusqu’à 5 altérations',
    description: 'Les trois mineures jusqu’à sol♯ et si♭ mineur.',
    maxAccidentals: 5,
    types: MINORS,
    clefs: ['treble', 'bass'],
    direction: 'upDown',
  },
  {
    id: 's7',
    title: 'Toutes les tonalités',
    description: 'Les 4 types, jusqu’à 7 dièses ou 7 bémols.',
    maxAccidentals: 7,
    types: ['major', ...MINORS],
    clefs: ['treble', 'bass'],
    direction: 'upDown',
  },
];

export function getScaleLevel(id: string): ScaleLevel {
  return SCALE_LEVELS.find((l) => l.id === id) ?? SCALE_LEVELS[0];
}

export function keysForLevel(level: ScaleLevel): ScaleKey[] {
  return keysUpTo(level.maxAccidentals, level.types);
}

/** Nombre de gammes par session selon l'exercice. */
export const SCALE_SESSION_LENGTH: Record<ScaleMode, number> = { play: 4, recognize: 10 };
