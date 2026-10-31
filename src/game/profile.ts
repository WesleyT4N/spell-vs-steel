// The player profile: every finished set played on this machine, won or lost, by the class played and by
// mode, and how often each spell deck gets picked. Kept in the save module's `profile` section; replays
// come and go (only the newest are kept) but these counts stay.
//
// A save from before the profile existed starts from the replays it still has, so a returning player
// doesn't open an empty card.
import { getSave, setSave } from '../engine/save';
import { loadReplays, replayScore, type Replay, type ReplayMode } from './replay';
import { CLASS_IDS } from './classes';
import type { ClassId } from '../art/sprites';

export interface WinLoss { w: number; l: number }

export interface Profile {
  /** Sets won and lost, by the class played. */
  classes: Partial<Record<ClassId, WinLoss>>;
  /** Sets won and lost, by mode. */
  modes: Partial<Record<ReplayMode, WinLoss>>;
  /** Sets played with each spell deck, as `<class>|<deck choice>` (the deck ids MatchConfig uses). */
  decks: Record<string, number>;
}

const blank = (): Profile => ({ classes: {}, modes: {}, decks: {} });
const isWL = (v: unknown): v is WinLoss => {
  const o = v as WinLoss;
  return !!o && typeof o === 'object' && Number.isInteger(o.w) && Number.isInteger(o.l) && o.w >= 0 && o.l >= 0;
};
const pick = <T>(v: unknown, ok: (x: unknown) => x is T): Record<string, T> =>
  v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([, x]) => ok(x))) as Record<string, T> : {};
const isCount = (x: unknown): x is number => Number.isInteger(x) && (x as number) > 0;

/** A set's result for the side that recorded it: true won, false lost, null not over (or nobody's side). */
export function setResult(r: Replay): boolean | null {
  if (r.me === null || r.mode === 'watch' || r.mode === 'versus') return null;
  const s = replayScore(r), need = Math.ceil(r.bestOf / 2);
  if (Math.max(s[0], s[1]) < need) return null;
  return s[r.me] > s[1 - r.me];
}

/** The class the recording player fought as. */
const myClass = (r: Replay): ClassId => r.rounds[0].specs[r.me ?? 0].cls;

function add(p: Profile, cls: ClassId, mode: ReplayMode, won: boolean): void {
  const c = p.classes[cls] ??= { w: 0, l: 0 }, m = p.modes[mode] ??= { w: 0, l: 0 };
  if (won) { c.w++; m.w++; } else { c.l++; m.l++; }
}

/** Results from saved replays, for a save made before the profile (`skip`: a set being counted right now). */
function fromReplays(skip?: string): Profile {
  const p = blank();
  for (const r of loadReplays()) {
    const won = r.id === skip ? null : setResult(r);
    if (won !== null) add(p, myClass(r), r.mode, won);
  }
  return p;
}

/** The profile as saved, checked (old saves, hand edits). */
export function loadProfile(skip?: string): Profile {
  const raw = getSave('profile');
  if (!raw) return fromReplays(skip);
  return {
    classes: pick(raw.classes, isWL),
    modes: pick(raw.modes, isWL),
    decks: pick(raw.decks, isCount),
  };
}

/** A set just ended (its last round is in `r`): count it, and the spell deck the player used. */
export function recordSet(r: Replay, deck: string): void {
  const won = setResult(r);
  if (won === null) return;
  const p = loadProfile(r.id), cls = myClass(r);
  add(p, cls, r.mode, won);
  const key = `${cls}|${deck}`;
  p.decks[key] = (p.decks[key] ?? 0) + 1;
  setSave('profile', p as unknown as Record<string, unknown>);
}

export const total = (p: Profile): WinLoss =>
  Object.values(p.classes).reduce<WinLoss>((a, x) => x ? { w: a.w + x.w, l: a.l + x.l } : a, { w: 0, l: 0 });

/** Win rate as a whole percent ('-' before any sets). */
export const pct = (x: WinLoss | undefined): string => (x && x.w + x.l ? `${Math.round((100 * x.w) / (x.w + x.l))}%` : '-');

/** The class played the most sets with (ties: the more wins), or null before any. */
export function favoriteClass(p: Profile): ClassId | null {
  let best: ClassId | null = null, bn = 0, bw = 0;
  for (const cls of CLASS_IDS) {
    const x = p.classes[cls];
    if (!x) continue;
    const n = x.w + x.l;
    if (n > bn || (n === bn && x.w > bw)) { best = cls; bn = n; bw = x.w; }
  }
  return best;
}

/** The spell deck played the most sets with (ties: the favorite class's): its class, deck choice and count, or null before any. */
export function favoriteDeck(p: Profile): { cls: ClassId; deck: string; n: number } | null {
  let best: { cls: ClassId; deck: string; n: number } | null = null;
  const fav = favoriteClass(p);
  for (const [key, n] of Object.entries(p.decks)) {
    const i = key.indexOf('|'), cls = key.slice(0, i);
    if (!CLASS_IDS.includes(cls)) continue;
    if (!best || n > best.n || (n === best.n && cls === fav && best.cls !== fav)) best = { cls, deck: key.slice(i + 1), n };
  }
  return best;
}
