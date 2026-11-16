import type { NoteStat } from '../music/noteGenerator';
import { NOTE_LEVELS } from '../music/noteLevels';
import { RHYTHM_LEVELS } from '../rhythm/rhythmLevels';
import { SCALE_LEVELS, type ScaleMode } from '../scales/scaleLevels';

export interface NoteSessionRecord {
  kind: 'notes';
  date: number;
  levelId: string;
  total: number;
  correct: number;
  avgMs: number;
}

export interface RhythmSessionRecord {
  kind: 'rhythm';
  date: number;
  levelId: string;
  tempo: number;
  score: number;
}

export interface ScaleSessionRecord {
  kind: 'scales';
  date: number;
  mode: ScaleMode;
  levelId: string;
  total: number;
  correct: number;
  avgMs: number;
}

export type SessionRecord = NoteSessionRecord | RhythmSessionRecord | ScaleSessionRecord;

export interface NoteLevelBest {
  accuracy: number;
  avgMs: number;
  passed: boolean;
}

export interface RhythmLevelBest {
  score: number;
  tempo: number;
  passed: boolean;
}

export interface ScaleLevelBest {
  accuracy: number;
  avgMs: number;
  passed: boolean;
}

export interface ProgressData {
  noteStats: Record<string, NoteStat>;
  noteBest: Record<string, NoteLevelBest>;
  rhythmBest: Record<string, RhythmLevelBest>;
  /** Clé : `${mode}:${levelId}` (play / recognize). */
  scaleBest: Record<string, ScaleLevelBest>;
  history: SessionRecord[];
}

/** Critères de réussite d'un niveau. */
export const NOTE_PASS = { minNotes: 20, accuracy: 0.9, avgMs: 2500 };
export const RHYTHM_PASS = { score: 85 };
/** Gammes : précision au premier essai (jouer) ou bonnes réponses (reconnaître). */
export const SCALE_PASS = { accuracy: 0.9 };

export const scaleBestKey = (mode: ScaleMode, levelId: string) => `${mode}:${levelId}`;

const MAX_HISTORY = 200;

export const emptyProgress = (): ProgressData => ({ noteStats: {}, noteBest: {}, rhythmBest: {}, scaleBest: {}, history: [] });

export function withNoteAnswer(p: ProgressData, key: string, correct: boolean, ms: number): ProgressData {
  const prev = p.noteStats[key] ?? { attempts: 0, errors: 0, totalMs: 0 };
  // Fenêtre glissante : on « oublie » progressivement les anciennes réponses.
  const decay = prev.attempts >= 30 ? 29 / 30 : 1;
  return {
    ...p,
    noteStats: {
      ...p.noteStats,
      [key]: {
        attempts: prev.attempts * decay + 1,
        errors: prev.errors * decay + (correct ? 0 : 1),
        totalMs: prev.totalMs * decay + Math.min(ms, 10000),
      },
    },
  };
}

/** Enregistre une session de notes ; `newlyPassed` vaut vrai si le niveau vient d'être réussi. */
export function withNoteSession(
  p: ProgressData,
  r: Omit<NoteSessionRecord, 'kind' | 'date'>,
  date = Date.now(),
): { progress: ProgressData; newlyPassed: boolean } {
  const accuracy = r.total ? r.correct / r.total : 0;
  const passed = r.total >= NOTE_PASS.minNotes && accuracy >= NOTE_PASS.accuracy && r.avgMs <= NOTE_PASS.avgMs;
  const prev = p.noteBest[r.levelId];
  const better = !prev || accuracy > prev.accuracy || (accuracy === prev.accuracy && r.avgMs < prev.avgMs);
  const best: NoteLevelBest = {
    accuracy: better ? accuracy : prev.accuracy,
    avgMs: better ? r.avgMs : prev.avgMs,
    passed: passed || Boolean(prev?.passed),
  };
  return {
    progress: {
      ...p,
      history: [{ kind: 'notes' as const, date, ...r }, ...p.history].slice(0, MAX_HISTORY),
      noteBest: { ...p.noteBest, [r.levelId]: best },
    },
    newlyPassed: passed && !prev?.passed,
  };
}

export function withRhythmSession(
  p: ProgressData,
  r: Omit<RhythmSessionRecord, 'kind' | 'date'>,
  date = Date.now(),
): { progress: ProgressData; newlyPassed: boolean } {
  const passed = r.score >= RHYTHM_PASS.score;
  const prev = p.rhythmBest[r.levelId];
  const better = !prev || r.score > prev.score;
  const best: RhythmLevelBest = {
    score: better ? r.score : prev.score,
    tempo: better ? r.tempo : prev.tempo,
    passed: passed || Boolean(prev?.passed),
  };
  return {
    progress: {
      ...p,
      history: [{ kind: 'rhythm' as const, date, ...r }, ...p.history].slice(0, MAX_HISTORY),
      rhythmBest: { ...p.rhythmBest, [r.levelId]: best },
    },
    newlyPassed: passed && !prev?.passed,
  };
}

/** `total` = notes jouées (jouer) ou questions (reconnaître). */
export function withScaleSession(
  p: ProgressData,
  r: Omit<ScaleSessionRecord, 'kind' | 'date'>,
  date = Date.now(),
): { progress: ProgressData; newlyPassed: boolean } {
  const accuracy = r.total ? r.correct / r.total : 0;
  const passed = accuracy >= SCALE_PASS.accuracy;
  const k = scaleBestKey(r.mode, r.levelId);
  const prev = p.scaleBest[k];
  const better = !prev || accuracy > prev.accuracy || (accuracy === prev.accuracy && r.avgMs < prev.avgMs);
  const best: ScaleLevelBest = {
    accuracy: better ? accuracy : prev.accuracy,
    avgMs: better ? r.avgMs : prev.avgMs,
    passed: passed || Boolean(prev?.passed),
  };
  return {
    progress: {
      ...p,
      history: [{ kind: 'scales' as const, date, ...r }, ...p.history].slice(0, MAX_HISTORY),
      scaleBest: { ...p.scaleBest, [k]: best },
    },
    newlyPassed: passed && !prev?.passed,
  };
}

export function suggestedScaleLevel(best: Record<string, ScaleLevelBest>, mode: ScaleMode): string {
  return (SCALE_LEVELS.find((l) => !best[scaleBestKey(mode, l.id)]?.passed) ?? SCALE_LEVELS[SCALE_LEVELS.length - 1]).id;
}

/** Premier niveau non réussi : celui qu'on suggère de travailler. */
export function suggestedNoteLevel(best: Record<string, NoteLevelBest>): string {
  return (NOTE_LEVELS.find((l) => !best[l.id]?.passed) ?? NOTE_LEVELS[NOTE_LEVELS.length - 1]).id;
}

export function suggestedRhythmLevel(best: Record<string, RhythmLevelBest>): string {
  return (RHYTHM_LEVELS.find((l) => !best[l.id]?.passed) ?? RHYTHM_LEVELS[RHYTHM_LEVELS.length - 1]).id;
}
