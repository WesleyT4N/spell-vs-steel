// WebAudio sound: realistic combat/spell effects (sfxReal), NES-style blips for menus, and pre-rendered looping BGM.
import { getSave, setSave } from './save';
import { playReal, type RealOpts } from './sfxReal';
import { playVoice, loadClips, type VoiceKind } from './voice';
import { playCall, type Call } from './announcer';
import type { ClassId } from '../art/sprites';
import { TRACKS, type TrackId } from './musicTracks';

let ctx: AudioContext | null = null;
let master: GainNode, sfxBus: GainNode, stingBus: GainNode, voiceBus: GainNode, annBus: GainNode, realBus: GainNode, musicBus: GainNode;
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
// Pre-rendered, sample-based tracks (scripts/music) shipped as looping MP3s. Each one decodes on first use.
const decoded = new Map<TrackId, Promise<AudioBuffer | null>>();
function loadTrack(c: AudioContext, id: TrackId): Promise<AudioBuffer | null> {
  let p = decoded.get(id);
  if (!p) {
    const bytes = Uint8Array.from(atob(TRACKS[id].mp3), ch => ch.charCodeAt(0));
    p = c.decodeAudioData(bytes.buffer).catch(() => null);
    decoded.set(id, p);
  }
  return p;
}

/** Decode a track ahead of time so it starts on cue (e.g. the stage theme while the battle loads). */
export function preloadMusic(id: TrackId): void {
  const c = init();
  if (c) void loadTrack(c, id);
}

interface Playing { id: TrackId; gain: GainNode; src: AudioBufferSourceNode | null }
let current: Playing | null = null;

export function playMusic(id: TrackId): void {
  if (current?.id === id) return;
  stopMusic();
  const c = init();
  if (!c) return;
  const me: Playing = { id, gain: c.createGain(), src: null };
  me.gain.connect(musicBus);
  current = me;
  void loadTrack(c, id).then(buf => {
    if (current !== me || !buf) return;
    const t = TRACKS[id];
    const src = c.createBufferSource();
    src.buffer = buf;
    // loop points sit on bar lines; the file's loop head already holds the ringing tail of the loop's end
    if (t.loopEnd > t.loopStart) { src.loop = true; src.loopStart = t.loopStart; src.loopEnd = t.loopEnd; }
    src.connect(me.gain);
    src.start();
    me.src = src;
  });
}

/** Fade the current track out quickly. */
export function stopMusic(): void {
  const p = current;
  current = null;
  if (!p || !ctx) return;
  const t = ctx.currentTime;
  p.gain.gain.setTargetAtTime(0, t, 0.06);
  p.src?.stop(t + 0.3);
}

/** The battle theme for a stage (falls back to the Colosseum theme). */
export const stageTrack = (stageId: string): TrackId => (`stage_${stageId}` in TRACKS ? `stage_${stageId}` : 'stage_colosseum') as TrackId;

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
