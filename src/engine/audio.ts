// WebAudio sound: realistic combat/spell effects (sfxReal), NES-style blips for menus, and a tiny SNES-style sequencer for the BGM.
import { getSave, setSave } from './save';
import { playReal, type RealOpts } from './sfxReal';
import { playVoice, loadClips, type VoiceKind } from './voice';
import { playCall, type Call } from './announcer';
import type { ClassId } from '../art/sprites';

let ctx: AudioContext | null = null;
let master: GainNode, sfxBus: GainNode, stingBus: GainNode, voiceBus: GainNode, annBus: GainNode, realBus: GainNode, musicBus: GainNode, reverb: ConvolverNode, reverbSend: GainNode;
let noiseBuf: AudioBuffer;
let muted = false;

/** Player audio settings. Volumes run 0-10. */
export interface AudioSettings { master: number; sfx: number; music: number; sfxOn: boolean; musicOn: boolean; voice: number; announcer: number }
const DEFAULT_AUDIO: AudioSettings = { master: 8, sfx: 10, music: 10, sfxOn: true, musicOn: true, voice: 8, announcer: 8 };
let settings: AudioSettings = { ...DEFAULT_AUDIO };
muted = getSave('muted');
// keep only known settings of the right type, so a hand-edited save can't break the mix
for (const [k, v] of Object.entries(getSave('audio'))) {
  if (k in DEFAULT_AUDIO && typeof v === typeof DEFAULT_AUDIO[k as keyof AudioSettings]) (settings as unknown as Record<string, unknown>)[k] = v;
}

// Base mix levels at full volume.
const MASTER = 1, SFX_LEVEL = 0.45, MUSIC_LEVEL = 0.32, VOICE_LEVEL = 0.5, ANN_LEVEL = 0.55;
const masterGain = (): number => (muted ? 0 : MASTER * settings.master / 10);
const sfxGain = (): number => (settings.sfxOn ? SFX_LEVEL * settings.sfx / 10 : 0);
const musicGain = (): number => (settings.musicOn ? MUSIC_LEVEL * settings.music / 10 : 0);
const voiceGain = (): number => VOICE_LEVEL * settings.voice / 10;
const annGain = (): number => ANN_LEVEL * settings.announcer / 10;

function applyGains(): void {
  if (!ctx) return;
  const t = ctx.currentTime;
  master.gain.setTargetAtTime(masterGain(), t, 0.02);
  sfxBus.gain.setTargetAtTime(sfxGain(), t, 0.02);
  musicBus.gain.setTargetAtTime(musicGain(), t, 0.02);
  voiceBus.gain.setTargetAtTime(voiceGain(), t, 0.02);
  annBus.gain.setTargetAtTime(annGain(), t, 0.02);
}

export const getAudioSettings = (): AudioSettings => ({ ...settings });
export function setAudioSettings(patch: Partial<AudioSettings>): void {
  settings = { ...settings, ...patch };
  setSave('audio', { ...settings });
  applyGains();
}

function init(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = masterGain();
  master.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.gain.value = sfxGain(); sfxBus.connect(master);
  realBus = ctx.createGain(); realBus.gain.value = 0.75; realBus.connect(sfxBus);
  musicBus = ctx.createGain(); musicBus.gain.value = musicGain(); musicBus.connect(master);
  voiceBus = ctx.createGain(); voiceBus.gain.value = voiceGain(); voiceBus.connect(master);
  annBus = ctx.createGain(); annBus.gain.value = annGain(); annBus.connect(master);
  // announcer stingers sit on the SFX channel, well under the announcer's voice
  stingBus = ctx.createGain(); stingBus.gain.value = 0.45; stingBus.connect(sfxBus);
  // SNES-ish echo: a short generated reverb tail
  reverb = ctx.createConvolver();
  const len = Math.floor(ctx.sampleRate * 1.6);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  reverb.buffer = ir;
  reverbSend = ctx.createGain(); reverbSend.gain.value = 0.35;
  reverbSend.connect(reverb); reverb.connect(musicBus);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  return ctx;
}

/** Browsers only allow audio after a user gesture; call this from input handlers. */
export function unlockAudio(): void {
  const was = ctx;
  const c = init();
  if (!was && c) void loadClips(c);
  if (c && c.state === 'suspended') void c.resume();
}

/** Pause all sound while the game is in the background, and pick it back up when it returns. */
export function setAudioSuspended(on: boolean): void {
  if (!ctx) return;
  void (on ? ctx.suspend() : ctx.resume()).catch(() => { /* resume waits for a gesture on some browsers */ });
}

