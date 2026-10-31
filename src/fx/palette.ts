// The game's colors for effects: the NES master palette the sprites and stages use, and an element ramp for
// each element (dark to bright, NES colors only) to hand pixelfx effects as `palette`.

/** The NES palette (as the 24px sprites use it), plus the two in-between grays the art already uses. */
export const NES = [
  '#7c7c7c', '#0000fc', '#0000bc', '#4428bc', '#940084', '#a80020', '#a81000', '#881400', '#503000', '#007800', '#006800', '#005800', '#004058', '#000000',
  '#bcbcbc', '#0078f8', '#0058f8', '#6844fc', '#d800cc', '#e40058', '#f83800', '#e45c10', '#ac7c00', '#00b800', '#00a800', '#00a844', '#008888',
  '#f8f8f8', '#3cbcfc', '#6888fc', '#9878f8', '#f878f8', '#f85898', '#f87858', '#fca044', '#f8b800', '#b8f818', '#58d854', '#58f898', '#00e8d8', '#787878',
  '#fcfcfc', '#a4e4fc', '#b8b8f8', '#d8b8f8', '#f8b8f8', '#f8a4c0', '#f0d0b0', '#fce0a8', '#f8d878', '#d8f878', '#b8f8b8', '#b8f8d8', '#00fcfc', '#f8d8f8',
  '#3c3c3c', '#5c5c5c',
];

/** Element ramps, dark to bright. Effects are colored by element (fire orange, frost blue, holy gold...). */
export const RAMPS = {
  steel: ['#000000', '#3c3c3c', '#7c7c7c', '#bcbcbc', '#fcfcfc'],
  /** Rage: the Warrior's heavy hits, hot gold over red. */
  rage: ['#881400', '#a81000', '#f83800', '#fca044', '#f8b800', '#fce0a8', '#fcfcfc'],
  fire: ['#881400', '#a81000', '#f83800', '#fca044', '#f8b800', '#fce0a8', '#fcfcfc'],
  frost: ['#0000bc', '#0058f8', '#0078f8', '#3cbcfc', '#a4e4fc', '#fcfcfc'],
  arcane: ['#940084', '#d800cc', '#f878f8', '#f8b8f8', '#fcfcfc'],
  holy: ['#503000', '#ac7c00', '#f8b800', '#f8d878', '#fce0a8', '#fcfcfc'],
  shadow: ['#000000', '#4428bc', '#6844fc', '#9878f8', '#d8b8f8'],
  poison: ['#005800', '#00a800', '#58d854', '#b8f818', '#d8f878'],
  nature: ['#006800', '#00b800', '#58d854', '#b8f8b8', '#fcfcfc'],
  dust: ['#503000', '#ac7c00', '#f0d0b0', '#fce0a8'],
} as const;
