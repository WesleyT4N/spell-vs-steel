// Post-match stats: damage, healing, spells, crowd control and accuracy for each side of one Battle.
// It watches a Battle by wrapping a few of its methods on that one instance and only ever reads the
// state, so the rules play out exactly the same with it on: online lockstep, the hash and the CPU
// never see it. Both machines watch the same battle, so online they agree without sending anything.
import type { Battle, Fighter, HitOpts, Panel, Side } from './battle';
import type { EffectRec } from '../content/effects';
import { CARDS } from './cards';
import { CLASS_INFO } from './classes';
import type { ClassId } from '../art/sprites';

/** Damage and healing one source did, and how often it was used. Sources are card ids, 'light' / 'heavy', or 'other'. */
export interface SourceStat { casts: number; dmg: number; heal: number }

export type CcKind = 'freeze' | 'stun' | 'root' | 'silence' | 'sleep' | 'knockback';

export interface SideStats {
  cls: ClassId;
  dealt: number;
  /** Damage dealt split by kind. */
  basic: number;
  spell: number;
  /** Burning panels, poison, holy fire and other lingering effects. */
  dot: number;
  biggest: number;
  biggestBy: string;
  healed: number;
  /** Basic attacks thrown, and how many reached the enemy (blocked hits count; dodged and missed ones don't). */
  attacks: number;
  attackHits: number;
  casts: number;
  /** Casts of damaging spells, and how many of them reached the enemy at least once. */
  dmgCasts: number;
  dmgCastHits: number;
  countered: number;
  /** Crowd control landed on the enemy: count per kind, and seconds added. */
  cc: Record<CcKind, number>;
  ccSecs: number;
  /** Seconds this fighter spent frozen, stunned or asleep. */
  disabledSecs: number;
  /** Enemy hits this fighter blocked (shields, Guard, parries) or avoided (dodges, misses, immunity). */
  blocked: number;
  evaded: number;
  /** Damage dealt per Draw turn (index 0 = turn 1). */
  turns: number[];
  sources: Record<string, SourceStat>;
}

export interface BattleStats {
  side: [SideStats, SideStats];
  /** Seconds of fighting (Draw screens and the K.O. pause left out). */
  fightSecs: number;
  turns: number;
}

/** One finished round of a set, for the per-round breakdown. */
export interface RoundRecord {
  winner: Side | null;
  secs: number;
  turns: number;
  dealt: [number, number];
  hpLeft: [number, number];
  stats: BattleStats;
}

const DOT_NAME: Record<string, string> = { poison: 'POISON', fire: 'BURNING PANELS', holy: 'HOLY FIRE', shadow: 'CURSES' };

/** Display name of a stats source for a class. */
export function sourceLabel(id: string, cls: ClassId): string {
  if (id === 'light') return CLASS_INFO[cls].basics[0];
  if (id === 'heavy') return CLASS_INFO[cls].basics[1];
  if (id === 'other') return 'EFFECTS';
  if (id.startsWith('dot:')) return DOT_NAME[id.slice(4)] ?? 'EFFECTS';
  return CARDS[id]?.name.toUpperCase() ?? id.toUpperCase();
}

function blank(cls: ClassId): SideStats {
  return {
    cls, dealt: 0, basic: 0, spell: 0, dot: 0, biggest: 0, biggestBy: '', healed: 0,
    attacks: 0, attackHits: 0, casts: 0, dmgCasts: 0, dmgCastHits: 0, countered: 0,
    cc: { freeze: 0, stun: 0, root: 0, silence: 0, sleep: 0, knockback: 0 }, ccSecs: 0, disabledSecs: 0,
    blocked: 0, evaded: 0, turns: [], sources: {},
  };
}

/** What a hit or heal is credited to: one cast or one basic attack. */
interface Tag { id: string; side: Side; hit: boolean; damaging: boolean }

const ROLLBACK = Symbol('stats rollback state');
/** Everything stats keep that rollback netcode must save and restore along with the battle. */
export const statsRollbackRoots = (s: BattleStats): object[] => [s, (s as unknown as Record<symbol, object>)[ROLLBACK]].filter(Boolean);

