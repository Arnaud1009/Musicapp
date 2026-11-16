import { useEffect, useRef, useState } from 'react';
import {
  Annotation,
  Beam,
  Dot,
  Formatter,
  Renderer,
  Stave,
  StaveNote,
  StaveTie,
  Tuplet,
  Voice,
} from 'vexflow/bravura';
import type { Rhythm } from '../rhythm/rhythmGenerator';
import { TPQ, measureTicks } from '../rhythm/rhythmLevels';
import type { HitRating } from '../rhythm/scoring';
import { useElementWidth } from '../hooks/useElementWidth';

export interface EventResult {
  rating: HitRating;
  offsetMs: number | null;
}

interface Props {
  rhythm: Rhythm;
  /** Résultat par événement, clé "mesure:index". */
  results?: Record<string, EventResult>;
  /** Frappes à afficher (position en ticks), rouges si en trop. */
  taps?: { tick: number; extra: boolean }[];
  /** Renvoie la position courante en ticks pendant la lecture (null = pas de curseur). */
  clock?: (() => number | null) | null;
}

const COLORS: Record<HitRating, string> = { perfect: '#1f9d55', good: '#d48806', miss: '#d64545' };
const ROW_H = 110;
const INK = '#1d1b2e';

function vexDuration(ticks: number, triplet?: boolean): { duration: string; dots: number } {
  if (triplet) return { duration: '8', dots: 0 };
  const table: Record<number, [string, number]> = {
    48: ['w', 0], 36: ['h', 1], 24: ['h', 0], 18: ['q', 1], 12: ['q', 0], 9: ['8', 1], 6: ['8', 0], 3: ['16', 0],
  };
  const [duration, dots] = table[ticks] ?? ['q', 0];
  return { duration, dots };
}

interface Layout {
  /** Par mesure : positions x des événements et ligne de la mesure. */
  measures: { top: number; xs: { tick: number; x: number }[] }[];
  scale: number;
}

