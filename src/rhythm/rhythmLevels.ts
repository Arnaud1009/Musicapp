/** Résolution : une noire = 12 ticks (permet doubles croches et triolets). */
export const TPQ = 12;

export interface TimeSig {
  num: number;
  den: 4 | 8;
}

export interface RhythmEvent {
  ticks: number;
  rest?: boolean;
  /** Lié à l'événement suivant (celui-ci n'est pas réattaqué). */
  tieToNext?: boolean;
  triplet?: boolean;
}

export interface Cell {
  id: string;
  /** Nombre de temps occupés (temps = noire en x/4, noire pointée en 6/8). */
  beats: number;
  events: RhythmEvent[];
  compound?: boolean;
}

const n = (ticks: number, extra: Partial<RhythmEvent> = {}): RhythmEvent => ({ ticks, ...extra });
const r = (ticks: number): RhythmEvent => ({ ticks, rest: true });

export const CELLS: Record<string, Cell> = {
  // Mesures simples (temps = noire)
  Q: { id: 'Q', beats: 1, events: [n(12)] },
  H: { id: 'H', beats: 2, events: [n(24)] },
  HD: { id: 'HD', beats: 3, events: [n(36)] },
  W: { id: 'W', beats: 4, events: [n(48)] },
  QR: { id: 'QR', beats: 1, events: [r(12)] },
  HR: { id: 'HR', beats: 2, events: [r(24)] },
  EE: { id: 'EE', beats: 1, events: [n(6), n(6)] },
  QD_E: { id: 'QD_E', beats: 2, events: [n(18), n(6)] },
  ER_E: { id: 'ER_E', beats: 1, events: [r(6), n(6)] },
  E_ER: { id: 'E_ER', beats: 1, events: [n(6), r(6)] },
  S4: { id: 'S4', beats: 1, events: [n(3), n(3), n(3), n(3)] },
  E_SS: { id: 'E_SS', beats: 1, events: [n(6), n(3), n(3)] },
  SS_E: { id: 'SS_E', beats: 1, events: [n(3), n(3), n(6)] },
  SYNC: { id: 'SYNC', beats: 2, events: [n(6), n(12), n(6)] },
  TIE_SYNC: { id: 'TIE_SYNC', beats: 2, events: [n(6), n(6, { tieToNext: true }), n(6), n(6)] },
  Q_TIE_E: { id: 'Q_TIE_E', beats: 2, events: [n(12, { tieToNext: true }), n(6), n(6)] },
  TRIP: { id: 'TRIP', beats: 1, events: [n(4, { triplet: true }), n(4, { triplet: true }), n(4, { triplet: true })] },
  ED_S: { id: 'ED_S', beats: 1, events: [n(9), n(3)] },
  S_E_S: { id: 'S_E_S', beats: 1, events: [n(3), n(6), n(3)] },
  // Mesures composées (temps = noire pointée)
  C_DQ: { id: 'C_DQ', beats: 1, compound: true, events: [n(18)] },
  C_Q_E: { id: 'C_Q_E', beats: 1, compound: true, events: [n(12), n(6)] },
  C_EEE: { id: 'C_EEE', beats: 1, compound: true, events: [n(6), n(6), n(6)] },
  C_E_Q: { id: 'C_E_Q', beats: 1, compound: true, events: [n(6), n(12)] },
  C_DH: { id: 'C_DH', beats: 2, compound: true, events: [n(36)] },
  C_DQR: { id: 'C_DQR', beats: 1, compound: true, events: [r(18)] },
  C_E_ER_E: { id: 'C_E_ER_E', beats: 1, compound: true, events: [n(6), r(6), n(6)] },
  C_EDSE: { id: 'C_EDSE', beats: 1, compound: true, events: [n(9), n(3), n(6)] },
  C_SSEE: { id: 'C_SSEE', beats: 1, compound: true, events: [n(3), n(3), n(6), n(6)] },
};