/** Start keeping stats for `b`. The returned object fills in as the battle runs. */
export function trackStats(b: Battle): BattleStats {
  const out: BattleStats = { side: [blank(b.f[0].cls), blank(b.f[1].cls)], fightSecs: 0, turns: 1 };
  /** A bug in here must never stop the fight: bookkeeping runs guarded. */
  const safe = (fn: () => void): void => { try { fn(); } catch { /* stats only */ } };
  const src = (s: SideStats, id: string): SourceStat => (s.sources[id] ??= { casts: 0, dmg: 0, heal: 0 });

  let current: Tag | null = null;
  const burnTag = new Map<Panel, Tag>();
  const blessTag = new Map<Panel, Tag>();
  const curseTag = new Map<Panel, Tag>();
  /** Recent tags: they change as they land (`hit`), so rollback netcode must rewind them with the battle. */
  const tags: Tag[] = [];
  const newTag = (t: Tag): Tag => { tags.push(t); if (tags.length > 64) tags.shift(); return t; };
  Object.defineProperty(out, ROLLBACK, { value: { tags, burnTag, blessTag, curseTag }, enumerable: false });
  /** Traps and companions remember the spell that placed them. */
  const placed = new WeakMap<object, Tag>();
  // Run `fn` credited to `tag`; effects it schedules, and projectiles, traps and pets it spawns, carry the tag to their hits.
  const under = <R>(tag: Tag | null, fn: () => R): R => {
    const prev = current, n = b.projectiles.length, nTraps = b.traps.length, nPets = b.pets.length;
    current = tag;
    try { return fn(); } finally {
      if (tag) {
        for (const p of b.projectiles.slice(n)) credit(p.onHit, tag);
        for (const t of [...b.traps.slice(nTraps), ...b.pets.slice(nPets)]) if (!placed.has(t)) placed.set(t, tag);
      }
      current = prev;
    }
  };
  // a scheduled effect is credited to whatever was current when it was scheduled (the note rewinds with the battle)
  const credit = (fx: EffectRec<unknown>, tag: Tag | null = current): void => { if (tag && !fx.w?.stats) fx.w = { ...fx.w, stats: tag }; };

  const update = b.update.bind(b);
  b.update = (dt, intents) => {
    safe(() => {
      if (b.phase !== 'fight') return;
      out.fightSecs += dt;
      for (const f of b.f) if (f.st.frozen > 0 || f.st.stunned > 0 || f.st.sleep > 0) out.side[f.side].disabledSecs += dt;
    });
    update(dt, intents);
  };

  const beginCustom = b.beginCustom.bind(b);
  b.beginCustom = () => { beginCustom(); out.turns = b.turn; };

  const basicAttack = b.basicAttack.bind(b);
  b.basicAttack = (f, kind) => {
    const tag = newTag({ id: kind, side: f.side, hit: false, damaging: true });
    safe(() => { out.side[f.side].attacks++; src(out.side[f.side], kind).casts++; });
    under(tag, () => basicAttack(f, kind));
  };

  const castTop = b.castTop.bind(b);
  b.castTop = (f, held) => {
    const id = f.queue[0], before = f.queue.length;
    const card = id ? CARDS[id] : undefined;
    const tag: Tag | null = id ? newTag({ id, side: f.side, hit: false, damaging: !!card?.damaging }) : null;
    under(tag, () => castTop(f, held));
    if (!tag || f.queue.length >= before) return;
    safe(() => {
      const s = out.side[f.side];
      s.casts++;
      src(s, id).casts++;
      if (tag.damaging) s.dmgCasts++;
      const callout = b.fx.find(e => e.kind === 'castName' && e.side === f.side);
      if (callout?.data?.countered) s.countered++;
    });
  };

  const later = b.later.bind(b);
  b.later = (delay, fx) => { credit(fx); later(delay, fx); };
  const runEffect = b.runEffect.bind(b);
  b.runEffect = (fx, h) => {
    const tag = fx.w?.stats as Tag | undefined;
    if (tag) under(tag, () => runEffect(fx, h)); else runEffect(fx, h);
  };

  const bless = b.bless.bind(b);
  b.bless = (col, row, kind) => {
    safe(() => { const p = b.panel(col, row); if (p && current) blessTag.set(p, current); });
    bless(col, row, kind);
  };

  const curse = b.curse.bind(b);
  b.curse = (side, col, row) => {
    safe(() => { const p = b.panel(col, row); if (p && current) curseTag.set(p, current); });
    curse(side, col, row);
  };

  const burn = b.burn.bind(b);
  b.burn = (col, row, secs, dps) => {
    safe(() => { const p = b.panel(col, row); if (p && current) burnTag.set(p, current); });
    burn(col, row, secs, dps);
  };

  const damage = b.damage.bind(b);
  b.damage = (target: Fighter, base: number, from: Fighter | null, opts: HitOpts) => {
    const res = damage(target, base, from, opts);
    safe(() => {
      let tag = current;
      // burning panels carry the spell that lit them
      if (!tag && !from && opts.element === 'fire') tag = burnTag.get(b.panels[target.col][target.row]) ?? null;
      // cursed panels carry the spell that cursed them; shadow DoTs are named by their card
      if (!tag && opts.dot && opts.element === 'shadow' && from) {
        if (opts.spell) {
          const dot = target.dots.find(d => d.src === from.side && d.dps === base);
          if (dot && CARDS[dot.id]) tag = { id: dot.id, side: from.side, hit: true, damaging: true };
        } else tag = curseTag.get(b.panels[target.col][target.row]) ?? null;
      }
      // a trap springing this frame (fired traps are cleared at the end of it)
      if (!tag && from && !opts.basic) { const trap = b.traps.find(t => t.fired && t.side === from.side); if (trap) tag = placed.get(trap) ?? null; }
      const by: Side = from ? from.side : tag ? tag.side : (1 - target.side) as Side;
      if (by === target.side) return;
      const s = out.side[by], t = out.side[target.side];
      const reached = res.dealt > 0 || res.blocked;
      if (tag && tag.side === by && reached && !opts.dot) {
        if (!tag.hit) { if (tag.id === 'light' || tag.id === 'heavy') s.attackHits++; else if (tag.damaging) s.dmgCastHits++; }
        tag.hit = true;
      }
      if (res.blocked) t.blocked++;
      else if (res.dealt <= 0 && !opts.dot && base > 0 && !target.dead) t.evaded++;
      const amt = res.dealt;
      if (amt <= 0) return;
      s.dealt += amt;
      if (opts.basic) s.basic += amt; else if (opts.dot && !tag) s.dot += amt; else s.spell += amt;
      const id = opts.basic ?? (tag && tag.side === by ? tag.id : opts.dot ? `dot:${opts.element ?? ''}` : 'other');
      src(s, id).dmg += amt;
      if (amt > s.biggest) { s.biggest = amt; s.biggestBy = id; }
      const turn = Math.max(0, b.turn - 1);
      while (s.turns.length <= turn) s.turns.push(0);
      s.turns[turn] += amt;
    });
    return res;
  };

  const petAttack = b.petAttack.bind(b);
  b.petAttack = (p, mult) => under(placed.get(p) ?? current, () => petAttack(p, mult));

  const heal = b.heal.bind(b);
  b.heal = (f, amt) => {
    const before = f.hp;
    heal(f, amt);
    safe(() => {
      const got = f.hp - before;
      if (got <= 0) return;
      const s = out.side[f.side];
      s.healed += got;
      // blessed panels heal in the name of the spell that blessed them
      const tag = current ?? blessTag.get(b.panels[f.col][f.row]) ?? null;
      src(s, tag && tag.side === f.side ? tag.id : 'other').heal += got;
    });
  };

  // crowd control: credited to the side that isn't on the receiving end
  const watchCc = (kind: CcKind, key: 'frozen' | 'stunned' | 'rooted' | 'silenced' | 'sleep'): void => {
    const name = kind as 'freeze' | 'stun' | 'root' | 'silence' | 'sleep';
    const orig = (b[name] as (f: Fighter, t: number) => void).bind(b);
    b[name] = (f: Fighter, t: number) => {
      const before = f.st[key];
      orig(f, t);
      safe(() => {
        const added = f.st[key] - before;
        if (added <= 0) return;
        const s = out.side[1 - f.side];
        s.cc[kind]++;
        s.ccSecs += added;
      });
    };
  };
  watchCc('freeze', 'frozen');
  watchCc('stun', 'stunned');
  watchCc('root', 'rooted');
  watchCc('silence', 'silenced');
  watchCc('sleep', 'sleep');
  const knockback = b.knockback.bind(b);
  b.knockback = (f, panels) => {
    const moved = knockback(f, panels);
    if (moved) safe(() => { out.side[1 - f.side].cc.knockback++; });
    return moved;
  };

  return out;
}

