import { type DeviceSettings, useDeviceSettings } from './useDeviceSettings';
import { type ProfileSettings, defaultProfileSettings, getActiveProfile, useActiveProfile, useProfiles } from './useProfiles';

export type { KeyLabels, NoteInput, SessionMode } from './useProfiles';
export type { Theme } from './useDeviceSettings';

export type Settings = DeviceSettings & ProfileSettings;

const PROFILE_KEYS = new Set(Object.keys(defaultProfileSettings()));

/** Répartit une modification entre le profil actif et les réglages de l'appareil. */
export function setSettings(patch: Partial<Settings>) {
  const profilePatch: Partial<ProfileSettings> = {};
  const devicePatch: Partial<DeviceSettings> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (PROFILE_KEYS.has(k)) (profilePatch as Record<string, unknown>)[k] = v;
    else (devicePatch as Record<string, unknown>)[k] = v;
  }
  if (Object.keys(profilePatch).length) {
    useProfiles.getState().updateActive((p) => ({ ...p, settings: { ...p.settings, ...profilePatch } }));
  }
  if (Object.keys(devicePatch).length) useDeviceSettings.getState().setDevice(devicePatch);
}

/** Réglages effectifs : appareil + profil actif. */
export function useSettings(): Settings & { set: typeof setSettings } {
  const { theme, noteSound, tapSound, latencyMs } = useDeviceSettings();
  const profile = useActiveProfile();
  return { ...profile.settings, theme, noteSound, tapSound, latencyMs, set: setSettings };
}

/** Lecture ponctuelle hors rendu (gestionnaires d'événements). */
export function getSettings(): Settings {
  const { theme, noteSound, tapSound, latencyMs } = useDeviceSettings.getState();
  return { ...getActiveProfile().settings, theme, noteSound, tapSound, latencyMs };
}
