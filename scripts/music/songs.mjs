// The soundtrack: one battle theme per stage, plus the menu theme and the victory music.
// Keys sit low (C minor, Bb, A minor...) for the darker, ~2 semitones lower sound direction.
import { rock, orchestral, folk, Song, bars, rep, nm, up, root, triad } from './arrange.mjs';

const sec = (chords, mel, lift = false) => ({ chords: chords.split(' '), mel: bars(...mel).join(' '), lift });
/** A theme in the usual battle shape: A, B (lifted), A again with the lift layer on. */
const ABA = (A, B) => [A, { ...B, lift: true }, { ...A, lift: true }];

// ---------- Colosseum: "Steel Meets Spell" (C minor, 156) ----------
const colosseum = {
  bpm: 156, introBars: 2,
  sections: ABA(
    sec('Cm Ab Bb G Cm Ab Fm G', [
      'C5 - - G4 C5 D5 Eb5 -', 'Eb5 - D5 C5 D5 - C5 -', 'Bb4 - - F4 Bb4 C5 D5 -', 'D5 - Eb5 D5 B4 - G4 -',
      'C5 - - G4 C5 D5 Eb5 F5', 'G5 - F5 Eb5 F5 - Eb5 C5', 'Ab5 - G5 F5 Eb5 - C5 -', 'D5 - - - B4 - D5 -']),
    sec('Ab Bb Gm Cm Ab Bb G G', [
      'Eb5 - - C5 Eb5 - Ab5 -', 'G5 - F5 - D5 - Bb4 -', 'G5 - F5 G5 Bb5 - G5 -', 'C6 - - - - - . .',
      'C6 - Bb5 Ab5 G5 - Eb5 -', 'F5 - G5 - Ab5 - Bb5 -', 'B5 - - - G5 - D5 -', 'G5 - - - . . . .']),
  ),
};

// ---------- Castle Courtyard: "Banners of the Keep" (Bb major march, 144) ----------
const courtyard = {
  bpm: 144, introBars: 2,
  sections: ABA(
    sec('Bb F Gm Eb Bb F Eb F', [
      'Bb4 - - F4 Bb4 - C5 D5', 'C5 - - A4 F4 - - -', 'G4 - Bb4 - D5 - G5 -', 'F5 - Eb5 - D5 - C5 -',
      'D5 - - Bb4 D5 - F5 -', 'F5 - Eb5 D5 C5 - A4 -', 'Bb4 - C5 - Eb5 - G5 -', 'F5 - - - - - . .']),
    sec('Gm Eb Bb F Gm Eb C F', [
      'G5 - - F5 D5 - Bb4 -', 'Eb5 - F5 G5 Bb5 - G5 -', 'F5 - - D5 Bb4 - D5 -', 'C5 - - - A4 - C5 -',
      'D5 - G5 - Bb5 - A5 G5', 'G5 - F5 - Eb5 - G5 -', 'E5 - - - C5 - E5 G5', 'A5 - - - F5 - - -']),
  ),
};

// ---------- Arcane Archive: "Candlelit Tomes" (A minor, 132) ----------
const archive = {
  bpm: 132, introBars: 2,
  sections: ABA(
    sec('Am F Dm E Am F G E', [
      'A4 - - - C5 - E5 -', 'F5 - E5 - C5 - - -', 'D5 - - F5 A5 - G5 F5', 'E5 - - - G#4 - B4 -',
      'A4 - - - C5 - E5 -', 'A5 - G5 F5 E5 - C5 -', 'D5 - E5 - F5 - D5 -', 'E5 - - - - - . .']),
    sec('F G Em Am Dm G C E', [
      'C6 - - A5 F5 - A5 -', 'B5 - - G5 D5 - G5 -', 'E5 - G5 - B5 - G5 -', 'A5 - - - E5 - - -',
      'F5 - E5 D5 A5 - F5 -', 'G5 - F5 E5 D5 - B4 -', 'C5 - E5 - G5 - C6 -', 'B5 - - - G#5 - E5 -']),
  ),
};

