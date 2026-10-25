// Dev instrumentation for a Battle: tags every hit with the spell (or basic attack) that caused it,
// scales spell damage by a per-card power multiplier, and reports each hit to a listener.
// It wraps methods on one Battle instance, so the rules in battle.ts stay untouched.
import type { Battle, Fighter, HitOpts, Panel, Side } from '../game/battle';
import { CARDS } from '../game/cards';

/** Damage multiplier per card id (1 = as written). Shared by the sandbox, the balance lab and the CLI sim. */
export const CARD_POWER: Record<string, number> = {};
export const cardPower = (id: string): number => CARD_POWER[id] ?? 1;

/** Where a hit came from: a card id, 'light' / 'heavy' basics, or 'other' (zones, statuses, walls). */
export type Source = string;

export interface Hit {
  time: number;
  /** Side that dealt the hit (null when unknown). */
  by: Side | null;
  target: Side;
  source: Source;
  base: number;
  dealt: number;
  blocked: boolean;
  /** Target was frozen or stunned (so the +50% applied). */
  disabled: boolean;
  element?: string;
}

export interface Probe {
  hits: Hit[];
  /** Spells cast per side, in order (countered ones included). */
  casts: [string[], string[]];
  /** Keep only the newest `keep` hits in `hits` (0 = keep all). */
  keep: number;
  onHit?: (h: Hit, target: Fighter) => void;
  onCast?: (side: Side, id: string) => void;
}

interface Tag { id: string; side: Side }

export function sourceName(s: Source): string {
  if (s === 'light') return 'Light attack';
  if (s === 'heavy') return 'Heavy attack';
  if (s === 'other') return 'Other';
  return CARDS[s]?.name ?? s;
}

export function instrument(b: Battle, keep = 0): Probe {
  const probe: Probe = { hits: [], casts: [[], []], keep };
  let current: Tag | null = null;
  const burnTag = new Map<Panel, Tag>();

  const tagged = new WeakSet<object>();
  // Run `fn` under `tag`; projectiles it spawns (by shoot() or a direct push) carry the tag to their hit.
  const under = <R>(tag: Tag | null, fn: () => R): R => {
    const prev = current, n = b.projectiles.length;
    current = tag;
    try { return fn(); } finally {
      if (tag) for (const p of b.projectiles.slice(n)) {
        if (tagged.has(p)) continue;
        tagged.add(p);
        p.onHit = carry(p.onHit, tag);
      }
      current = prev;
    }
  };
  // run `fn` with the tag that was current when it was scheduled
  function carry<A extends unknown[], R>(fn: (...a: A) => R, tag: Tag | null = current): (...a: A) => R {
    if (!tag) return fn;
    return (...a: A): R => under(tag, () => fn(...a));
  }

  const castTop = b.castTop.bind(b);
  b.castTop = (f, held) => {
    const id = f.queue[0];
    const before = f.queue.length;
    under(id ? { id, side: f.side } : null, () => castTop(f, held));
    if (id && f.queue.length < before) { probe.casts[f.side].push(id); probe.onCast?.(f.side, id); }
  };

  const later = b.later.bind(b);
  b.later = (delay, fn) => later(delay, carry(fn));

  const burn = b.burn.bind(b);
  b.burn = (col, row, secs, dps) => {
    const p = b.panel(col, row);
    if (p && current) burnTag.set(p, current);
    burn(col, row, secs, dps);
  };

  const damage = b.damage.bind(b);
  b.damage = (target: Fighter, base: number, src: Fighter | null, opts: HitOpts) => {
    let tag: Tag | null = current;
    // burning panels carry the spell that lit them
    if (!opts.basic && !tag && !src && opts.element === 'fire') tag = burnTag.get(b.panels[target.col][target.row]) ?? null;
    const source: Source = opts.basic ?? tag?.id ?? 'other';
    const by: Side | null = src ? src.side : tag ? tag.side : null;
    const scaled = opts.basic || !tag ? base : base * cardPower(tag.id);
    const disabled = target.st.frozen > 0 || target.st.stunned > 0;
    const out = damage(target, scaled, src, opts);
    const h: Hit = { time: b.time, by, target: target.side, source, base: scaled, dealt: out.dealt, blocked: out.blocked, disabled, element: opts.element };
    probe.hits.push(h);
    if (probe.keep && probe.hits.length > probe.keep) probe.hits.splice(0, probe.hits.length - probe.keep);
    probe.onHit?.(h, target);
    return out;
  };

  return probe;
}
