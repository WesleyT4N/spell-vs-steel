// Two original tracks in a 16-bit JRPG style: a gentle harp-and-flute menu theme and a driving battle theme.
import { midi, type Song } from './audio';

const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const name = (m: number): string => NAMES[m % 12] + (Math.floor(m / 12) - 1);

/** Join bars written as space-separated tokens into one token list. */
const bars = (...b: string[]): string[] => b.join(' ').trim().split(/\s+/);
/** Double each token so an eighth-note line can sit on a sixteenth-note grid. */
const doubled = (tokens: string[]): string[] => tokens.flatMap(t => [t, t === '.' ? '.' : '-']);
/** One held note per bar. */
const held = (notes: string[], perBar: number): string[] => notes.flatMap(n => [n, ...Array(perBar - 1).fill(n === '.' ? '.' : '-')]);
const rep = (s: string, n: number): string => Array(n).fill(s).join(' ');

// ---------- Menu: "Colosseum Dawn" (F major, 80 bpm, sixteenths) ----------
const MENU_CHORDS = [
  ['F3', 'A3', 'C4', 'E4'], ['E3', 'G3', 'B3', 'D4'], ['D3', 'F3', 'A3', 'C4'], ['C3', 'G3', 'C4', 'E4'],
  ['Bb2', 'D3', 'F3', 'A3'], ['A2', 'C3', 'E3', 'G3'], ['G2', 'Bb2', 'D3', 'F3'], ['C3', 'E3', 'G3', 'Bb3'],
];
const ARP = [0, 1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 3, 2, 1];
const harpBar = (ch: string[]): string[] => {
  const tones = [...ch.map(midi), ...ch.map(n => midi(n) + 12)];
  return ARP.map(i => name(tones[i] + 12));
};
const menuHarp = [...MENU_CHORDS, ...MENU_CHORDS].flatMap(harpBar);
const menuBass = held(['F2', 'E2', 'D2', 'C2', 'Bb1', 'A1', 'G1', 'C2', 'F2', 'E2', 'D2', 'C2', 'Bb1', 'A1', 'G1', 'C2'], 16);
const menuPad = held([...MENU_CHORDS, ...MENU_CHORDS].map(c => c[2]), 16);
const menuFlute = doubled(bars(
  '. . . . . . . .', '. . . . . . . .', '. . . . . . . .', '. . . . . . . .',
  '. . . . . . . .', '. . . . . . . .', '. . . . . . . .', '. . . . . . . .',
  'A5 - - - G5 - F5 -', 'G5 - - - - - E5 -', 'F5 - - - E5 - D5 -', 'E5 - - - - - - -',
  'D5 - - - F5 - A5 -', 'G5 - - - E5 - C5 -', 'D5 - - - F5 - Bb5 -', 'A5 - - - G5 - - -',
  'C6 - - - A5 - F5 -', 'B5 - - - G5 - E5 -', 'A5 - - - F5 - D5 -', 'G5 - - - E5 - C5 -',
  'D5 - F5 - Bb5 - A5 -', 'G5 - - - E5 - - -', 'F5 - - - E5 - D5 -', 'E5 - - - - - . .',
));

export const MENU_SONG: Song = {
  bpm: 80, steps: 4, intro: 8,
  tracks: [
    { inst: 'harp', notes: [...menuHarp, ...menuHarp, ...menuHarp].slice(0, 24 * 16), vol: 0.16 },
    { inst: 'bass', notes: [...menuBass, ...menuBass.slice(0, 8 * 16)], vol: 0.14 },
    { inst: 'strings', notes: [...menuPad, ...menuPad.slice(0, 8 * 16)], vol: 0.06 },
    { inst: 'flute', notes: menuFlute, vol: 0.13 },
  ],
};

// ---------- Battle: "Steel Meets Spell" (D minor, 160 bpm, eighths) ----------
type Chord = 'Dm' | 'Bb' | 'C' | 'A' | 'Gm';
const ROOT: Record<Chord, [string, string]> = { Dm: ['D2', 'D3'], Bb: ['Bb1', 'Bb2'], C: ['C2', 'C3'], A: ['A1', 'A2'], Gm: ['G1', 'G2'] };
const TRIAD: Record<Chord, string[]> = { Dm: ['D4', 'F4', 'A4'], Bb: ['D4', 'F4', 'Bb4'], C: ['E4', 'G4', 'C5'], A: ['E4', 'A4', 'C#5'], Gm: ['D4', 'G4', 'Bb4'] };