// ---------- Frostpeak Pass: "Aurora Pass" (E minor, 150) ----------
const frostpeak = {
  bpm: 150, introBars: 2,
  sections: ABA(
    sec('Em C D B Em C Am B', [
      'E5 - - B4 E5 F#5 G5 -', 'G5 - F#5 E5 D5 - E5 -', 'F#5 - - D5 A4 - D5 -', 'D#5 - - - B4 - F#4 -',
      'E5 - - B4 E5 F#5 G5 A5', 'B5 - A5 G5 E5 - G5 -', 'A5 - G5 - E5 - C5 -', 'B4 - - - D#5 - F#5 -']),
    sec('C D Bm Em C D B B', [
      'G5 - - E5 C5 - E5 -', 'F#5 - - D5 A4 - D5 -', 'B4 - D5 - F#5 - B5 -', 'G5 - - - E5 - - -',
      'E5 - G5 - C6 - B5 A5', 'A5 - F#5 - D5 - F#5 -', 'B5 - - - A5 - F#5 -', 'D#5 - - - . . . .']),
  ),
};

// ---------- Emberforge: "Anvil and Ash" (B minor, 138, heavy) ----------
const emberforge = {
  bpm: 138, introBars: 2,
  sections: ABA(
    sec('Bm C Bm A Bm G A F#', [
      'B4 - - - F#5 - - -', 'E5 - - - D5 - C5 -', 'B4 - - - D5 - F#5 -', 'E5 - - - - - . .',
      'B4 - - - F#5 - - -', 'G5 - - - F#5 - E5 -', 'A5 - - - G5 - E5 -', 'F#5 - - - A#4 - C#5 -']),
    sec('G A Bm Bm G A F# F#', [
      'D5 - - B4 D5 - G5 -', 'E5 - - C#5 E5 - A5 -', 'F#5 - - D5 F#5 - B5 -', 'B5 - - - - - . .',
      'B5 - A5 G5 F#5 - D5 -', 'C#5 - E5 - A5 - G5 -', 'F#5 - - - E5 - C#5 -', 'A#4 - - - . . . .']),
  ),
};

// ---------- Elderwood Ruins: "Ruins at Dusk" (D dorian, 150) ----------
const elderwood = {
  bpm: 150, introBars: 2,
  sections: ABA(
    sec('Dm C Dm Am Dm C G A', [
      'D5 - E5 F5 A5 - F5 -', 'G5 - F5 E5 C5 - E5 -', 'F5 - E5 D5 A4 - D5 -', 'E5 - - - C5 - A4 -',
      'D5 - E5 F5 A5 - D6 -', 'C6 - A5 G5 E5 - G5 -', 'B4 - D5 - G5 - F5 E5', 'E5 - - - C#5 - A4 -']),
    sec('F C G Dm F C G A', [
      'A5 - - G5 F5 - C5 -', 'E5 - - D5 C5 - G4 -', 'B4 - D5 - G5 - B5 -', 'A5 - - - F5 - D5 -',
      'F5 - G5 A5 C6 - A5 -', 'G5 - E5 - C5 - E5 -', 'D5 - E5 F5 G5 - B5 -', 'A5 - - - - - . .']),
  ),
};

