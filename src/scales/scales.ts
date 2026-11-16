import { type Alter, type Clef, type Pitch, type Step, STEPS, frenchName, toMidi } from '../music/pitch';

export type ScaleType = 'major' | 'naturalMinor' | 'harmonicMinor' | 'melodicMinor';
export type Direction = 'up' | 'upDown';

export interface ScaleKey {
  tonic: { step: Step; alter: Alter };
  type: ScaleType;
}

/** Tonalités majeures par armure : nombre positif = dièses, négatif = bémols. */
const MAJOR_BY_SIGNATURE: Record<number, { step: Step; alter: Alter }> = {
  0: { step: 'C', alter: 0 },
  1: { step: 'G', alter: 0 },
  2: { step: 'D', alter: 0 },
  3: { step: 'A', alter: 0 },
  4: { step: 'E', alter: 0 },
  5: { step: 'B', alter: 0 },
  6: { step: 'F', alter: 1 },
  7: { step: 'C', alter: 1 },
  [-1]: { step: 'F', alter: 0 },
  [-2]: { step: 'B', alter: -1 },
  [-3]: { step: 'E', alter: -1 },
  [-4]: { step: 'A', alter: -1 },
  [-5]: { step: 'D', alter: -1 },
  [-6]: { step: 'G', alter: -1 },
  [-7]: { step: 'C', alter: -1 },
};

const SHARP_ORDER: Step[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_ORDER: Step[] = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

const PATTERNS: Record<ScaleType, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11, 12],
  naturalMinor: [0, 2, 3, 5, 7, 8, 10, 12],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11, 12],
  melodicMinor: [0, 2, 3, 5, 7, 9, 11, 12],
};

const TYPE_NAMES: Record<ScaleType, string> = {
  major: 'majeur',
  naturalMinor: 'mineur naturelle',
  harmonicMinor: 'mineur harmonique',
  melodicMinor: 'mineur mélodique',
};

export const SCALE_TYPE_LABELS: Record<ScaleType, string> = {
  major: 'Majeure',
  naturalMinor: 'Mineure naturelle',
  harmonicMinor: 'Mineure harmonique',
  melodicMinor: 'Mineure mélodique',
};

export const isMinor = (t: ScaleType) => t !== 'major';

/** Toutes les tonalités dont l'armure a au plus `maxAccidentals` altérations. */
export function keysUpTo(maxAccidentals: number, types: ScaleType[]): ScaleKey[] {
  const out: ScaleKey[] = [];
  for (let n = 0; n <= maxAccidentals; n++) {
    for (const sig of n === 0 ? [0] : [n, -n]) {
      const major = MAJOR_BY_SIGNATURE[sig];
      for (const type of types) {
        out.push({ tonic: isMinor(type) ? relativeMinorTonic(major) : major, type });
      }
    }
  }
  return out;
}

function relativeMinorTonic(major: { step: Step; alter: Alter }): { step: Step; alter: Alter } {
  // Sixième degré de la gamme majeure.
  return scaleDegrees({ tonic: major, type: 'major' }, 4)[5];
}

/** Nombre d'altérations à l'armure (positif = dièses). */
export function signatureCount(key: ScaleKey): number {
  for (const [sig, major] of Object.entries(MAJOR_BY_SIGNATURE)) {
    const tonic = isMinor(key.type) ? relativeMinorTonic(major) : major;
    if (tonic.step === key.tonic.step && tonic.alter === key.tonic.alter) return Number(sig);
  }
  throw new Error(`Tonalité hors armure : ${keyId(key)}`);
}

/** Altération imposée par l'armure pour chaque nom de note. */
export function signatureAlters(key: ScaleKey): Record<Step, Alter> {
  const count = signatureCount(key);
  const alters = Object.fromEntries(STEPS.map((s) => [s, 0])) as Record<Step, Alter>;
  const order = count > 0 ? SHARP_ORDER : FLAT_ORDER;
  for (let i = 0; i < Math.abs(count); i++) alters[order[i]] = count > 0 ? 1 : -1;
  return alters;
}

/** Armure au format VexFlow (on donne toujours la tonalité majeure relative : même armure). */
export function vexKeySignature(key: ScaleKey): string {
  const major = MAJOR_BY_SIGNATURE[signatureCount(key)];
  return major.step + (major.alter === 1 ? '#' : major.alter === -1 ? 'b' : '');
}

