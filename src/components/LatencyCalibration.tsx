import { useCallback, useEffect, useRef, useState } from 'react';
import { type Playback, type ScheduledEvent, eventToAudioTime, getAudioContext, schedule } from '../audio/audioEngine';
import { TapPad } from './TapPad';

const BPM = 90;
const COUNT_IN = 4;
const CLICKS = 8;

interface Props {
  current: number;
  onSave: (ms: number) => void;
}

/** Mesure le décalage entre le clic entendu et la frappe (écran, haut-parleurs, Bluetooth…). */
export function LatencyCalibration({ current, onSave }: Props) {
  const [running, setRunning] = useState(false);
  const [measured, setMeasured] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const clicks = useRef<number[]>([]);
  const taps = useRef<number[]>([]);
  const playback = useRef<Playback | null>(null);
  const timer = useRef<number>();

  useEffect(() => () => { playback.current?.stop(); window.clearTimeout(timer.current); }, []);

  const start = () => {
    const c = getAudioContext();
    const beat = 60 / BPM;
    const t0 = c.currentTime + 0.3;
    const events: ScheduledEvent[] = [];
    clicks.current = [];
    taps.current = [];
    for (let i = 0; i < COUNT_IN + CLICKS; i++) {
      const time = t0 + i * beat;
      events.push({ time, kind: i < COUNT_IN ? 'accent' : 'click' });
      if (i >= COUNT_IN) clicks.current.push(time);
    }
    playback.current = schedule(events);
    setRunning(true);
    setMeasured(null);
    setError(null);
    timer.current = window.setTimeout(() => {
      setRunning(false);
      const offsets = clicks.current
        .map((ct) => {
          const near = taps.current.filter((t) => Math.abs(t - ct) < beat / 2);
          return near.length ? near.reduce((a, b) => (Math.abs(a - ct) < Math.abs(b - ct) ? a : b)) - ct : null;
        })
        .filter((x): x is number => x !== null)
        .sort((a, b) => a - b);
      if (offsets.length < CLICKS / 2) {
        setError('Pas assez de frappes détectées, réessayez.');
        return;
      }
      setMeasured(Math.round(offsets[Math.floor(offsets.length / 2)] * 1000));
    }, (COUNT_IN + CLICKS) * beat * 1000 + 700);
  };

  const onTap = useCallback((ts: number) => taps.current.push(eventToAudioTime(ts)), []);

  return (
    <div className="calibration">
      <p className="muted small">
        Écoutez 4 clics de décompte puis tapez en même temps que les 8 clics suivants. Le décalage mesuré sera
        compensé dans les exercices de rythme. Valeur actuelle : <strong>{current} ms</strong>.
      </p>
      {running ? (
        <TapPad active onTap={onTap} label="Tapez sur chaque clic" />
      ) : (
        <div className="actions">
          <button onClick={start}>Lancer la calibration</button>
          {measured !== null && (
            <>
              <span>Mesuré : <strong>{measured} ms</strong></span>
              <button className="primary" onClick={() => onSave(measured)}>Enregistrer</button>
            </>
          )}
          {current !== 0 && <button onClick={() => onSave(0)}>Remettre à 0</button>}
        </div>
      )}
      {error && <p className="error small">{error}</p>}
    </div>
  );
}
