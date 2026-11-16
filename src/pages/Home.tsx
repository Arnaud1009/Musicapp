import { Link } from 'react-router-dom';
import { ProfileSwitcher } from '../components/Profiles';
import { CUSTOM_LEVEL_ID, NOTE_LEVELS } from '../music/noteLevels';
import { RHYTHM_LEVELS, getRhythmLevel } from '../rhythm/rhythmLevels';
import { useProgress } from '../store/useProgress';
import { useSettings } from '../store/useSettings';
import { SCALE_LEVELS, getScaleLevel } from '../scales/scaleLevels';
import { scaleBestKey } from '../store/progressLogic';

export function Home() {
  const { noteBest, rhythmBest, scaleBest } = useProgress();
  const { noteLevelId, rhythmLevelId, scaleLevelId, scaleMode } = useSettings();
  const scaleLevel = getScaleLevel(scaleLevelId);
  const scaleLevelLabel = `${SCALE_LEVELS.indexOf(scaleLevel) + 1}. ${scaleLevel.title}`;
  const scalesPassed = SCALE_LEVELS.filter((l) => scaleBest[scaleBestKey(scaleMode, l.id)]?.passed).length;
  const noteIndex = NOTE_LEVELS.findIndex((l) => l.id === noteLevelId);
  const noteLevelLabel =
    noteLevelId === CUSTOM_LEVEL_ID ? 'Personnalisé' : `${noteIndex + 1}. ${NOTE_LEVELS[Math.max(0, noteIndex)].title}`;
  const rhythmLevel = getRhythmLevel(rhythmLevelId);
  const rhythmLevelLabel = `${RHYTHM_LEVELS.indexOf(rhythmLevel) + 1}. ${rhythmLevel.title}`;
  const notesPassed = NOTE_LEVELS.filter((l) => noteBest[l.id]?.passed).length;
  const rhythmPassed = RHYTHM_LEVELS.filter((l) => rhythmBest[l.id]?.passed).length;

  return (
    <div className="page home">
      <div className="home-header">
        <h1>Solfège Piano</h1>
        <ProfileSwitcher />
      </div>
      <p className="muted">Quelques minutes par jour pour lire plus vite.</p>
      <div className="mode-cards">
        <Link to="/notes" className="mode-card">
          <span className="mode-icon" aria-hidden>𝄞𝄢</span>
          <span className="mode-title">Lecture de notes</span>
          <span className="mode-sub">Clés de sol et de fa, au clavier</span>
          <span className="mode-level">Niveau en cours : {noteLevelLabel}</span>
          <Progress value={notesPassed} max={NOTE_LEVELS.length} />
        </Link>
        <Link to="/rythme" className="mode-card">
          <span className="mode-icon" aria-hidden>♩♫</span>
          <span className="mode-title">Lecture de rythme</span>
          <span className="mode-sub">Tapez le rythme sur le métronome</span>
          <span className="mode-level">Niveau en cours : {rhythmLevelLabel}</span>
          <Progress value={rhythmPassed} max={RHYTHM_LEVELS.length} />
        </Link>
        <Link to="/gammes" className="mode-card">
          <span className="mode-icon" aria-hidden>♯♭</span>
          <span className="mode-title">Lecture de gammes</span>
          <span className="mode-sub">Majeures et mineures, avec armure</span>
          <span className="mode-level">
            Niveau en cours : {scaleLevelLabel} · {scaleMode === 'play' ? 'Jouer' : 'Reconnaître'}
          </span>
          <Progress value={scalesPassed} max={SCALE_LEVELS.length} />
        </Link>
      </div>
    </div>
  );
}

function Progress({ value, max }: { value: number; max: number }) {
  return (
    <span className="progress">
      <span className="progress-bar">
        <span style={{ width: `${(value / max) * 100}%` }} />
      </span>
      <span className="small muted">
        {value}/{max} niveaux
      </span>
    </span>
  );
}