export function RhythmStaff({ rhythm, results, taps, clock }: Props) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const svgRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout | null>(null);

  useEffect(() => {
    const el = svgRef.current;
    if (!el || width === 0) return;
    el.innerHTML = '';

    const scale = width < 500 ? 1.1 : 1.25;
    const w = width / scale;
    const ts = rhythm.timeSig;
    const mt = measureTicks(ts);
    const perRow = Math.max(1, Math.min(rhythm.measures.length, Math.floor(w / 260)));
    const rows = Math.ceil(rhythm.measures.length / perRow);
    const staveW = (w - 10) / perRow;

    const renderer = new Renderer(el, Renderer.Backends.SVG);
    renderer.resize(width, rows * ROW_H * scale);
    const ctx = renderer.getContext();
    ctx.scale(scale, scale);

    const newLayout: Layout = { measures: [], scale };

    rhythm.measures.forEach((measure, mi) => {
      const row = Math.floor(mi / perRow);
      const col = mi % perRow;
      const stave = new Stave(5 + col * staveW, row * ROW_H + 5, staveW);
      if (mi === 0) stave.addTimeSignature(`${ts.num}/${ts.den}`);
      stave.setContext(ctx).draw();

      const notes = measure.events.map((ev, i) => {
        const { duration, dots } = vexDuration(ev.ticks, ev.triplet);
        const key = ev.rest ? (duration === 'w' ? 'd/5' : 'b/4') : 'b/4';
        const note = new StaveNote({
          keys: [key],
          duration: duration + 'd'.repeat(dots) + (ev.rest ? 'r' : ''),
          stem_direction: 1,
          auto_stem: false,
        });
        if (dots) Dot.buildAndAttach([note], { all: true });
        const res = results?.[`${mi}:${i}`];
        if (res) {
          const c = COLORS[res.rating];
          note.setStyle({ fillStyle: c, strokeStyle: c });
          const text = res.offsetMs === null ? '✗' : res.rating === 'perfect' ? '' : `${res.offsetMs > 0 ? '+' : ''}${res.offsetMs}`;
          if (text) {
            const a = new Annotation(text).setVerticalJustification(Annotation.VerticalJustify.BOTTOM);
            a.setFont('sans-serif', 9);
            a.setStyle({ fillStyle: c, strokeStyle: c });
            note.addModifier(a, 0);
          }
        } else {
          note.setStyle({ fillStyle: INK, strokeStyle: INK });
        }
        return note;
      });

      // Triolets (doivent être créés avant l'ajout à la voix : ils modifient les durées).
      const tuplets: Tuplet[] = [];
      const beams: Beam[] = [];
      const cells = [...new Set(measure.events.map((e) => e.cell))];
      for (const cell of cells) {
        const idx = measure.events.map((e, i) => (e.cell === cell ? i : -1)).filter((i) => i >= 0);
        if (measure.events[idx[0]].triplet) {
          tuplets.push(new Tuplet(idx.map((i) => notes[i]), { num_notes: 3, notes_occupied: 2, bracketed: false }));
        }
        // Ligatures : suites de notes (pas de silences) plus courtes qu'une noire, dans un même temps.
        const beat = (i: number) => Math.floor(measure.events[i].start / (ts.den === 8 ? TPQ * 1.5 : TPQ));
        let run: number[] = [];
        const flush = () => {
          if (run.length >= 2) beams.push(new Beam(run.map((i) => notes[i])));
          run = [];
        };
        for (const i of idx) {
          const ev = measure.events[i];
          const beamable = !ev.rest && (ev.ticks < TPQ || ev.triplet);
          if (!beamable || (run.length && beat(run[0]) !== beat(i))) flush();
          if (beamable) run.push(i);
        }
        flush();
      }

      const voice = new Voice({ num_beats: ts.num, beat_value: ts.den }).setMode(Voice.Mode.SOFT);
      voice.addTickables(notes);
      const available = stave.getX() + stave.getWidth() - stave.getNoteStartX() - 15;
      new Formatter().joinVoices([voice]).format([voice], available);
      voice.draw(ctx, stave);
      beams.forEach((b) => b.setContext(ctx).draw());
      tuplets.forEach((t) => t.setContext(ctx).draw());

      measure.events.forEach((ev, i) => {
        if (ev.tieToNext && notes[i + 1]) {
          new StaveTie({ first_note: notes[i], last_note: notes[i + 1], first_indices: [0], last_indices: [0] })
            .setContext(ctx)
            .draw();
        }
      });

      const xs = measure.events.map((ev, i) => ({ tick: mi * mt + ev.start, x: notes[i].getAbsoluteX() + 4 }));
      xs.push({ tick: (mi + 1) * mt, x: stave.getX() + stave.getWidth() - 4 });
      newLayout.measures.push({ top: row * ROW_H + 5, xs });
    });

    setLayout(newLayout);
  }, [width, rhythm, results]);

  const position = (tick: number) => {
    if (!layout) return null;
    const m = layout.measures.find((mm) => tick >= mm.xs[0].tick && tick <= mm.xs[mm.xs.length - 1].tick)
      ?? (tick < 0 ? layout.measures[0] : null);
    if (!m) return null;
    const pts = m.xs;
    if (tick <= pts[0].tick) return { x: pts[0].x * layout.scale, top: m.top * layout.scale };
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      if (tick >= a.tick && tick <= b.tick) {
        const f = b.tick === a.tick ? 0 : (tick - a.tick) / (b.tick - a.tick);
        return { x: (a.x + f * (b.x - a.x)) * layout.scale, top: m.top * layout.scale };
      }
    }
    return null;
  };

  // Curseur de lecture animé hors du cycle React.
  useEffect(() => {
    const cursor = cursorRef.current;
    if (!cursor) return;
    if (!clock || !layout) {
      cursor.hidden = true;
      return;
    }
    let raf = 0;
    const loop = () => {
      const tick = clock();
      const p = tick === null ? null : position(Math.max(0, tick));
      if (p && tick !== null && tick >= 0) {
        cursor.hidden = false;
        cursor.style.transform = `translate(${p.x}px, ${p.top + 30 * layout.scale}px)`;
      } else {
        cursor.hidden = true;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clock, layout]);

  return (
    <div className="paper rhythm-staff" ref={ref}>
      <div ref={svgRef} />
      <div ref={cursorRef} className="cursor" hidden style={{ height: 50 * (layout?.scale ?? 1) }} />
      {taps?.map((t, i) => {
        const p = position(t.tick);
        return p ? (
          <div
            key={i}
            className={`tap-mark ${t.extra ? 'extra' : ''}`}
            style={{ transform: `translate(${p.x}px, ${p.top + 22 * (layout?.scale ?? 1)}px)` }}
          />
        ) : null;
      })}
    </div>
  );
}
