import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'auto' | 'light' | 'dark';

/** Réglages liés à l'appareil (partagés par tous les profils). */
export interface DeviceSettings {
  theme: Theme;
  noteSound: boolean;
  tapSound: boolean;
  /** Décalage mesuré entre frappe et clic entendu (ms, positif = frappes en retard). */
  latencyMs: number;
}

function legacy(): Partial<DeviceSettings> {
  try {
    const s = JSON.parse(localStorage.getItem('solfege-settings') ?? '{}').state ?? {};
    const out: Partial<DeviceSettings> = {};
    for (const k of ['theme', 'noteSound', 'tapSound', 'latencyMs'] as const) if (k in s) out[k] = s[k];
    return out;
  } catch {
    return {};
  }
}

export const useDeviceSettings = create<DeviceSettings & { setDevice: (p: Partial<DeviceSettings>) => void }>()(
  persist(
    (set) => ({
      theme: 'auto',
      noteSound: true,
      tapSound: true,
      latencyMs: 0,
      ...legacy(),
      setDevice: (p) => set(p),
    }),
    { name: 'solfege-device', version: 1 },
  ),
);
