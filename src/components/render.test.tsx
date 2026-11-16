// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, beforeAll } from 'vitest';
import { Staff } from './Staff';
import { RhythmStaff } from './RhythmStaff';
import { NOTE_LEVELS } from '../music/noteLevels';
import { candidatesForLevel } from '../music/noteGenerator';
import { RHYTHM_LEVELS } from '../rhythm/rhythmLevels';
import { generateRhythm, onsets } from '../rhythm/rhythmGenerator';
import { ScaleStaff } from './ScaleStaff';
import { keysUpTo, scaleMeasures } from '../scales/scales';

const WIDTH = 380;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver = class {
    constructor(private cb: ResizeObserverCallback) {}
    observe() {
      this.cb([{ contentRect: { width: WIDTH } } as ResizeObserverEntry], this as unknown as ResizeObserver);
    }
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.getBoundingClientRect = () => ({ width: WIDTH, height: 100 }) as DOMRect;
  // jsdom ne mesure pas le texte SVG.
  (SVGElement.prototype as unknown as { getBBox: () => DOMRect }).getBBox = () =>
    ({ x: 0, y: 0, width: 10, height: 10 }) as DOMRect;
});

function render(el: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(el));
  return { container, unmount: () => act(() => root.unmount()) };
}

describe('rendu VexFlow', () => {
  for (const level of NOTE_LEVELS) {
    it(`portée de notes — ${level.id}`, () => {
      for (const q of candidatesForLevel(level)) {
        const { container, unmount } = render(<Staff level={level} question={q} />);
        expect(container.querySelector('svg')).not.toBeNull();
        unmount();
      }
    });
  }

  for (const level of RHYTHM_LEVELS) {
    it(`portée rythmique — ${level.id}`, () => {
      for (let i = 0; i < 40; i++) {
        const rhythm = generateRhythm(level, 4);
        const results = Object.fromEntries(
          onsets(rhythm).map((o, j) => [`${o.measure}:${o.index}`, { rating: (['perfect', 'good', 'miss'] as const)[j % 3], offsetMs: j % 3 === 2 ? null : 30 }]),
        );
        const { container, unmount } = render(<RhythmStaff rhythm={rhythm} results={results} taps={[{ tick: 0, extra: false }]} />);
        expect(container.querySelectorAll('svg .vf-stavenote').length).toBe(
          rhythm.measures.reduce((s, m) => s + m.events.length, 0),
        );
        unmount();
      }
    });
  }

  it('portée de gammes — 60 tonalités, deux clés, montée et descente', () => {
    for (const key of keysUpTo(7, ['major', 'naturalMinor', 'harmonicMinor', 'melodicMinor'])) {
      for (const clef of ['treble', 'bass'] as const) {
        const measures = scaleMeasures(key, clef, 'upDown');
        const { container, unmount } = render(<ScaleStaff scaleKey={key} clef={clef} measures={measures} />);
        expect(container.querySelectorAll('svg .vf-stavenote')).toHaveLength(15);
        unmount();
      }
    }
  });
});
