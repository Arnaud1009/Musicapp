import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Staff } from '../components/Staff';
import { PianoKeyboard, type KeyMark } from '../components/PianoKeyboard';
import { CustomLevelEditor } from '../components/CustomLevelEditor';
import { LevelPicker, type LevelOption } from '../components/LevelPicker';
import { NoteNameButtons, type NameMark, nameKey } from '../components/NoteNameButtons';
import { CUSTOM_LEVEL_ID, NOTE_LEVELS, getNoteLevel } from '../music/noteLevels';
import {
  type NoteQuestion,
  candidatesForLevel,
  midiRangeForLevel,
  pickQuestion,
  questionKey,
} from '../music/noteGenerator';
import { type Alter, type Step, frenchName, keyName, toMidi } from '../music/pitch';
import { getAudioContext, playNote } from '../audio/audioEngine';
import { type NoteInput, useSettings } from '../store/useSettings';
import { NOTE_PASS, getProgress, useProgress } from '../store/useProgress';
import { suggestedNoteLevel } from '../store/progressLogic';

/** Réponse donnée : une touche du clavier, ou un nom de note (sans octave). */
type Given = { kind: 'key'; midi: number } | { kind: 'name'; step: Step; alter: Alter };

interface Answer {
  question: NoteQuestion;
  given: Given;
  correct: boolean;
  ms: number;
}

const givenLabel = (g: Given) => (g.kind === 'key' ? keyName(g.midi) : frenchName(g));

const INPUT_LABELS: Record<NoteInput, string> = { keyboard: 'Clavier', names: 'Noms', both: 'Les deux' };

type Phase = 'ready' | 'playing' | 'done';

