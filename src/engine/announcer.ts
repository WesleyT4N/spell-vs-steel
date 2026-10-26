// Fighting-game announcer: recorded lines (voiceClips, from scripts/voices) over synthesized stingers
// (drum hits, a crash, a crowd roar) in a big stone hall.
import { playAnnouncerLine } from './voice';

export type Call = 'round' | 'final' | 'fight' | 'ko' | 'perfect' | 'wins' | 'match';

// ---------- stingers ----------
interface Rig { c: AudioContext; inp: AudioNode; hall: AudioNode; pink: AudioBuffer; white: AudioBuffer }
let R: Rig | null = null;

function rig(c: AudioContext, out: AudioNode): Rig {
  if (R && R.c === c) return R;
  const sr = c.sampleRate;
  const white = c.createBuffer(1, sr * 2, sr), w = white.getChannelData(0);
  for (let i = 0; i < w.length; i++) w[i] = Math.random() * 2 - 1;
  const pink = c.createBuffer(1, sr * 3, sr), p = pink.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < p.length; i++) { const x = Math.random() * 2 - 1; b0 = 0.99765 * b0 + x * 0.099046; b1 = 0.963 * b1 + x * 0.2965164; b2 = 0.57 * b2 + x * 1.0526913; p[i] = (b0 + b1 + b2 + x * 0.1848) * 0.2; }
  // light on bass like the rest of the mix, then glue and a ceiling
  const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 70;
  const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 8; comp.attack.value = 0.002; comp.release.value = 0.2;
  const lim = c.createDynamicsCompressor(); lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0; lim.release.value = 0.08;
  const lvl = c.createGain(); lvl.gain.value = 0.8;
  hp.connect(comp); comp.connect(lvl); lvl.connect(lim); lim.connect(out);
  // a big stone colosseum: long, dark tail
  const ir = c.createBuffer(2, Math.floor(sr * 2.4), sr);
  for (let ch = 0; ch < 2; ch++) { const x = ir.getChannelData(ch); let lp = 0; for (let i = 0; i < x.length; i++) { lp = lp * 0.6 + (Math.random() * 2 - 1) * 0.4; x[i] = lp * Math.exp(-i / sr * 2.6); } }
  const hall = c.createConvolver(); hall.buffer = ir;
  const hg = c.createGain(); hg.gain.value = 0.5; hall.connect(hg); hg.connect(hp);
  R = { c, inp: hp, hall, pink, white };
  return R;
}

function env(g: AudioParam, t: number, pts: Array<[number, number]>): void {
  g.setValueAtTime(0.0001, t);
  for (const [dt, v] of pts) g.linearRampToValueAtTime(v, t + dt);
}
function noise(buf: 'pink' | 'white', type: BiquadFilterType, f: number, q: number, t: number, pts: Array<[number, number]>, wet = 0.5, f1?: number): void {
  const r = R!, c = r.c, s = c.createBufferSource(); s.buffer = r[buf]; s.loop = true;
  const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q;
  const dur = pts[pts.length - 1][0];
  if (f1) { b.frequency.setValueAtTime(f, t); b.frequency.exponentialRampToValueAtTime(f1, t + dur); }
  const g = c.createGain(); env(g.gain, t, pts);
  const ws = c.createGain(); ws.gain.value = wet;
  s.connect(b); b.connect(g); g.connect(r.inp); g.connect(ws); ws.connect(r.hall);
  s.start(t, Math.random()); s.stop(t + dur + 0.05);
}
function tone(f0: number, f1: number, t: number, dur: number, vol: number, type: OscillatorType = 'sine', wet = 0.5): void {
  const r = R!, c = r.c, o = c.createOscillator(), g = c.createGain(), ws = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  ws.gain.value = wet;
  o.connect(g); g.connect(r.inp); g.connect(ws); ws.connect(r.hall); o.start(t); o.stop(t + dur + 0.02);
}

