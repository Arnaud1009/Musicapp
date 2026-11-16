import { useEffect, useMemo, useRef } from 'react';
import { isBlackKey, keyName } from '../music/pitch';
import type { KeyLabels } from '../store/useSettings';
import { useElementWidth } from '../hooks/useElementWidth';

export type KeyMark = 'correct' | 'wrong' | 'hint';

interface Props {
  low: number;
  high: number;
  onPress: (midi: number) => void;
  marks?: Record<number, KeyMark>;
  labels: KeyLabels;
  disabled?: boolean;
}

const MIN_WHITE = 30;
const MAX_WHITE = 64;
const MIDDLE_C = 60;

export function PianoKeyboard({ low, high, onPress, marks = {}, labels, disabled }: Props) {
  const [scrollRef, width] = useElementWidth<HTMLDivElement>();

  // Étend la plage pour commencer et finir sur une touche blanche, avec un peu de marge.
  const [start, end] = useMemo(() => {
    let s = low - 2;
    let e = high + 2;
    while (isBlackKey(s)) s--;
    while (isBlackKey(e)) e++;
    return [s, e];
  }, [low, high]);

  const whites = useMemo(() => {
    const out: number[] = [];
    for (let m = start; m <= end; m++) if (!isBlackKey(m)) out.push(m);
    return out;
  }, [start, end]);

  const whiteW = Math.max(MIN_WHITE, Math.min(MAX_WHITE, width / whites.length || MIN_WHITE));
  const totalW = whiteW * whites.length;
  const blackW = whiteW * 0.6;

  // Clavier plus large que l'écran : on centre la vue sur le Do central.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || totalW <= width) return;
    const idx = whites.findIndex((m) => m >= Math.min(Math.max(MIDDLE_C, start), end));
    el.scrollLeft = Math.max(0, idx * whiteW + whiteW / 2 - width / 2);
  }, [scrollRef, whites, whiteW, totalW, width, start, end]);

  // Clavier défilant : on valide au relâchement si le doigt n'a pas glissé,
  // pour pouvoir faire défiler sans jouer de note. Sinon, réponse immédiate.
  const scrollable = totalW > width + 1;
  const downAt = useRef<{ x: number; scroll: number } | null>(null);
  const handlers = (midi: number) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (disabled) return;
      if (!scrollable) {
        e.preventDefault();
        onPress(midi);
      } else {
        downAt.current = { x: e.clientX, scroll: scrollRef.current?.scrollLeft ?? 0 };
      }
    },
    onPointerUp: (e: React.PointerEvent) => {
      const d = downAt.current;
      downAt.current = null;
      if (disabled || !scrollable || !d) return;
      const moved = Math.abs(e.clientX - d.x) + Math.abs((scrollRef.current?.scrollLeft ?? 0) - d.scroll);
      if (moved < 10) onPress(midi);
    },
    onPointerCancel: () => {
      downAt.current = null;
    },
  });

  const label = (midi: number) => {
    if (labels === 'none') return null;
    const pc = midi % 12;
    if (labels === 'c' && pc !== 0) return null;
    return keyName(midi);
  };

  return (
    <div className="keyboard-scroll" ref={scrollRef}>
      <div className="keyboard" style={{ width: totalW }}>
        {whites.map((m, i) => (
          <button
            key={m}
            type="button"
            className={`key white ${marks[m] ?? ''}`}
            style={{ left: i * whiteW, width: whiteW }}
            {...handlers(m)}
            aria-label={keyName(m)}
          >
            {m === MIDDLE_C && labels !== 'none' && <span className="middle-c" title="Do central" />}
            <span className="key-label">{label(m)}</span>
          </button>
        ))}
        {whites.map((m, i) =>
          m + 1 <= end && isBlackKey(m + 1) ? (
            <button
              key={m + 1}
              type="button"
              className={`key black ${marks[m + 1] ?? ''}`}
              style={{ left: (i + 1) * whiteW - blackW / 2, width: blackW }}
              {...handlers(m + 1)}
              aria-label={keyName(m + 1)}
            />
          ) : null,
        )}
      </div>
    </div>
  );
}
