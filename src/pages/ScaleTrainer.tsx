import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScaleStaff } from '../components/ScaleStaff';
import { PianoKeyboard, type KeyMark } from '../components/PianoKeyboard';
import { LevelPicker, type LevelOption } from '../components/LevelPicker';
import { type Clef, type Pitch, toMidi } from '../music/pitch';
import {
  type ScaleKey,
  distractors,
  sameKey,
  scaleMeasures,
  scaleMidiRange,
  scaleName,
  shuffle,
} from '../scales/scales';
import {
  SCALE_LEVELS,
  SCALE_SESSION_LENGTH,
  type ScaleLevel,
  type ScaleMode,
  getScaleLevel,
  keysForLevel,
} from '../scales/scaleLevels';
import { getAudioContext, playNote, schedule, type Playback } from '../audio/audioEngine';
import { useSettings } from '../store/useSettings';
import { SCALE_PASS, useProgress } from '../store/useProgress';
import { scaleBestKey, suggestedScaleLevel } from '../store/progressLogic';

type Phase = 'ready' | 'playing' | 'done';

interface Question {
  key: ScaleKey;
  clef: Clef;
  measures: Pitch[][];
  /** Choix proposés (exercice « reconnaître »). */
  options: ScaleKey[];
}

interface Outcome {
  key: ScaleKey;
  /** Jouer : notes réussies du premier coup / total. Reconnaître : 1/1 ou 0/1. */
  correct: number;
  total: number;
  ms: number;
  chosen?: ScaleKey;
}

const COLORS = { current: '#4a6cf7', ok: '#1f9d55', fixed: '#d48806' };

/** Plage du clavier commune à toutes les gammes du niveau pour une clé (positions stables). */
function keyboardRange(level: ScaleLevel, clef: Clef): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const key of keysForLevel(level)) {
    const [a, b] = scaleMidiRange(scaleMeasures(key, clef, 'up'));
    lo = Math.min(lo, a);
    hi = Math.max(hi, b);
  }
  return [lo, hi];
}

function newQuestion(level: ScaleLevel, prev: Question | null): Question {
  const pool = keysForLevel(level);
  const candidates = prev && pool.length > 1 ? pool.filter((k) => !sameKey(k, prev.key)) : pool;
  const key = candidates[Math.floor(Math.random() * candidates.length)];
  const clef = level.clefs[Math.floor(Math.random() * level.clefs.length)];
  return {
    key,
    clef,
    measures: scaleMeasures(key, clef, level.direction),
    options: shuffle([key, ...distractors(key, pool)], Math.random),
  };
}

