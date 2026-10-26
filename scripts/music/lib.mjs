// Tiny composition DSL + offline renderer (spessasynth_core) + ffmpeg mastering.
import fs from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { BasicMIDI, MIDIBuilder, SoundBankLoader, SpessaSynthProcessor, SpessaSynthSequencer, audioToWav } from 'spessasynth_core';

const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export const midi = n => {
  if (typeof n === 'number') return n;
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(n);
  if (!m) throw new Error('bad note ' + n);
  return 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
};
export const bars = (...b) => b.join(' ').trim().split(/\s+/);
export const rep = (s, n) => Array(n).fill(s).join(' ');

// deterministic rng for humanizing
let seed = 1;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

/**
 * Song builder. Times are in beats. Tokens on a step grid:
 *   "C4" note, "C4!" accent, "C4'" soft, "C4+E4+G4" chord, "-" hold, "." rest, "x"/"X"/"o" drum hits (note given by the part).
 */
export class Song {
  constructor({ bpm, introBars = 0, loopBars, beatsPerBar = 4 }) {
    Object.assign(this, { bpm, introBars, loopBars, beatsPerBar });
    this.parts = [];
  }
  get introBeats() { return this.introBars * this.beatsPerBar; }
  get loopBeats() { return this.loopBars * this.beatsPerBar; }
  /** Add an instrument. opts: prog, drums, vol(0-127), pan(-1..1), rev(0-127), cho, bank */
  part(name, opts) {
    const p = { name, events: [], ...opts };
    this.parts.push(p);
    const api = {
      /** place tokens starting at beat `at`, each token lasting `step` beats */
      seq: (tokens, { at = 0, step = 0.5, vel = 90, note, len = 0.95, hum = 1 } = {}) => {
        if (typeof tokens === 'string') tokens = bars(tokens);
        tokens.forEach((tok, i) => {
          if (tok === '-' || tok === '.') return;
          let n = 1;
          while (tokens[i + n] === '-') n++;
          let v = vel;
          let t = tok;
          if (t.endsWith('!')) { v = Math.min(127, vel + 22); t = t.slice(0, -1); }
          else if (t.endsWith("'")) { v = Math.max(20, vel - 28); t = t.slice(0, -1); }
          const notes = t === 'x' || t === 'X' || t === 'o' ? [note] : t.split('+').map(midi);
          if (t === 'X') v = Math.min(127, vel + 22);
          if (t === 'o') v = Math.max(20, vel - 35);
          const dur = p.drums ? 0.25 : n * step * len;
          for (const m of notes) p.events.push({ t: at + i * step, d: dur, m: midi(m), v: Math.round(Math.max(1, Math.min(127, v + (rnd() - 0.5) * 10 * hum))), j: (rnd() - 0.5) * 0.012 * hum });
        });
        return api;
      },
      note: (t, d, m, v = 90) => { p.events.push({ t, d, m: midi(m), v, j: 0 }); return api; },
      cc: (t, c, val) => { (p.ccs ??= []).push({ t, c, val }); return api; },
    };
    return api;
  }
}

const TPQ = 480;
export function toMidi(song, extraBeats) {
  const b = new MIDIBuilder({ timeDivision: TPQ, initialTempo: song.bpm, name: 'x', format: 1 });
  const total = song.introBeats + song.loopBeats + extraBeats;
  let ch = 0;
  song.parts.forEach((p, i) => {
    b.addTrack(p.name);
    const tr = i + 1;
    const c = p.drums ? 9 : (ch === 9 ? ++ch : ch);
    if (!p.drums) ch++;
    if (p.bank) b.controllerChange(0, tr, c, 0, p.bank);
    b.programChange(0, tr, c, p.prog ?? 0);
    b.controllerChange(0, tr, c, 7, p.vol ?? 100);
    b.controllerChange(0, tr, c, 10, Math.round(64 + (p.pan ?? 0) * 63));
    b.controllerChange(0, tr, c, 91, p.rev ?? 30);
    b.controllerChange(0, tr, c, 93, p.cho ?? 0);
    for (const e of p.ccs ?? []) b.controllerChange(Math.round(e.t * TPQ), tr, c, e.c, e.val);
    // events: the loop body is repeated so the render has the tail of the loop end ringing into the loop start
    const evs = [...p.events];
    for (const e of p.events) if (e.t >= song.introBeats && e.t < song.introBeats + extraBeats) evs.push({ ...e, t: e.t + song.loopBeats });
    const sec = 60 / song.bpm;
    const list = [];
    for (const e of evs) {
      const on = Math.max(0, Math.round((e.t + e.j / sec) * TPQ));
      if (e.t >= total) continue;
      list.push([on, 1, e.m, e.v]);
      list.push([Math.round((e.t + e.d) * TPQ), 0, e.m, 0]);
    }
    list.sort((a, z) => a[0] - z[0] || a[1] - z[1]);
    for (const [t, on, m, v] of list) on ? b.noteOn(t, tr, c, m, v) : b.noteOff(t, tr, c, m);
  });
  b.flush();
  return b.writeMIDI();
}