export function toggleMute(): boolean {
  muted = !muted;
  setSave('muted', muted);
  applyGains();
  return muted;
}
export const isMuted = (): boolean => muted;

// ---------- sound effects ----------
type Wave = OscillatorType | 'noise';
interface Blip { w: Wave; f0: number; f1: number; d: number; v: number; delay?: number; hp?: number }

const SFX: Record<string, Blip[]> = {
  step: [{ w: 'triangle', f0: 220, f1: 160, d: 0.035, v: 0.18 }],
  move: [{ w: 'square', f0: 660, f1: 660, d: 0.04, v: 0.2 }],
  select: [{ w: 'square', f0: 880, f1: 1320, d: 0.07, v: 0.25 }],
  back: [{ w: 'square', f0: 660, f1: 330, d: 0.08, v: 0.25 }],
  open: [{ w: 'square', f0: 440, f1: 880, d: 0.12, v: 0.25 }, { w: 'square', f0: 660, f1: 1320, d: 0.12, v: 0.2, delay: 0.08 }],
  confirm: [{ w: 'square', f0: 523, f1: 523, d: 0.06, v: 0.25 }, { w: 'square', f0: 784, f1: 784, d: 0.1, v: 0.25, delay: 0.06 }],
  charged: [{ w: 'square', f0: 1200, f1: 1800, d: 0.08, v: 0.15 }],
  pip: [{ w: 'square', f0: 990, f1: 1480, d: 0.06, v: 0.18 }],
  slash: [{ w: 'noise', f0: 0, f1: 0, d: 0.06, v: 0.35, hp: 2000 }, { w: 'square', f0: 300, f1: 120, d: 0.05, v: 0.15 }],
  slashHeavy: [{ w: 'noise', f0: 0, f1: 0, d: 0.14, v: 0.45, hp: 800 }, { w: 'sawtooth', f0: 220, f1: 60, d: 0.12, v: 0.25 }],
  bolt: [{ w: 'square', f0: 1400, f1: 500, d: 0.06, v: 0.18 }],
  boltHeavy: [{ w: 'sawtooth', f0: 900, f1: 150, d: 0.2, v: 0.25 }, { w: 'noise', f0: 0, f1: 0, d: 0.1, v: 0.2, hp: 3000 }],
  hit: [{ w: 'noise', f0: 0, f1: 0, d: 0.05, v: 0.3, hp: 1200 }, { w: 'square', f0: 180, f1: 90, d: 0.05, v: 0.2 }],
  // heavy basic landing: a low boom, a crunch and a ringing smack layered together
  heavyImpact: [
    { w: 'sine', f0: 150, f1: 38, d: 0.32, v: 0.6 },
    { w: 'noise', f0: 0, f1: 0, d: 0.22, v: 0.55, hp: 250 },
    { w: 'square', f0: 220, f1: 55, d: 0.16, v: 0.3 },
    { w: 'noise', f0: 0, f1: 0, d: 0.06, v: 0.35, hp: 4000 },
  ],
  hitBig: [{ w: 'noise', f0: 0, f1: 0, d: 0.18, v: 0.45, hp: 400 }, { w: 'square', f0: 140, f1: 40, d: 0.15, v: 0.3 }],
  block: [{ w: 'square', f0: 1800, f1: 1800, d: 0.03, v: 0.18 }, { w: 'square', f0: 2400, f1: 2400, d: 0.05, v: 0.15, delay: 0.03 }],
  break: [{ w: 'noise', f0: 0, f1: 0, d: 0.25, v: 0.4, hp: 1500 }, { w: 'square', f0: 2000, f1: 400, d: 0.2, v: 0.2 }],
  freeze: [{ w: 'triangle', f0: 2200, f1: 3200, d: 0.2, v: 0.3 }, { w: 'noise', f0: 0, f1: 0, d: 0.15, v: 0.15, hp: 6000 }],
  heal: [{ w: 'triangle', f0: 523, f1: 523, d: 0.08, v: 0.3 }, { w: 'triangle', f0: 659, f1: 659, d: 0.08, v: 0.3, delay: 0.08 }, { w: 'triangle', f0: 784, f1: 784, d: 0.15, v: 0.3, delay: 0.16 }],
  deny: [{ w: 'square', f0: 140, f1: 140, d: 0.1, v: 0.2 }],
  cast: [{ w: 'square', f0: 330, f1: 660, d: 0.1, v: 0.2 }],
  fire: [{ w: 'noise', f0: 0, f1: 0, d: 0.25, v: 0.3, hp: 300 }, { w: 'sawtooth', f0: 200, f1: 400, d: 0.2, v: 0.15 }],
  frost: [{ w: 'triangle', f0: 1600, f1: 2600, d: 0.18, v: 0.25 }],
  arcane: [{ w: 'square', f0: 700, f1: 1400, d: 0.12, v: 0.18 }, { w: 'square', f0: 1050, f1: 2100, d: 0.12, v: 0.12, delay: 0.05 }],
  missile: [{ w: 'square', f0: 1200, f1: 1800, d: 0.05, v: 0.12 }],
  reflect: [{ w: 'square', f0: 2000, f1: 600, d: 0.12, v: 0.2 }],
  explode: [{ w: 'noise', f0: 0, f1: 0, d: 0.4, v: 0.5, hp: 100 }, { w: 'sawtooth', f0: 120, f1: 30, d: 0.3, v: 0.25 }],
  ko: [{ w: 'square', f0: 440, f1: 110, d: 0.6, v: 0.3 }, { w: 'noise', f0: 0, f1: 0, d: 0.6, v: 0.3, hp: 200 }],
  win: [523, 659, 784, 1047].map((f, i) => ({ w: 'square' as Wave, f0: f, f1: f, d: 0.12, v: 0.25, delay: i * 0.12 })),
};

