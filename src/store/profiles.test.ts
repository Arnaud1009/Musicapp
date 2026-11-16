// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { withNoteSession, withRhythmSession, emptyProgress, suggestedNoteLevel } from './progressLogic';

describe('logique de progression', () => {
  it('valide un niveau de notes et garde le meilleur résultat', () => {
    let r = withNoteSession(emptyProgress(), { levelId: 'n1', total: 20, correct: 19, avgMs: 1500 });
    expect(r.newlyPassed).toBe(true);
    r = withNoteSession(r.progress, { levelId: 'n1', total: 20, correct: 10, avgMs: 3000 });
    expect(r.newlyPassed).toBe(false);
    expect(r.progress.noteBest.n1).toEqual({ accuracy: 0.95, avgMs: 1500, passed: true });
    expect(r.progress.history).toHaveLength(2);
    expect(suggestedNoteLevel(r.progress.noteBest)).toBe('n2');
  });
  it('ne valide pas un rythme sous le seuil', () => {
    const r = withRhythmSession(emptyProgress(), { levelId: 'r1', tempo: 70, score: 80 });
    expect(r.newlyPassed).toBe(false);
    expect(r.progress.rhythmBest.r1.passed).toBe(false);
  });
});

// Node ≥ 25 expose son propre `localStorage` (indéfini sans --localstorage-file), qui masque celui de jsdom.
const memory = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => void memory.set(k, String(v)),
    removeItem: (k: string) => void memory.delete(k),
    clear: () => memory.clear(),
    key: (i: number) => [...memory.keys()][i] ?? null,
    get length() {
      return memory.size;
    },
  },
});

describe('profils', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('isole niveaux, réglages et progression par profil', async () => {
    const { useProfiles } = await import('./useProfiles');
    const { getSettings, setSettings } = await import('./useSettings');
    const { getProgress } = await import('./useProgress');
    const { withRhythmSession: wr } = await import('./progressLogic');

    const first = useProfiles.getState().activeId;
    setSettings({ noteLevelId: 'n4' });
    useProfiles.getState().updateActive((p) => ({ ...p, progress: wr(p.progress, { levelId: 'r1', tempo: 70, score: 95 }).progress }));

    const second = useProfiles.getState().createProfile('Léa');
    expect(useProfiles.getState().activeId).toBe(second);
    expect(getSettings().noteLevelId).toBe('n1');
    expect(getProgress().rhythmBest).toEqual({});

    useProfiles.getState().switchProfile(first);
    expect(getSettings().noteLevelId).toBe('n4');
    expect(getProgress().rhythmBest.r1.passed).toBe(true);
  });

  it('répartit les réglages entre profil et appareil', async () => {
    const { useProfiles } = await import('./useProfiles');
    const { useDeviceSettings } = await import('./useDeviceSettings');
    const { getSettings, setSettings } = await import('./useSettings');
    setSettings({ latencyMs: 42, rhythmTempo: 100 });
    expect(useDeviceSettings.getState().latencyMs).toBe(42);
    expect(getSettings().rhythmTempo).toBe(100);
    useProfiles.getState().createProfile('Tom');
    expect(getSettings().latencyMs).toBe(42); // partagé par l'appareil
    expect(getSettings().rhythmTempo).toBe(70); // propre au profil
  });

  it('garde toujours au moins un profil', async () => {
    const { useProfiles } = await import('./useProfiles');
    const only = useProfiles.getState().activeId;
    useProfiles.getState().deleteProfile(only);
    expect(useProfiles.getState().profiles).toHaveLength(1);
    const other = useProfiles.getState().createProfile('Tom');
    useProfiles.getState().deleteProfile(other);
    expect(useProfiles.getState().activeId).toBe(only);
  });

  it('migre les données de la version mono-utilisateur', async () => {
    localStorage.setItem(
      'solfege-settings',
      JSON.stringify({ state: { noteLevelId: 'n3', latencyMs: 25, unlockAll: true }, version: 1 }),
    );
    localStorage.setItem(
      'solfege-progress',
      JSON.stringify({ state: { noteBest: { n1: { accuracy: 1, avgMs: 900, passed: true } }, history: [] }, version: 1 }),
    );
    const { getSettings } = await import('./useSettings');
    const { getProgress } = await import('./useProgress');
    const { useProfiles } = await import('./useProfiles');
    expect(useProfiles.getState().profiles).toHaveLength(1);
    expect(getSettings().noteLevelId).toBe('n3');
    expect(getSettings().latencyMs).toBe(25);
    expect(getProgress().noteBest.n1.passed).toBe(true);
    expect(getProgress().rhythmBest).toEqual({});
  });

  it('complète les profils enregistrés avant l’ajout des gammes', async () => {
    const old = {
      id: 'p1',
      name: 'Léa',
      color: '#e0a53a',
      createdAt: 0,
      settings: { noteLevelId: 'n3', rhythmLevelId: 'r2' },
      progress: { noteStats: {}, noteBest: {}, rhythmBest: {}, history: [] },
    };
    localStorage.setItem('solfege-profiles', JSON.stringify({ state: { profiles: [old], activeId: 'p1' }, version: 1 }));
    const { getSettings } = await import('./useSettings');
    const { getProgress } = await import('./useProgress');
    expect(getSettings().noteLevelId).toBe('n3');
    expect(getSettings().scaleLevelId).toBe('s1');
    expect(getSettings().scaleMode).toBe('play');
    expect(getProgress().scaleBest).toEqual({});
  });

  it('retire les « Do » du clavier des profils existants, sauf choix « toutes les notes »', async () => {
    const profile = (id: string, keyLabels: string) => ({
      id,
      name: id,
      color: '#e0a53a',
      createdAt: 0,
      settings: { keyLabels },
      progress: {},
    });
    localStorage.setItem(
      'solfege-profiles',
      JSON.stringify({ state: { profiles: [profile('a', 'c'), profile('b', 'all')], activeId: 'a' }, version: 1 }),
    );
    const { useProfiles } = await import('./useProfiles');
    const { getSettings } = await import('./useSettings');
    expect(getSettings().keyLabels).toBe('none');
    useProfiles.getState().switchProfile('b');
    expect(getSettings().keyLabels).toBe('all');
  });
});
