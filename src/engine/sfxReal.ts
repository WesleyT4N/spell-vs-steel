// Realistic spell and combat sounds, synthesized live: layered noise, crackle and crystal partials, stereo
// panning by column, a short stone-arena room and a punchy master chain. No audio files.
// Profile (Wes): realistic not chiptune, light on bass, snappy, hits punchy, pitched a tad low.

/** Global pitch for the whole set: scales noise playback, filters, sweeps and tones. */
const PITCH = 0.88;

export interface RealOpts {
  /** -1 = left edge of the arena, +1 = right edge. */
  pan?: number;
  /** Damage dealt, for hits. */
  amt?: number;
  element?: string;
  basic?: 'light' | 'heavy';
  /** Length of the effect in seconds, for sounds that last as long as their visual. */
  dur?: number;
  data?: Record<string, number | string>;
}

interface Rig { c: AudioContext; inp: AudioNode; verb: ConvolverNode; white: AudioBuffer; pink: AudioBuffer; brown: AudioBuffer; grit: Float32Array<ArrayBuffer> }
let R: Rig | null = null;

function rig(c: AudioContext, out: AudioNode): Rig {
  if (R && R.c === c) return R;
  const sr = c.sampleRate;
  const mk = (len: number, fill: (d: Float32Array) => void): AudioBuffer => { const b = c.createBuffer(1, Math.floor(sr * len), sr); fill(b.getChannelData(0)); return b; };
  const white = mk(2, d => { for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; });
  const pink = mk(3, d => {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
    }
  });
  const brown = mk(3, d => { let l = 0; for (let i = 0; i < d.length; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.5; } });
  // stone colosseum: a short, bright stereo room with early reflections
  const ir = c.createBuffer(2, Math.floor(sr * 0.8), sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < d.length; i++) { const t = i / sr; d[i] = (Math.random() * 2 - 1) * Math.exp(-t * 6) * (t < 0.08 ? 0.4 + Math.random() : 1); }
  }
  const filt = (type: BiquadFilterType, f: number, gain = 0): BiquadFilterNode => { const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; b.gain.value = gain; return b; };
  // master: compressor -> highpass + low-shelf cut (not bassy) -> a little air -> limiter -> soft saturation
  const comp = c.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 10; comp.attack.value = 0.003; comp.release.value = 0.12;
  const hp = filt('highpass', 140), shelf = filt('lowshelf', 300, -6), air = filt('highshelf', 3500, 3);
  const gain = c.createGain(); gain.gain.value = 1.6;
  const lim = c.createDynamicsCompressor(); lim.threshold.value = -4; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0; lim.release.value = 0.06;
  const sat = c.createWaveShaper(); const sc = new Float32Array(2048);
  for (let i = 0; i < 2048; i++) { const x = (i / 1024 - 1) * 1.5; sc[i] = Math.tanh(x) / Math.tanh(1.5); }
  sat.curve = sc;
  const fin = c.createGain(); fin.gain.value = 0.85;
  comp.connect(hp); hp.connect(shelf); shelf.connect(air); air.connect(gain); gain.connect(lim); lim.connect(sat); sat.connect(fin); fin.connect(out);
  const verb = c.createConvolver(); verb.buffer = ir; const vg = c.createGain(); vg.gain.value = 0.22; verb.connect(vg); vg.connect(comp);
  const grit = new Float32Array(1024); for (let i = 0; i < 1024; i++) grit[i] = Math.tanh((i / 512 - 1) * 3);
  const made: Rig = { c, inp: comp, verb, white, pink, brown, grit };
  R = made;
  return made;
}

// ---------- building blocks ----------
const rnd = (a: number, b: number): number => a + Math.random() * (b - a);
const clampPan = (p: number): number => Math.max(-1, Math.min(1, p));

function chan(pan: number, send: number): { in: GainNode; pan: AudioParam } {
  const r = R!, c = r.c;
  const g = c.createGain(), p = c.createStereoPanner(), s = c.createGain();
  p.pan.value = clampPan(pan); s.gain.value = send;
  g.connect(p); p.connect(r.inp); p.connect(s); s.connect(r.verb);
  return { in: g, pan: p.pan };
}
function filt(type: BiquadFilterType, f: number, q = 0.7): BiquadFilterNode {
  const b = R!.c.createBiquadFilter(); b.type = type; b.frequency.value = Math.min(18000, f); b.Q.value = q; return b;
}
/** Random wobble: what makes fire and wind sound alive instead of like static. */
function flutter(n: number, depth: number): Float32Array<ArrayBuffer> {
  const a = new Float32Array(n); let v = 0;
  for (let i = 0; i < n; i++) { v = v * 0.6 + (Math.random() * 2 - 1) * 0.4; a[i] = Math.max(0.0001, 1 + v * depth); }
  return a;
}

