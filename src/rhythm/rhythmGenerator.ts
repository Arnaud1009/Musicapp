import {
  CELLS,
  type Cell,
  type RhythmEvent,
  type RhythmLevel,
  type TimeSig,
  beatTicks,
  beatsPerMeasure,
  isCompound,
  measureTicks,
} from './rhythmLevels';

export interface PlacedEvent extends RhythmEvent {
  /** Début en ticks depuis le début de la mesure. */
  start: number;
  /** Index de la cellule dans la mesure (sert aux ligatures / triolets). */
  cell: number;
}

export interface Measure {
  events: PlacedEvent[];
}

export interface Rhythm {
  timeSig: TimeSig;
  measures: Measure[];
}

export interface Onset {
  /** Position absolue en ticks depuis le début du premier temps. */
  tick: number;
  measure: number;
  index: number;
}

function canPlace(cell: Cell, pos: number, ts: TimeSig): boolean {
  const beats = beatsPerMeasure(ts);
  if (Boolean(cell.compound) !== isCompound(ts)) return false;
  if (pos + cell.beats > beats) return false;
  if (cell.beats === 1) return true;
  if (cell.beats >= 3) return pos === 0;
  // Cellules de 2 temps : sur un temps fort (1 ou 3) en 4/4, librement en 3/4.
  if (beats === 4) return pos % 2 === 0;
  return true;
}

function weightedPick<T>(items: T[], weights: number[], random: () => number): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let x = random() * total;
  for (let i = 0; i < items.length; i++) {
    x -= weights[i];
    if (x <= 0) return items[i];
  }
  return items[items.length - 1];
}

function generateMeasure(level: RhythmLevel, ts: TimeSig, random: () => number): Measure {
  const beats = beatsPerMeasure(ts);
  const bt = beatTicks(ts);
  const entries = Object.entries(level.cells).filter(([id]) => CELLS[id]);
  const events: PlacedEvent[] = [];
  let pos = 0;
  let cellIndex = 0;
  while (pos < beats) {
    const fitting = entries.filter(([id]) => canPlace(CELLS[id], pos, ts));
    const [id] = weightedPick(fitting, fitting.map(([, w]) => w), random);
    const cell = CELLS[id];
    let start = pos * bt;
    for (const ev of cell.events) {
      events.push({ ...ev, start, cell: cellIndex });
      start += ev.ticks;
    }
    pos += cell.beats;
    cellIndex++;
  }
  return { events };
}

export function generateRhythm(
  level: RhythmLevel,
  measureCount: number,
  random: () => number = Math.random,
): Rhythm {
  const timeSig = level.timeSigs[Math.floor(random() * level.timeSigs.length)];
  const measures: Measure[] = [];
  for (let m = 0; m < measureCount; m++) {
    let measure = generateMeasure(level, timeSig, random);
    // Évite les mesures entièrement silencieuses et les répétitions immédiates.
    for (let tries = 0; tries < 20; tries++) {
      const allRest = measure.events.every((e) => e.rest);
      const sameAsPrev = m > 0 && signature(measure) === signature(measures[m - 1]);
      if (!allRest && !sameAsPrev) break;
      measure = generateMeasure(level, timeSig, random);
    }
    measures.push(measure);
  }
  return { timeSig, measures };
}

function signature(m: Measure): string {
  return m.events.map((e) => `${e.ticks}${e.rest ? 'r' : ''}${e.tieToNext ? 't' : ''}`).join(',');
}

/** Attaques à jouer : ni silences, ni notes de prolongation d'une liaison. */
export function onsets(rhythm: Rhythm): Onset[] {
  const mt = measureTicks(rhythm.timeSig);
  const out: Onset[] = [];
  let tiedFromPrev = false;
  rhythm.measures.forEach((measure, mi) => {
    measure.events.forEach((ev, i) => {
      if (!ev.rest && !tiedFromPrev) out.push({ tick: mi * mt + ev.start, measure: mi, index: i });
      tiedFromPrev = Boolean(ev.tieToNext) && !ev.rest;
    });
  });
  return out;
}

export function totalTicks(rhythm: Rhythm): number {
  return measureTicks(rhythm.timeSig) * rhythm.measures.length;
}
