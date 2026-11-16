import { describe, expect, it } from 'vitest';
import { RHYTHM_LEVELS, measureTicks } from './rhythmLevels';
import { generateRhythm, onsets, type Rhythm } from './rhythmGenerator';
import { scoreTaps, windowsForTempo } from './scoring';

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

describe('générateur de rythmes', () => {
  for (const level of RHYTHM_LEVELS) {
    it(`mesures complètes et cellules autorisées — ${level.id}`, () => {
      const rand = seeded(level.id.charCodeAt(1));
      for (let i = 0; i < 300; i++) {
        const r = generateRhythm(level, 4, rand);
        expect(level.timeSigs).toContainEqual(r.timeSig);
        for (const m of r.measures) {
          const sum = m.events.reduce((a, e) => a + e.ticks, 0);
          expect(sum).toBe(measureTicks(r.timeSig));
          expect(m.events.every((e) => e.rest)).toBe(false);
        }
        if (level.id === 'r1') {
          expect(r.measures.flatMap((m) => m.events).every((e) => !e.rest && e.ticks >= 12)).toBe(true);
        }
      }
    });
  }

  it('les notes liées ne sont pas réattaquées', () => {
    const r: Rhythm = {
      timeSig: { num: 2, den: 4 },
      measures: [{
        events: [
          { ticks: 6, start: 0, cell: 0 },
          { ticks: 6, start: 6, cell: 0, tieToNext: true },
          { ticks: 6, start: 12, cell: 0 },
          { ticks: 6, start: 18, cell: 0 },
        ],
      }],
    };
    expect(onsets(r).map((o) => o.tick)).toEqual([0, 6, 18]);
  });

  it('ignore les silences', () => {
    const r: Rhythm = {
      timeSig: { num: 2, den: 4 },
      measures: [{ events: [{ ticks: 12, start: 0, cell: 0, rest: true }, { ticks: 12, start: 12, cell: 1 }] }],
    };
    expect(onsets(r).map((o) => o.tick)).toEqual([12]);
  });
});

describe('scoring', () => {
  const w = windowsForTempo(60);
  const expected = [0, 1, 2, 2.5, 3];

  it('parfait', () => {
    const s = scoreTaps(expected, [0.01, 0.99, 2.02, 2.5, 3.0], w);
    expect(s.perfect).toBe(5);
    expect(s.score).toBe(100);
  });
  it('en avance / en retard', () => {
    const s = scoreTaps(expected, [-0.08, 1.08, 2, 2.5, 3], w);
    expect(s.good).toBe(2);
    expect(s.hits[0].offset).toBeCloseTo(-0.08);
    expect(s.score).toBeLessThan(100);
  });
  it('note manquée', () => {
    const s = scoreTaps(expected, [0, 1, 2, 3], w);
    expect(s.missed).toBe(1);
    expect(s.hits[3].rating).toBe('miss');
  });
  it('frappe en trop', () => {
    const s = scoreTaps(expected, [0, 0.5, 1, 2, 2.5, 3], w);
    expect(s.extras).toEqual([0.5]);
    expect(s.perfect).toBe(5);
    expect(s.score).toBe(90);
  });
  it('une seule frappe ne compte pas pour deux attaques proches', () => {
    const s = scoreTaps([0, 0.1], [0.05], { perfect: 0.05, good: 0.15 });
    expect(s.perfect + s.good).toBe(1);
    expect(s.missed).toBe(1);
  });
});
