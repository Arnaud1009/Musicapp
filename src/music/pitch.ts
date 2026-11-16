export type Step = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
/** -2 = double bémol … 2 = double dièse. */
export type Alter = -2 | -1 | 0 | 1 | 2;
export type Clef = 'treble' | 'bass';

export interface Pitch {
  step: Step;
  alter: Alter;
  /** Octave en notation scientifique (Do central = C4). */
  octave: number;
}

export const STEPS: Step[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const STEP_SEMITONES: Record<Step, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const FRENCH_NAMES: Record<Step, string> = {
  C: 'Do',
  D: 'Ré',
  E: 'Mi',
  F: 'Fa',
  G: 'Sol',
  A: 'La',
  B: 'Si',
};

export function toMidi(p: Pitch): number {
  return (p.octave + 1) * 12 + STEP_SEMITONES[p.step] + p.alter;
}

/** Index diatonique (une unité par ligne/interligne) : C4 = 28. */
export function diatonicIndex(p: Pitch): number {
  return p.octave * 7 + STEPS.indexOf(p.step);
}

export function fromDiatonicIndex(index: number, alter: Alter = 0): Pitch {
  const octave = Math.floor(index / 7);
  return { step: STEPS[((index % 7) + 7) % 7], alter, octave };
}

const ALTER_ASCII: Record<Alter, string> = { [-2]: 'bb', [-1]: 'b', 0: '', 1: '#', 2: '##' };
const ALTER_SYMBOL: Record<Alter, string> = { [-2]: '𝄫', [-1]: '♭', 0: '', 1: '♯', 2: '𝄪' };

/** Parse "C4", "F#3", "Bb2", "F##4". */
export function parsePitch(s: string): Pitch {
  const m = /^([A-G])(##|bb|#|b)?(-?\d)$/.exec(s);
  if (!m) throw new Error(`Hauteur invalide : ${s}`);
  const alters: Record<string, Alter> = { bb: -2, b: -1, '': 0, '#': 1, '##': 2 };
  return { step: m[1] as Step, alter: alters[m[2] ?? ''], octave: Number(m[3]) };
}

/** Altération au format VexFlow ("#", "b", "##", "bb"), chaîne vide si naturelle. */
export function alterAscii(alter: Alter): string {
  return ALTER_ASCII[alter];
}

export function alterSymbol(alter: Alter): string {
  return ALTER_SYMBOL[alter];
}

export function pitchId(p: Pitch): string {
  return `${p.step}${ALTER_ASCII[p.alter]}${p.octave}`;
}

/** Clé VexFlow, ex. "c#/4". */
export function vexKey(p: Pitch): string {
  return `${p.step.toLowerCase()}${ALTER_ASCII[p.alter]}/${p.octave}`;
}

export function stepName(step: Step): string {
  return FRENCH_NAMES[step];
}

export function frenchName(p: Pick<Pitch, 'step' | 'alter'>): string {
  return FRENCH_NAMES[p.step] + ALTER_SYMBOL[p.alter];
}

const SHARP_SPELLING: [Step, Alter][] = [
  ['C', 0], ['C', 1], ['D', 0], ['D', 1], ['E', 0], ['F', 0],
  ['F', 1], ['G', 0], ['G', 1], ['A', 0], ['A', 1], ['B', 0],
];

export function fromMidi(midi: number): Pitch {
  const [step, alter] = SHARP_SPELLING[((midi % 12) + 12) % 12];
  return { step, alter, octave: Math.floor(midi / 12) - 1 };
}

export function isBlackKey(midi: number): boolean {
  return [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);
}

/** Nom français d'une touche (touches noires : "Do♯/Ré♭"). */
export function keyName(midi: number): string {
  const pc = ((midi % 12) + 12) % 12;
  const names = ['Do', 'Do♯', 'Ré', 'Ré♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'];
  return names[pc];
}

export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}