// Stage flavors on top of each style.
const ARCH_EXTRA = ({ song, secs, at }) => {
  // celesta sparkle answering the melody, a candlelit-library color
  song.part('celesta', { prog: 8, vol: 70, pan: 0.35, rev: 70 }).seq(secs.map(s => s.chords.map(c => { const [a, b, d] = triad(c, 72).map(nm); return `${a} ${d} ${b} ${d} ${up(a, 12)} ${d} ${b} ${d}`; }).join(' ')).join(' '), { at, len: 0.5, vel: 58 });
};
const FROST_EXTRA = ({ song, secs, at }) => {
  song.part('glock', { prog: 9, vol: 62, pan: -0.35, rev: 75 }).seq(secs.map(s => s.chords.map(c => { const [a, b, d] = triad(c, 76).map(nm); return `${a} . ${d} . ${b} . ${d} .`; }).join(' ')).join(' '), { at, vel: 60 });
  song.part('tremolo', { prog: 44, vol: 64, pan: 0.3, rev: 60 }).seq(secs.map(s => s.chords.map(c => triad(c, 64).map(nm).join('+') + ' - - - - - - -').join(' ')).join(' '), { at, vel: 66 });
};
const FORGE_EXTRA = ({ song, intro, secs, at }) => {
  // the anvil: a bright metallic hit on the off-beats, and low brass doubling the riff root
  song.part('anvil', { drums: true, prog: 0, vol: 96, rev: 50 }).seq(bars(...intro.map(() => rep('.', 8)), ...secs.flatMap(s => s.chords.map(() => '. . x . . . x .'))), { note: 53, vel: 104 });
  song.part('taiko', { prog: 116, vol: 104, rev: 45 }).seq(bars(...intro.map(() => 'C2! . . . C2! . . .'), ...secs.flatMap(s => s.chords.map((_, i) => (i % 2 ? 'C2! . C2 . C2! . C2 C2' : 'C2! . . . C2! . . .')))), { vel: 100 });
  song.part('lowbrass', { prog: 57, vol: 82, pan: -0.1, rev: 45 }).seq(bars(...intro.map(c => `${nm(root(c, 40))} - - - - - - -`), ...secs.flatMap(s => s.chords.map(c => `${nm(root(c, 40))}+${nm(root(c, 40) + 7)} - - - - - - -`))), { vel: 82 });
};
const COURT_EXTRA = ({ song, intro, secs }) => {
  // a marching snare line on top of the orchestra
  song.part('march', { drums: true, prog: 48, vol: 92, pan: 0.2, rev: 35 }).seq(bars(...intro.map(() => 'x . x x x . x x'), ...secs.flatMap(s => s.chords.map(() => 'X . x x x . x x'))), { note: 38, vel: 74 });
};

export const STAGES = {
  colosseum: () => rock(colosseum),
  courtyard: () => orchestral(courtyard, { extra: COURT_EXTRA, snare: '. . . . . . . .', taikoVol: 80 }),
  archive: () => orchestral(archive, { extra: ARCH_EXTRA, lead: 71, lead2: 48, ostProg: 45, choirAlways: true, taikoVol: 92 }),
  frostpeak: () => orchestral(frostpeak, { extra: FROST_EXTRA, lead: 48, lead2: 60, introOst: true }),
  emberforge: () => rock(emberforge, { guitar: 30, lead: 57, extra: FORGE_EXTRA, kick: 'x . x x x . x x' }),
  elderwood: () => folk(elderwood),
};

// ---------- Menu: "Spell VS Steel" main theme (Eb major / C minor, 92) ----------
export function menu() {
  const s = new Song({ bpm: 92, introBars: 1, loopBars: 16 });
  const C = 'Eb Cm Ab Bb Eb Cm Ab Bb Cm Ab Eb Bb Cm Ab Fm G'.split(' ');
  const all = ['Eb', ...C];
  // harp arpeggios in sixteenths
  s.part('harp', { prog: 46, vol: 84, pan: -0.3, rev: 60 }).seq(all.map(c => { const t = triad(c, 51).map(nm); const u = t.map(n => up(n, 12)); return [t[0], t[1], t[2], u[0], u[1], u[2], u[1], u[0], t[2], t[1], t[2], u[0], u[1], u[0], t[2], t[1]].join(' '); }).join(' '), { step: 0.25, len: 1.5, vel: 66 });
  s.part('strings', { prog: 49, vol: 76, pan: 0.2, rev: 65 }).seq(all.map(c => triad(c, 55).map(nm).join('+') + ' - - - - - - -').join(' '), { vel: 66 });
  s.part('celli', { prog: 49, bank: 40, vol: 74, pan: 0.3, rev: 55 }).seq(all.map(c => `${nm(root(c, 36))} - - - - - - -`).join(' '), { vel: 70 });
  // the battle theme's opening motif, slowed into a horn call, then a flute answer
  s.part('horn', { prog: 60, vol: 96, pan: -0.1, rev: 65 }).seq(bars(
    '. . . . . . . .',
    'Eb4 - - Bb3 Eb4 F4 G4 -', 'G4 - - - - - Eb4 -', 'C4 - - - Eb4 - Ab4 -', 'F4 - - - - - . .',
    'Eb4 - - Bb3 Eb4 F4 G4 Ab4', 'Bb4 - - - G4 - - -', 'Ab4 - G4 - F4 - Eb4 -', 'F4 - - - - - . .',
    rep('.', 8), rep('.', 8), rep('.', 8), rep('.', 8), rep('.', 8), rep('.', 8), rep('.', 8), rep('.', 8)), { vel: 88 });
  s.part('flute', { prog: 73, vol: 86, pan: 0.2, rev: 65 }).seq(bars(
    rep('.', 8), rep('.', 8), rep('.', 8), rep('.', 8), rep('.', 8), rep('.', 8), rep('.', 8), rep('.', 8), rep('.', 8),
    'G5 - - Eb5 G5 - C6 -', 'C6 - Bb5 - Ab5 - Eb5 -', 'Bb5 - - G5 Eb5 - G5 -', 'F5 - - - - - . .',
    'G5 - - Eb5 C5 - G5 -', 'Ab5 - - - C6 - - -', 'Ab5 - G5 - F5 - Eb5 -', 'D5 - - - - - . .'), { vel: 84 });
  s.part('timpani', { prog: 47, vol: 70, rev: 50 }).seq(bars(rep('.', 8), ...C.map((c, i) => (i % 4 === 3 ? `${nm(root(c, 36))} . . . ${nm(root(c, 36))} . ${nm(root(c, 36))} .` : rep('.', 8)))), { vel: 70 });
  return s;
}

