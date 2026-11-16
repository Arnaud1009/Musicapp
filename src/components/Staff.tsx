import { useEffect } from 'react';
import { Accidental, Formatter, Renderer, Stave, StaveConnector, StaveNote, Voice } from 'vexflow/bravura';
import type { NoteQuestion } from '../music/noteGenerator';
import { type Clef, alterAscii, diatonicIndex, parsePitch, vexKey } from '../music/pitch';
import type { NoteLevel } from '../music/noteLevels';
import { useElementWidth } from '../hooks/useElementWidth';

interface Props {
  level: NoteLevel;
  question: NoteQuestion | null;
  color?: string;
}

const SCALE = 1.5;
const LINE = 10; // espacement VexFlow entre deux lignes
/** Index diatonique des lignes extrêmes de chaque portée. */
const TOP_LINE: Record<Clef, number> = { treble: diatonicIndex(parsePitch('F5')), bass: diatonicIndex(parsePitch('A3')) };
const BOTTOM_LINE: Record<Clef, number> = { treble: diatonicIndex(parsePitch('E4')), bass: diatonicIndex(parsePitch('G2')) };

/** Débord (en px VexFlow) des notes du niveau au-dessus et en dessous de la portée. */
function overflow(level: NoteLevel, clef: Clef) {
  let above = 0;
  let below = 0;
  for (const r of level.ranges.filter((x) => x.clef === clef)) {
    const hi = diatonicIndex(parsePitch(r.high));
    const lo = diatonicIndex(parsePitch(r.low));
    above = Math.max(above, (hi - TOP_LINE[clef]) * (LINE / 2));
    below = Math.max(below, (BOTTOM_LINE[clef] - lo) * (LINE / 2));
  }
  return { above: above + LINE * 1.5, below: below + LINE * 1.5 };
}

export function Staff({ level, question, color = '#1d1b2e' }: Props) {
  const [ref, width] = useElementWidth<HTMLDivElement>();

  useEffect(() => {
    const el = ref.current;
    if (!el || width === 0) return;
    el.innerHTML = '';

    const clefs = (['treble', 'bass'] as Clef[]).filter((c) => level.ranges.some((r) => r.clef === c));
    const grand = clefs.length > 1;
    const w = Math.min(width / SCALE, 300);
    const staveW = w - 10;

    const renderer = new Renderer(el, Renderer.Backends.SVG);
    const ctx = renderer.getContext();

    // Disposition verticale : marges calculées d'après les lignes supplémentaires du niveau.
    const staves: Partial<Record<Clef, Stave>> = {};
    let y = 0;
    clefs.forEach((clef, i) => {
      const o = overflow(level, clef);
      y += i === 0 ? Math.max(o.above, LINE * 2.5) : o.above;
      const stave = new Stave(5, y, staveW, { space_above_staff_ln: 0, space_below_staff_ln: 0 });
      stave.addClef(clef).setContext(ctx);
      staves[clef] = stave;
      y += LINE * 4 + Math.max(o.below, LINE * 2);
      if (grand && i === 0) y += LINE; // respiration entre les deux portées
    });

    renderer.resize(w * SCALE, y * SCALE);
    ctx.scale(SCALE, SCALE);
    Object.values(staves).forEach((s) => s!.draw());

    if (grand) {
      const top = staves.treble!;
      const bottom = staves.bass!;
      new StaveConnector(top, bottom).setType('brace').setContext(ctx).draw();
      new StaveConnector(top, bottom).setType('singleLeft').setContext(ctx).draw();
    }

    if (question) {
      const stave = staves[question.clef] ?? Object.values(staves)[0]!;
      const note = new StaveNote({ keys: [vexKey(question.pitch)], duration: 'w', clef: question.clef });
      if (question.pitch.alter !== 0) note.addModifier(new Accidental(alterAscii(question.pitch.alter)), 0);
      note.setStyle({ fillStyle: color, strokeStyle: color });
      const voice = new Voice({ num_beats: 4, beat_value: 4 }).setMode(Voice.Mode.SOFT).addTickables([note]);
      const available = stave.getWidth() - (stave.getNoteStartX() - stave.getX());
      new Formatter().joinVoices([voice]).format([voice], available);
      // Une seule note : on la centre dans l'espace disponible après la clé.
      note.setXShift(Math.max(0, available / 2 - 25));
      voice.draw(ctx, stave);
    }
  }, [ref, width, level, question, color]);

  return <div className="paper staff" ref={ref} aria-label="Portée" />;
}