export function ScaleTrainer() {
  const settings = useSettings();
  const progress = useProgress();
  const level = getScaleLevel(settings.scaleLevelId);
  const mode = settings.scaleMode;
  const sessionLength = SCALE_SESSION_LENGTH[mode];

  const [phase, setPhase] = useState<Phase>('ready');
  const [question, setQuestion] = useState<Question | null>(null);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [newlyPassed, setNewlyPassed] = useState(false);
  // Jouer : progression dans la gamme.
  const [noteIndex, setNoteIndex] = useState(0);
  const [noteResults, setNoteResults] = useState<('ok' | 'fixed')[]>([]);
  const [errorsOnNote, setErrorsOnNote] = useState(0);
  const [wrongKey, setWrongKey] = useState<number | null>(null);
  // Reconnaître : réponse choisie.
  const [chosen, setChosen] = useState<ScaleKey | null>(null);
  const shownAt = useRef(0);
  const noteShownAt = useRef(0);
  const noteTimes = useRef<number[]>([]);
  const timers = useRef<number[]>([]);
  const playback = useRef<Playback | null>(null);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

  const flat = useMemo(() => question?.measures.flat() ?? [], [question]);

  const ask = useCallback(
    (prev: Question | null) => {
      setQuestion(newQuestion(level, prev));
      setNoteIndex(0);
      setNoteResults([]);
      setErrorsOnNote(0);
      setWrongKey(null);
      setChosen(null);
      noteTimes.current = [];
      shownAt.current = performance.now();
      noteShownAt.current = performance.now();
    },
    [level],
  );

  const finish = useCallback(
    (all: Outcome[]) => {
      clearTimers();
      setPhase('done');
      const total = all.reduce((s, o) => s + o.total, 0);
      const correct = all.reduce((s, o) => s + o.correct, 0);
      const avgMs = Math.round(all.reduce((s, o) => s + o.ms, 0) / Math.max(1, total));
      setNewlyPassed(progress.recordScaleSession({ mode, levelId: level.id, total, correct, avgMs }));
    },
    [progress, mode, level.id],
  );

  const next = (all: Outcome[]) => {
    if (all.length >= sessionLength) finish(all);
    else ask(question);
  };

  const start = () => {
    getAudioContext();
    clearTimers();
    setOutcomes([]);
    setNewlyPassed(false);
    setPhase('playing');
    ask(null);
  };

  // Changer de niveau ou d'exercice réinitialise la session.
  useEffect(() => {
    clearTimers();
    playback.current?.stop();
    setPhase('ready');
    setQuestion(null);
  }, [level, mode]);

  useEffect(
    () => () => {
      clearTimers();
      playback.current?.stop();
    },
    [],
  );

  const listen = () => {
    if (!question) return;
    playback.current?.stop();
    const c = getAudioContext();
    const t0 = c.currentTime + 0.1;
    const step = 0.32;
    playback.current = schedule(
      question.measures.flat().map((p, i) => ({ time: t0 + i * step, kind: 'note' as const, midi: toMidi(p), duration: 0.45 })),
    );
  };

  // --- Exercice « jouer la gamme écrite » ---
  const onPress = (midi: number) => {
    if (phase !== 'playing' || !question || noteIndex >= flat.length) return;
    if (settings.noteSound) playNote(midi, 0.8);
    const expected = toMidi(flat[noteIndex]);
    if (midi !== expected) {
      setErrorsOnNote((e) => e + 1);
      setWrongKey(midi);
      later(() => setWrongKey(null), 500);
      return;
    }
    noteTimes.current.push(performance.now() - noteShownAt.current);
    noteShownAt.current = performance.now();
    const results = [...noteResults, errorsOnNote === 0 ? ('ok' as const) : ('fixed' as const)];
    setNoteResults(results);
    setNoteIndex(noteIndex + 1);
    setErrorsOnNote(0);
    setWrongKey(null);
    if (results.length === flat.length) {
      const outcome: Outcome = {
        key: question.key,
        correct: results.filter((r) => r === 'ok').length,
        total: results.length,
        ms: noteTimes.current.reduce((a, b) => a + b, 0),
      };
      const all = [...outcomes, outcome];
      setOutcomes(all);
      later(() => next(all), 1800);
    }
  };

  // --- Exercice « reconnaître la gamme » ---
  const onChoose = (option: ScaleKey) => {
    if (!question || chosen) return;
    setChosen(option);
    const ok = sameKey(option, question.key);
    const outcome: Outcome = {
      key: question.key,
      correct: ok ? 1 : 0,
      total: 1,
      ms: performance.now() - shownAt.current,
      chosen: option,
    };
    const all = [...outcomes, outcome];
    setOutcomes(all);
    if (ok) later(() => next(all), 900);
  };

  const colors = useMemo(
    () =>
      flat.map((_, i) =>
        i < noteResults.length ? COLORS[noteResults[i]] : mode === 'play' && i === noteIndex ? COLORS.current : undefined,
      ),
    [flat, noteResults, noteIndex, mode],
  );

  const [low, high] = useMemo(
    () => keyboardRange(level, question?.clef ?? level.clefs[0]),
    [level, question?.clef],
  );
  const marks: Record<number, KeyMark> = {};
  if (wrongKey !== null) marks[wrongKey] = 'wrong';
  if (question && noteIndex < flat.length && errorsOnNote >= 2) marks[toMidi(flat[noteIndex])] = 'hint';

  const scaleDone = mode === 'play' && question !== null && noteIndex >= flat.length && flat.length > 0;

  const levelOptions: LevelOption[] = SCALE_LEVELS.map((l, i) => {
    const b = progress.scaleBest[scaleBestKey(mode, l.id)];
    return {
      id: l.id,
      badge: String(i + 1),
      title: l.title,
      description: l.description,
      best: b ? `${Math.round(b.accuracy * 100)} %` : undefined,
      passed: b?.passed,
    };
  });

  return (
    <div className="page trainer">
      <div className="toolbar">
        <LevelPicker
          options={levelOptions}
          value={level.id}
          onChange={(scaleLevelId) => settings.set({ scaleLevelId })}
          suggestedId={suggestedScaleLevel(progress.scaleBest, mode)}
        />
        <div className="segmented" role="group" aria-label="Exercice">
          {(['play', 'recognize'] as ScaleMode[]).map((m) => (
            <button
              key={m}
              type="button"
              className={m === mode ? 'active' : ''}
              aria-pressed={m === mode}
              onClick={() => settings.set({ scaleMode: m })}
            >
              {m === 'play' ? 'Jouer' : 'Reconnaître'}
            </button>
          ))}
        </div>
        {phase === 'playing' && (
          <div className="score-pill">
            {Math.min(outcomes.length + 1, sessionLength)}/{sessionLength}
          </div>
        )}
      </div>

      {phase === 'ready' && (
        <div className="card intro">
          <p className="muted">{level.description}</p>
          <p className="muted small">
            {mode === 'play'
              ? `Jouez au clavier, note par note, les ${sessionLength} gammes écrites sur la portée. La note à jouer est en bleu ; après deux erreurs, la bonne touche est indiquée.`
              : `Identifiez ${sessionLength} gammes écrites sur la portée, parmi quatre propositions.`}
          </p>
          <button className="primary big" onClick={start}>
            Commencer
          </button>
        </div>
      )}

      {phase === 'playing' && question && (
        <>
          <ScaleStaff scaleKey={question.key} clef={question.clef} measures={question.measures} colors={colors} />

          {mode === 'play' && (
            <div className={`feedback ${scaleDone ? 'ok' : ''}`} aria-live="polite">
              {scaleDone
                ? `${scaleName(question.key)} ✓ — ${noteResults.filter((r) => r === 'ok').length}/${flat.length} du premier coup`
                : errorsOnNote > 0
                  ? `Pas tout à fait… ${errorsOnNote >= 2 ? 'la bonne touche est indiquée.' : 'réessayez.'}`
                  : ' '}
            </div>
          )}

          {mode === 'recognize' && (
            <>
              <div className="choices">
                {question.options.map((o) => {
                  const isAnswer = sameKey(o, question.key);
                  const state = chosen ? (isAnswer ? 'ok' : chosen && sameKey(o, chosen) ? 'ko' : '') : '';
                  return (
                    <button key={scaleName(o)} type="button" className={`choice ${state}`} onClick={() => onChoose(o)} disabled={Boolean(chosen)}>
                      {scaleName(o)}
                    </button>
                  );
                })}
              </div>
              <div className="actions">
                <button onClick={listen}>Écouter la gamme</button>
                {chosen && !sameKey(chosen, question.key) && (
                  <button className="primary" onClick={() => next(outcomes)}>
                    Suivante →
                  </button>
                )}
              </div>
            </>
          )}
        </>
      )}

      {phase === 'done' && (
        <ScaleSummary mode={mode} outcomes={outcomes} newlyPassed={newlyPassed} onRestart={start} />
      )}

      {mode === 'play' && (
        <div className="keyboard-dock">
          <PianoKeyboard
            low={low}
            high={high}
            onPress={onPress}
            marks={marks}
            labels={settings.keyLabels}
            disabled={phase !== 'playing' || scaleDone}
          />
        </div>
      )}
    </div>
  );
}