interface Layer {
  buf?: 'white' | 'pink' | 'brown'; type?: BiquadFilterType; f?: number; f1?: number; q?: number;
  /** Envelope points [time, gain]; the last time is the length. */
  env: Array<[number, number]>; pan?: number; panTo?: number; send?: number; delay?: number; flut?: number; grit?: boolean;
}
/** A noise layer: buffer -> filter (optionally swept) -> envelope -> optional flutter/grit -> panned channel. */
function layer(o: Layer): void {
  const r = R!, c = r.c, t = c.currentTime + (o.delay ?? 0), dur = o.env[o.env.length - 1][0];
  const n = c.createBufferSource(); n.buffer = r[o.buf ?? 'pink']; n.loop = true; n.playbackRate.value = PITCH;
  const f0 = (o.f ?? 1000) * PITCH, b = filt(o.type ?? 'lowpass', f0, o.q ?? 0.7);
  if (o.f1) { b.frequency.setValueAtTime(f0, t); b.frequency.exponentialRampToValueAtTime(o.f1 * PITCH, t + dur); }
  const g = c.createGain(), ch = chan(o.pan ?? 0, o.send ?? 0.3);
  g.gain.setValueAtTime(0.0001, t);
  for (const [tt, v] of o.env) g.gain.linearRampToValueAtTime(v, t + tt);
  let tail: AudioNode = g;
  if (o.flut) { const fg = c.createGain(); fg.gain.setValueCurveAtTime(flutter(Math.max(4, Math.round(dur * 30)), o.flut), t, dur); g.connect(fg); tail = fg; }
  if (o.grit) { const s = c.createWaveShaper(); s.curve = r.grit; tail.connect(s); tail = s; }
  if (o.panTo !== undefined) ch.pan.linearRampToValueAtTime(clampPan(o.panTo), t + dur);
  n.connect(b); b.connect(g); tail.connect(ch.in);
  n.start(t, Math.random() * 1.5); n.stop(t + dur + 0.05);
}
/** Short resonant pops (fire, wood, debris); some get a woody low body. */
function crackles(o: { dur: number; rate: number; vol: number; pan?: number; spread?: number; delay?: number; decay?: boolean; lo?: number; hi?: number }): void {
  const r = R!, c = r.c, t0 = c.currentTime + (o.delay ?? 0), n = Math.round(o.dur * o.rate);
  for (let i = 0; i < n; i++) {
    const u = Math.random(), t = t0 + (o.decay ? u * u : u) * o.dur, big = Math.random() < 0.15;
    const s = c.createBufferSource(); s.buffer = r.white;
    const b = filt('bandpass', (big ? rnd(600, 1500) : rnd(o.lo ?? 1800, o.hi ?? 7000)) * PITCH, big ? 3 : rnd(2, 6));
    const g = c.createGain(), ch = chan((o.pan ?? 0) + rnd(-(o.spread ?? 0.3), o.spread ?? 0.3), 0.15);
    const v = o.vol * (big ? 1.6 : rnd(0.2, 1)) * (o.decay ? 1 - u * 0.7 : 1), d = big ? rnd(0.02, 0.05) : rnd(0.003, 0.012);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(b); b.connect(g); g.connect(ch.in); s.start(t, Math.random() * 1.5); s.stop(t + d + 0.01);
  }
}
/** Gritty bursts: ice cracking, gravel, crunching snow. */
function crunch(o: { dur: number; rate: number; vol: number; pan?: number; delay?: number; f?: number }): void {
  const r = R!, c = r.c, t0 = c.currentTime + (o.delay ?? 0), f = o.f ?? 3000;
  for (let i = 0, n = Math.round(o.dur * o.rate); i < n; i++) {
    const t = t0 + Math.random() * o.dur, d = rnd(0.008, 0.03);
    const s = c.createBufferSource(); s.buffer = r.white;
    const b = filt('bandpass', rnd(f * 0.5, f * 1.5) * PITCH, rnd(3, 9)), g = c.createGain(), ch = chan((o.pan ?? 0) + rnd(-0.2, 0.2), 0.2);
    g.gain.setValueAtTime(o.vol * rnd(0.4, 1), t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(b); b.connect(g); g.connect(ch.in); s.start(t, Math.random() * 1.5); s.stop(t + d + 0.01);
  }
}
/** A sine (or other) tone with a pitch sweep and a fast attack. */
function tone(f0: number, f1: number, dur: number, vol: number, pan = 0, delay = 0, type: OscillatorType = 'sine', send = 0.3): void {
  const c = R!.c, t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain(), ch = chan(pan, send);
  o.type = type; o.frequency.setValueAtTime(f0 * PITCH, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1 * PITCH), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(ch.in); o.start(t); o.stop(t + dur + 0.02);
}
/** Struck crystal, bell or metal: a few partials (inharmonic for metal and ice) ringing down. */
function ping(f: number, vol: number, pan = 0, delay = 0, dur = 0.12, partials: Array<[number, number]> = [[1, 1], [2.76, 0.5], [5.4, 0.25]], send = 0.35): void {
  const c = R!.c, t = c.currentTime + delay, ch = chan(pan, send);
  for (const [m, v] of partials) {
    if (f * m * PITCH > 16000) continue;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = f * m * PITCH;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * v, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur / m ** 0.3);
    o.connect(g); g.connect(ch.in); o.start(t); o.stop(t + dur + 0.02);
  }
}
const METAL: Array<[number, number]> = [[1, 1], [2.4, 0.6], [3.9, 0.35], [5.6, 0.2]];
const BELL: Array<[number, number]> = [[1, 1], [2, 0.45], [3, 0.25], [4.2, 0.12]];
function pings(o: { n: number; dur: number; vol: number; pan?: number; spread?: number; delay?: number; lo?: number; hi?: number; decay?: boolean; partials?: Array<[number, number]>; ring?: number }): void {
  for (let i = 0; i < o.n; i++) {
    const u = Math.random(), dec = o.decay ?? true;
    ping(rnd(o.lo ?? 2500, o.hi ?? 6000), o.vol * rnd(0.3, 1) * (dec ? 1 - u * 0.6 : 1), (o.pan ?? 0) + rnd(-(o.spread ?? 0.4), o.spread ?? 0.4),
      (o.delay ?? 0) + (dec ? u * u : u) * o.dur, o.ring ?? rnd(0.06, 0.18), o.partials);
  }
}
/** The hit: a hard click, a short mid smack and a quick body. Dry so it lands instantly. */
function punch(vol = 1, pan = 0, delay = 0): void {
  layer({ buf: 'white', type: 'highpass', f: 1800, env: [[0.0008, 1.4 * vol], [0.025, 0]], pan, send: 0.1, delay });
  layer({ buf: 'pink', type: 'bandpass', f: 1100, q: 1.2, env: [[0.002, 1.6 * vol], [0.06, 0]], pan, send: 0.15, delay, grit: true });
  tone(260, 110, 0.09, 1.1 * vol, pan, delay);
}
/** Air being cut: a band of noise swept from f to f1. */
function whoosh(f: number, f1: number, dur: number, vol: number, pan = 0, delay = 0, q = 1.2, panTo?: number): void {
  layer({ buf: 'pink', type: 'bandpass', f, f1, q, env: [[dur * 0.35, vol], [dur, 0]], pan, panTo, send: 0.2, delay });
}