/** A big war drum: skin smack plus a short body, most of its size from the hall. */
function drum(t: number, vol = 1): void {
  noise('white', 'bandpass', 1400, 0.8, t, [[0.002, 0.9 * vol], [0.04, 0]], 0.6);
  tone(130, 62, t, 0.35, 0.9 * vol, 'sine', 0.7);
  noise('pink', 'lowpass', 600, 0.7, t, [[0.004, 0.8 * vol], [0.18, 0]], 0.8);
}
/** Cymbal-like crash: bright noise with inharmonic metal ringing under it. */
function crash(t: number, vol = 1): void {
  noise('white', 'highpass', 4000, 0.7, t, [[0.003, 0.6 * vol], [0.2, 0.25 * vol], [1.4, 0]], 0.5);
  for (const [f, v] of [[523, 0.12], [1260, 0.08], [2050, 0.06], [3390, 0.04]] as Array<[number, number]>) tone(f, f * 0.98, t, 1.2, v * vol, 'sine', 0.6);
}
/** A whoosh that swells into the next hit. */
function riser(t: number, dur: number, vol = 1): void {
  noise('pink', 'bandpass', 500, 1.2, t, [[dur * 0.9, 0.5 * vol], [dur, 0]], 0.4, 3500);
}
/** The crowd: a wash of roaring noise with a few cheering voices gliding up inside it. */
function crowd(t: number, dur: number, vol = 1): void {
  const r = R!, c = r.c;
  noise('pink', 'bandpass', 900, 0.6, t, [[0.25, 0.6 * vol], [dur * 0.5, 0.5 * vol], [dur, 0]], 0.7);
  noise('pink', 'bandpass', 2200, 1.4, t, [[0.3, 0.25 * vol], [dur * 0.5, 0.18 * vol], [dur, 0]], 0.7);
  for (let i = 0; i < 10; i++) {
    const st = t + Math.random() * dur * 0.4, d = 0.5 + Math.random() * 0.8, f = 170 + Math.random() * 220;
    const o = c.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(f, st); o.frequency.linearRampToValueAtTime(f * (1.25 + Math.random() * 0.3), st + d * 0.6); o.frequency.linearRampToValueAtTime(f * 1.1, st + d);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700 + Math.random() * 600; bp.Q.value = 2.5;
    const g = c.createGain(); env(g.gain, st, [[d * 0.3, 0.05 * vol], [d, 0]]);
    const ws = c.createGain(); ws.gain.value = 1;
    o.connect(bp); bp.connect(g); g.connect(r.inp); g.connect(ws); ws.connect(r.hall);
    o.start(st); o.stop(st + d + 0.05);
  }
}

const STINGER: Record<Call, (t: number) => void> = {
  round: t => { riser(t, 0.35, 0.8); drum(t + 0.35); drum(t + 0.6, 0.7); },
  final: t => { riser(t, 0.45, 1); drum(t + 0.45, 1.1); drum(t + 0.65, 0.8); drum(t + 0.85, 1); },
  fight: t => { drum(t, 1.1); crash(t, 1); crowd(t + 0.05, 1.6, 0.6); },
  ko: t => { drum(t, 1.3); crash(t + 0.02, 1.2); noise('pink', 'bandpass', 3000, 1, t, [[0.05, 0.6], [1.2, 0]], 0.6, 300); crowd(t + 0.2, 2.6, 1); },
  perfect: t => crash(t, 0.6),
  wins: t => crowd(t, 2.2, 0.7),
  match: t => { drum(t, 1); crash(t, 0.8); crowd(t, 2.8, 1); },
};

/** Delay from the stinger's start to the words, so a hit lands under the voice. */
const SAY_AT: Partial<Record<Call, number>> = { round: 0.3, final: 0.4 };

/** Make a call: its stinger and its line. `who` is the winner's class name as shown (WARRIOR, PRIEST...). */
/** `out` takes the spoken line, `fx` the stinger (it rides the sound effects channel). */
export function playCall(c: BaseAudioContext, out: AudioNode, fx: AudioNode | null, call: Call, args: { n?: number; who?: string } = {}): void {
  if (c.state === 'closed') return;
  if (fx) { rig(c as AudioContext, fx);
  STINGER[call](c.currentTime + 0.01); }
  const who = (args.who ?? '').toLowerCase();
  const key = call === 'round' ? `round${Math.min(5, Math.max(1, args.n ?? 1))}` : call === 'wins' || call === 'match' ? `${call}_${who}` : call;
  playAnnouncerLine(c, out, key, SAY_AT[call] ?? 0);
}
