export type HitRating = 'perfect' | 'good' | 'miss';

export interface HitResult {
  /** Temps attendu (s, depuis le début du premier temps). */
  expected: number;
  rating: HitRating;
  /** Écart frappe − attendu en secondes (négatif = en avance), null si manquée. */
  offset: number | null;
}

export interface RhythmScore {
  hits: HitResult[];
  /** Frappes ne correspondant à aucune attaque (s). */
  extras: number[];
  perfect: number;
  good: number;
  missed: number;
  /** Score global 0–100. */
  score: number;
  /** Écart moyen des frappes réussies (s) : tendance à jouer en avance / en retard. */
  meanOffset: number;
}

export interface Windows {
  perfect: number;
  good: number;
}

/** Fenêtres de tolérance, un peu plus larges à tempo lent. */
export function windowsForTempo(bpm: number): Windows {
  const beatSec = 60 / bpm;
  return {
    perfect: Math.min(0.08, Math.max(0.045, beatSec * 0.07)),
    good: Math.min(0.16, Math.max(0.09, beatSec * 0.15)),
  };
}

export function scoreTaps(expected: number[], taps: number[], windows: Windows): RhythmScore {
  const sortedTaps = [...taps].sort((a, b) => a - b);
  const used = new Array(sortedTaps.length).fill(false);

  // Ne pas « voler » la frappe d'une attaque voisine : la fenêtre est bornée
  // par la moitié de l'écart avec les attaques adjacentes.
  const hits: HitResult[] = expected.map((e, i) => {
    const prevGap = i > 0 ? e - expected[i - 1] : Infinity;
    const nextGap = i < expected.length - 1 ? expected[i + 1] - e : Infinity;
    const before = Math.min(windows.good, prevGap / 2);
    const after = Math.min(windows.good, nextGap / 2);
    let best = -1;
    let bestDist = Infinity;
    for (let t = 0; t < sortedTaps.length; t++) {
      if (used[t]) continue;
      const d = sortedTaps[t] - e;
      if (d < -before || d > after) continue;
      if (Math.abs(d) < bestDist) {
        bestDist = Math.abs(d);
        best = t;
      }
    }
    if (best === -1) return { expected: e, rating: 'miss', offset: null };
    used[best] = true;
    const offset = sortedTaps[best] - e;
    return { expected: e, rating: Math.abs(offset) <= windows.perfect ? 'perfect' : 'good', offset };
  });

  const extras = sortedTaps.filter((_, i) => !used[i]);
  const perfect = hits.filter((h) => h.rating === 'perfect').length;
  const good = hits.filter((h) => h.rating === 'good').length;
  const missed = hits.length - perfect - good;
  const matched = hits.filter((h) => h.offset !== null);
  const meanOffset = matched.length ? matched.reduce((a, h) => a + (h.offset ?? 0), 0) / matched.length : 0;
  const raw = hits.length ? (perfect + good * 0.7) / hits.length - extras.length * 0.1 : 0;

  return {
    hits,
    extras,
    perfect,
    good,
    missed,
    score: Math.round(Math.max(0, Math.min(1, raw)) * 100),
    meanOffset,
  };
}
