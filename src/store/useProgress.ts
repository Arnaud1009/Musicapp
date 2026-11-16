import { getActiveProfile, useActiveProfile, useProfiles } from './useProfiles';
import {
  type NoteSessionRecord,
  type ProgressData,
  type RhythmSessionRecord,
  type ScaleSessionRecord,
  emptyProgress,
  withNoteAnswer,
  withNoteSession,
  withRhythmSession,
  withScaleSession,
} from './progressLogic';

export { NOTE_PASS, RHYTHM_PASS, SCALE_PASS } from './progressLogic';
export type { NoteLevelBest, RhythmLevelBest, ScaleLevelBest, SessionRecord } from './progressLogic';

function update(fn: (p: ProgressData) => ProgressData) {
  useProfiles.getState().updateActive((profile) => ({ ...profile, progress: fn(profile.progress) }));
}

const actions = {
  recordNoteAnswer: (key: string, correct: boolean, ms: number) => update((p) => withNoteAnswer(p, key, correct, ms)),
  recordNoteSession: (r: Omit<NoteSessionRecord, 'kind' | 'date'>): boolean => {
    const { progress, newlyPassed } = withNoteSession(getActiveProfile().progress, r);
    update(() => progress);
    return newlyPassed;
  },
  recordRhythmSession: (r: Omit<RhythmSessionRecord, 'kind' | 'date'>): boolean => {
    const { progress, newlyPassed } = withRhythmSession(getActiveProfile().progress, r);
    update(() => progress);
    return newlyPassed;
  },
  recordScaleSession: (r: Omit<ScaleSessionRecord, 'kind' | 'date'>): boolean => {
    const { progress, newlyPassed } = withScaleSession(getActiveProfile().progress, r);
    update(() => progress);
    return newlyPassed;
  },
  reset: () => update(() => emptyProgress()),
};

/** Progression du profil actif. */
export function useProgress(): ProgressData & typeof actions {
  return { ...useActiveProfile().progress, ...actions };
}

export function getProgress(): ProgressData {
  return getActiveProfile().progress;
}