export function NoteTrainer() {
  const settings = useSettings();
  const progress = useProgress();
  const level = getNoteLevel(settings.noteLevelId, settings.customLevel);
  const candidates = useMemo(() => candidatesForLevel(level), [level]);
  const [low, high] = useMemo(() => midiRangeForLevel(level), [level]);

  const [phase, setPhase] = useState<Phase>('ready');
  const [question, setQuestion] = useState<NoteQuestion | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [feedback, setFeedback] = useState<Answer | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [newlyPassed, setNewlyPassed] = useState(false);
  const shownAt = useRef(0);
  const deadline = useRef(0);
  const timer = useRef<number>();

  const nextQuestion = useCallback(
    (prev: NoteQuestion | null) => {
      const q = pickQuestion(candidates, getProgress().noteStats, prev);
      setQuestion(q);
      setFeedback(null);
      shownAt.current = performance.now();
    },
    [candidates],
  );

  const finish = useCallback(
    (all: Answer[]) => {
      setPhase('done');
      setFeedback(null);
      window.clearInterval(timer.current);
      if (all.length === 0) return;
      const correct = all.filter((a) => a.correct).length;
      const avgMs = Math.round(all.reduce((s, a) => s + a.ms, 0) / all.length);
      setNewlyPassed(progress.recordNoteSession({ levelId: level.id, total: all.length, correct, avgMs }));
    },
    [level.id, progress],
  );

  const start = () => {
    getAudioContext(); // déverrouille l'audio sur iOS
    setAnswers([]);
    setNewlyPassed(false);
    setPhase('playing');
    if (settings.sessionMode === 'timed') {
      deadline.current = performance.now() + settings.sessionSeconds * 1000;
      setTimeLeft(settings.sessionSeconds);
      window.clearInterval(timer.current);
      timer.current = window.setInterval(() => {
        setTimeLeft(Math.max(0, Math.ceil((deadline.current - performance.now()) / 1000)));
      }, 250);
    }
    nextQuestion(null);
  };

  useEffect(() => () => window.clearInterval(timer.current), []);

  // Fin de session chronométrée.
  useEffect(() => {
    if (phase === 'playing' && settings.sessionMode === 'timed' && timeLeft === 0 && !feedback) finish(answers);
  }, [phase, settings.sessionMode, timeLeft, feedback, answers, finish]);

  // Changer de niveau réinitialise la session.
  useEffect(() => {
    setPhase('ready');
    setQuestion(null);
    window.clearInterval(timer.current);
  }, [level]);

  const submit = (given: Given) => {
    if (phase !== 'playing' || !question || feedback) return;
    // Clavier : la touche (enharmonies acceptées). Nom : l'orthographe exacte, octave libre.
    const correct =
      given.kind === 'key'
        ? given.midi === toMidi(question.pitch)
        : given.step === question.pitch.step && given.alter === question.pitch.alter;
    if (settings.noteSound) {
      playNote(given.kind === 'key' ? given.midi : toMidi({ ...given, octave: question.pitch.octave }));
    }
    const answer: Answer = { question, given, correct, ms: performance.now() - shownAt.current };
    progress.recordNoteAnswer(questionKey(question), correct, answer.ms);
    const all = [...answers, answer];
    setAnswers(all);
    setFeedback(answer);
    window.setTimeout(
      () => {
        const timeUp = settings.sessionMode === 'timed' && performance.now() >= deadline.current;
        const countReached = settings.sessionMode === 'count' && all.length >= settings.sessionCount;
        if (timeUp || countReached) finish(all);
        else nextQuestion(question);
      },
      correct ? 350 : 1400,
    );
  };

  const marks: Record<number, KeyMark> = {};
  const nameMarks: Record<string, NameMark> = {};
  if (feedback) {
    const q = feedback.question.pitch;
    marks[toMidi(q)] = 'correct';
    nameMarks[nameKey(q.step, q.alter)] = 'correct';
    if (!feedback.correct) {
      const g = feedback.given;
      if (g.kind === 'key') marks[g.midi] = 'wrong';
      else nameMarks[nameKey(g.step, g.alter)] = 'wrong';
    }
  }
  const input = settings.noteInput;
  const showKeyboard = input !== 'names';
  const showNames = input !== 'keyboard';

  const feedbackText = (() => {
    if (!feedback) return ' ';
    const q = feedback.question.pitch;
    if (feedback.correct) return `${frenchName(q)} ✓`;
    const g = feedback.given;
    if (g.kind === 'key' && (g.midi - toMidi(q)) % 12 === 0) {
      return `Bonne note, mauvaise octave : ${frenchName(q)} ${g.midi > toMidi(q) ? 'plus grave' : 'plus aigu'}`;
    }
    return `C’était ${frenchName(q)} (vous avez ${g.kind === 'key' ? 'joué' : 'répondu'} ${givenLabel(g)})`;
  })();

  const correctCount = answers.filter((a) => a.correct).length;
  const levelOptions: LevelOption[] = [
    ...NOTE_LEVELS.map((l, i) => {
      const b = progress.noteBest[l.id];
      return {
        id: l.id,
        badge: String(i + 1),
        title: l.title,
        description: l.description,
        best: b ? `${Math.round(b.accuracy * 100)} %` : undefined,
        passed: b?.passed,
      };
    }),
    {
      id: CUSTOM_LEVEL_ID,
      badge: '★',
      title: 'Personnalisé',
      description: 'Choisissez vous-même les clés, la plage et les altérations.',
      best: progress.noteBest[CUSTOM_LEVEL_ID] ? `${Math.round(progress.noteBest[CUSTOM_LEVEL_ID].accuracy * 100)} %` : undefined,
    },
  ];
  const staffColor = feedback ? (feedback.correct ? '#1f9d55' : '#d64545') : undefined;

  return (
    <div className="page trainer">
      <div className="toolbar">
        <LevelPicker
          options={levelOptions}
          value={settings.noteLevelId}
          onChange={(noteLevelId) => settings.set({ noteLevelId })}
          suggestedId={suggestedNoteLevel(progress.noteBest)}
          disabled={phase === 'playing'}
        />
        <div className="segmented" role="group" aria-label="Mode de réponse">
          {(['keyboard', 'names', 'both'] as NoteInput[]).map((m) => (
            <button
              key={m}
              type="button"
              className={m === input ? 'active' : ''}
              aria-pressed={m === input}
              onClick={() => settings.set({ noteInput: m })}
            >
              {INPUT_LABELS[m]}
            </button>
          ))}
        </div>
        {phase === 'playing' && (
          <div className="score-pill">
            {settings.sessionMode === 'timed' ? `${timeLeft} s · ` : `${answers.length}/${settings.sessionCount} · `}
            {correctCount} ✓
          </div>
        )}
      </div>

      {phase === 'ready' && (
        <div className="card intro">
          <p className="muted">{level.description}</p>
          {level.id === CUSTOM_LEVEL_ID && (
            <CustomLevelEditor level={settings.customLevel} onChange={(customLevel) => settings.set({ customLevel })} />
          )}
          <p className="muted small">
            {settings.sessionMode === 'timed'
              ? `Session chronométrée de ${settings.sessionSeconds} secondes.`
              : `Session de ${settings.sessionCount} notes.`}{' '}
            {input === 'names'
              ? 'Touchez le nom de la note affichée.'
              : input === 'both'
                ? 'Touchez la touche (à la bonne octave) ou le nom de la note affichée.'
                : 'Touchez la touche correspondant à la note affichée, à la bonne octave.'}
          </p>
          <button className="primary big" onClick={start} disabled={candidates.length === 0}>
            Commencer
          </button>
        </div>
      )}

      {phase === 'playing' && (
        <>
          <Staff level={level} question={question} color={staffColor} />
          <div className={`feedback ${feedback ? (feedback.correct ? 'ok' : 'ko') : ''}`} aria-live="polite">
            {feedbackText}
          </div>
        </>
      )}

      {phase === 'done' && (
        <NoteSummary
          answers={answers}
          newlyPassed={newlyPassed}
          onRestart={start}
          onNextLevel={() => {
            const i = NOTE_LEVELS.findIndex((l) => l.id === level.id);
            if (i >= 0 && i < NOTE_LEVELS.length - 1) settings.set({ noteLevelId: NOTE_LEVELS[i + 1].id });
          }}
          isLastLevel={level.id === NOTE_LEVELS[NOTE_LEVELS.length - 1].id || level.id === CUSTOM_LEVEL_ID}
        />
      )}

      <div className="keyboard-dock">
        {showNames && (
          <NoteNameButtons
            accidentals={level.accidentals}
            onPress={(step, alter) => submit({ kind: 'name', step, alter })}
            marks={nameMarks}
            disabled={phase !== 'playing'}
          />
        )}
        {showKeyboard && (
          <PianoKeyboard
            low={low}
            high={high}
            onPress={(midi) => submit({ kind: 'key', midi })}
            marks={marks}
            labels={settings.keyLabels}
            disabled={phase !== 'playing'}
          />
        )}
      </div>
    </div>
  );
}

