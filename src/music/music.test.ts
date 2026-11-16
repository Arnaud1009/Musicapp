import { describe, expect, it } from 'vitest';
import { diatonicIndex, fromMidi, frenchName, parsePitch, toMidi, vexKey } from './pitch';
import { NOTE_LEVELS } from './noteLevels';

const level = (id: string) => NOTE_LEVELS.find((l) => l.id === id)!;
import { candidatesForLevel, midiRangeForLevel, pickQuestion, questionKey } from './noteGenerator';

describe('pitch', () => {
  it('convertit en MIDI', () => {
    expect(toMidi(parsePitch('C4'))).toBe(60);
    expect(toMidi(parsePitch('A4'))).toBe(69);
    expect(toMidi(parsePitch('F#3'))).toBe(54);
    expect(toMidi(parsePitch('Bb2'))).toBe(46);
  });
  it('formate pour VexFlow et en français', () => {
    expect(vexKey(parsePitch('F#3'))).toBe('f#/3');
    expect(frenchName(parsePitch('Bb2'))).toBe('Si♭');
    expect(frenchName(parsePitch('E5'))).toBe('Mi');
  });
  it('aller-retour MIDI', () => {
    for (let m = 21; m <= 108; m++) expect(toMidi(fromMidi(m))).toBe(m);
  });
  it('index diatonique', () => {
    expect(diatonicIndex(parsePitch('D4')) - diatonicIndex(parsePitch('C4'))).toBe(1);
    expect(diatonicIndex(parsePitch('C5')) - diatonicIndex(parsePitch('B4'))).toBe(1);
  });
});

describe('générateur de notes', () => {
  it('respecte la plage du niveau 1', () => {
    const c = candidatesForLevel(NOTE_LEVELS[0]);
    expect(c.map((q) => vexKey(q.pitch))).toEqual(['c/4', 'd/4', 'e/4', 'f/4', 'g/4']);
    expect(midiRangeForLevel(NOTE_LEVELS[0])).toEqual([60, 67]);
  });
  it('ajoute les altérations sans E#/B#/Fb/Cb', () => {
    const c = candidatesForLevel(level('n6'));
    const ids = c.map(questionKey);
    expect(ids).toContain('treble:F#4');
    expect(ids).toContain('bass:Bb2');
    expect(ids).not.toContain('treble:E#4');
    expect(ids).not.toContain('treble:Cb5');
  });
  it('clé de sol étendue : 2 lignes supplémentaires de chaque côté', () => {
    const c = candidatesForLevel(level('n2e'));
    expect(new Set(c.map((q) => q.clef))).toEqual(new Set(['treble']));
    expect(midiRangeForLevel(level('n2e'))).toEqual([57, 84]); // La3 → Do6
    expect(c.every((q) => q.pitch.alter === 0)).toBe(true);
  });
  it('mélange les deux clés en grand-portée', () => {
    const clefs = new Set(candidatesForLevel(level('n5')).map((q) => q.clef));
    expect(clefs).toEqual(new Set(['treble', 'bass']));
  });
  it('ne répète pas la note précédente', () => {
    const c = candidatesForLevel(NOTE_LEVELS[0]);
    let prev = c[0];
    for (let i = 0; i < 200; i++) {
      const q = pickQuestion(c, {}, prev);
      expect(questionKey(q)).not.toBe(questionKey(prev));
      prev = q;
    }
  });
  it('privilégie les notes souvent ratées', () => {
    const c = candidatesForLevel(NOTE_LEVELS[0]);
    const stats = Object.fromEntries(c.map((q) => [questionKey(q), { attempts: 10, errors: 0, totalMs: 10000 }]));
    stats['treble:E4'] = { attempts: 10, errors: 10, totalMs: 10000 };
    let e4 = 0;
    for (let i = 0; i < 2000; i++) if (questionKey(pickQuestion(c, stats, null)) === 'treble:E4') e4++;
    expect(e4 / 2000).toBeGreaterThan(0.35);
  });
});
