import { useEffect } from 'react';
import { Accidental, Formatter, Renderer, Stave, StaveNote, Voice } from 'vexflow/bravura';
import { type Clef, type Pitch, vexKey } from '../music/pitch';
import { type ScaleKey, signatureAlters, vexKeySignature, writtenAccidentals } from '../scales/scales';
import { useElementWidth } from '../hooks/useElementWidth';

interface Props {
  scaleKey: ScaleKey;
  clef: Clef;
  /** Une mesure (montée) ou deux (montée | descente). */
  measures: Pitch[][];
  /** Couleur de chaque note, index global (montée puis descente). */
  colors?: (string | undefined)[];
}

const INK = '#1d1b2e';
const ROW_H = 125;

export function ScaleStaff({ scaleKey, clef, measures, colors = [] }: Props) {
  const [ref, width] = useElementWidth<HTMLDivElement>();

  useEffect(() => {
    const el = ref.current;
    if (!el || width === 0) return;
    el.innerHTML = '';

    const scale = width < 500 ? 1.1 : 1.3;
    const w = width / scale;
    // Montée et descente côte à côte si la place le permet, sinon l'une sous l'autre.
    const perRow = measures.length > 1 && w >= 600 ? measures.length : 1;
    const rows = Math.ceil(measures.length / perRow);

    const renderer = new Renderer(el, Renderer.Backends.SVG);
    renderer.resize(width, rows * ROW_H * scale);
    const ctx = renderer.getContext();
    ctx.scale(scale, scale);

    const signature = signatureAlters(scaleKey);
    let globalIndex = 0;

    measures.forEach((notes, mi) => {
      const row = Math.floor(mi / perRow);
      const col = mi % perRow;
      const staveW = (w - 10) / perRow;
      const stave = new Stave(5 + col * staveW, row * ROW_H + 10, staveW);
      if (col === 0) stave.addClef(clef).addKeySignature(vexKeySignature(scaleKey));
      stave.setContext(ctx).draw();

      const accidentals = writtenAccidentals(notes, signature);
      const vfNotes = notes.map((p, i) => {
        const note = new StaveNote({ keys: [vexKey(p)], duration: 'w', clef });
        const acc = accidentals[i];
        if (acc) note.addModifier(new Accidental(acc), 0);
        const color = colors[globalIndex + i] ?? INK;
        note.setStyle({ fillStyle: color, strokeStyle: color });
        return note;
      });
      globalIndex += notes.length;

      const voice = new Voice({ num_beats: 4 * notes.length, beat_value: 4 }).setMode(Voice.Mode.SOFT);
      voice.addTickables(vfNotes);
      const available = stave.getX() + stave.getWidth() - stave.getNoteStartX() - 20;
      new Formatter().joinVoices([voice]).format([voice], available);
      voice.draw(ctx, stave);
    });
  }, [ref, width, scaleKey, clef, measures, colors]);

  return <div className="paper scale-staff" ref={ref} aria-label="Gamme" />;
}
