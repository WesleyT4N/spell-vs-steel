// Character voices, synthesized live: a glottal buzz and breath noise through moving vowel formants, with
// pitch contours, jitter, rasp and per-class vocal tracts. No audio files.
// Profile (Wes): realistic not chiptune, punchy and snappy, pitched about 2 semitones low.
import type { ClassId } from '../art/sprites';

export type VoiceKind = 'grunt' | 'cast' | 'castBig' | 'hurt' | 'hurtBig' | 'death' | 'win';

/** Two semitones down, the same as the spell sounds. */
const LOW = 0.89;

/** A class's voice: pitch, vocal tract and texture. */
interface Profile {
  /** Speaking pitch in Hz (before LOW). */
  f0: number;
  /** Formant scale: below 1 is a bigger, darker tract, above 1 a smaller, brighter one. */
  tract: number;
  /** Breath noise mixed under the voice, 0-1. */
  breath: number;
  /** Gravel: period doubling under the voice, 0-1. */
  rasp: number;
  /** Pitch wobble from age or nerves, 0-1. */
  shake: number;
  /** Vibrato depth in semitones on held notes (sung lines). */
  vib: number;
  vol: number;
}
// Warrior: young baritone hero. Mage: old, breathy wizard with a wobble. Rogue: light, whispery ninja.
// Ranger: clear tenor. Priest: warm alto that sings her spells.
const PROFILES: Record<ClassId, Profile> = {
  warrior: { f0: 112, tract: 0.92, breath: 0.12, rasp: 0.3, shake: 0.15, vib: 0, vol: 1 },
  mage: { f0: 98, tract: 0.95, breath: 0.32, rasp: 0.18, shake: 0.6, vib: 0.15, vol: 0.9 },
  rogue: { f0: 165, tract: 1.07, breath: 0.45, rasp: 0.05, shake: 0.1, vib: 0, vol: 0.85 },
  ranger: { f0: 140, tract: 1.02, breath: 0.2, rasp: 0.1, shake: 0.12, vib: 0, vol: 0.95 },
  cleric: { f0: 215, tract: 1.17, breath: 0.16, rasp: 0.02, shake: 0.08, vib: 0.35, vol: 0.85 },
};

// Vowel formants (adult male averages, Hz) and their relative levels.
type Vowel = 'a' | 'u' | 'o' | 'e' | 'i' | 'ae' | 'oo' | 'er' | 'm' | 'l';
const VOWEL: Record<Vowel, { f: [number, number, number, number]; g: [number, number, number, number] }> = {
  a: { f: [730, 1090, 2440, 3400], g: [1, 0.7, 0.3, 0.15] },
  u: { f: [640, 1190, 2390, 3400], g: [1, 0.6, 0.25, 0.12] }, // "uh"
  o: { f: [570, 840, 2410, 3300], g: [1, 0.55, 0.2, 0.1] },
  e: { f: [530, 1840, 2480, 3500], g: [1, 0.6, 0.35, 0.15] },
  i: { f: [300, 2250, 2960, 3600], g: [1, 0.35, 0.35, 0.2] },
  ae: { f: [660, 1720, 2410, 3400], g: [1, 0.7, 0.35, 0.15] },
  oo: { f: [320, 870, 2240, 3300], g: [1, 0.35, 0.12, 0.06] },
  er: { f: [490, 1350, 1690, 3300], g: [1, 0.6, 0.45, 0.12] },
  m: { f: [260, 1100, 2400, 3300], g: [1, 0.08, 0.04, 0.02] }, // a hum: "mm", "nn", "ng"
  l: { f: [360, 1250, 2700, 3300], g: [1, 0.3, 0.15, 0.08] },
};

/** Unvoiced consonants: a burst or hiss of noise in front of a segment. */
type Cons = 'h' | 'k' | 't' | 'p' | 's' | 'sh' | 'th' | 'f';
const CONS: Record<Cons, { f: number; q: number; d: number; v: number }> = {
  h: { f: 0, q: 0, d: 0.05, v: 0 }, // breath through the next vowel's formants
  k: { f: 2200, q: 1.5, d: 0.03, v: 0.9 },
  t: { f: 4200, q: 1.2, d: 0.02, v: 0.8 },
  p: { f: 900, q: 0.8, d: 0.015, v: 0.7 },
  s: { f: 6000, q: 2.5, d: 0.09, v: 0.45 },
  sh: { f: 2900, q: 1.6, d: 0.09, v: 0.45 },
  th: { f: 6500, q: 0.8, d: 0.05, v: 0.2 },
  f: { f: 3500, q: 0.5, d: 0.07, v: 0.25 },
};

