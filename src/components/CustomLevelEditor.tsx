import type { ClefRange, NoteLevel } from '../music/noteLevels';
import { type Clef, diatonicIndex, fromDiatonicIndex, frenchName, parsePitch, pitchId } from '../music/pitch';

interface Props {
  level: NoteLevel;
  onChange: (level: NoteLevel) => void;
}

const BOUNDS: Record<Clef, [string, string]> = { treble: ['C3', 'C7'], bass: ['C1', 'E5'] };
const DEFAULTS: Record<Clef, ClefRange> = {
  treble: { clef: 'treble', low: 'C4', high: 'G5' },
  bass: { clef: 'bass', low: 'G2', high: 'C4' },
};

/** Notes naturelles proposées pour les bornes, en notation lisible (Do4 = Do central). */
function naturals(clef: Clef) {
  const [lo, hi] = BOUNDS[clef].map((s) => diatonicIndex(parsePitch(s)));
  const out: { id: string; label: string }[] = [];
  for (let i = lo; i <= hi; i++) {
    const p = fromDiatonicIndex(i);
    out.push({ id: pitchId(p), label: `${frenchName(p)}${p.octave}${pitchId(p) === 'C4' ? ' (central)' : ''}` });
  }
  return out;
}

export function CustomLevelEditor({ level, onChange }: Props) {
  const rangeFor = (clef: Clef) => level.ranges.find((r) => r.clef === clef);

  const toggleClef = (clef: Clef, on: boolean) => {
    const ranges = on
      ? [...level.ranges.filter((r) => r.clef !== clef), DEFAULTS[clef]]
      : level.ranges.filter((r) => r.clef !== clef);
    if (ranges.length === 0) return; // au moins une clé
    ranges.sort((a, b) => (a.clef === b.clef ? 0 : a.clef === 'treble' ? -1 : 1));
    onChange({ ...level, ranges });
  };

  const setBound = (clef: Clef, key: 'low' | 'high', value: string) => {
    onChange({
      ...level,
      ranges: level.ranges.map((r) => {
        if (r.clef !== clef) return r;
        const next = { ...r, [key]: value };
        // Garde low ≤ high.
        if (diatonicIndex(parsePitch(next.low)) > diatonicIndex(parsePitch(next.high))) {
          if (key === 'low') next.high = value;
          else next.low = value;
        }
        return next;
      }),
    });
  };

  return (
    <div className="custom-editor">
      {(['treble', 'bass'] as Clef[]).map((clef) => {
        const r = rangeFor(clef);
        const options = naturals(clef);
        return (
          <fieldset key={clef}>
            <label className="check">
              <input type="checkbox" checked={Boolean(r)} onChange={(e) => toggleClef(clef, e.target.checked)} />
              {clef === 'treble' ? 'Clé de sol' : 'Clé de fa'}
            </label>
            {r && (
              <div className="range-row">
                <select value={r.low} onChange={(e) => setBound(clef, 'low', e.target.value)} aria-label="Note la plus grave">
                  {options.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
                <span>→</span>
                <select value={r.high} onChange={(e) => setBound(clef, 'high', e.target.value)} aria-label="Note la plus aiguë">
                  {options.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
              </div>
            )}
          </fieldset>
        );
      })}
      <label className="check">
        <input
          type="checkbox"
          checked={level.accidentals}
          onChange={(e) => onChange({ ...level, accidentals: e.target.checked })}
        />
        Dièses et bémols
      </label>
    </div>
  );
}
