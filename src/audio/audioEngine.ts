import { midiToFrequency } from '../music/pitch';

let ctx: AudioContext | null = null;

type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };

/**
 * iOS range Web Audio dans la catégorie « ambiante », coupée par l'interrupteur silencieux.
 * Safari ≥ 16.4 permet de passer en « playback » ; sinon, jouer un <audio> muet
 * depuis un geste utilisateur bascule la session audio de la page dans cette catégorie.
 */
function preferPlaybackSession() {
  const nav = navigator as AudioSessionNavigator;
  if (nav.audioSession) {
    try {
      nav.audioSession.type = 'playback';
      return;
    } catch {
      /* ignoré : on tente le repli ci-dessous */
    }
  }
  if (!/iPad|iPhone|iPod/.test(navigator.userAgent) && !(navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent))) {
    return;
  }
  const el = new Audio(silentWavDataUri());
  el.setAttribute('playsinline', '');
  el.loop = true;
  void el.play().catch(() => {});
  // Pas de « lecture en cours » sur l'écran verrouillé quand l'app est en arrière-plan.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) el.pause();
    else void el.play().catch(() => {});
  });
}

/** WAV PCM 8 bits d'un dixième de seconde de silence. */
function silentWavDataUri(): string {
  const samples = 800;
  const bytes = new Uint8Array(44 + samples);
  const view = new DataView(bytes.buffer);
  const str = (o: number, s: string) => [...s].forEach((ch, i) => view.setUint8(o + i, ch.charCodeAt(0)));
  str(0, 'RIFF');
  view.setUint32(4, 36 + samples, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, 8000, true);
  view.setUint32(28, 8000, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  str(36, 'data');
  view.setUint32(40, samples, true);
  bytes.fill(128, 44); // silence en 8 bits non signé
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return `data:audio/wav;base64,${btoa(bin)}`;
}

export function getAudioContext(): AudioContext {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor({ latencyHint: 'interactive' });
  }
  // « suspended » (autoplay) ou « interrupted » (iOS après un appel, une autre app…).
  if (ctx.state !== 'running') void ctx.resume().catch(() => {});
  return ctx;
}

/**
 * Déverrouille l'audio au premier geste, puis le relance à chaque geste s'il a été suspendu.
 * Indispensable car `pointerdown` au doigt (utilisé par le clavier) n'est pas un geste
 * qui autorise l'audio dans Chrome : seuls pointerup / touchend / click / keydown le sont.
 */
export function installAudioUnlock() {
  let sessionDone = false;
  const unlock = () => {
    if (!sessionDone) {
      sessionDone = true;
      preferPlaybackSession();
    }
    const c = getAudioContext();
    // Un tampon vide joué dans le geste finit de déverrouiller les anciens iOS.
    const src = c.createBufferSource();
    src.buffer = c.createBuffer(1, 1, 22050);
    src.connect(c.destination);
    src.start(0);
  };
  for (const type of ['pointerup', 'touchend', 'click', 'keydown'] as const) {
    window.addEventListener(type, () => (ctx?.state === 'running' && sessionDone ? undefined : unlock()), {
      capture: true,
      passive: true,
    });
  }
}

/**
 * Convertit l'horodatage d'un événement DOM (horloge performance.now)
 * en temps de l'AudioContext, pour comparer frappes et clics sur la même horloge.
 */
export function eventToAudioTime(eventTimeStamp: number): number {
  return audibleTime() - (performance.now() - eventTimeStamp) / 1000;
}

function click(c: AudioContext, dest: AudioNode, time: number, accent: boolean) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'square';
  osc.frequency.value = accent ? 1760 : 1100;
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(accent ? 0.35 : 0.22, time + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
  osc.connect(gain).connect(dest);
  osc.start(time);
  osc.stop(time + 0.06);
}

/**
 * Son « piano » synthétique. Riche en harmoniques : les haut-parleurs de téléphone ne
 * restituent pas les fondamentales graves (< ~300 Hz), l'oreille les reconstitue
 * à partir des harmoniques.
 */
function tone(c: AudioContext, dest: AudioNode, time: number, freq: number, duration: number, volume = 0.3) {
  const out = c.createGain();
  out.gain.setValueAtTime(0.0001, time);
  out.gain.exponentialRampToValueAtTime(volume, time + 0.006);
  out.gain.exponentialRampToValueAtTime(volume * 0.35, time + 0.2);
  out.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(Math.min(9000, Math.max(2500, freq * 10)), time);
  filter.frequency.exponentialRampToValueAtTime(Math.min(4000, Math.max(1200, freq * 4)), time + 0.3);
  filter.connect(out).connect(dest);
  // Les notes graves reçoivent plus d'harmoniques pour rester audibles.
  const bass = freq < 220;
  for (const [mult, level] of [
    [1, 1],
    [2, bass ? 0.8 : 0.5],
    [3, bass ? 0.6 : 0.25],
    [4, bass ? 0.4 : 0.12],
    [5, bass ? 0.25 : 0.06],
  ] as const) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = mult === 1 ? 'triangle' : 'sine';
    osc.frequency.value = freq * mult;
    g.gain.value = level / (bass ? 2.2 : 1.6);
    osc.connect(g).connect(filter);
    osc.start(time);
    osc.stop(time + duration + 0.05);
  }
}

export function playNote(midi: number, duration = 1.2) {
  const c = getAudioContext();
  tone(c, c.destination, c.currentTime + 0.005, midiToFrequency(midi), duration, 0.45);
}

export interface ScheduledEvent {
  time: number;
  kind: 'click' | 'accent' | 'note';
  duration?: number;
  /** Hauteur des événements 'note' (Do5 par défaut). */
  midi?: number;
}

export interface Playback {
  stop: () => void;
}

/**
 * Planifie tous les événements d'un exercice d'un coup sur l'horloge audio
 * (précision à l'échantillon, insensible aux ralentissements de l'UI).
 */
export function schedule(events: ScheduledEvent[]): Playback {
  const c = getAudioContext();
  const bus = c.createGain();
  bus.connect(c.destination);
  for (const e of events) {
    if (e.kind === 'note') tone(c, bus, e.time, midiToFrequency(e.midi ?? 72), e.duration ?? 0.2, e.midi ? 0.4 : 0.25);
    else click(c, bus, e.time, e.kind === 'accent');
  }
  return {
    stop: () => {
      bus.gain.setValueAtTime(0, c.currentTime);
      setTimeout(() => bus.disconnect(), 100);
    },
  };
}

/** Petit retour sonore à chaque frappe. */
export function playTap() {
  const c = getAudioContext();
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(700, t);
  osc.frequency.exponentialRampToValueAtTime(300, t + 0.05);
  gain.gain.setValueAtTime(0.25, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.08);
}

/** Temps audio actuellement *entendu* (corrige la latence de sortie quand c'est possible). */
export function audibleTime(): number {
  const c = getAudioContext();
  if (typeof c.getOutputTimestamp === 'function') {
    const ts = c.getOutputTimestamp();
    if (ts.contextTime !== undefined && ts.performanceTime !== undefined && ts.performanceTime > 0) {
      return ts.contextTime + (performance.now() - ts.performanceTime) / 1000;
    }
  }
  return c.currentTime - (c.outputLatency ?? 0);
}
