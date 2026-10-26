// Character voices and announcer lines: neural-TTS clips (scripts/voices/gen.py) decoded once, then played
// through a short stone room. Each fighter says one line at a time, ranked by priority.
import type { ClassId } from '../art/sprites';
import { CLIPS } from './voiceClips';

/** grunt/hurt/hurtBig have no clips yet (TTS can't do them); those calls stay silent until recordings land. */
export type VoiceKind = 'grunt' | 'cast' | 'castBig' | 'hurt' | 'hurtBig' | 'death' | 'win';

const PRIORITY: Record<VoiceKind, number> = { grunt: 1, cast: 1, hurt: 2, castBig: 3, hurtBig: 3, win: 4, death: 5 };

const rnd = (a: number, b: number): number => a + Math.random() * (b - a);

// ---------- clip bank ----------
let bankCtx: BaseAudioContext | null = null;
const bank = new Map<string, AudioBuffer[]>();

/** Decode every clip for this context (async; lines asked for before a clip is ready are skipped). */
export function loadClips(c: BaseAudioContext): Promise<void> {
  if (bankCtx === c) return Promise.resolve();
  bankCtx = c;
  bank.clear();
  const jobs: Array<Promise<void>> = [];
  for (const [key, list] of Object.entries(CLIPS)) {
    const bufs: AudioBuffer[] = [];
    bank.set(key, bufs);
    for (const b64 of list) {
      const bin = atob(b64), bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      jobs.push(c.decodeAudioData(bytes.buffer).then(buf => { bufs.push(buf); }, () => { /* undecodable: skip */ }));
    }
  }
  return Promise.all(jobs).then(() => undefined);
}

/** A random clip from a bank, never the same one twice in a row when there's a choice. */
const lastPick = new Map<string, AudioBuffer>();
function clip(key: string): AudioBuffer | null {
  const list = bank.get(key);
  if (!list?.length) return null;
  let b = list[Math.floor(Math.random() * list.length)];
  if (list.length > 1 && b === lastPick.get(key)) b = list[(list.indexOf(b) + 1) % list.length];
  lastPick.set(key, b);
  return b;
}

// ---------- output chains ----------
interface Rig { c: BaseAudioContext; inp: AudioNode; room: AudioNode }
const rigs = [new Map<AudioNode, Rig>(), new Map<AudioNode, Rig>()];

function makeIr(c: BaseAudioContext, secs: number, decay: number, dark: number): AudioBuffer {
  const sr = c.sampleRate, ir = c.createBuffer(2, Math.floor(sr * secs), sr);
  for (let ch = 0; ch < 2; ch++) {
    const x = ir.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < x.length; i++) { lp = lp * dark + (Math.random() * 2 - 1) * (1 - dark); x[i] = lp * Math.exp(-i / sr * decay) * (1 + dark); }
  }
  return ir;
}

/** Voices: highpass, a little presence, glue compression; `hall` picks the announcer's big colosseum over the arena room. */
function rig(c: BaseAudioContext, out: AudioNode, hall: boolean): Rig {
  const have = rigs[hall ? 1 : 0].get(out);
  if (have && have.c === c) return have;
  const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = hall ? 80 : 100;
  const pres = c.createBiquadFilter(); pres.type = 'peaking'; pres.frequency.value = 3000; pres.Q.value = 0.8; pres.gain.value = hall ? 2 : 3;
  const comp = c.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.12;
  hp.connect(pres); pres.connect(comp); comp.connect(out);
  const room = c.createConvolver(); room.buffer = hall ? makeIr(c, 2.2, 2.8, 0.55) : makeIr(c, 0.6, 7, 0.3);
  const rg = c.createGain(); rg.gain.value = hall ? 0.4 : 0.18; room.connect(rg); rg.connect(comp);
  const r: Rig = { c, inp: hp, room };
  rigs[hall ? 1 : 0].set(out, r);
  return r;
}

/** Play one buffer into a rig, panned, with a reverb send. */
function play(r: Rig, buf: AudioBuffer, pan: number, vol: number, send: number, rate = 1, delay = 0): { stop: () => void; end: number } {
  const c = r.c, t = c.currentTime + 0.005 + delay;
  const s = c.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate;
  const g = c.createGain(); g.gain.value = vol;
  const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
  const sg = c.createGain(); sg.gain.value = send;
  s.connect(g); g.connect(p); p.connect(r.inp); p.connect(sg); sg.connect(r.room);
  s.start(t);
  return {
    end: t + buf.duration / rate,
    stop: () => {
      const n = c.currentTime;
      g.gain.cancelScheduledValues(n); g.gain.setValueAtTime(g.gain.value, n); g.gain.linearRampToValueAtTime(0, n + 0.03);
      try { s.stop(n + 0.04); } catch { /* already stopped */ }
    },
  };
}

// ---------- fighters ----------
interface Playing { c: BaseAudioContext; stop: () => void; end: number; prio: number }
const active: Array<Playing | null> = [null, null];

/** Say a line for a class. `side` lets a fighter's new line cut off its last one; `element` picks per-element cast lines. */
export function playVoice(c: BaseAudioContext, out: AudioNode, cls: ClassId, kind: VoiceKind, pan = 0, side = 0, element?: string): void {
  void loadClips(c);
  const now = c.currentTime, cur = active[side];
  if (cur && cur.c === c && now < cur.end) {
    if (PRIORITY[kind] < cur.prio) return;
    cur.stop();
  }
  const buf = (element && kind === 'cast' ? clip(`${cls}:cast_${element}`) : null) ?? clip(`${cls}:${kind}`);
  if (!buf) return;
  // a hair of pitch drift so repeats don't sound pasted in
  const p = play(rig(c, out, false), buf, pan * 0.7, 1, 0.3, rnd(0.97, 1.03));
  active[side] = { c, prio: PRIORITY[kind], ...p };
}

let annLine: { stop: () => void; end: number } | null = null;

/** An announcer clip into the big hall, `delay` seconds from now. Cuts off the line before it. */
export function playAnnouncerLine(c: BaseAudioContext, out: AudioNode, key: string, delay = 0): void {
  void loadClips(c);
  const buf = clip(`ann:${key}`);
  if (!buf) return;
  annLine?.stop();
  annLine = play(rig(c, out, true), buf, 0, 1.1, 0.45, 1, delay);
}