const banks = {};
async function bank(path) {
  if (!banks[path]) banks[path] = SoundBankLoader.fromArrayBuffer(fs.readFileSync(path).buffer);
  return banks[path];
}
export const MSG = new URL('./node_modules/@librescore/sf3/MuseScore_General_Lite.sf3.wasm', import.meta.url).pathname;
export const GUS = new URL('./node_modules/generaluser/GeneralUser.sf2', import.meta.url).pathname;

export async function renderRaw(song, { sf = MSG, extraBars = 2, sampleRate = 44100 } = {}) {
  const extraBeats = extraBars * song.beatsPerBar;
  const mid = BasicMIDI.fromArrayBuffer(toMidi(song, extraBeats));
  const synth = new SpessaSynthProcessor(sampleRate, { eventsEnabled: false });
  synth.soundBankManager.addSoundBank(await bank(sf), 'main');
  await synth.processorInitialized;
  synth.setSystemParameter?.('autoAllocateVoices', true);
  const seq = new SpessaSynthSequencer(synth);
  seq.loadNewSongList([mid]);
  seq.play();
  const sec = 60 / song.bpm;
  const n = Math.ceil(sampleRate * (song.introBeats + song.loopBeats + extraBeats) * sec);
  const L = new Float32Array(n), R = new Float32Array(n);
  for (let f = 0; f < n; f += 128) { seq.processTick(); synth.process(L, R, f, Math.min(128, n - f)); }
  return { L, R, sampleRate, sec };
}

/**
 * Render a song to a loopable file: [intro][loop], where the first bars of the loop already hold the
 * tail of the loop's end, so jumping from loopEnd back to loopStart is seamless.
 */
export async function renderLoop(song, out, opts = {}) {
  const { L, R, sampleRate, sec } = await renderRaw(song, opts);
  const s0 = Math.round(song.introBeats * sec * sampleRate);
  const s1 = Math.round((song.introBeats + song.loopBeats) * sec * sampleRate);
  const tail = L.length - s1;
  const oL = L.slice(0, s1), oR = R.slice(0, s1);
  // replace the loop head with the render that follows the loop end (same notes plus the ringing tail)
  for (let i = 0; i < tail; i++) {
    const w = i < tail - 2000 ? 1 : (tail - i) / 2000;
    oL[s0 + i] = L[s1 + i] * w + oL[s0 + i] * (1 - w);
    oR[s0 + i] = R[s1 + i] * w + oR[s0 + i] * (1 - w);
  }
  return master([oL, oR], sampleRate, out, { loopStart: s0 / sampleRate, loopEnd: s1 / sampleRate, ...opts });
}

/** Render a one-shot preview: whole song plus tail, with a fade out. */
export async function renderPreview(song, out, { fade = 2.5, ...opts } = {}) {
  const { L, R, sampleRate } = await renderRaw(song, { extraBars: 2, ...opts });
  return master([L, R], sampleRate, out, { fadeOut: fade, ...opts });
}

function master(chs, sampleRate, out, { gain = 1, bitrate = '64k', target = -16, fadeOut = 0, loopStart, loopEnd, eq = '' } = {}) {
  const wav = out.replace(/\.\w+$/, '.raw.wav');
  fs.writeFileSync(wav, new Uint8Array(audioToWav(chs, sampleRate)));
  const dur = chs[0].length / sampleRate;
  // realistic + punchy + light bass: rumble cut, gentle low-shelf dip, a touch of presence, glue compression, limiter
  const af = [
    'highpass=f=45',
    'lowshelf=f=140:g=-3',
    'equalizer=f=3200:t=q:w=1:g=1.5',
    eq,
    `volume=${gain}`,
    'acompressor=threshold=0.18:ratio=3:attack=8:release=120:makeup=1.6',
    'alimiter=limit=0.89:attack=3:release=40',
    fadeOut ? `afade=t=out:st=${(dur - fadeOut).toFixed(2)}:d=${fadeOut}` : '',
  ].filter(Boolean).join(',');
  const mid = out.replace(/\.\w+$/, '.m.wav');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-af', af, mid]);
  // normalize to a fixed loudness so every track sits at the same level in game
    const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', mid, '-af', 'ebur128', '-f', 'null', '-']).stderr.toString();
  const I = parseFloat(/Summary:[\s\S]*?I:\s+(-?[\d.]+)/.exec(r)[1]);
  const g = Math.pow(10, (target - I) / 20);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', mid, '-af', `volume=${g.toFixed(4)}`, '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', bitrate, out]);
  fs.unlinkSync(wav); fs.unlinkSync(mid);
  return { out, bytes: fs.statSync(out).size, dur, loopStart, loopEnd };
}
