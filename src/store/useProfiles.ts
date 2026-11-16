import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_CUSTOM_LEVEL, type NoteLevel } from '../music/noteLevels';
import type { ScaleMode } from '../scales/scaleLevels';
import { type ProgressData, emptyProgress } from './progressLogic';

export type KeyLabels = 'none' | 'c' | 'all';
export type SessionMode = 'count' | 'timed';
export type NoteInput = 'keyboard' | 'names' | 'both';

/** Préférences d'entraînement propres à chaque élève. */
export interface ProfileSettings {
  keyLabels: KeyLabels;
  /** Lecture de notes : réponse au clavier, par le nom, ou les deux. */
  noteInput: NoteInput;
  sessionMode: SessionMode;
  sessionCount: number;
  sessionSeconds: number;
  customLevel: NoteLevel;
  noteLevelId: string;
  rhythmLevelId: string;
  rhythmTempo: number;
  rhythmMeasures: number;
  metronomeDuringExercise: boolean;
  scaleLevelId: string;
  scaleMode: ScaleMode;
}

export interface Profile {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  settings: ProfileSettings;
  progress: ProgressData;
}

export const PROFILE_COLORS = ['#e0a53a', '#4a6cf7', '#1f9d55', '#d64545', '#9b59b6', '#16a2b8', '#e67e22'];

export const defaultProfileSettings = (): ProfileSettings => ({
  keyLabels: 'none',
  noteInput: 'keyboard',
  sessionMode: 'count',
  sessionCount: 20,
  sessionSeconds: 60,
  customLevel: DEFAULT_CUSTOM_LEVEL,
  noteLevelId: 'n1',
  rhythmLevelId: 'r1',
  rhythmTempo: 70,
  rhythmMeasures: 2,
  metronomeDuringExercise: true,
  scaleLevelId: 's1',
  scaleMode: 'play',
});

const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export function makeProfile(name: string, color: string, partial: Partial<Profile> = {}): Profile {
  return {
    id: newId(),
    name,
    color,
    createdAt: Date.now(),
    settings: defaultProfileSettings(),
    progress: emptyProgress(),
    ...partial,
  };
}

/** Reprend les données de la version mono-utilisateur (clés localStorage d'origine). */
function readLegacy<T>(key: string): Partial<T> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw).state ?? {}) : {};
  } catch {
    return {};
  }
}

function initialProfile(): Profile {
  const legacySettings = readLegacy<ProfileSettings>('solfege-settings');
  const legacyProgress = readLegacy<ProgressData>('solfege-progress');
  const defaults = defaultProfileSettings();
  const settings = Object.fromEntries(
    Object.keys(defaults).map((k) => [k, (legacySettings as Record<string, unknown>)[k] ?? defaults[k as keyof ProfileSettings]]),
  ) as unknown as ProfileSettings;
  const progress = { ...emptyProgress(), ...legacyProgress } as ProgressData;
  return makeProfile('Moi', PROFILE_COLORS[0], { settings, progress });
}

export function normalizeProfile(p: Profile): Profile {
  return {
    ...p,
    settings: { ...defaultProfileSettings(), ...p.settings },
    progress: { ...emptyProgress(), ...p.progress },
  };
}

interface ProfilesState {
  profiles: Profile[];
  activeId: string;

  createProfile: (name: string) => string;
  renameProfile: (id: string, name: string) => void;
  deleteProfile: (id: string) => void;
  switchProfile: (id: string) => void;
  /** Met à jour le profil actif. */
  updateActive: (fn: (p: Profile) => Profile) => void;
}

const first = initialProfile();

export const useProfiles = create<ProfilesState>()(
  persist(
    (set, get) => ({
      profiles: [first],
      activeId: first.id,

      createProfile: (name) => {
        const used = new Set(get().profiles.map((p) => p.color));
        const color = PROFILE_COLORS.find((c) => !used.has(c)) ?? PROFILE_COLORS[get().profiles.length % PROFILE_COLORS.length];
        const p = makeProfile(name.trim() || 'Nouveau profil', color);
        set((s) => ({ profiles: [...s.profiles, p], activeId: p.id }));
        return p.id;
      },
      renameProfile: (id, name) =>
        set((s) => ({ profiles: s.profiles.map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p)) })),
      deleteProfile: (id) =>
        set((s) => {
          if (s.profiles.length <= 1) return s; // toujours au moins un profil
          const profiles = s.profiles.filter((p) => p.id !== id);
          return { profiles, activeId: s.activeId === id ? profiles[0].id : s.activeId };
        }),
      switchProfile: (id) => set((s) => (s.profiles.some((p) => p.id === id) ? { activeId: id } : s)),
      updateActive: (fn) => set((s) => ({ profiles: s.profiles.map((p) => (p.id === s.activeId ? fn(p) : p)) })),
    }),
    {
      name: 'solfege-profiles',
      version: 2,
      migrate: (persisted, version) => {
        const p = persisted as Partial<ProfilesState>;
        // v2 : plus de « Do » affichés par défaut sur le clavier.
        if (version < 2 && p.profiles) {
          p.profiles = p.profiles.map((profile) =>
            profile.settings?.keyLabels === 'c'
              ? { ...profile, settings: { ...profile.settings, keyLabels: 'none' } }
              : profile,
          );
        }
        return p as ProfilesState;
      },
      // Complète les profils enregistrés par une version antérieure avec les champs ajoutés depuis.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ProfilesState>;
        if (!p.profiles?.length) return current;
        return { ...current, ...p, profiles: p.profiles.map(normalizeProfile) };
      },
    },
  ),
);

export function getActiveProfile(s: Pick<ProfilesState, 'profiles' | 'activeId'> = useProfiles.getState()): Profile {
  return s.profiles.find((p) => p.id === s.activeId) ?? s.profiles[0];
}

export function useActiveProfile(): Profile {
  return useProfiles((s) => getActiveProfile(s));
}
