import { useState } from 'react';
import { NOTE_LEVELS } from '../music/noteLevels';
import { RHYTHM_LEVELS } from '../rhythm/rhythmLevels';
import { SCALE_LEVELS } from '../scales/scaleLevels';
import { scaleBestKey } from '../store/progressLogic';
import { frenchName, parsePitch } from '../music/pitch';
import { useProgress } from '../store/useProgress';
import { ProfileSwitcher } from '../components/Profiles';
import { useActiveProfile } from '../store/useProfiles';

function noteLevelLabel(id: string) {
  const i = NOTE_LEVELS.findIndex((l) => l.id === id);
  return i >= 0 ? `niveau ${i + 1}` : 'personnalisé';
}

const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function Stats() {
  const { noteBest, rhythmBest, scaleBest, noteStats, history, reset } = useProgress();
  const [confirmReset, setConfirmReset] = useState(false);
  const profile = useActiveProfile();

  const hardest = Object.entries(noteStats)
    .filter(([, s]) => s.attempts >= 3 && s.errors > 0)
    .map(([key, s]) => ({ key, rate: s.errors / s.attempts, avg: s.totalMs / s.attempts }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 10);

  const label = (key: string) => {
    const [clef, id] = key.split(':');
    const p = parsePitch(id);
    return `${frenchName(p)}${p.octave} · ${clef === 'treble' ? 'sol' : 'fa'}`;
  };

  return (
    <div className="page stats">
      <div className="home-header">
        <h1>Progrès de {profile.name}</h1>
        <ProfileSwitcher />
      </div>
      <h2>Lecture de notes</h2>
      <table className="table">
        <thead>
          <tr><th>Niveau</th><th>Meilleure réussite</th><th>Temps</th><th /></tr>
        </thead>
        <tbody>
          {NOTE_LEVELS.map((l, i) => {
            const b = noteBest[l.id];
            return (
              <tr key={l.id}>
                <td>{i + 1}. {l.title}</td>
                <td>{b ? `${Math.round(b.accuracy * 100)} %` : '—'}</td>
                <td>{b ? `${(b.avgMs / 1000).toFixed(1)} s` : '—'}</td>
                <td>{b?.passed ? '✓' : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {hardest.length > 0 && (
        <>
          <h3>Notes à retravailler</h3>
          <ul className="chips">
            {hardest.map((h) => (
              <li key={h.key} className="chip">
                {label(h.key)} <span className="muted">{Math.round(h.rate * 100)} % d’erreurs</span>
              </li>
            ))}
          </ul>
          <p className="muted small">Ces notes apparaissent plus souvent dans vos sessions.</p>
        </>
      )}

      <h2>Lecture de rythme</h2>
      <table className="table">
        <thead>
          <tr><th>Niveau</th><th>Meilleur score</th><th>Tempo</th><th /></tr>
        </thead>
        <tbody>
          {RHYTHM_LEVELS.map((l, i) => {
            const b = rhythmBest[l.id];
            return (
              <tr key={l.id}>
                <td>{i + 1}. {l.title}</td>
                <td>{b ? b.score : '—'}</td>
                <td>{b ? `♩ = ${b.tempo}` : '—'}</td>
                <td>{b?.passed ? '✓' : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h2>Lecture de gammes</h2>
      <table className="table">
        <thead>
          <tr><th>Niveau</th><th>Jouer</th><th>Reconnaître</th></tr>
        </thead>
        <tbody>
          {SCALE_LEVELS.map((l, i) => {
            const cell = (mode: 'play' | 'recognize') => {
              const b = scaleBest[scaleBestKey(mode, l.id)];
              return b ? `${Math.round(b.accuracy * 100)} %${b.passed ? ' ✓' : ''}` : '—';
            };
            return (
              <tr key={l.id}>
                <td>{i + 1}. {l.title}</td>
                <td>{cell('play')}</td>
                <td>{cell('recognize')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h2>Historique</h2>
      {history.length === 0 ? (
        <p className="muted">Aucune session pour l’instant.</p>
      ) : (
        <ul className="history">
          {history.slice(0, 30).map((h, i) => (
            <li key={i}>
              <span className="muted small">{dateFmt.format(h.date)}</span>{' '}
              {h.kind === 'notes'
                ? `Notes · ${noteLevelLabel(h.levelId)} · ${h.correct}/${h.total} · ${(h.avgMs / 1000).toFixed(1)} s`
                : h.kind === 'rhythm'
                  ? `Rythme · niveau ${h.levelId.replace('r', '')} · ♩ = ${h.tempo} · score ${h.score}`
                  : `Gammes (${h.mode === 'play' ? 'jouer' : 'reconnaître'}) · niveau ${h.levelId.replace('s', '')} · ${Math.round((h.correct / Math.max(1, h.total)) * 100)} %`}
            </li>
          ))}
        </ul>
      )}

      <div className="danger-zone">
        {confirmReset ? (
          <>
            <span>Effacer toute la progression de {profile.name} ?</span>
            <button className="danger" onClick={() => { reset(); setConfirmReset(false); }}>Oui, effacer</button>
            <button onClick={() => setConfirmReset(false)}>Annuler</button>
          </>
        ) : (
          <button onClick={() => setConfirmReset(true)}>Réinitialiser la progression de {profile.name}</button>
        )}
      </div>
    </div>
  );
}