/** Share of attacks or damaging spells that reached the enemy, 0..1, or null with nothing thrown. */
export const accuracy = (hits: number, tries: number): number | null => (tries > 0 ? Math.min(1, hits / tries) : null);

export const ccCount = (s: SideStats): number => Object.values(s.cc).reduce((a, n) => a + n, 0);

/** Sources of one side, most damage (then healing, then casts) first. */
export function rankedSources(s: SideStats): Array<[string, SourceStat]> {
  return Object.entries(s.sources)
    .filter(([, v]) => v.dmg > 0 || v.heal > 0 || v.casts > 0)
    .sort((a, b) => b[1].dmg - a[1].dmg || b[1].heal - a[1].heal || b[1].casts - a[1].casts);
}

/** The spell cast most often (ties go to the one that did more), or null if none was cast. */
export function mostUsed(s: SideStats): [string, SourceStat] | null {
  const spells = Object.entries(s.sources).filter(([id, v]) => CARDS[id] && v.casts > 0);
  spells.sort((a, b) => b[1].casts - a[1].casts || b[1].dmg + b[1].heal - (a[1].dmg + a[1].heal));
  return spells[0] ?? null;
}

/** The spell that did the most damage plus healing, or null. */
export function topSpell(s: SideStats): [string, SourceStat] | null {
  const spells = Object.entries(s.sources).filter(([id, v]) => CARDS[id] && v.dmg + v.heal > 0);
  spells.sort((a, b) => b[1].dmg + b[1].heal - (a[1].dmg + a[1].heal));
  return spells[0] ?? null;
}

