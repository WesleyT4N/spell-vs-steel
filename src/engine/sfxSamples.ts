// Recorded sound effects: one MP3 per slot under assets/audio/sfx/, chosen by name through assets/audio/sfx/sfx.json.
// sfx() in audio.ts tries these first and falls back to the synthesized recipes (sfxReal.ts) for any name the map
// doesn't list, or while the files are still decoding. Render side only: the sim never imports audio.
import { assetBytes, assetData } from './assets';
import type { RealOpts } from './sfxReal';

export interface SfxMap {
  slots: Record<string, { gain?: number; rate?: number }>;
  /** Game sound name ("fx:<kind>" for spell effects) -> slot, or slots played together. [] plays nothing. */
  sounds: Record<string, string | string[]>;
}

const MAP_PATH = 'audio/sfx/sfx.json';
const bufs = new Map<string, AudioBuffer>();
let loading: Promise<void> | null = null;
let loadedFor: BaseAudioContext | null = null;
/** Dev tools: play the old synthesized sounds instead, to compare. */
let synthOnly = false;
export const setSynthOnly = (on: boolean): void => { synthOnly = on; };
export const isSynthOnly = (): boolean => synthOnly;

export const sfxMap = (): SfxMap | undefined => assetData<SfxMap>(MAP_PATH);

/** Every slot name, in map order (for the dev tools' sound test). */
export const sfxSlots = (): string[] => Object.keys(sfxMap()?.slots ?? {});

/** Decode every sample once. Safe to call repeatedly. */
export function loadSfx(c: BaseAudioContext): Promise<void> {
  if (loading && loadedFor === c) return loading;
  loadedFor = c;
  const map = sfxMap();
  if (!map) return (loading = Promise.resolve());
  const jobs = Object.keys(map.slots).map(slot =>
    assetBytes(`audio/sfx/${slot}.mp3`)
      .then(b => (b ? c.decodeAudioData(b) : null))
      .then(buf => { if (buf) bufs.set(slot, buf); }, () => { /* undecodable: the synth covers it */ }));
  return (loading = Promise.all(jobs).then(() => undefined));
}

/** The slots a game sound plays, or null when the map doesn't list it. */
export function slotsFor(name: string, o: RealOpts = {}): string[] | null {
  const map = sfxMap();
  const v = map?.sounds[name];
  if (v === undefined || !map) return null;
  const el = o.element && map.slots[`hit_${o.element}`] ? o.element : 'steel';
  return (Array.isArray(v) ? v : [v]).map(s => s.replace('{element}', el));
}

const lastPlayed: Record<string, number> = {};

/** Play one slot straight (the dev tools' sound test). */
export function playSlot(c: AudioContext, out: AudioNode, slot: string, o: RealOpts = {}): boolean {
  const buf = bufs.get(slot);
  if (!buf) return false;
  const conf = sfxMap()?.slots[slot] ?? {};
  const src = c.createBufferSource();
  src.buffer = buf;
  // a touch of pitch spread so repeated hits don't sound copy-pasted
  src.playbackRate.value = (conf.rate ?? 1) * (0.97 + Math.random() * 0.06);
  const g = c.createGain();
  const big = (o.amt ?? 0) >= 600 ? 1.15 : 1;
  g.gain.value = (conf.gain ?? 0.75) * big;
  const p = c.createStereoPanner();
  p.pan.value = Math.max(-1, Math.min(1, (o.pan ?? 0) * 0.8));
  src.connect(g); g.connect(p); p.connect(out);
  src.start();
  return true;
}

/** Play a game sound from its samples. False when it has none (yet), so the caller can use the synth. */
export function playSample(c: AudioContext, out: AudioNode, name: string, o: RealOpts = {}): boolean {
  if (synthOnly) return false;
  const slots = slotsFor(name, o);
  if (!slots) return false;
  if (slots.length === 0) return true;
  if (!slots.every(s => bufs.has(s))) return false;
  // one voice per sound at a time: Inferno puts 9 explosions down in one frame
  const now = c.currentTime;
  if (now - (lastPlayed[name] ?? -1) < 0.04) return true;
  lastPlayed[name] = now;
  for (const s of slots) playSlot(c, out, s, o);
  return true;
}