// ---------- element flavors ----------
function fireBurst(vol: number, pan: number, big = 1): void {
  layer({ buf: 'brown', type: 'lowpass', f: 4000, f1: 600, env: [[0.005, vol], [0.08 * big, 0.4 * vol], [0.4 * big, 0]], pan, send: 0.4, grit: true, flut: 0.3 });
  layer({ buf: 'pink', type: 'bandpass', f: 2200, f1: 800, q: 0.7, env: [[0.008, 0.9 * vol], [0.3 * big, 0]], pan, send: 0.35, flut: 0.5 });
  crackles({ dur: 0.6 * big, rate: 45 * big, vol: 0.32 * vol, pan, spread: 0.5, delay: 0.04, decay: true });
}
function iceShatter(vol: number, pan: number): void {
  layer({ buf: 'white', type: 'highpass', f: 3000, env: [[0.001, 1.1 * vol], [0.06, 0]], pan, send: 0.3 });
  crunch({ dur: 0.1, rate: 200, vol: 0.4 * vol, pan, f: 3500 });
  pings({ n: Math.round(14 * vol), dur: 0.5, vol: 0.3 * vol, pan, lo: 2800, hi: 7500 });
}
function sparkle(vol: number, pan: number, delay = 0, n = 6): void {
  pings({ n, dur: 0.25, vol: 0.22 * vol, pan, delay, lo: 3000, hi: 8000, decay: false, partials: [[1, 1], [2, 0.3]] });
}
function darkSwell(dur: number, vol: number, pan: number, delay = 0): void {
  layer({ buf: 'brown', type: 'bandpass', f: 500, f1: 1400, q: 1.5, env: [[dur * 0.8, vol], [dur, 0]], pan, send: 0.3, delay, flut: 0.4 });
}
function gasHiss(dur: number, vol: number, pan: number, delay = 0): void {
  layer({ buf: 'white', type: 'highpass', f: 3500, env: [[0.02, vol], [dur, 0]], pan, send: 0.2, delay, flut: 0.6 });
  for (let i = 0; i < 4; i++) tone(rnd(180, 300), rnd(400, 700), 0.05, 0.25 * vol, pan + rnd(-0.2, 0.2), delay + rnd(0.02, dur), 'sine', 0.2); // bubbles
}
function metalClang(vol: number, pan: number, delay = 0, f = 1400): void {
  punch(0.6 * vol, pan, delay);
  ping(f * rnd(0.95, 1.05), 0.4 * vol, pan, delay, 0.35, METAL, 0.35);
}
function thud(vol: number, pan: number, delay = 0): void {
  layer({ buf: 'brown', type: 'bandpass', f: 500, q: 0.8, env: [[0.004, vol], [0.12, 0]], pan, send: 0.2, delay, grit: true });
  crunch({ dur: 0.12, rate: 80, vol: 0.25 * vol, pan, delay, f: 1600 });
}