export function roundRecord(b: Battle, stats: BattleStats): RoundRecord {
  return {
    winner: b.winner, secs: stats.fightSecs, turns: stats.turns,
    dealt: [stats.side[0].dealt, stats.side[1].dealt],
    hpLeft: [Math.max(0, b.f[0].hp), Math.max(0, b.f[1].hp)],
    stats,
  };
}

/** Both sides' stats summed over a set of rounds. */
export function setTotals(rounds: RoundRecord[]): [SideStats, SideStats] | null {
  if (!rounds.length) return null;
  const sum = (side: Side): SideStats => {
    const t = blank(rounds[0].stats.side[side].cls);
    for (const r of rounds) {
      const s = r.stats.side[side];
      for (const k of ['dealt', 'basic', 'spell', 'dot', 'healed', 'attacks', 'attackHits', 'casts', 'dmgCasts', 'dmgCastHits', 'countered', 'ccSecs', 'disabledSecs', 'blocked', 'evaded'] as const) t[k] += s[k];
      if (s.biggest > t.biggest) { t.biggest = s.biggest; t.biggestBy = s.biggestBy; }
      for (const k of Object.keys(t.cc) as CcKind[]) t.cc[k] += s.cc[k];
      for (const [id, v] of Object.entries(s.sources)) {
        const d = (t.sources[id] ??= { casts: 0, dmg: 0, heal: 0 });
        d.casts += v.casts; d.dmg += v.dmg; d.heal += v.heal;
      }
    }
    return t;
  };
  return [sum(0), sum(1)];
}

/** Start the counts over (training's CLEAR STATS). The watcher keeps filling the same object. */
export function clearStats(s: BattleStats): void {
  s.side = [blank(s.side[0].cls), blank(s.side[1].cls)];
  s.fightSecs = 0;
}