type Ramp = number | [number, number];
/** One stretch of an utterance. `v: null` is silence (or a bare consonant). */
interface Seg {
  v: Vowel | null;
  d: number;
  /** Pitch as a multiple of the class pitch, start to end. */
  p?: Ramp;
  amp?: Ramp;
  /** Extra breath on top of the class's. */
  br?: Ramp;
  /** Extra rasp on top of the class's. */
  rasp?: number;
  /** A consonant before the vowel; `end` puts one after it. */
  c?: Cons;
  end?: Cons;
  /** Held, sung note: adds vibrato. */
  sing?: boolean;
}

const rnd = (a: number, b: number): number => a + Math.random() * (b - a);
const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const at = (r: Ramp | undefined, u: number, dflt: number): number => r === undefined ? dflt : typeof r === 'number' ? r : r[0] + (r[1] - r[0]) * u;

// ---------- lines ----------
// Each is a small script of segments; variants are picked at random so repeats don't sound canned.
const H = (v: Vowel, d: number, p: Ramp, amp: Ramp = 1, extra: Partial<Seg> = {}): Seg => ({ v, d, p, amp, c: 'h', ...extra });
const gap = (d: number): Seg => ({ v: null, d });

/** Mage gibberish: consonant-vowel syllables muttered on a falling line. */
function incant(n: number, shout: boolean): Seg[] {
  const out: Seg[] = [];
  const cs: Array<Cons | 'r' | 'l' | 'm' | null> = ['k', 't', 's', 'sh', 'th', 'r', 'l', 'm', null];
  const vs: Vowel[] = ['a', 'e', 'i', 'o', 'u', 'ae'];
  for (let i = 0; i < n; i++) {
    const c = pick(cs), v = pick(vs), p = 1.05 - i * 0.04 + rnd(-0.03, 0.03), d = rnd(0.07, 0.1);
    if (c === 'r') out.push({ v: 'er', d: 0.035, p, amp: 0.6 });
    else if (c === 'l') out.push({ v: 'l', d: 0.035, p, amp: 0.6 });
    else if (c === 'm') out.push({ v: 'm', d: 0.04, p, amp: 0.5 });
    out.push({ v, d, p: [p, p * 0.97], amp: 0.75, br: 0.15, c: c && c.length <= 2 && c !== 'r' && c !== 'l' && c !== 'm' ? c as Cons : undefined });
  }
  if (shout) out.push(gap(0.03), { v: 'a', d: 0.28, p: [1.45, 1.1], amp: [1.2, 0.9], c: 'h', rasp: 0.2 });
  return out;
}

type Lines = Record<VoiceKind, () => Seg[]>;
const COMMON: Lines = {
  grunt: () => pick([
    [H('a', 0.13, [1.2, 1.0], [1, 0.7])],
    [H('u', 0.11, [1.25, 1.05], [1, 0.6], { end: 'p' })],
    [{ v: 'i', d: 0.04, p: 1.2, amp: 0.6, c: 'h' }, { v: 'a', d: 0.12, p: [1.25, 1.0], amp: [1, 0.6] }],
  ]),
  cast: () => pick([[H('a', 0.16, [1.15, 1.0])], [H('u', 0.14, [1.2, 1.0], 1, { end: 'p' })]]),
  castBig: () => [{ v: 'i', d: 0.05, p: 1.2, amp: 0.7, c: 'h' }, { v: 'a', d: 0.32, p: [1.35, 1.05], amp: [1.2, 0.8], rasp: 0.15 }],
  hurt: () => pick([
    [H('u', 0.13, [1.35, 0.95], [1, 0.5], { br: 0.1 })],
    [H('a', 0.11, [1.4, 1.1], [1, 0.5])],
    [{ v: 'm', d: 0.05, p: 1.2, amp: 0.7 }, { v: 'u', d: 0.1, p: [1.3, 1.0], amp: [1, 0.4] }],
    [{ v: 'oo', d: 0.08, p: [1.25, 1.0], amp: [1, 0.6], c: 'h' }, { v: null, d: 0.06, c: 'f' }],
  ]),
  hurtBig: () => pick([
    [H('a', 0.12, [1.5, 1.45], 1.2, { rasp: 0.3 }), { v: 'u', d: 0.2, p: [1.4, 0.95], amp: [1, 0.3], rasp: 0.35, br: [0, 0.4] }],
    [{ v: 'e', d: 0.05, p: 1.5, amp: 1, c: 'h' }, { v: 'a', d: 0.24, p: [1.55, 1.05], amp: [1.2, 0.3], rasp: 0.3 }],
  ]),
  death: () => [
    { v: 'a', d: 0.35, p: [1.45, 1.3], amp: [1.2, 1.0], c: 'h', rasp: 0.2 },
    { v: 'u', d: 0.4, p: [1.3, 0.85], amp: [1.0, 0.55], rasp: 0.4, br: [0.05, 0.3] },
    { v: 'o', d: 0.35, p: [0.85, 0.65], amp: [0.55, 0], rasp: 0.55, br: [0.3, 0.6] },
  ],
  win: () => [H('a', 0.12, [1.3, 1.15]), gap(0.05), H('a', 0.11, [1.25, 1.1], 0.9), gap(0.05), H('a', 0.2, [1.3, 0.95], [1, 0.4])],
};