// ---------- Victory: brass fanfare, then a calm triumphant loop (Eb major, 112) ----------
export function victory() {
  const s = new Song({ bpm: 112, introBars: 2, loopBars: 8 });
  const loopC = 'Eb Ab Bb Eb Cm Ab Bb Bb'.split(' ');
  s.part('trumpets', { prog: 56, vol: 104, pan: 0.1, rev: 60 }).seq(bars('Bb4 . Bb4 Bb4 Bb4 - Eb5 -', 'G5 - - - Bb5 - - -', ...Array(8).fill(rep('.', 8))), { vel: 104 });
  s.part('horns', { prog: 60, vol: 98, pan: -0.15, rev: 60 }).seq(bars('G4 . G4 G4 G4 - Bb4 -', 'Eb5 - - - F5 - - -',
    'G4 - - - Bb4 - Eb5 -', 'C5 - - - Ab4 - - -', 'Bb4 - - - D5 - F5 -', 'Eb5 - - - - - . .',
    'C5 - - - Eb5 - G5 -', 'Ab5 - - - Eb5 - C5 -', 'D5 - - - F5 - Bb4 -', 'D5 - - - - - . .'), { vel: 78 });
  s.part('trombones', { prog: 57, vol: 88, rev: 55 }).seq(bars('Eb3+Bb3 . Eb3+Bb3 Eb3+Bb3 Eb3+Bb3 - Eb3+G3 -', 'Eb3+Bb3 - - - D3+Bb3 - - -', ...Array(8).fill(rep('.', 8))), { vel: 96 });
  s.part('strings', { prog: 49, vol: 78, pan: 0.2, rev: 65 }).seq(bars(rep('.', 8), 'Eb4+G4+Bb4 - - - D4+F4+Bb4 - - -', ...loopC.map(c => triad(c, 55).map(nm).join('+') + ' - - - - - - -')), { vel: 66 });
  s.part('harp', { prog: 46, vol: 72, pan: -0.3, rev: 60 }).seq(bars(rep('.', 8), rep('.', 8), ...loopC.map(c => { const t = triad(c, 63).map(nm); return `${t[0]} ${t[1]} ${t[2]} ${up(t[0], 12)} ${up(t[1], 12)} ${up(t[0], 12)} ${t[2]} ${t[1]}`; })), { len: 1.5, vel: 62 });
  s.part('bass', { prog: 43, vol: 60, rev: 40 }).seq(bars('Eb2 . Eb2 Eb2 Eb2 - Eb2 -', 'Eb2 - - - Bb1 - - -', ...loopC.map(c => `${nm(root(c, 36))} - - - - - - -`)), { vel: 74 });
  s.part('timpani', { prog: 47, vol: 100, rev: 50 }).seq(bars('Eb2! . Eb2 Eb2 Eb2! - Bb1 -', 'Eb2! - Eb2 Eb2 Bb1! - - -', ...Array(8).fill(rep('.', 8))), { vel: 100 });
  s.part('cymbal', { drums: true, prog: 48, vol: 92, rev: 60 }).seq(bars('x . . . . . . .', 'x . . . x . . .', ...Array(8).fill(rep('.', 8))), { note: 49, vel: 100 });
  return s;
}