function NoteSummary({
  answers,
  newlyPassed,
  onRestart,
  onNextLevel,
  isLastLevel,
}: {
  answers: Answer[];
  newlyPassed: boolean;
  onRestart: () => void;
  onNextLevel: () => void;
  isLastLevel: boolean;
}) {
  const correct = answers.filter((a) => a.correct).length;
  const accuracy = answers.length ? correct / answers.length : 0;
  const avg = answers.length ? answers.reduce((s, a) => s + a.ms, 0) / answers.length : 0;
  const mistakes = answers.filter((a) => !a.correct);
  const passed = answers.length >= NOTE_PASS.minNotes && accuracy >= NOTE_PASS.accuracy && avg <= NOTE_PASS.avgMs;

  return (
    <div className="card summary">
      <div className="stats-row">
        <div className="stat">
          <span className="stat-value">{Math.round(accuracy * 100)} %</span>
          <span className="stat-label">réussite</span>
        </div>
        <div className="stat">
          <span className="stat-value">{(avg / 1000).toFixed(1)} s</span>
          <span className="stat-label">par note</span>
        </div>
        <div className="stat">
          <span className="stat-value">{answers.length}</span>
          <span className="stat-label">notes</span>
        </div>
      </div>
      {newlyPassed && <p className="success">🎉 Niveau réussi !</p>}
      {!passed && (
        <p className="muted small">
          Pour valider le niveau : au moins {NOTE_PASS.minNotes} notes, {NOTE_PASS.accuracy * 100} % de réussite et moins
          de {NOTE_PASS.avgMs / 1000} s par note.
        </p>
      )}
      {mistakes.length > 0 && (
        <details>
          <summary>{mistakes.length} erreur(s)</summary>
          <ul className="mistakes">
            {mistakes.map((m, i) => (
              <li key={i}>
                {frenchName(m.question.pitch)} ({m.question.clef === 'treble' ? 'clé de sol' : 'clé de fa'}) —{' '}
                {m.given.kind === 'key' ? 'joué' : 'répondu'} : {givenLabel(m.given)}
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="actions">
        <button className="primary" onClick={onRestart}>
          Recommencer
        </button>
        {passed && !isLastLevel && <button onClick={onNextLevel}>Niveau suivant →</button>}
      </div>
    </div>
  );
}