// ---------- arcane: round, low and punchy (Deep Pulse), no crystal pings ----------
/** An oscillator (or a detuned pair) through a swept lowpass: warm, round synth body for magic. */
function synth(o: { type?: OscillatorType; f: number; f1?: number; dur: number; vol: number; pan?: number; delay?: number; lp?: number; lp1?: number; q?: number; detune?: number; atk?: number; send?: number; grit?: boolean }): void {
  const r = R!, c = r.c, t = c.currentTime + (o.delay ?? 0), dur = o.dur, ch = chan(o.pan ?? 0, o.send ?? 0.3);
  const lp = filt('lowpass', (o.lp ?? 2000) * PITCH, o.q ?? 1);
  if (o.lp1) { lp.frequency.setValueAtTime((o.lp ?? 2000) * PITCH, t); lp.frequency.exponentialRampToValueAtTime(o.lp1 * PITCH, t + dur); }
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.vol, t + (o.atk ?? 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let tail: AudioNode = g;
  if (o.grit) { const sh = c.createWaveShaper(); sh.curve = r.grit; g.connect(sh); tail = sh; }
  for (const k of o.detune ? [1 - o.detune, 1 + o.detune] : [1]) {
    const os = c.createOscillator(); os.type = o.type ?? 'sine';
    os.frequency.setValueAtTime(o.f * k * PITCH, t); if (o.f1) os.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1 * k * PITCH), t + dur);
    os.connect(lp); os.start(t); os.stop(t + dur + 0.02);
  }
  lp.connect(g); tail.connect(ch.in);
}
const jit = (): number => rnd(0.97, 1.03);
const dirTo = (o: RealOpts, k = 0.8): number => P0(o) + (o.data?.d === -1 || o.data?.dir === -1 ? -k : k);
/** Arcane Bolt (and each Arcane Missile) leaving the hand: a falling low thrum with a soft push of air. */
const arcaneBolt: Recipe = o => { const p = P0(o), j = jit(); synth({ f: 170 * j, f1: 85 * j, dur: 0.17, vol: 0.75, pan: p, lp: 900 }); synth({ type: 'triangle', f: 340 * j, f1: 170 * j, dur: 0.11, vol: 0.25, pan: p, lp: 1000 });
      layer({ buf: 'pink', type: 'bandpass', f: 450, f1: 1100, q: 1, env: [[0.03, 0.35], [0.14, 0]], pan: p, panTo: dirTo(o), send: 0.25 }); };
/** Arcane Beam: a longer, lower thrum that carries for the length of the beam. */
const arcaneBeam: Recipe = o => { const p = P0(o), d = o.dur ?? 0.32; synth({ f: 115, f1: 80, dur: d + 0.1, vol: 1, pan: p, lp: 700, atk: 0.02 }); synth({ type: 'triangle', f: 230, f1: 160, dur: d, vol: 0.35, pan: p, lp: 1000, detune: 0.01 });
      layer({ buf: 'pink', type: 'bandpass', f: 350, f1: 1000, q: 1.5, env: [[0.04, 0.6], [d, 0.3], [d + 0.08, 0]], pan: p, panTo: dirTo(o), send: 0.35, flut: 0.4 }); };
/** The arcane tail on a hit: a low whomp under the punch. */
const arcaneTail = (v: number, p: number): void => { synth({ f: 150, f1: 55, dur: 0.24, vol: 1 * v, pan: p, lp: 600 }); layer({ buf: 'brown', type: 'bandpass', f: 320, q: 1, env: [[0.01, 0.6 * v], [0.18, 0]], pan: p, send: 0.35 }); };

/** The holy tail on a hit: a low thump, no bell ringing. */
const holyTail = (v: number, p: number): void => { thud(0.6 * v, p); synth({ f: 160, f1: 70, dur: 0.18, vol: 0.7 * v, pan: p, lp: 600 }); };

/** Element tail layered on top of a hit's punch. */
function elementHit(el: string, vol: number, pan: number): void {
  switch (el) {
    case 'fire': fireBurst(0.55 * vol, pan, 0.6); break;
    case 'frost': crunch({ dur: 0.12, rate: 140, vol: 0.4 * vol, pan }); ping(3100, 0.25 * vol, pan, 0.01, 0.3); break;
    case 'arcane': arcaneTail(vol, pan); break;
    case 'holy': holyTail(vol, pan); break;
    case 'shadow': darkSwell(0.18, 0.6 * vol, pan); break;
    case 'poison': gasHiss(0.2, 0.5 * vol, pan); break;
    case 'nature': thud(0.6 * vol, pan); break;
    default: ping(rnd(1200, 1700), 0.22 * vol, pan, 0, 0.18, METAL, 0.25); crunch({ dur: 0.05, rate: 200, vol: 0.25 * vol, pan, f: 2500 }); break; // steel
  }
}