/** Les 8 degrés montants (tonique à tonique), avec l'octave de départ donnée. */
export function scaleDegrees(key: ScaleKey, octave: number, pattern = PATTERNS[key.type]): Pitch[] {
  const start: Pitch = { ...key.tonic, octave };
  const startIndex = STEPS.indexOf(key.tonic.step);
  const startMidi = toMidi(start);
  return pattern.map((semis, i) => {
    const idx = startIndex + i;
    const step = STEPS[idx % 7];
    const oct = octave + Math.floor(idx / 7);
    const alter = startMidi + semis - toMidi({ step, alter: 0, octave: oct });
    if (alter < -2 || alter > 2) throw new Error(`Altération impossible dans ${keyId(key)}`);
    return { step, alter: alter as Alter, octave: oct };
  });
}

/** Octave de départ lisible sur la clé choisie (tonique sur ou près de la portée). */
export function startOctave(key: ScaleKey, clef: Clef): number {
  if (clef === 'treble') return 4;
  return ['C', 'D', 'E'].includes(key.tonic.step) ? 3 : 2;
}

/**
 * Notes écrites, par mesure : montée seule, ou montée | descente.
 * La mineure mélodique redescend en mineure naturelle (usage classique).
 */
export function scaleMeasures(key: ScaleKey, clef: Clef, direction: Direction): Pitch[][] {
  const oct = startOctave(key, clef);
  const up = scaleDegrees(key, oct);
  if (direction === 'up') return [up];
  const downPattern = key.type === 'melodicMinor' ? PATTERNS.naturalMinor : PATTERNS[key.type];
  const down = scaleDegrees(key, oct, downPattern).reverse().slice(1);
  return [up, down];
}

/**
 * Altérations à écrire devant chaque note, compte tenu de l'armure et des altérations
 * déjà écrites dans la mesure (elles valent jusqu'à la barre de mesure, à la même octave).
 * Renvoie "#", "b", "##", "bb", "n" (bécarre) ou null.
 */
export function writtenAccidentals(notes: Pitch[], signature: Record<Step, Alter>): (string | null)[] {
  const current = new Map<string, Alter>();
  return notes.map((p) => {
    const slot = `${p.step}${p.octave}`;
    const active = current.get(slot) ?? signature[p.step];
    if (p.alter === active) return null;
    current.set(slot, p.alter);
    return p.alter === 0 ? 'n' : { [-2]: 'bb', [-1]: 'b', 1: '#', 2: '##' }[p.alter as -2 | -1 | 1 | 2];
  });
}

export function keyId(key: ScaleKey): string {
  return `${key.tonic.step}${key.tonic.alter === 1 ? '#' : key.tonic.alter === -1 ? 'b' : ''}-${key.type}`;
}

export function sameKey(a: ScaleKey, b: ScaleKey): boolean {
  return keyId(a) === keyId(b);
}

/** Ex. « Fa♯ mineur harmonique ». */
export function scaleName(key: ScaleKey): string {
  return `${frenchName({ ...key.tonic })} ${TYPE_NAMES[key.type]}`;
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Trois mauvaises réponses plausibles : la tonalité relative (même armure),
 * les autres types sur la même tonique, puis le reste du niveau.
 */
export function distractors(answer: ScaleKey, pool: ScaleKey[], random: () => number = Math.random, count = 3): ScaleKey[] {
  const sig = signatureCount(answer);
  const others = pool.filter((k) => !sameKey(k, answer));
  const relatives = others.filter((k) => signatureCount(k) === sig && isMinor(k.type) !== isMinor(answer.type));
  const sameTonic = others.filter(
    (k) => k.tonic.step === answer.tonic.step && k.tonic.alter === answer.tonic.alter,
  );
  const ranked = [...shuffle(relatives, random).slice(0, 1), ...shuffle(sameTonic, random), ...shuffle(others, random)];
  const out: ScaleKey[] = [];
  for (const k of ranked) {
    if (out.length >= count) break;
    if (!out.some((o) => sameKey(o, k))) out.push(k);
  }
  return out;
}

export function scaleMidiRange(measures: Pitch[][]): [number, number] {
  const midis = measures.flat().map(toMidi);
  return [Math.min(...midis), Math.max(...midis)];
}

export { shuffle };