function ScaleSummary({
  mode,
  outcomes,
  newlyPassed,
  onRestart,
}: {
  mode: ScaleMode;
  outcomes: Outcome[];
  newlyPassed: boolean;
  onRestart: () => void;
}) {
  const total = outcomes.reduce((s, o) => s + o.total, 0);
  const correct = outcomes.reduce((s, o) => s + o.correct, 0);
  const accuracy = total ? correct / total : 0;
  const avgSec = outcomes.reduce((s, o) => s + o.ms, 0) / Math.max(1, total) / 1000;

  return (
    <div className="card summary">
      <div className="stats-row">
        <div className="stat">
          <span className="stat-value">{Math.round(accuracy * 100)} %</span>
          <span className="stat-label">{mode === 'play' ? 'notes du premier coup' : 'bonnes réponses'}</span>
        </div>
        <div className="stat">
          <span className="stat-value">{avgSec.toFixed(1)} s</span>
          <span className="stat-label">{mode === 'play' ? 'par note' : 'par gamme'}</span>
        </div>
      </div>
      {newlyPassed && <p className="success">🎉 Niveau réussi !</p>}
      {accuracy < SCALE_PASS.accuracy && (
        <p className="muted small">Pour valider le niveau : {SCALE_PASS.accuracy * 100} % de réussite.</p>
      )}
      <ul className="mistakes">
        {outcomes.map((o, i) => (
          <li key={i}>
            {mode === 'play'
              ? `${scaleName(o.key)} — ${o.correct}/${o.total}`
              : o.correct
                ? `${scaleName(o.key)} ✓`
                : `${scaleName(o.key)} — vous avez répondu ${o.chosen ? scaleName(o.chosen) : '?'}`}
          </li>
        ))}
      </ul>
      <div className="actions">
        <button className="primary" onClick={onRestart}>
          Recommencer
        </button>
      </div>
    </div>
  );
}