// ---------- recipes ----------
type Recipe = (o: RealOpts) => void;
const P0 = (o: RealOpts): number => o.pan ?? 0;
const REAL: Record<string, Recipe> = {
  // combat
  hit: o => { const p = P0(o), big = (o.amt ?? 20) >= 60; punch(big ? 1.15 : 0.85, p); elementHit(o.element ?? 'steel', big ? 1.1 : 0.8, p); },
  heavyImpact: o => { const p = P0(o); punch(1.3, p); thud(0.8, p); elementHit(o.element ?? 'steel', 1.1, p); },
  block: o => metalClang(0.8, P0(o), 0, 1700),
  break: o => { const p = P0(o); punch(1, p); crunch({ dur: 0.2, rate: 160, vol: 0.5, pan: p, f: 2200 }); crackles({ dur: 0.6, rate: 40, vol: 0.3, pan: p, decay: true, lo: 1500, hi: 5000 }); },
  freeze: o => { const p = P0(o); punch(0.9, p); crunch({ dur: 0.18, rate: 120, vol: 0.45, pan: p });
    layer({ buf: 'white', type: 'bandpass', f: 1800, f1: 3200, q: 12, env: [[0.06, 0.0001], [0.1, 0.6], [0.32, 0]], pan: p, send: 0.3 });
    ping(3100, 0.35, p, 0.02, 0.4); ping(4650, 0.2, p, 0.05, 0.3); },
  thaw: o => iceShatter(1, P0(o)),
  heal: o => { const p = P0(o); layer({ buf: 'pink', type: 'bandpass', f: 1800, f1: 3500, q: 2, env: [[0.15, 0.25], [0.45, 0]], pan: p, send: 0.4 });
    [0, 0.07, 0.14].forEach((d, i) => ping([1320, 1660, 1980][i], 0.18, p, d, 0.5, BELL, 0.5)); },
  reflect: o => { const p = P0(o); metalClang(0.7, p, 0, 2400); whoosh(4000, 1500, 0.18, 0.5, p, 0.02, 2, -p); },
  ko: o => { const p = P0(o); punch(1.4, p); thud(1, p); whoosh(1200, 300, 0.6, 0.6, p, 0.05); crackles({ dur: 0.5, rate: 30, vol: 0.2, pan: p, decay: true, lo: 800, hi: 3000 }); },
  step: o => layer({ buf: 'brown', type: 'bandpass', f: 1200, q: 1, env: [[0.003, 0.25], [0.05, 0]], pan: P0(o), send: 0.05 }),
  charged: o => { ping(1760, 0.18, P0(o), 0, 0.4, BELL, 0.4); sparkle(0.6, P0(o), 0.02, 4); },
  // casting, by element
  cast_fire: o => { const p = P0(o); layer({ buf: 'pink', type: 'bandpass', f: 600, f1: 2400, q: 0.9, env: [[0.02, 1.0], [0.08, 0.5], [0.22, 0]], pan: p, send: 0.2, flut: 0.5 });
    layer({ buf: 'brown', type: 'bandpass', f: 500, q: 0.8, env: [[0.015, 0.5], [0.15, 0]], pan: p, send: 0.1 }); crackles({ dur: 0.25, rate: 50, vol: 0.3, pan: p }); },
  cast_frost: o => { const p = P0(o); layer({ buf: 'pink', type: 'bandpass', f: 4500, f1: 1800, q: 1.2, env: [[0.06, 0.7], [0.25, 0]], pan: p, send: 0.3, flut: 0.4 });
    pings({ n: 5, dur: 0.2, vol: 0.18, pan: p, decay: false }); },
  cast_arcane: o => { const p = P0(o); synth({ f: 110, f1: 165, dur: 0.3, vol: 0.6, pan: p, lp: 700, atk: 0.12 }); layer({ buf: 'pink', type: 'bandpass', f: 300, f1: 900, q: 1.2, env: [[0.2, 0.4], [0.3, 0]], pan: p, send: 0.3 }); },
  cast_holy: o => layer({ buf: 'pink', type: 'lowpass', f: 600, f1: 2200, env: [[0.15, 0.5], [0.25, 0]], pan: P0(o), send: 0.3, flut: 0.3 }),
  cast_shadow: o => { const p = P0(o); darkSwell(0.25, 0.7, p); whoosh(600, 2500, 0.2, 0.35, p, 0.05); },
  cast_poison: o => gasHiss(0.25, 0.6, P0(o)),
  cast_nature: o => { const p = P0(o); layer({ buf: 'pink', type: 'bandpass', f: 1200, f1: 700, q: 1, env: [[0.05, 0.5], [0.25, 0]], pan: p, send: 0.3, flut: 0.8 }); crackles({ dur: 0.2, rate: 30, vol: 0.18, pan: p, lo: 1500, hi: 4000 }); },
  cast_steel: o => { const p = P0(o); whoosh(1500, 3500, 0.14, 0.5, p); ping(2200, 0.15, p, 0.05, 0.25, METAL); },
  // projectiles leaving
  shot_fireball: o => { const p = P0(o), d = o.dur ?? 0.5, to = p + (o.data?.dir === -1 ? -1.2 : 1.2);
    layer({ buf: 'brown', type: 'bandpass', f: 700, q: 0.7, env: [[0.04, 0.4], [d * 0.8, 0.45], [d, 0.1]], pan: p, panTo: to, send: 0.2, flut: 0.6 });
    layer({ buf: 'pink', type: 'bandpass', f: 1400, f1: 2000, q: 0.8, env: [[0.04, 0.45], [d, 0.3]], pan: p, panTo: to, send: 0.2, flut: 0.8 });
    crackles({ dur: d, rate: 50, vol: 0.2, pan: p, spread: 0.6 }); },
  shot_arrow: o => { const p = P0(o); tone(190, 150, 0.12, 0.5, p, 0, 'triangle', 0.15); layer({ buf: 'white', type: 'highpass', f: 2500, env: [[0.001, 0.6], [0.02, 0]], pan: p, send: 0.1 });
    whoosh(3500, 1800, 0.18, 0.35, p, 0.01, 2, p + (o.data?.dir === -1 ? -0.8 : 0.8)); },
  shot_knife: o => { const p = P0(o); whoosh(2500, 5000, 0.12, 0.5, p, 0, 1.5); for (let i = 0; i < 3; i++) whoosh(3000, 4000, 0.04, 0.25, p, 0.06 + i * 0.05, 3); },
  shot_spin: o => { const p = P0(o); for (let i = 0; i < 5; i++) whoosh(900, 1500, 0.07, 0.35, p, i * 0.07, 2); },
  shot_magic: o => { const p = P0(o); whoosh(2000, 4500, 0.15, 0.4, p, 0, 2); sparkle(0.5, p, 0, 3); },
  shot_chain: o => { const p = P0(o); whoosh(1500, 3000, 0.2, 0.4, p); crunch({ dur: 0.25, rate: 60, vol: 0.25, pan: p, f: 4500 }); },
  shot_net: o => whoosh(800, 1600, 0.25, 0.5, P0(o), 0, 0.8),
  shot_wind: o => layer({ buf: 'pink', type: 'bandpass', f: 900, f1: 2200, q: 2, env: [[0.1, 0.6], [0.4, 0]], pan: P0(o), panTo: P0(o) + 0.8, send: 0.35, flut: 0.6 }),
  shot_beast: o => { const p = P0(o); layer({ buf: 'brown', type: 'bandpass', f: 400, f1: 700, q: 3, env: [[0.05, 0.6], [0.3, 0]], pan: p, send: 0.2, flut: 1.2, grit: true }); for (let i = 0; i < 4; i++) thud(0.3, p, 0.05 + i * 0.07); },
};