/** Silence sound effects while `fn` runs (headless sims in the dev tools). */
let quiet = 0;
export function withoutSfx<T>(fn: () => T): T {
  quiet++;
  try { return fn(); } finally { quiet--; }
}

/** Play a sound effect. Combat and spell names have a realistic recipe; the rest (menus) are blips. */
export function sfx(name: string, o?: RealOpts): void {
  const c = ctx;
  if (!c || c.state !== 'running' || quiet || muted || !settings.sfxOn || settings.sfx === 0) return;
  if (playReal(c, realBus, name, o)) return;
  const list = SFX[name];
  if (!list) return;
  const t0 = c.currentTime;
  for (const b of list) {
    const t = t0 + (b.delay ?? 0);
    const g = c.createGain();
    g.gain.setValueAtTime(b.v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + b.d);
    let src: AudioScheduledSourceNode;
    if (b.w === 'noise') {
      const n = c.createBufferSource();
      n.buffer = noiseBuf;
      const f = c.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = b.hp ?? 1000;
      n.connect(f); f.connect(g);
      src = n;
    } else {
      const o = c.createOscillator();
      o.type = b.w;
      o.frequency.setValueAtTime(b.f0, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, b.f1), t + b.d);
      o.connect(g);
      src = o;
    }
    g.connect(sfxBus);
    src.start(t);
    src.stop(t + b.d + 0.02);
  }
}

/** A fighter's voice: grunts, casting, hurt and death. `side` keeps each fighter to one line at a time. */
export function voiceLine(cls: ClassId, kind: VoiceKind, pan = 0, side = 0, element?: string): void {
  const c = ctx;
  if (!c || c.state !== 'running' || quiet || muted || settings.voice === 0) return;
  playVoice(c, voiceBus, cls, kind, pan, side, element);
}

/** The announcer: a stinger plus the spoken words. */
export function announce(call: Call, args?: { n?: number; who?: string }): void {
  const c = ctx;
  if (!c || c.state !== 'running' || quiet || muted || settings.announcer === 0) return;
  playCall(c, annBus, settings.sfxOn && settings.sfx > 0 ? stingBus : null, call, args);
}

/** The sound that goes with a spell effect's visual (see battle.addFx). */
export function sfxFx(kind: string, o?: RealOpts): void { sfx('fx:' + kind, o); }

// ---------- music ----------
// Tracks are written as one token per step: a note ("D5", "C#4", "Bb3"), "-" to hold, "." for a rest.
export interface Song {
  bpm: number;
  /** Steps per beat (2 = eighth notes, 4 = sixteenths). */
  steps: number;
  /** Bars played once before the loop starts. */
  intro?: number;
  tracks: Array<{ inst: Instrument; notes: string[]; vol?: number }>;
}
export type Instrument = 'lead' | 'flute' | 'harp' | 'strings' | 'bass' | 'kick' | 'snare' | 'hat' | 'brass';

