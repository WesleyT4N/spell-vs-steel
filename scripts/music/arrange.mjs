// Arrangers: turn a piece's musical material (chords + melody per section) into parts for one style.
import { Song, bars, rep, midi } from './lib.mjs';

const N = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
export const nm = m => N[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
export const up = (n, k) => (n.length > 1 && n !== '-' && n !== '.' ? n.split('+').map(x => nm(midi(x) + k)).join('+') : n);

/** "Cm", "Ab", "F#", "C#dim", "Esus" -> { root pitch class, intervals } */
export function chord(name) {
  const m = /^([A-G])(#|b)?(m|dim|sus)?$/.exec(name);
  if (!m) throw new Error('bad chord ' + name);
  const pc = (NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
  const iv = m[3] === 'm' ? [0, 3, 7] : m[3] === 'dim' ? [0, 3, 6] : m[3] === 'sus' ? [0, 5, 7] : [0, 4, 7];
  return { pc, iv };
}
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** Bass root at or above `lo` (default C2..B2, kept light). */
export const root = (c, lo = 36) => { const { pc } = chord(c); let m = lo; while (m % 12 !== pc) m++; return m; };
/** Close triad voicing with its lowest note at or above `lo`. */
export const triad = (c, lo = 55) => { const { pc, iv } = chord(c); const tones = []; for (let m = lo; tones.length < 3; m++) if (iv.some(i => (pc + i) % 12 === m % 12)) tones.push(m); return tones; };

const bar8 = f => s => s.chords.map(f).join(' ');
const each = (secs, f) => secs.map(f).join(' ');

/**
 * Build a Song. piece: { bpm, introBars, sections: [{ chords: [...], mel: 'tokens', lift?: true }] }
 * The loop is every section in order; the intro repeats the first chord with a build.
 */
function frame(piece, style, extra) {
  const song = new Song({ bpm: piece.bpm, introBars: piece.introBars ?? 1, loopBars: piece.sections.reduce((a, s) => a + s.chords.length, 0) });
  const intro = Array(song.introBars).fill(piece.sections[0].chords[0]);
  const secs = piece.sections;
  const allChords = [...intro, ...secs.flatMap(s => s.chords)];
  const at = song.introBeats;
  const ctx = { song, intro, secs, allChords, at, piece };
  style(ctx);
  extra?.(ctx);
  return song;
}

/** Section-end drum fill for an 8-step bar. */
const fillBars = (s, normal, fill, every = 8) => s.chords.map((_, i) => (i === s.chords.length - 1 || (i + 1) % every === 0 ? fill : normal));

// ---------- Symphonic rock: kit, twin chugging guitars, bass, brass lead, strings ----------
export const rock = (piece, o = {}) => frame(piece, ({ song, intro, secs, allChords, at }) => {
  const g = o.guitar ?? 29;
  const chug = c => { const r = nm(root(c, 40)); const p = `${r}+${up(r, 7)}`; return o.chug?.(r, p) ?? `${p}! ${r}' ${r}' ${p}! ${r}' ${r}' ${p}! ${r}'`; };
  const introChug = intro.map((c, i) => { const r = nm(root(c, 40)); const p = `${r}+${up(r, 7)}+${up(r, 12)}`; return i === intro.length - 1 ? `${p}! - - - ${p} - ${p} -` : `${p}! - - - - - - -`; });
  const gtr = bars(...introChug, ...secs.flatMap(s => s.chords.map(chug)));
  song.part('gtrL', { prog: g, vol: o.gtrVol ?? 76, pan: -0.6, rev: 18 }).seq(gtr, { len: 0.6, vel: 88 });
  song.part('gtrR', { prog: g, vol: o.gtrVol ?? 76, pan: 0.6, rev: 18 }).seq(gtr, { len: 0.6, vel: 86, hum: 1.4 });
  song.part('bass', { prog: 33, vol: 74, rev: 8 }).seq(bars(...intro.map(c => `${nm(root(c))} - - - ${nm(root(c))} - ${nm(root(c))} -`), ...secs.flatMap(s => s.chords.map(c => rep(nm(root(c)), 8)))), { len: 0.7, vel: 84 });
  song.part('lead', { prog: o.lead ?? 61, vol: 100, pan: 0.1, rev: 45 }).seq(each(secs, s => (s.lift ? rep('.', s.chords.length * 8) : s.mel)), { at, vel: 98 });
  song.part('lead2', { prog: o.lead2 ?? 48, vol: 86, pan: -0.15, rev: 50 }).seq(each(secs, s => (s.lift ? bars(s.mel).map(t => up(t, 12)).join(' ') : rep('.', s.chords.length * 8))), { at, vel: 92 });
  song.part('lift', { prog: 61, vol: 84, pan: 0.15, rev: 45 }).seq(each(secs, s => (s.lift ? s.mel : rep('.', s.chords.length * 8))), { at, vel: 92 });
  song.part('pad', { prog: 49, vol: 58, pan: 0.2, rev: 55 }).seq(allChords.map(c => triad(c).map(nm).join('+') + ' - - - - - - -').join(' '), { vel: 64 });
  const kit = song.part('kit', { drums: true, prog: 16, vol: 104, rev: 18 });
  kit.seq(bars(...intro.map((_, i) => (i === intro.length - 1 ? 'x . . . x . x .' : 'x . . . . . . .')), ...secs.flatMap(s => fillBars(s, o.kick ?? 'x . . x x . . .', 'x . . x x . . .'))), { note: 36, vel: 104 });
  kit.seq(bars(...intro.map((_, i) => (i === intro.length - 1 ? '. . . . x x X X' : rep('.', 8))), ...secs.flatMap(s => fillBars(s, '. . X . . . X .', '. . X . x x X X'))), { note: 38, vel: 98 });
  kit.seq(bars(...intro.map(() => rep('.', 8)), ...secs.flatMap(s => s.chords.map(() => 'x o x o x o x o'))), { note: 42, vel: 70 });
  kit.seq(bars(...intro.map(() => rep('.', 8)), ...secs.flatMap(s => s.chords.map((_, i) => (i % 4 === 0 ? 'X . . . . . . .' : rep('.', 8))))), { note: 49, vel: 96 });
}, o.extra);

// ---------- Orchestral: spiccato strings, horns/trumpets, trombones, choir, timpani, taiko ----------
export const orchestral = (piece, o = {}) => frame(piece, ({ song, intro, secs, allChords, at }) => {
  const ost = c => { const [a, b, d] = triad(c, 60).map(nm); return o.ost?.(a, b, d) ?? `${up(a, -12)} ${a} ${b} ${a} ${up(a, -12)} ${a} ${d} ${a}`; };
  song.part('violins', { prog: o.ostProg ?? 48, bank: o.ostBank, vol: 90, pan: -0.3, rev: 40 }).seq(bars(...intro.map(c => (o.introOst ? ost(c) : rep('.', 8))), ...secs.flatMap(s => s.chords.map(ost))), { len: 0.45, vel: 80 });
  song.part('celli', { prog: 48, bank: 40, vol: 84, pan: 0.25, rev: 40 }).seq(bars(...allChords.map(c => rep(nm(root(c, 36)), 8))), { len: 0.45, vel: 82 });
  song.part('basses', { prog: 43, vol: 56, pan: 0.3, rev: 30 }).seq(bars(...allChords.map(c => `${nm(root(c, 36))} - - - - - - -`)), { vel: 70 });
  song.part('horns', { prog: o.lead ?? 60, vol: 100, pan: -0.15, rev: 55 }).seq(each(secs, s => s.mel), { at, vel: 96 });
  song.part('trumpets', { prog: o.lead2 ?? 56, vol: 74, pan: 0.15, rev: 55 }).seq(each(secs, s => (s.lift ? s.mel : rep('.', s.chords.length * 8))), { at, vel: 90 });
  song.part('trombones', { prog: 57, vol: 80, pan: 0.1, rev: 50 }).seq(bars(...allChords.map(c => { const t = triad(c, 48); return `${nm(t[0])}+${nm(t[2])} - - - - - - -`; })), { vel: 72 });
  song.part('choir', { prog: 52, vol: 72, rev: 70 }).seq(each(secs, s => (s.lift || o.choirAlways ? s.chords.map(c => triad(c).map(nm).join('+') + ' - - - - - - -').join(' ') : rep('.', s.chords.length * 8))), { at, vel: 74 });
  song.part('timpani', { prog: 47, vol: 104, rev: 40 }).seq(bars(...intro.map((c, i) => (i === intro.length - 1 ? `${nm(root(c, 36))}! . . . ${nm(root(c, 36))} ${nm(root(c, 36))} ${nm(root(c, 36))} ${nm(root(c, 36))}` : `${nm(root(c, 36))}! . . . . . . .`)), ...secs.flatMap(s => s.chords.map(c => { const r = nm(root(c, 36)); return o.timp?.(r) ?? `${r}! . . ${r} . . ${r} .`; }))), { vel: 96 });
  song.part('taiko', { prog: 116, vol: o.taikoVol ?? 108, rev: 45 }).seq(bars(...intro.map(() => rep('.', 8)), ...secs.flatMap(s => s.chords.map((_, i) => (i % 4 === 3 ? 'C2! . C2 C2 C2! . C2 C2' : 'C2! . . . C2 . . .')))), { vel: 100 });
  const perc = song.part('perc', { drums: true, prog: 48, vol: 100, rev: 40 });
  perc.seq(bars(...intro.map(() => rep('.', 8)), ...secs.flatMap(s => s.chords.map((_, i) => (i % 4 === 0 ? 'x . . . . . . .' : rep('.', 8))))), { note: 49, vel: 90 });
  perc.seq(bars(...intro.map((_, i) => (i === intro.length - 1 ? 'o o o o o o x X' : rep('.', 8))), ...secs.flatMap(s => fillBars(s, o.snare ?? '. . x . . . x .', 'o o x o x x X X'))), { note: 38, vel: 70 });
}, o.extra);

// ---------- Folk: strummed guitar, fiddle + whistle, cello, harp, bodhran ----------
export const folk = (piece, o = {}) => frame(piece, ({ song, intro, secs, allChords, at }) => {
  const strum = c => { const ch = [nm(root(c, 40)), ...triad(c, 52).map(nm)].join('+'); return `${ch}! . ${ch}' ${ch} . ${ch} ${ch}' ${ch}`; };
  song.part('guitar', { prog: 25, vol: 92, pan: -0.35, rev: 35 }).seq(bars(...allChords.map(strum)), { len: 0.8, vel: 78 });
  song.part('mandolin', { prog: 25, bank: 16, vol: 70, pan: 0.45, rev: 40 }).seq(bars(...intro.map(() => rep('.', 8)), ...secs.flatMap(s => s.chords.map(c => { const [a, b, d] = triad(c, 67).map(nm); return `${a} ${b} ${d} ${b} ${a} ${b} ${d} ${b}`; }))), { len: 0.5, vel: 64 });
  song.part('fiddle', { prog: o.lead ?? 110, vol: 100, pan: 0.15, rev: 45 }).seq(each(secs, s => s.mel), { at, vel: 96 });
  song.part('whistle', { prog: o.lead2 ?? 78, vol: 74, pan: -0.1, rev: 50 }).seq(each(secs, s => (s.lift ? bars(s.mel).map(t => up(t, 12)).join(' ') : rep('.', s.chords.length * 8))), { at, vel: 84 });
  song.part('cello', { prog: 42, vol: 90, pan: 0.3, rev: 40 }).seq(bars(...allChords.map(c => { const r = nm(root(c, 36)); return `${r} - - ${r} . ${up(r, 7)} - -`; })), { vel: 84 });
  song.part('harp', { prog: 46, vol: 66, pan: 0.4, rev: 50 }).seq(each(secs, s => s.chords.map(c => { const [a, b, d] = triad(c).map(nm); return `${a} ${b} ${d} ${up(a, 12)} ${d} ${b} ${a} ${b}`; }).join(' ')), { at, vel: 62 });
  const dr = song.part('bodhran', { drums: true, prog: 0, vol: 100, rev: 30 });
  dr.seq(bars(...intro.map(() => 'X . o x . o x o'), ...secs.flatMap(s => s.chords.map(() => 'X . o x . o x o'))), { note: 45, vel: 82 });
  dr.seq(bars(...intro.map((_, i) => (i === intro.length - 1 ? '. . . . . . x x' : rep('.', 8))), ...secs.flatMap(s => fillBars(s, '. . . . x . . .', '. . . . x . x x'))), { note: 41, vel: 70 });
  dr.seq(bars(...intro.map(() => rep('.', 8)), ...secs.flatMap(s => s.chords.map(() => 'x . x . x . x .'))), { note: 54, vel: 46 });
}, o.extra);

export { Song, bars, rep };