/** Per-class lines; anything missing uses COMMON. */
const LINES: Record<ClassId, Partial<Lines>> = {
  warrior: {
    grunt: () => pick([
      [H('a', 0.14, [1.15, 0.95], [1.1, 0.7], { rasp: 0.2 })],
      [{ v: 'er', d: 0.05, p: 1.1, amp: 0.8, c: 'h' }, { v: 'a', d: 0.13, p: [1.2, 0.95], amp: [1.1, 0.6], rasp: 0.2 }],
      [H('u', 0.12, [1.2, 1.0], [1.1, 0.6], { end: 'p', rasp: 0.15 })],
    ]),
    cast: () => pick([
      [H('a', 0.2, [1.25, 1.0], [1.1, 0.7], { rasp: 0.25 })],
      [{ v: 'i', d: 0.04, p: 1.2, amp: 0.7, c: 'h' }, { v: 'a', d: 0.18, p: [1.3, 1.0], amp: [1.1, 0.6], rasp: 0.2 }],
    ]),
    // a battle roar
    castBig: () => [{ v: 'er', d: 0.08, p: [1.1, 1.25], amp: 0.9, c: 'h', rasp: 0.3 }, { v: 'a', d: 0.5, p: [1.35, 1.1], amp: [1.3, 0.6], rasp: 0.45, br: [0, 0.2] }],
    win: () => [H('a', 0.1, [1.2, 1.1]), gap(0.06), H('a', 0.1, [1.25, 1.1]), gap(0.06), H('a', 0.26, [1.35, 0.95], [1.1, 0.3], { rasp: 0.15 })],
  },
  mage: {
    grunt: () => pick([[H('a', 0.12, [1.1, 0.95], [0.9, 0.5])], [H('u', 0.1, [1.1, 0.95], [0.9, 0.5], { end: 'p' })]]),
    cast: () => incant(Math.random() < 0.5 ? 2 : 3, false),
    castBig: () => incant(4, true),
    // a dry chuckle through the nose
    win: () => [{ v: 'm', d: 0.09, p: [1.2, 1.1], amp: 0.8, c: 'h' }, gap(0.04), { v: 'm', d: 0.08, p: [1.15, 1.05], amp: 0.7, c: 'h' }, gap(0.05),
      { v: 'm', d: 0.06, p: 1.1, amp: 0.6 }, { v: 'e', d: 0.12, p: [1.15, 0.95], amp: [0.8, 0.3], c: 'h' }],
  },
  rogue: {
    grunt: () => pick([[H('u', 0.08, [1.1, 0.95], [0.8, 0.4], { br: 0.3 })], [{ v: null, d: 0.04, c: 't' }, H('a', 0.07, [1.1, 1.0], [0.7, 0.3], { br: 0.3 })]]),
    // a quick, hissed breath
    cast: () => pick([[{ v: null, d: 0.03, c: 't' }, { v: null, d: 0.1, c: 's' }], [H('a', 0.16, [1.15, 1.0], 0.8, { br: 0.3, end: 's' })]]),
    castBig: () => [{ v: 'i', d: 0.04, p: 1.3, amp: 0.7, c: 'h' }, { v: 'a', d: 0.16, p: [1.4, 1.1], amp: [1, 0.5] }, { v: null, d: 0.05, c: 's' }],
    win: () => [H('e', 0.07, [1.2, 1.1], 0.8, { br: 0.25 }), gap(0.05), H('e', 0.07, [1.15, 1.05], 0.7, { br: 0.25 }), gap(0.07), { v: 'm', d: 0.14, p: [1.1, 0.9], amp: [0.7, 0.2] }],
  },
  ranger: {
    cast: () => pick([[H('u', 0.12, [1.2, 1.05], 1, { end: 'p' })], [{ v: 'i', d: 0.04, p: 1.2, amp: 0.6, c: 'h' }, { v: 'a', d: 0.13, p: [1.25, 1.0], amp: [1, 0.6] }]]),
    castBig: () => [{ v: 'i', d: 0.05, p: 1.25, amp: 0.7, c: 'h' }, { v: 'a', d: 0.36, p: [1.4, 1.1], amp: [1.2, 0.5], rasp: 0.1 }],
  },
  cleric: {
    grunt: () => pick([[H('a', 0.11, [1.15, 1.0], [0.9, 0.5])], [H('u', 0.1, [1.15, 1.0], [0.9, 0.5])]]),
    // sung "ah" / "lu-men" / "o-ra" chants
    cast: () => pick([
      [{ v: 'a', d: 0.3, p: 1.12, amp: [0.8, 0.5], sing: true, c: 'h' }],
      [{ v: 'l', d: 0.04, p: 1.0, amp: 0.5 }, { v: 'oo', d: 0.12, p: 1.0, amp: 0.7, sing: true }, { v: 'm', d: 0.04, p: 1.12, amp: 0.5 }, { v: 'e', d: 0.2, p: 1.12, amp: [0.7, 0.4], sing: true }],
      [{ v: 'o', d: 0.14, p: 1.0, amp: 0.7, sing: true }, { v: 'er', d: 0.03, p: 1.0, amp: 0.5 }, { v: 'a', d: 0.22, p: 1.19, amp: [0.75, 0.4], sing: true }],
    ]),
    castBig: () => [{ v: 'a', d: 0.22, p: 1.0, amp: 0.8, sing: true, c: 'h' }, { v: 'a', d: 0.45, p: 1.33, amp: [0.9, 0.4], sing: true }],
    win: () => [{ v: 'a', d: 0.2, p: 1.0, amp: 0.8, sing: true, c: 'h' }, { v: 'a', d: 0.18, p: 1.26, amp: 0.8, sing: true }, { v: 'a', d: 0.4, p: 1.5, amp: [0.85, 0.2], sing: true }],
  },
};