const NOTE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function midi(n: string): number {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(n);
  if (!m) return -1;
  return 12 * (parseInt(m[3]) + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
const hz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

function voice(c: AudioContext, inst: Instrument, freq: number, t: number, dur: number, vol: number): void {
  const out = c.createGain();
  out.connect(musicBus);
  out.connect(reverbSend);
  const env = out.gain;
  const end = t + dur;
  const osc = (type: OscillatorType, f: number, detune = 0): OscillatorNode => {
    const o = c.createOscillator();
    o.type = type; o.frequency.value = f; o.detune.value = detune;
    return o;
  };
  const vib = (o: OscillatorNode, depth: number, delay: number): void => {
    const l = c.createOscillator(); l.frequency.value = 5.5;
    const lg = c.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(depth, t + delay);
    l.connect(lg); lg.connect(o.detune); l.start(t); l.stop(end + 0.3);
  };
  const lp = (f: number, q = 0.7): BiquadFilterNode => { const b = c.createBiquadFilter(); b.type = 'lowpass'; b.frequency.value = f; b.Q.value = q; b.connect(out); return b; };
  const play = (nodes: AudioScheduledSourceNode[], stop: number): void => { for (const n of nodes) { n.start(t); n.stop(stop); } };

  switch (inst) {
    case 'lead': case 'brass': {
      const f = lp(inst === 'brass' ? 1800 : 2600, 2);
      f.frequency.setValueAtTime(600, t);
      f.frequency.linearRampToValueAtTime(inst === 'brass' ? 2200 : 3000, t + 0.06);
      f.frequency.linearRampToValueAtTime(inst === 'brass' ? 1400 : 2000, t + 0.3);
      const a = osc('sawtooth', freq, -6), b = osc('square', freq, 6);
      const ga = c.createGain(); ga.gain.value = 0.5; a.connect(ga); b.connect(ga); ga.connect(f);
      vib(a, 14, 0.25); vib(b, 14, 0.25);
      env.setValueAtTime(0, t); env.linearRampToValueAtTime(vol, t + 0.02); env.setValueAtTime(vol * 0.8, end - 0.02); env.linearRampToValueAtTime(0, end + 0.08);
      play([a, b], end + 0.1);
      break;
    }
    case 'flute': {
      const f = lp(3000);
      const a = osc('triangle', freq), b = osc('sine', freq * 2);
      const gb = c.createGain(); gb.gain.value = 0.15; b.connect(gb); gb.connect(f); a.connect(f);
      vib(a, 18, 0.2); vib(b, 18, 0.2);
      env.setValueAtTime(0, t); env.linearRampToValueAtTime(vol, t + 0.06); env.setValueAtTime(vol * 0.85, end - 0.03); env.linearRampToValueAtTime(0, end + 0.15);
      play([a, b], end + 0.2);
      break;
    }
    case 'harp': {
      const f = lp(2600);
      const a = osc('triangle', freq), b = osc('square', freq);
      const gb = c.createGain(); gb.gain.value = 0.12; b.connect(gb); gb.connect(f); a.connect(f);
      env.setValueAtTime(vol, t); env.exponentialRampToValueAtTime(0.001, t + 1.2);
      play([a, b], t + 1.25);
      break;
    }
    case 'strings': {
      const f = lp(1300);
      const a = osc('sawtooth', freq, -9), b = osc('sawtooth', freq, 9);
      const ga = c.createGain(); ga.gain.value = 0.5; a.connect(ga); b.connect(ga); ga.connect(f);
      env.setValueAtTime(0, t); env.linearRampToValueAtTime(vol, t + 0.18); env.setValueAtTime(vol, end - 0.05); env.linearRampToValueAtTime(0, end + 0.3);
      play([a, b], end + 0.35);
      break;
    }
    case 'bass': {
      const f = lp(900, 3);
      const a = osc('sawtooth', freq), b = osc('triangle', freq);
      a.connect(f); b.connect(f);
      env.setValueAtTime(vol, t); env.exponentialRampToValueAtTime(vol * 0.5, t + dur * 0.8); env.linearRampToValueAtTime(0, end + 0.03);
      play([a, b], end + 0.05);
      break;
    }
    case 'kick': {
      const a = osc('sine', 150);
      a.frequency.setValueAtTime(150, t); a.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      a.connect(out);
      env.setValueAtTime(vol, t); env.exponentialRampToValueAtTime(0.001, t + 0.18);
      play([a], t + 0.2);
      break;
    }
    case 'snare': case 'hat': {
      const n = c.createBufferSource(); n.buffer = noiseBuf;
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = inst === 'hat' ? 7000 : 1500;
      n.connect(hp); hp.connect(out);
      const d = inst === 'hat' ? 0.04 : 0.14;
      env.setValueAtTime(vol, t); env.exponentialRampToValueAtTime(0.001, t + d);
      const nodes: AudioScheduledSourceNode[] = [n];
      if (inst === 'snare') { const o = osc('triangle', 190); const g2 = c.createGain(); g2.gain.value = 0.6; o.connect(g2); g2.connect(out); nodes.push(o); }
      play(nodes, t + d + 0.02);
      break;
    }
  }
}

interface Playing { song: Song; step: number; next: number; timer: number; total: number; introSteps: number; parsed: Array<Array<{ m: number; len: number } | null>> }
let current: Playing | null = null;
let currentName = '';

function parse(song: Song): Playing['parsed'] {
  return song.tracks.map(tr => {
    const out: Array<{ m: number; len: number } | null> = [];
    tr.notes.forEach((tok, i) => {
      if (tok === '-' || tok === '.') { out.push(null); return; }
      let len = 1;
      while (tr.notes[i + len] === '-') len++;
      out.push({ m: tok === 'x' ? 0 : midi(tok), len });
    });
    return out;
  });
}

export function playMusic(name: string, song: Song): void {
  if (currentName === name && current) return;
  stopMusic();
  const c = init();
  if (!c) return;
  currentName = name;
  const parsed = parse(song);
  const total = Math.max(...song.tracks.map(t => t.notes.length));
  const introSteps = (song.intro ?? 0) * song.steps * 4;
  const p: Playing = { song, step: 0, next: c.currentTime + 0.1, timer: 0, total, introSteps, parsed };
  const stepDur = 60 / song.bpm / song.steps;
  const tick = (): void => {
    if (!ctx || current !== p) return;
    while (p.next < ctx.currentTime + 0.2) {
      if (ctx.state === 'running') {
        song.tracks.forEach((tr, k) => {
          const ev = p.parsed[k][p.step];
          if (!ev) return;
          const vol = tr.vol ?? 0.2;
          if (tr.inst === 'kick' || tr.inst === 'snare' || tr.inst === 'hat') voice(ctx!, tr.inst, 0, p.next, stepDur, vol);
          else if (ev.m > 0) voice(ctx!, tr.inst, hz(ev.m), p.next, ev.len * stepDur * 0.95, vol);
        });
      }
      p.next += stepDur;
      p.step++;
      if (p.step >= p.total) p.step = p.introSteps;
    }
  };
  p.timer = window.setInterval(tick, 40);
  current = p;
  tick();
}

export function stopMusic(): void {
  if (current) window.clearInterval(current.timer);
  current = null;
  currentName = '';
}

// ---------- charge hum ----------
// A held tone that rises while a heavy attack charges and warbles once it's ready. Call every frame
// with the charge progress; it fades out on its own a moment after the calls stop.
interface Hum { osc: OscillatorNode; gain: GainNode; lfo: OscillatorNode; lfoGain: GainNode; timer: number }
const hums = new Map<number, Hum>();

export function chargeHum(id: number, progress: number | null): void {
  const c = ctx;
  const h = hums.get(id);
  if (progress === null || !c || c.state !== 'running' || muted || !settings.sfxOn || settings.sfx === 0) {
    if (h) stopHum(id);
    return;
  }
  const t = c.currentTime;
  if (!h) {
    const osc = c.createOscillator(), gain = c.createGain(), lfo = c.createOscillator(), lfoGain = c.createGain();
    osc.type = 'square';
    lfo.frequency.value = 16;
    lfoGain.gain.value = 0;
    lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.07, t + 0.05);
    osc.connect(gain); gain.connect(sfxBus);
    osc.start(t); lfo.start(t);
    hums.set(id, { osc, gain, lfo, lfoGain, timer: 0 });
  }
  const hum = hums.get(id)!;
  const full = progress >= 1;
  hum.osc.frequency.setTargetAtTime(full ? 620 : 160 + 380 * progress, t, 0.03);
  hum.lfoGain.gain.setTargetAtTime(full ? 60 : 6, t, 0.03);
  window.clearTimeout(hum.timer);
  hum.timer = window.setTimeout(() => stopHum(id), 150);
}

function stopHum(id: number): void {
  const h = hums.get(id);
  if (!h || !ctx) return;
  hums.delete(id);
  window.clearTimeout(h.timer);
  const t = ctx.currentTime;
  h.gain.gain.cancelScheduledValues(t);
  h.gain.gain.setValueAtTime(h.gain.gain.value, t);
  h.gain.gain.linearRampToValueAtTime(0, t + 0.05);
  h.osc.stop(t + 0.06); h.lfo.stop(t + 0.06);
}