export interface RhythmLevel {
  id: string;
  title: string;
  description: string;
  timeSigs: TimeSig[];
  /** Identifiant de cellule → poids de tirage. */
  cells: Record<string, number>;
  defaultTempo: number;
}

const L1 = { Q: 5, H: 3, HD: 1, W: 1 };
const L2 = { ...L1, QR: 2, HR: 1 };
const L3 = { ...L2, Q: 4, EE: 4 };
const L4 = { ...L3, QD_E: 3, ER_E: 1, E_ER: 1 };
const L5 = { ...L4, S4: 2, E_SS: 2, SS_E: 2 };
const L6 = { ...L5, SYNC: 2, TIE_SYNC: 1, Q_TIE_E: 1, TRIP: 2 };
const L7 = {
  ...L6, ED_S: 2, S_E_S: 1,
  C_DQ: 2, C_Q_E: 3, C_EEE: 3, C_E_Q: 2, C_DH: 1, C_DQR: 1, C_E_ER_E: 1, C_EDSE: 2, C_SSEE: 1,
};

export const RHYTHM_LEVELS: RhythmLevel[] = [
  {
    id: 'r1',
    title: 'Rondes, blanches, noires',
    description: 'Les valeurs de base en 4/4.',
    timeSigs: [{ num: 4, den: 4 }],
    cells: L1,
    defaultTempo: 70,
  },
  {
    id: 'r2',
    title: 'Les silences',
    description: 'Soupirs et demi-pauses.',
    timeSigs: [{ num: 4, den: 4 }],
    cells: L2,
    defaultTempo: 70,
  },
  {
    id: 'r3',
    title: 'Les croches',
    description: 'Deux croches par temps.',
    timeSigs: [{ num: 4, den: 4 }],
    cells: L3,
    defaultTempo: 70,
  },
  {
    id: 'r4',
    title: 'Pointées et demi-soupirs',
    description: 'Noire pointée-croche, demi-soupirs, mesures à 2 et 3 temps.',
    timeSigs: [{ num: 4, den: 4 }, { num: 3, den: 4 }, { num: 2, den: 4 }],
    cells: L4,
    defaultTempo: 72,
  },
  {
    id: 'r5',
    title: 'Doubles croches',
    description: 'Quatre doubles, croche-deux doubles, deux doubles-croche.',
    timeSigs: [{ num: 4, den: 4 }, { num: 3, den: 4 }, { num: 2, den: 4 }],
    cells: L5,
    defaultTempo: 66,
  },
  {
    id: 'r6',
    title: 'Syncopes et triolets',
    description: 'Syncopes, liaisons et triolets de croches.',
    timeSigs: [{ num: 4, den: 4 }, { num: 3, den: 4 }],
    cells: L6,
    defaultTempo: 66,
  },
  {
    id: 'r7',
    title: 'Mesures composées',
    description: '6/8, croche pointée-double et rythmes lombards.',
    timeSigs: [{ num: 4, den: 4 }, { num: 3, den: 4 }, { num: 6, den: 8 }],
    cells: L7,
    defaultTempo: 60,
  },
];

export function getRhythmLevel(id: string): RhythmLevel {
  return RHYTHM_LEVELS.find((l) => l.id === id) ?? RHYTHM_LEVELS[0];
}

export function isCompound(ts: TimeSig): boolean {
  return ts.den === 8 && ts.num % 3 === 0;
}

/** Durée d'un temps de métronome en ticks. */
export function beatTicks(ts: TimeSig): number {
  return isCompound(ts) ? (TPQ * 3) / 2 : (TPQ * 4) / ts.den;
}

export function beatsPerMeasure(ts: TimeSig): number {
  return isCompound(ts) ? ts.num / 3 : ts.num;
}

export function measureTicks(ts: TimeSig): number {
  return beatTicks(ts) * beatsPerMeasure(ts);
}
