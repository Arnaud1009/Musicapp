import { describe, expect, it } from 'vitest';
import { pitchId } from '../music/pitch';
import {
  type ScaleKey,
  distractors,
  keyId,
  keysUpTo,
  scaleDegrees,
  scaleMeasures,
  scaleName,
  signatureAlters,
  signatureCount,
  vexKeySignature,
  writtenAccidentals,
} from './scales';
import { SCALE_LEVELS, keysForLevel } from './scaleLevels';

const key = (tonic: string, type: ScaleKey['type']): ScaleKey => {
  const alter = tonic.endsWith('#') ? 1 : tonic.length > 1 && tonic.endsWith('b') ? -1 : 0;
  return { tonic: { step: tonic[0] as ScaleKey['tonic']['step'], alter }, type };
};
const ids = (ps: ReturnType<typeof scaleDegrees>) => ps.map(pitchId).join(' ');

describe('gammes', () => {
  it('construit les gammes majeures et mineures', () => {
    expect(ids(scaleDegrees(key('C', 'major'), 4))).toBe('C4 D4 E4 F4 G4 A4 B4 C5');
    expect(ids(scaleDegrees(key('Eb', 'major'), 4))).toBe('Eb4 F4 G4 Ab4 Bb4 C5 D5 Eb5');
    expect(ids(scaleDegrees(key('A', 'harmonicMinor'), 4))).toBe('A4 B4 C5 D5 E5 F5 G#5 A5');
    expect(ids(scaleDegrees(key('D', 'melodicMinor'), 4))).toBe('D4 E4 F4 G4 A4 B4 C#5 D5');
    expect(ids(scaleDegrees(key('G#', 'harmonicMinor'), 4))).toBe('G#4 A#4 B4 C#5 D#5 E5 F##5 G#5');
    expect(ids(scaleDegrees(key('Cb', 'major'), 4))).toBe('Cb4 Db4 Eb4 Fb4 Gb4 Ab4 Bb4 Cb5');
  });

  it('calcule les armures', () => {
    expect(signatureCount(key('A', 'naturalMinor'))).toBe(0);
    expect(signatureCount(key('F#', 'harmonicMinor'))).toBe(3);
    expect(signatureCount(key('Bb', 'melodicMinor'))).toBe(-5);
    expect(vexKeySignature(key('C#', 'naturalMinor'))).toBe('E');
    const sig = signatureAlters(key('D', 'major'));
    expect([sig.F, sig.C, sig.G]).toEqual([1, 1, 0]);
  });

  it('couvre les 15 armures pour chaque type', () => {
    const all = keysUpTo(7, ['major', 'naturalMinor', 'harmonicMinor', 'melodicMinor']);
    expect(all).toHaveLength(60);
    expect(new Set(all.map(keyId)).size).toBe(60);
    for (const k of all) {
      for (const clef of ['treble', 'bass'] as const) expect(scaleMeasures(k, clef, 'upDown')).toHaveLength(2);
    }
  });

  it('n’écrit que les altérations hors armure', () => {
    const [up] = scaleMeasures(key('A', 'harmonicMinor'), 'treble', 'up');
    expect(writtenAccidentals(up, signatureAlters(key('A', 'harmonicMinor')))).toEqual([
      null, null, null, null, null, null, '#', null,
    ]);
    const d = key('D', 'melodicMinor');
    const [dUp, dDown] = scaleMeasures(d, 'treble', 'upDown');
    // Ré mineur : Si♭ à l'armure → bécarre sur le Si, dièse sur le Do en montant.
    expect(writtenAccidentals(dUp, signatureAlters(d))).toEqual([null, null, null, null, null, 'n', '#', null]);
    // Redescente en mineure naturelle, nouvelle mesure : rien à écrire.
    expect(writtenAccidentals(dDown, signatureAlters(d)).every((a) => a === null)).toBe(true);
    const g = key('G#', 'harmonicMinor');
    expect(writtenAccidentals(scaleMeasures(g, 'treble', 'up')[0], signatureAlters(g))[6]).toBe('##');
    // Une altération vaut jusqu'à la barre de mesure : pas de répétition à la même octave.
    expect(
      writtenAccidentals(
        [{ step: 'F', alter: 1, octave: 4 }, { step: 'F', alter: 1, octave: 4 }, { step: 'F', alter: 0, octave: 4 }],
        signatureAlters(key('C', 'major')),
      ),
    ).toEqual(['#', null, 'n']);
  });

  it('nomme les gammes en français', () => {
    expect(scaleName(key('F#', 'harmonicMinor'))).toBe('Fa♯ mineur harmonique');
    expect(scaleName(key('Bb', 'major'))).toBe('Si♭ majeur');
  });

  it('propose des distracteurs distincts et plausibles', () => {
    const pool = keysForLevel(SCALE_LEVELS[3]);
    const answer = key('A', 'naturalMinor');
    for (let i = 0; i < 50; i++) {
      const d = distractors(answer, pool);
      expect(d).toHaveLength(3);
      expect(new Set([answer, ...d].map(keyId)).size).toBe(4);
      expect(d.some((k) => keyId(k) === 'C-major')).toBe(true); // relative majeure
    }
  });

  it('chaque niveau a assez de tonalités pour un QCM à 4 choix', () => {
    for (const level of SCALE_LEVELS) expect(keysForLevel(level).length).toBeGreaterThanOrEqual(4);
  });
});