// ---------- effect kinds (one sound per visual) ----------
const FX: Record<string, Recipe> = {
  cleave: o => whoosh(1800, 4500, 0.13, 0.75, P0(o), 0, 1.4),
  cleaveHeavy: o => { const p = P0(o); whoosh(700, 2600, 0.2, 0.9, p, 0, 1); thud(0.9, p, 0.15); },
  dagger: o => { const p = P0(o); whoosh(3000, 6000, 0.09, 0.6, p, 0, 1.8); ping(3200, 0.12, p, 0.03, 0.15, METAL); },
  knife: REAL.shot_knife,
  bolt: arcaneBolt,
  boltHeavy: arcaneBeam,
  arrow: REAL.shot_arrow,
  aimed: o => { const p = P0(o); tone(150, 110, 0.18, 0.7, p, 0, 'triangle', 0.15); layer({ buf: 'white', type: 'highpass', f: 2000, env: [[0.001, 1.1], [0.04, 0]], pan: p, send: 0.3 }); whoosh(4500, 1500, 0.12, 0.6, p, 0.01, 2.5); },
  holySpark: o => { const p = P0(o); layer({ buf: 'pink', type: 'lowpass', f: 2600, f1: 700, env: [[0.01, 0.6], [0.14, 0]], pan: p, panTo: dirTo(o), send: 0.2, flut: 0.3 }); synth({ f: 300 * jit(), f1: 190, dur: 0.1, vol: 0.35, pan: p, lp: 900 }); },
  holyPillar: o => { const p = P0(o); layer({ buf: 'pink', type: 'bandpass', f: 3000, f1: 600, q: 0.8, env: [[0.03, 0.7], [0.28, 0]], pan: p, send: 0.3, flut: 0.4 }); punch(1, p, 0.03); thud(0.8, p, 0.03); synth({ f: 110, f1: 55, dur: 0.25, vol: 0.8, pan: p, lp: 600, delay: 0.03 }); },
  holyNova: o => { const p = P0(o); punch(0.9, p); thud(0.9, p); layer({ buf: 'pink', type: 'lowpass', f: 3000, f1: 500, env: [[0.02, 0.8], [0.4, 0]], pan: p, send: 0.4, flut: 0.4 }); },
  healBurst: () => { /* heal() plays the heal sound */ },
  thrust: o => { const p = P0(o); whoosh(1500, 5000, 0.12, 0.8, p, 0, 1.6, p + 0.4 * Math.sign(Number(o.data?.d ?? 1))); ping(1500, 0.18, p, 0.02, 0.25, METAL); },
  smash: o => { const p = P0(o); punch(1, p); thud(1, p); },
  quake: o => { const p = P0(o); punch(0.9, p); thud(1, p); crackles({ dur: 0.45, rate: 35, vol: 0.3, pan: p, decay: true, lo: 700, hi: 2500 }); },
  shockwave: o => { const p = P0(o); punch(1, p); layer({ buf: 'brown', type: 'bandpass', f: 400, f1: 1200, q: 0.8, env: [[0.01, 1], [0.35, 0]], pan: p, send: 0.4, grit: true }); crackles({ dur: 0.4, rate: 50, vol: 0.3, pan: p, spread: 0.8, lo: 800, hi: 3000 }); },
  wide: o => { const p = P0(o); whoosh(600, 2800, 0.25, 0.9, p, 0, 0.9); thud(0.7, p, 0.12); },
  explode: o => { const p = P0(o); punch(1, p); fireBurst(1, p, (o.dur ?? 0.35) >= 0.45 ? 1.5 : 1); },
  pillar: o => { const p = P0(o);
    layer({ buf: 'pink', type: 'bandpass', f: 700, f1: 2800, q: 0.7, env: [[0.015, 1.2], [0.15, 0.6], [0.5, 0]], pan: p, send: 0.3, flut: 0.6 });
    layer({ buf: 'brown', type: 'bandpass', f: 900, q: 0.6, env: [[0.01, 0.7], [0.15, 0.35], [0.45, 0]], pan: p, send: 0.25, grit: true, flut: 0.4 });
    punch(1, p); crackles({ dur: 0.6, rate: 60, vol: 0.3, pan: p, spread: 0.4 }); },
  meteorFall: o => { const p = P0(o), d = (o.dur ?? 1.5) - 0.05;
    layer({ buf: 'pink', type: 'bandpass', f: 4000, f1: 1000, q: 2.5, env: [[d * 0.6, 0.35], [d, 0.9]], pan: p + 0.2, send: 0.2, flut: 0.3 });
    layer({ buf: 'brown', type: 'bandpass', f: 800, f1: 1400, q: 0.8, env: [[d, 0.5]], pan: p, send: 0.15, flut: 0.6 });
    crackles({ dur: d, rate: 30, vol: 0.15, pan: p }); },
  shard: o => { const p = P0(o), d = (o.dur ?? 0.3) * 0.5; whoosh(5000, 1800, d, 0.3, p, 0, 3); iceShatter(0.6, p); },
  arcaneHit: o => { const p = P0(o), big = (o.dur ?? 0.35) >= 0.45; punch(0.9, p); arcaneTail(big ? 1.6 : 1.3, p); if (big) synth({ f: 90, f1: 45, dur: 0.4, vol: 0.9, pan: p, lp: 500 }); },
  blink: o => { const p = P0(o); layer({ buf: 'pink', type: 'bandpass', f: 1500, f1: 6000, q: 2, env: [[0.12, 0.6], [0.14, 0]], pan: p, send: 0.4 }); sparkle(0.7, p, 0.1, 4); },
  nova: o => REAL.cast_frost(o),
  novaZone: o => { const p = P0(o);
    layer({ buf: 'white', type: 'highpass', f: 2500, env: [[0.001, 0.9], [0.03, 0]], pan: p, send: 0.2 });
    layer({ buf: 'pink', type: 'bandpass', f: 3500, f1: 900, q: 0.9, env: [[0.01, 1.0], [0.1, 0.5], [0.35, 0]], pan: p, send: 0.35, flut: 0.5 });
    crunch({ dur: 0.25, rate: 80, vol: 0.35, pan: p }); },
  guard: o => metalClang(0.8, P0(o), 0, 1300),
  shieldHit: o => metalClang(0.9, P0(o), 0, 1500),
  spark: o => { const p = P0(o); ping(rnd(1600, 2400), 0.3, p, 0, 0.25, METAL); crunch({ dur: 0.04, rate: 250, vol: 0.3, pan: p, f: 4000 }); },
  shout: o => { const p = P0(o); layer({ buf: 'brown', type: 'bandpass', f: 350, f1: 500, q: 2.5, env: [[0.05, 1], [0.35, 0.7], [0.55, 0]], pan: p, send: 0.4, flut: 0.8, grit: true });
    layer({ buf: 'pink', type: 'bandpass', f: 1100, q: 3, env: [[0.05, 0.4], [0.5, 0]], pan: p, send: 0.4, flut: 1 }); },
  transform: o => { const p = P0(o); layer({ buf: 'pink', type: 'bandpass', f: 500, f1: 4000, q: 1.2, env: [[0.5, 0.8], [0.6, 0]], pan: p, send: 0.5, flut: 0.3 }); punch(1, p, 0.5); sparkle(1, p, 0.5, 10); },
  counter: o => { const p = P0(o); layer({ buf: 'pink', type: 'bandpass', f: 5000, f1: 800, q: 3, env: [[0.01, 0.7], [0.25, 0]], pan: p, send: 0.4 }); punch(0.6, p); },
  banner: o => { const p = P0(o); for (let i = 0; i < 4; i++) layer({ buf: 'pink', type: 'bandpass', f: 1400, q: 1, env: [[0.02, 0.5], [0.08, 0]], pan: p, send: 0.2, delay: i * 0.09 }); thud(0.6, p, 0.05); },
  stab: o => { const p = P0(o); whoosh(3000, 6000, 0.07, 0.6, p, 0, 2); whoosh(3500, 6500, 0.07, 0.5, p, 0.07, 2); },
  smoke: o => { const p = P0(o); layer({ buf: 'pink', type: 'lowpass', f: 1500, f1: 400, env: [[0.01, 0.8], [0.3, 0]], pan: p, send: 0.3 }); layer({ buf: 'white', type: 'highpass', f: 4000, env: [[0.02, 0.25], [0.35, 0]], pan: p, send: 0.2 }); },
  toxicPuff: o => { const p = P0(o); layer({ buf: 'pink', type: 'lowpass', f: 1200, env: [[0.01, 0.5], [0.2, 0]], pan: p, send: 0.2 }); gasHiss(0.35, 0.7, p); },
  lob: o => whoosh(800, 2000, (o.dur ?? 0.4) * 0.6, 0.4, P0(o), 0, 1.2),
  trapPop: o => { const p = P0(o), k = String(o.data?.kind ?? 'explode');
    metalClang(0.7, p, 0, 2000); // the trap snapping shut
    if (k === 'freeze') { iceShatter(0.8, p); crunch({ dur: 0.18, rate: 120, vol: 0.4, pan: p }); }
    else if (k === 'mine') thud(1, p, 0.02); },
  hawkDive: o => { const p = P0(o); layer({ buf: 'white', type: 'bandpass', f: 4200, f1: 2600, q: 14, env: [[0.03, 0.7], [0.3, 0]], pan: p, send: 0.35, flut: 0.6 }); for (let i = 0; i < 3; i++) whoosh(2500, 4500, 0.06, 0.4, p, 0.15 + i * 0.05, 2); },
  bite: o => { const p = P0(o); layer({ buf: 'brown', type: 'bandpass', f: 450, q: 3, env: [[0.04, 0.8], [0.22, 0]], pan: p, send: 0.2, flut: 1.4, grit: true }); punch(0.8, p, 0.08); crunch({ dur: 0.08, rate: 150, vol: 0.4, pan: p, delay: 0.08, f: 1800 }); },
  claw: o => { const p = P0(o); for (let i = 0; i < 4; i++) whoosh(2500, 5500, 0.06, 0.45, p, i * 0.05, 2); },
  flare: o => { const p = P0(o); layer({ buf: 'white', type: 'bandpass', f: 3000, q: 1, env: [[0.01, 0.5], [0.4, 0]], pan: p, send: 0.3, flut: 1.2 }); punch(0.5, p); },
  arrowRain: o => { const p = P0(o), d = (o.dur ?? 0.35) * 0.5; for (let i = 0; i < 3; i++) whoosh(4500, 2000, d, 0.25, p, i * 0.03, 3); for (let i = 0; i < 3; i++) thud(0.4, p + rnd(-0.1, 0.1), d + i * 0.03); },
  laser: o => { const p = P0(o), d = o.dur ?? 1; for (let i = 0, t = 0; t < d; i++) { ping(2600, 0.12, p, t, 0.06, [[1, 1]], 0.1); t += 0.18 * (1 - t / d) + 0.04; } },
};

// older names still used around the game
Object.assign(REAL, {
  missile: arcaneBolt, explode: FX.explode, slash: FX.cleave, slashHeavy: FX.cleaveHeavy, bolt: FX.bolt, boltHeavy: FX.boltHeavy,
  hitBig: (o: RealOpts) => REAL.hit({ ...o, amt: 80 }), fire: REAL.cast_fire, frost: REAL.cast_frost, arcane: REAL.cast_arcane, cast: REAL.cast_arcane,
  shot_hawk: FX.hawkDive,
});

const lastPlayed: Record<string, number> = {};

/** Play a realistic recipe into `out`. Returns false if there is none (the caller falls back to its old blip). */
export function playReal(c: AudioContext, out: AudioNode, name: string, o: RealOpts = {}): boolean {
  const fx = name.startsWith('fx:'), key = fx ? name.slice(3) : name;
  const fn = fx ? FX[key] : REAL[key];
  if (!fn) return false;
  rig(c, out);
  // one voice per sound at a time: Inferno puts 9 explosions down in one frame
  const now = c.currentTime;
  if (now - (lastPlayed[name] ?? -1) < 0.04) return true;
  lastPlayed[name] = now;
  fn(o);
  return true;
}
