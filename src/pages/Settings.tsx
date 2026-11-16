import { LatencyCalibration } from '../components/LatencyCalibration';
import { ProfileManager } from '../components/Profiles';
import { useActiveProfile } from '../store/useProfiles';
import { type KeyLabels, type Theme, useSettings } from '../store/useSettings';

export function Settings() {
  const s = useSettings();
  const profile = useActiveProfile();
  return (
    <div className="page settings">
      <h2>Profils</h2>
      <p className="muted small">Chaque profil a ses propres niveaux, sa progression et ses préférences de lecture de notes.</p>
      <ProfileManager />

      <h2>Lecture de notes — {profile.name}</h2>
      <div className="field">
        <label htmlFor="labels">Noms sur le clavier</label>
        <select id="labels" value={s.keyLabels} onChange={(e) => s.set({ keyLabels: e.target.value as KeyLabels })}>
          <option value="none">Aucun</option>
          <option value="c">Seulement les Do</option>
          <option value="all">Toutes les notes</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="mode">Type de session</label>
        <select
          id="mode"
          value={s.sessionMode}
          onChange={(e) => s.set({ sessionMode: e.target.value as 'count' | 'timed' })}
        >
          <option value="count">Nombre de notes</option>
          <option value="timed">Chronométrée</option>
        </select>
      </div>
      {s.sessionMode === 'count' ? (
        <div className="field">
          <label htmlFor="count">Notes par session</label>
          <select id="count" value={s.sessionCount} onChange={(e) => s.set({ sessionCount: Number(e.target.value) })}>
            {[10, 20, 30, 50].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      ) : (
        <div className="field">
          <label htmlFor="secs">Durée</label>
          <select id="secs" value={s.sessionSeconds} onChange={(e) => s.set({ sessionSeconds: Number(e.target.value) })}>
            {[30, 60, 120, 300].map((n) => <option key={n} value={n}>{n < 120 ? `${n} s` : `${n / 60} min`}</option>)}
          </select>
        </div>
      )}

      <h2>Cet appareil</h2>
      <p className="muted small">Réglages communs à tous les profils.</p>
      <label className="check">
        <input type="checkbox" checked={s.noteSound} onChange={(e) => s.set({ noteSound: e.target.checked })} />
        Jouer le son de la touche (notes)
      </label>
      <label className="check">
        <input type="checkbox" checked={s.tapSound} onChange={(e) => s.set({ tapSound: e.target.checked })} />
        Son à chaque frappe (rythme)
      </label>
      <h3>Calibration de la latence</h3>
      <LatencyCalibration current={s.latencyMs} onSave={(latencyMs) => s.set({ latencyMs })} />

      <h3>Affichage</h3>
      <div className="field">
        <label htmlFor="theme">Thème</label>
        <select id="theme" value={s.theme} onChange={(e) => s.set({ theme: e.target.value as Theme })}>
          <option value="auto">Automatique</option>
          <option value="light">Clair</option>
          <option value="dark">Sombre</option>
        </select>
      </div>
    </div>
  );
}