const SEC_A: Chord[] = ['Dm', 'Bb', 'C', 'A', 'Dm', 'Bb', 'C', 'A'];
const SEC_B: Chord[] = ['Gm', 'A', 'Dm', 'Bb', 'Gm', 'C', 'A', 'A'];
const LOOP = [...SEC_A, ...SEC_B];

const bassBar = (c: Chord): string => { const [lo, hi] = ROOT[c]; return rep(`${lo} ${hi}`, 4); };
const ostBar = (c: Chord): string => { const [a, b, d] = TRIAD[c]; const up = (n: string): string => name(midi(n) + 12); return `${a} ${up(a)} ${b} ${up(a)} ${d} ${up(a)} ${b} ${up(a)}`; };

const battleBass = bars(
  'A1 . . . A1 . . .', 'A1 . A1 . A1 A1 A2 A1',
  ...LOOP.map(bassBar),
);
const battleOst = bars(rep('.', 16), ...LOOP.map(ostBar));
const padTrack = (k: number): string[] => bars(
  `${TRIAD.A[k]} . ${TRIAD.A[k]} . ${TRIAD.A[k]} ${TRIAD.A[k]} . .`, `${TRIAD.A[k]} - - - - - - -`,
  ...LOOP.map(c => `${TRIAD[c][k]} - - - - - - -`),
);
const battleLead = bars(
  rep('.', 16),
  'D5 - - A4 D5 E5 F5 -', 'F5 - E5 D5 E5 - D5 -', 'C5 - - G4 C5 D5 E5 -', 'E5 - - - C#5 - A4 -',
  'D5 - - A4 D5 E5 F5 G5', 'A5 - G5 F5 G5 - F5 D5', 'E5 - C5 - G5 - E5 -', 'A5 - - - - - . .',
  'G5 - F5 - D5 - Bb4 -', 'C#5 - E5 - A5 - G5 -', 'F5 - - E5 D5 - A4 -', 'Bb4 - D5 - F5 - Bb5 -',
  'A5 - G5 - F5 - D5 -', 'E5 - F5 - G5 - E5 -', 'C#5 - D5 - E5 - G5 -', 'A5 - - - A4 - C#5 E5',
);
const battleKick = bars('x . . . . . . .', 'x . . . x . x .', ...LOOP.map(() => 'x . . x x . . .'));
const battleSnare = bars('. . . . . . . .', 'x . x . x x x x', ...LOOP.map(() => '. . x . . . x .'));
const battleHat = bars(rep('.', 8), rep('.', 8), ...LOOP.map(() => 'x x x x x x x x'));

export const BATTLE_SONG: Song = {
  bpm: 160, steps: 2, intro: 2,
  tracks: [
    { inst: 'bass', notes: battleBass, vol: 0.2 },
    { inst: 'harp', notes: battleOst, vol: 0.07 },
    { inst: 'strings', notes: padTrack(0), vol: 0.05 },
    { inst: 'strings', notes: padTrack(1), vol: 0.05 },
    { inst: 'strings', notes: padTrack(2), vol: 0.05 },
    { inst: 'brass', notes: battleLead, vol: 0.12 },
    { inst: 'kick', notes: battleKick, vol: 0.45 },
    { inst: 'snare', notes: battleSnare, vol: 0.18 },
    { inst: 'hat', notes: battleHat, vol: 0.05 },
  ],
};

// ---------- Victory fanfare-ish sting, loops quietly on the results screen ----------
export const RESULT_SONG: Song = {
  bpm: 120, steps: 2,
  tracks: [
    { inst: 'brass', notes: bars('D5 D5 D5 D5 - Bb4 - C5', 'D5 - C5 D5 - - - -', rep('.', 8), rep('.', 8)), vol: 0.12 },
    { inst: 'strings', notes: bars('D4 - - - Bb3 - C4 -', 'D4 - - - - - - -', rep('.', 8), rep('.', 8)), vol: 0.06 },
    { inst: 'bass', notes: bars('D2 - - - Bb1 - C2 -', 'D2 - - - - - - -', rep('.', 8), rep('.', 8)), vol: 0.16 },
  ],
};