const PRIORITY: Record<VoiceKind, number> = { grunt: 1, cast: 1, hurt: 2, castBig: 3, hurtBig: 3, win: 4, death: 5 };

// ---------- the synth ----------
interface Rig { c: AudioContext; inp: AudioNode; verb: AudioNode; pink: AudioBuffer; soft: PeriodicWave; pressed: PeriodicWave }
let R: Rig | null = null;

function rig(c: AudioContext, out: AudioNode): Rig {
  if (R && R.c === c) return R;
  const sr = c.sampleRate;
  const pink = c.createBuffer(1, sr * 2, sr), d = pink.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913;
    d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
  }
  // a glottal pulse: harmonics falling off with a spectral tilt (steeper = softer voice)
  const wave = (tilt: number): PeriodicWave => {
    const n = 48, re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) im[k] = 1 / Math.pow(k, tilt);
    return c.createPeriodicWave(re, im);
  };
  // chain: highpass (no boom) -> presence -> compressor -> level; a short stone room on a send
  const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 110;
  const pres = c.createBiquadFilter(); pres.type = 'peaking'; pres.frequency.value = 2600; pres.Q.value = 0.9; pres.gain.value = 3;
  const comp = c.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 6; comp.attack.value = 0.002; comp.release.value = 0.1;
  const lvl = c.createGain(); lvl.gain.value = 1.4;
  hp.connect(pres); pres.connect(comp); comp.connect(lvl); lvl.connect(out);
  const ir = c.createBuffer(2, Math.floor(sr * 0.7), sr);
  for (let ch = 0; ch < 2; ch++) { const x = ir.getChannelData(ch); for (let i = 0; i < x.length; i++) x[i] = (Math.random() * 2 - 1) * Math.exp(-i / sr * 7); }
  const verb = c.createConvolver(); verb.buffer = ir;
  const vg = c.createGain(); vg.gain.value = 0.25; verb.connect(vg); vg.connect(hp);
  R = { c, inp: hp, verb, pink, soft: wave(1.9), pressed: wave(1.25) };
  return R;
}

