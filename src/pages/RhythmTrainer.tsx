import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RhythmStaff, type EventResult } from '../components/RhythmStaff';
import { TapPad } from '../components/TapPad';
import { LevelPicker, type LevelOption } from '../components/LevelPicker';
import { RHYTHM_LEVELS, beatTicks, beatsPerMeasure, getRhythmLevel } from '../rhythm/rhythmLevels';
import { type Rhythm, generateRhythm, onsets, totalTicks } from '../rhythm/rhythmGenerator';
import { type RhythmScore, scoreTaps, windowsForTempo } from '../rhythm/scoring';
import {
  type Playback,
  type ScheduledEvent,
  audibleTime,
  eventToAudioTime,
  getAudioContext,
  playTap,
  schedule,
} from '../audio/audioEngine';
import { getSettings, useSettings } from '../store/useSettings';
import { RHYTHM_PASS, useProgress } from '../store/useProgress';
import { suggestedRhythmLevel } from '../store/progressLogic';

type Phase = 'idle' | 'listening' | 'countin' | 'playing' | 'done';

interface Run {
  start: number;
  secPerTick: number;
  playback: Playback;
  timers: number[];
}

export function RhythmTrainer() {
  const settings = useSettings();
  const progress = useProgress();
  const level = getRhythmLevel(settings.rhythmLevelId);
  const tempo = settings.rhythmTempo;

  const [rhythm, setRhythm] = useState<Rhythm>(() => generateRhythm(level, settings.rhythmMeasures));
  const [phase, setPhase] = useState<Phase>('idle');
  const [score, setScore] = useState<RhythmScore | null>(null);
  const [results, setResults] = useState<Record<string, EventResult> | undefined>();
  const [tapMarks, setTapMarks] = useState<{ tick: number; extra: boolean }[] | undefined>();
  const [clock, setClock] = useState<(() => number | null) | null>(null);
  const [newlyPassed, setNewlyPassed] = useState(false);
  const run = useRef<Run | null>(null);
  const taps = useRef<number[]>([]);

  const stop = useCallback(() => {
    if (!run.current) return;
    run.current.playback.stop();
    run.current.timers.forEach((t) => window.clearTimeout(t));
    run.current = null;
    setClock(null);
  }, []);

  useEffect(() => stop, [stop]);

  const newRhythm = useCallback(() => {
    stop();
    setRhythm(generateRhythm(getRhythmLevel(getSettings().rhythmLevelId), getSettings().rhythmMeasures));
    setPhase('idle');
    setScore(null);
    setResults(undefined);
    setTapMarks(undefined);
  }, [stop]);

  useEffect(() => {
    newRhythm();
  }, [settings.rhythmLevelId, settings.rhythmMeasures, newRhythm]);

  const expectedOnsets = useMemo(() => onsets(rhythm), [rhythm]);

  const finish = useCallback(
    (secPerTick: number) => {
      const expected = expectedOnsets.map((o) => o.tick * secPerTick);
      const s = scoreTaps(expected, taps.current, windowsForTempo(tempo));
      const res: Record<string, EventResult> = {};
      expectedOnsets.forEach((o, i) => {
        const h = s.hits[i];
        res[`${o.measure}:${o.index}`] = {
          rating: h.rating,
          offsetMs: h.offset === null ? null : Math.round(h.offset * 1000),
        };
      });
      const extras = new Set(s.extras);
      setTapMarks(taps.current.map((t) => ({ tick: t / secPerTick, extra: extras.has(t) })));
      setResults(res);
      setScore(s);
      setPhase('done');
      setNewlyPassed(progress.recordRhythmSession({ levelId: level.id, tempo, score: s.score }));
      stop();
    },
    [expectedOnsets, tempo, progress, level.id, stop],
  );

  const play = (mode: 'listen' | 'exercise') => {
    stop();
    const c = getAudioContext();
    const ts = rhythm.timeSig;
    const beats = beatsPerMeasure(ts);
    const beatSec = 60 / tempo;
    const secPerTick = beatSec / beatTicks(ts);
    const countBeats = beats < 3 ? beats * 2 : beats;
    const t0 = c.currentTime + 0.3;
    const start = t0 + countBeats * beatSec;
    const end = start + totalTicks(rhythm) * secPerTick;

    const events: ScheduledEvent[] = [];
    for (let i = 0; i < countBeats; i++) events.push({ time: t0 + i * beatSec, kind: i % beats === 0 ? 'accent' : 'click' });
    if (mode === 'listen' || settings.metronomeDuringExercise) {
      const total = beats * rhythm.measures.length;
      for (let i = 0; i < total; i++) events.push({ time: start + i * beatSec, kind: i % beats === 0 ? 'accent' : 'click' });
    }
    if (mode === 'listen') {
      expectedOnsets.forEach((o) => {
        const ev = rhythm.measures[o.measure].events[o.index];
        events.push({ time: start + o.tick * secPerTick, kind: 'note', duration: Math.min(0.35, ev.ticks * secPerTick * 0.9) });
      });
    }

    taps.current = [];
    setScore(null);
    setResults(undefined);
    setTapMarks(undefined);
    setNewlyPassed(false);

    const playback = schedule(events);
    const msUntil = (t: number) => Math.max(0, (t - c.currentTime) * 1000);
    const timers: number[] = [];
    if (mode === 'exercise') {
      setPhase('countin');
      timers.push(window.setTimeout(() => setPhase('playing'), msUntil(start)));
      timers.push(window.setTimeout(() => finish(secPerTick), msUntil(end) + 450));
    } else {
      setPhase('listening');
      timers.push(
        window.setTimeout(() => {
          stop();
          setPhase('idle');
        }, msUntil(end) + 300),
      );
    }
    run.current = { start, secPerTick, playback, timers };
    setClock(() => () => (audibleTime() - start) / secPerTick);
  };

  const onTap = useCallback(
    (timeStamp: number) => {
      const r = run.current;
      if (!r) return;
      if (getSettings().tapSound) playTap();
      const t = eventToAudioTime(timeStamp) - r.start - getSettings().latencyMs / 1000;
      if (t > -0.25) taps.current.push(t);
    },
    [],
  );

  const exercising = phase === 'countin' || phase === 'playing';

  return (
    <div className="page trainer">
      <div className="toolbar">
        <LevelPicker
          options={RHYTHM_LEVELS.map((l, i): LevelOption => {
            const b = progress.rhythmBest[l.id];
            return {
              id: l.id,
              badge: String(i + 1),
              title: l.title,
              description: l.description,
              best: b ? `${b.score} pts` : undefined,
              passed: b?.passed,
            };
          })}
          value={settings.rhythmLevelId}
          onChange={(id) => settings.set({ rhythmLevelId: id, rhythmTempo: getRhythmLevel(id).defaultTempo })}
          suggestedId={suggestedRhythmLevel(progress.rhythmBest)}
          disabled={exercising}
        />
        <select
          value={settings.rhythmMeasures}
          onChange={(e) => settings.set({ rhythmMeasures: Number(e.target.value) })}
          aria-label="Nombre de mesures"
          disabled={exercising}
        >
          {[1, 2, 4].map((n) => (
            <option key={n} value={n}>
              {n} mesure{n > 1 ? 's' : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="tempo-row">
        <label htmlFor="tempo">♩ = {tempo}</label>
        <input
          id="tempo"
          type="range"
          min={40}
          max={160}
          step={2}
          value={tempo}
          disabled={exercising}
          onChange={(e) => settings.set({ rhythmTempo: Number(e.target.value) })}
        />
        <label className="check small">
          <input
            type="checkbox"
            checked={settings.metronomeDuringExercise}
            onChange={(e) => settings.set({ metronomeDuringExercise: e.target.checked })}
          />
          Métronome
        </label>
      </div>

      <p className="muted small">{level.description}</p>

      <RhythmStaff rhythm={rhythm} results={results} taps={tapMarks} clock={clock} />

      <div className="status-line" aria-live="polite">
        {phase === 'countin' && 'Décompte…'}
        {phase === 'playing' && 'À vous !'}
        {phase === 'listening' && 'Écoute…'}
        {phase === 'done' && score && <RhythmSummary score={score} newlyPassed={newlyPassed} />}
      </div>

      <div className="actions">
        {exercising || phase === 'listening' ? (
          <button
            onClick={() => {
              stop();
              setPhase('idle');
            }}
          >
            Arrêter
          </button>
        ) : (
          <>
            <button className="primary" onClick={() => play('exercise')}>
              {phase === 'done' ? 'Réessayer' : 'Jouer'}
            </button>
            <button onClick={() => play('listen')}>Écouter</button>
            <button onClick={newRhythm}>Nouveau rythme</button>
          </>
        )}
      </div>

      <TapPad active={exercising} onTap={onTap} />
    </div>
  );
}

function RhythmSummary({ score, newlyPassed }: { score: RhythmScore; newlyPassed: boolean }) {
  const tendencyMs = Math.round(score.meanOffset * 1000);
  return (
    <div className="rhythm-summary">
      <div className="stats-row">
        <div className="stat">
          <span className="stat-value">{score.score}</span>
          <span className="stat-label">score</span>
        </div>
        <div className="stat">
          <span className="stat-value perfect">{score.perfect}</span>
          <span className="stat-label">parfait</span>
        </div>
        <div className="stat">
          <span className="stat-value good">{score.good}</span>
          <span className="stat-label">bien</span>
        </div>
        <div className="stat">
          <span className="stat-value miss">{score.missed + score.extras.length}</span>
          <span className="stat-label">erreurs</span>
        </div>
      </div>
      <p className="muted small">
        {score.extras.length > 0 && `${score.extras.length} frappe(s) en trop. `}
        {Math.abs(tendencyMs) >= 15 &&
          `Tendance : ${tendencyMs > 0 ? 'en retard' : 'en avance'} de ${Math.abs(tendencyMs)} ms en moyenne. `}
        {score.score < RHYTHM_PASS.score && `Objectif pour valider le niveau : ${RHYTHM_PASS.score}.`}
      </p>
      {newlyPassed && <p className="success">🎉 Niveau réussi ! Le niveau suivant est débloqué.</p>}
    </div>
  );
}
