// Side colors, as the player sees them: your side is always blue and the opponent's always red, whichever side of
// the grid you stand on. In local 2P and CPU vs CPU, P1 (the left side) is blue. View-only: the battle never reads it.
import type { Side } from './battle';

/** The colors of one team: panel rims, area-spell flashes, reticles and banners. */
export interface TeamColors { rim: [string, string]; flash: string; edge: string; mark: string; dark: string }
export const YOU: TeamColors = { rim: ['#486cdb', '#212f84'], flash: '#3cbcfc', edge: '#0078f8', mark: '#0058f8', dark: '#0000a8' };
export const FOE: TeamColors = { rim: ['#dd3443', '#8d1a30'], flash: '#f87858', edge: '#f83800', mark: '#d82800', dark: '#881400' };

let home: Side = 0;
/** Which side draws blue. drawBattle sets it from its viewer every frame. */
export function setHome(s: Side): void { home = s; }
export function isHome(s: Side): boolean { return s === home; }
export function team(s: Side): TeamColors { return s === home ? YOU : FOE; }
