import type { NoteLevel } from './noteLevels';
import {
  type Alter,
  type Clef,
  type Pitch,
  diatonicIndex,
  fromDiatonicIndex,
  parsePitch,
  pitchId,
  toMidi,
} from './pitch';

export interface NoteQuestion {
  pitch: Pitch;
  clef: Clef;
}

export interface NoteStat {
  attempts: number;
  errors: number;
  totalMs: number;
}

export function questionKey(q: NoteQuestion): string {
  return `${q.clef}:${pitchId(q.pitch)}`;
}

/** Les orthographes E♯, B♯, F♭, C♭ sont exclues pour rester lisible. */
function allowedAlter(p: Pitch, alter: Alter): boolean {
  if (alter === 1) return p.step !== 'E' && p.step !== 'B';
  if (alter === -1) return p.step !== 'F' && p.step !== 'C';
  return true;
}

export function candidatesForLevel(level: NoteLevel): NoteQuestion[] {
  const out: NoteQuestion[] = [];
  for (const range of level.ranges) {
    const lo = diatonicIndex(parsePitch(range.low));
    const hi = diatonicIndex(parsePitch(range.high));
    for (let i = Math.min(lo, hi); i <= Math.max(lo, hi); i++) {
      const natural = fromDiatonicIndex(i);
      out.push({ pitch: natural, clef: range.clef });
      if (level.accidentals) {
        for (const alter of [1, -1] as Alter[]) {
          if (allowedAlter(natural, alter)) out.push({ pitch: { ...natural, alter }, clef: range.clef });
        }
      }
    }
  }
  return out;
}

/** Plage MIDI couverte par le niveau (pour dimensionner le clavier). */
export function midiRangeForLevel(level: NoteLevel): [number, number] {
  const midis = candidatesForLevel(level).map((q) => toMidi(q.pitch));
  return [Math.min(...midis), Math.max(...midis)];
}

/**
 * Poids d'une note : on insiste sur les notes souvent ratées ou lentes.
 * Les altérations sont un peu moins fréquentes que les notes naturelles.
 */
function weight(q: NoteQuestion, stats: Record<string, NoteStat>): number {
  const s = stats[questionKey(q)];
  let w = q.pitch.alter === 0 ? 1 : 0.6;
  if (s && s.attempts > 0) {
    const errorRate = s.errors / s.attempts;
    const avgSec = s.totalMs / s.attempts / 1000;
    w *= 1 + errorRate * 3 + Math.min(avgSec, 5) * 0.2;
  } else {
    w *= 1.3; // jamais vue : légère priorité
  }
  return w;
}

export function pickQuestion(
  candidates: NoteQuestion[],
  stats: Record<string, NoteStat>,
  previous: NoteQuestion | null,
  random: () => number = Math.random,
): NoteQuestion {
  const pool =
    previous && candidates.length > 1
      ? candidates.filter((c) => toMidi(c.pitch) !== toMidi(previous.pitch) || c.clef !== previous.clef)
      : candidates;
  const weights = pool.map((q) => weight(q, stats));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}