/** Sample a value along the segments: held inside each one, gliding into the next over its last stretch. */
function track(segs: Seg[], starts: number[], n: number, total: number, get: (s: Seg, u: number) => number): Float32Array<ArrayBuffer> {
  const out = new Float32Array(n);
  let i = 0;
  for (let k = 0; k < n; k++) {
    const t = (k / (n - 1)) * total;
    while (i < segs.length - 1 && t >= starts[i] + segs[i].d) i++;
    const s = segs[i], u = Math.min(1, Math.max(0, (t - starts[i]) / s.d));
    let v = get(s, u);
    const tr = Math.min(0.035, s.d * 0.4), left = starts[i] + s.d - t, nx = segs[i + 1];
    if (nx && left < tr) { const w = 1 - left / tr; v = v * (1 - w * 0.5) + get(nx, 0) * w * 0.5; }
    out[k] = v;
  }
  return out;
}

interface Playing { c: AudioContext; stop: () => void; end: number; prio: number }
const active: Array<Playing | null> = [null, null];

/** Say a line for a class. `side` lets a fighter's new line cut off its last one. */
export function playVoice(c: AudioContext, out: AudioNode, cls: ClassId, kind: VoiceKind, pan = 0, side = 0, gain = 1): void {
  const r = rig(c, out), prof = PROFILES[cls], now = c.currentTime;
  const cur = active[side];
  if (cur && cur.c === c && now < cur.end) {
    if (PRIORITY[kind] < cur.prio) return;
    cur.stop();
  }
  const segs = (LINES[cls][kind] ?? COMMON[kind])();
  const t0 = now + 0.005, starts: number[] = [];
  let total = 0;
  for (const s of segs) { starts.push(total); total += s.d; }
  const n = Math.max(16, Math.ceil(total * 200));
  const base = prof.f0 * LOW * rnd(0.96, 1.04), tract = prof.tract * rnd(0.97, 1.03);
  const sung = segs.some(s => s.sing), loud = kind !== 'cast' || cls === 'warrior' || cls === 'ranger';

  // pitch with jitter (and vibrato on sung notes)
  let walk = 0;
  const pitch = track(segs, starts, n, total, (s, u) => at(s.p, u, 1));
  const held = track(segs, starts, n, total, s => (s.sing ? 1 : 0));
  for (let k = 0; k < n; k++) {
    walk = walk * 0.85 + rnd(-1, 1) * 0.15;
    const t = (k / (n - 1)) * total;
    const vib = held[k] * Math.sin(t * 2 * Math.PI * 5.2) * prof.vib * Math.min(1, t / 0.12);
    pitch[k] = Math.max(30, base * pitch[k] * Math.pow(2, (vib + walk * (0.25 + prof.shake * 0.6)) / 12));
  }
  // voicing and breath: a consonant in front of a vowel holds the voice back while its noise plays
  const pre = (s: Seg): number => (s.c ? CONS[s.c].d : 0);
  const voiced = track(segs, starts, n, total, (s, u) => {
    if (!s.v) return 0;
    const t = u * s.d, p = pre(s);
    if (t < p) return 0;
    const a = at(s.amp, u, 1), on = Math.min(1, (t - p) / 0.012), endC = s.end ? CONS[s.end].d : 0;
    return a * on * (s.end && t > s.d - endC ? 0 : 1);
  });
  const breath = track(segs, starts, n, total, (s, u) => {
    if (!s.v) return 0;
    const t = u * s.d, h = s.c === 'h' && t < CONS.h.d ? 0.9 : 0;
    return Math.max(h, (prof.breath + at(s.br, u, 0)) * at(s.amp, u, 1) * 0.5);
  });
  // fade out the very end so nothing clicks
  for (let k = 0; k < n; k++) { const left = total * (1 - k / (n - 1)); if (left < 0.02) { voiced[k] *= left / 0.02; breath[k] *= left / 0.02; } }
  const raspC = track(segs, starts, n, total, s => Math.min(0.9, prof.rasp + (s.rasp ?? 0)));

  const nodes: AudioScheduledSourceNode[] = [];
  const vg = c.createGain(), ng = c.createGain(), mix = c.createGain(), outG = c.createGain(), pn = c.createStereoPanner();
  pn.pan.value = Math.max(-1, Math.min(1, pan));
  outG.gain.value = 0.7 * prof.vol * gain;
  mix.connect(outG); outG.connect(pn); pn.connect(r.inp);
  const send = c.createGain(); send.gain.value = 0.35; pn.connect(send); send.connect(r.verb);

  // glottal source, with a half-rate copy pulling every other pulse down (rasp)
  const osc = c.createOscillator(); osc.setPeriodicWave(loud || !sung ? r.pressed : r.soft);
  osc.frequency.setValueCurveAtTime(pitch, t0, total);
  const am = c.createGain(); am.gain.value = 1;
  const sub = c.createOscillator(); sub.type = 'square';
  const half = pitch.map(f => f / 2) as Float32Array<ArrayBuffer>;
  sub.frequency.setValueCurveAtTime(half, t0, total);
  const subG = c.createGain(); subG.gain.setValueCurveAtTime(raspC.map(v => v * 0.5) as Float32Array<ArrayBuffer>, t0, total);
  sub.connect(subG); subG.connect(am.gain);
  osc.connect(am); am.connect(vg);
  vg.gain.setValueCurveAtTime(voiced, t0, total);
  nodes.push(osc, sub);

  const noise = c.createBufferSource(); noise.buffer = r.pink; noise.loop = true;
  noise.connect(ng); ng.gain.setValueCurveAtTime(breath, t0, total);
  nodes.push(noise);

  // the vocal tract: four formants gliding between the vowels
  const src = c.createGain(); vg.connect(src); ng.connect(src);
  const vowelOf = (s: Seg): Vowel => s.v ?? 'u';
  for (let fi = 0; fi < 4; fi++) {
    const bp = c.createBiquadFilter(); bp.type = 'bandpass';
    const fc = track(segs, starts, n, total, s => VOWEL[vowelOf(s)].f[fi] * tract);
    const bw = [90, 110, 160, 220][fi];
    bp.Q.value = (VOWEL.a.f[fi] * tract) / bw;
    bp.frequency.setValueCurveAtTime(fc, t0, total);
    const g = c.createGain();
    g.gain.setValueCurveAtTime(track(segs, starts, n, total, s => VOWEL[vowelOf(s)].g[fi] * [1.6, 1.4, 1.1, 0.9][fi]), t0, total);
    src.connect(bp); bp.connect(g); g.connect(mix);
  }
  // consonant bursts and hisses
  segs.forEach((s, i) => {
    for (const [cn, when] of [[s.c, starts[i]], [s.end, starts[i] + Math.max(0, s.d - (s.end ? CONS[s.end].d : 0))]] as Array<[Cons | undefined, number]>) {
      if (!cn || cn === 'h') continue;
      const k = CONS[cn], t = t0 + when;
      const b = c.createBufferSource(); b.buffer = r.pink; b.loop = true; b.playbackRate.value = 1.6;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = k.f * Math.min(1.15, tract); f.Q.value = k.q;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(k.v * 1.6, t + Math.min(0.006, k.d * 0.3));
      g.gain.linearRampToValueAtTime(cn === 's' || cn === 'sh' || cn === 'f' ? k.v : 0.0001, t + k.d * 0.6);
      g.gain.linearRampToValueAtTime(0.0001, t + k.d);
      b.connect(f); f.connect(g); g.connect(mix);
      b.start(t, Math.random()); b.stop(t + k.d + 0.02);
    }
  });
  osc.start(t0); sub.start(t0); noise.start(t0, Math.random());
  for (const nd of nodes) nd.stop(t0 + total + 0.05);

  const play: Playing = {
    c,
    end: t0 + total,
    prio: PRIORITY[kind],
    stop: () => {
      const t = c.currentTime;
      outG.gain.cancelScheduledValues(t);
      outG.gain.setValueAtTime(outG.gain.value, t);
      outG.gain.linearRampToValueAtTime(0, t + 0.03);
      for (const nd of nodes) { try { nd.stop(t + 0.04); } catch { /* already stopped */ } }
    },
  };
  active[side] = play;
}
