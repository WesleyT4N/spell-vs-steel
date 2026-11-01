// Expedition monsters: each one's numbers and its pattern (a small "brain" the battle runs every frame the
// monster can act). Patterns follow Battle Network's viruses: one readable thing each, every hit telegraphed.
// Delayed hits are plain-data effect records (src/content/effects.ts), so the battle state holds no functions.
import { Battle, MOB_BRAINS, makeMob, COLS, ROWS, type Fighter, type MobBrain, type HitOpts } from './battle';
import { effect, type EffectRec, type ShotHit } from '../content/effects';
import type { Element } from './cards';

export interface MobDef {
  id: string;
  name: string;
  hp: number;
  /** The column it starts in (3 front, 5 back). */
  col: number;
  rank: 'regular' | 'elite' | 'boss';
  /** One line for the encyclopedia-style info on the map and in the pack nameplate. */
  blurb: string;
}

export const MOBS: Record<string, MobDef> = {
  stumpkin: { id: 'stumpkin', name: 'STUMPKIN', hp: 900, col: 4, rank: 'regular', blurb: 'Slams a root shockwave down its row.' },
  wolf: { id: 'wolf', name: 'GREY WOLF', hp: 800, col: 4, rank: 'regular', blurb: 'Howls, then dashes down your row.' },
  webspinner: { id: 'webspinner', name: 'WEBSPINNER', hp: 700, col: 5, rank: 'regular', blurb: 'Its web roots you in place.' },
  wisp: { id: 'wisp', name: 'WISP', hp: 500, col: 5, rank: 'regular', blurb: 'Heals its allies. Kill it first.' },
  barkguard: { id: 'barkguard', name: 'BARKGUARD', hp: 1800, col: 3, rank: 'regular', blurb: 'Steps in front of your shots.' },
  alpha: { id: 'alpha', name: 'ALPHA WOLF', hp: 3500, col: 4, rank: 'elite', blurb: 'Pounces, dashes, and calls the pack.' },
  thornmother: { id: 'thornmother', name: 'THORNMOTHER', hp: 4500, col: 5, rank: 'elite', blurb: 'Brambles, bark skin and wisps.' },
  oakheart: { id: 'oakheart', name: 'OLD OAKHEART', hp: 9000, col: 4, rank: 'boss', blurb: 'The forest itself, angry.' },
  // the crypt
  skelarcher: { id: 'skelarcher', name: 'SKELETON ARCHER', hp: 1100, col: 5, rank: 'regular', blurb: 'Lines up and looses an arrow.' },
  rattler: { id: 'rattler', name: 'BONE RATTLER', hp: 1300, col: 4, rank: 'regular', blurb: 'Rattles, then a fast bone shockwave.' },
  ghoul: { id: 'ghoul', name: 'GHOUL', hp: 1400, col: 3, rank: 'regular', blurb: 'Marks your panel, then leaps on it.' },
  banshee: { id: 'banshee', name: 'BANSHEE', hp: 900, col: 5, rank: 'regular', blurb: 'Screams down your column. Stuns.' },
  gravebell: { id: 'gravebell', name: 'GRAVE BELL', hp: 1000, col: 5, rank: 'regular', blurb: 'Its toll makes its allies hit harder.' },
  deathknight: { id: 'deathknight', name: 'DEATH KNIGHT', hp: 5500, col: 4, rank: 'elite', blurb: 'Blade waves, a column cleave, raises archers.' },
  colossus: { id: 'colossus', name: 'BONE COLOSSUS', hp: 7000, col: 5, rank: 'elite', blurb: 'Never moves. Spears and falling bones.' },
  boneking: { id: 'boneking', name: 'THE BONE KING', hp: 9000, col: 4, rank: 'boss', blurb: 'The lich under the crypt.' },
  // the volcano
  imp: { id: 'imp', name: 'IMP', hp: 1200, col: 5, rank: 'regular', blurb: 'Drops fire on your panel.' },
  salamander: { id: 'salamander', name: 'SALAMANDER', hp: 1500, col: 4, rank: 'regular', blurb: 'Spits fireballs down its row.' },
  golem: { id: 'golem', name: 'MAGMA GOLEM', hp: 2600, col: 3, rank: 'regular', blurb: 'Slams your column and cracks it.' },
  emberbat: { id: 'emberbat', name: 'EMBER BAT', hp: 1000, col: 5, rank: 'regular', blurb: 'Dives across you on a diagonal.' },
  shaman: { id: 'shaman', name: 'CINDER SHAMAN', hp: 1300, col: 5, rank: 'regular', blurb: 'Shields its allies. Kill it first.' },
  drakerider: { id: 'drakerider', name: 'DRAKE RIDER', hp: 8000, col: 4, rank: 'elite', blurb: 'Lance charges and fire breath.' },
  titan: { id: 'titan', name: 'OBSIDIAN TITAN', hp: 6500, col: 4, rank: 'elite', blurb: 'Quakes, shockwaves, an obsidian shell.' },
  emberwyrm: { id: 'emberwyrm', name: 'EMBERWYRM', hp: 13000, col: 4, rank: 'boss', blurb: 'The red dragon in the mountain.' },
};

// ---------- shared moves ----------

const NATURE: HitOpts = { element: 'nature' };

/** A telegraphed hit on cells for monster `m` (skipped if it died while the warning ran). */
const mobHit = effect('mob.hit', (b, a: { m: Fighter; cells: Array<[number, number]>; dmg: number; root?: number; fx?: string; el?: Element; stun?: number; freeze?: number; crack?: boolean }) => {
  if (a.m.dead || b.phase !== 'fight') return;
  for (const [c, r] of a.cells) if (a.fx && b.inGrid(c, r)) b.addFx(a.fx, 1, c, r, 0.36);
  const res = b.strike(a.m, a.cells, a.dmg, { element: a.el ?? 'nature', knockback: false, stun: a.stun, freeze: a.freeze });
  if (a.crack) for (const [c, r] of a.cells) { const p = b.panel(c, r); if (p) p.cracked = true; }
  if (res.fighter && a.root) b.root(b.f[0], a.root);
});

/** A shot that lands on the player: damage, and a root for the web. */
const mobShot = effect('mob.shot', (b, a: { dmg: number; root?: number; fx?: string; el?: Element }, h: ShotHit) => {
  const opts: HitOpts = a.el ? { element: a.el } : NATURE;
  if (h.w) { b.hitWall(h.w, a.dmg, null, opts); return; }
  if (!h.t) return;
  const out = b.damage(h.t, a.dmg, null, opts);
  if (a.fx) b.addFx(a.fx, 1, h.t.col, h.t.row, 0.3);
  if (out.dealt > 0 && a.root) b.root(h.t, a.root);
});

/** A second dash on another row (the Alpha Wolf's and the Drake Rider's), once the first pass has cleared. */
const mobRun = effect('mob.run', (b, a: { m: Fighter; row: number; dmg: number; fx: string; el?: Element }) => {
  if (a.m.dead || b.phase !== 'fight') return;
  dash(b, a.m, a.row, 11, mobShot({ dmg: a.dmg, fx: a.fx, el: a.el }));
});

/** The Grave Bell's toll wearing off: the ally hits normally again. */
const mobUnbuff = effect('mob.unbuff', (_b, a: { m: Fighter }) => { a.m.power = 1; });

/** A summoned monster arrives a beat after its call. */
const mobSpawn = effect('mob.spawn', (b, a: { kind: string; col: number; row: number }) => {
  if (b.phase !== 'fight' || b.fighterAt(a.col, a.row)) return;
  spawn(b, a.kind, a.col, a.row);
});

const me = (b: Battle): Fighter => b.f[0];
/** Seconds until the next action, a little random so packs fall out of step (the battle's seeded roll). */
const wait = (b: Battle, f: Fighter, base: number, spread = 0.6): void => { f.mob!.t = base + b.rand() * spread; };
/** Move one panel toward `row` on the monster's side, if the panel is free. */
function towardRow(b: Battle, f: Fighter, row: number): boolean {
  if (f.row === row) return false;
  const nr = f.row + Math.sign(row - f.row);
  if (!b.canStand(f, f.col, nr)) return false;
  f.row = nr;
  b.sound('step', {});
  return true;
}
const rowCells = (row: number, cols = [0, 1, 2]): Array<[number, number]> => cols.map(c => [c, row]);
const colCells = (col: number): Array<[number, number]> => [[col, 0], [col, 1], [col, 2]];
/** Up to `n` free panels on the monster side, in the order of the preferred columns. */
function freeCells(b: Battle, n: number, prefer: number[] = [4, 5, 3]): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const c of prefer) for (const r of [1, 0, 2]) {
    const p = b.panel(c, r);
    if (out.length < n && p && p.owner === 1 && p.hole <= 0 && !b.fighterAt(c, r) && !b.wallAt(c, r)) out.push([c, r]);
  }
  return out;
}
/** Wind-up look (drawn by the view from `step`), with a ! over the head. */
function windUp(b: Battle, f: Fighter, secs: number, mark = '!'): void {
  f.mob!.step = 1;
  f.mob!.t = secs;
  f.pose = 'cast';
  f.poseT = secs;
  b.text(f, mark, '#f8b800');
}
function done(b: Battle, f: Fighter, base: number, spread?: number): void {
  f.mob!.step = 0;
  f.pose = 'attack';
  f.poseT = 0.2;
  wait(b, f, base, spread);
}
/** Count down; true when it is time to act. */
function ready(f: Fighter, dt: number): boolean { f.mob!.t -= dt; return f.mob!.t <= 0; }

// ---------- moving the monster's sprite (dashes, leaps, dives) ----------
// Purely visual offsets (dx/dy) run as plain-data anims, the way the Warrior's lunges are: the monster stays on its
// panel in the rules, so hits, targeting and lockstep are untouched; only where its sprite is drawn changes.

interface MobMove { m: Fighter; px: number; py: number; arc: number; out: number; hold: number; back: number }
const PANEL_W = 38, PANEL_H = 19;
const mobMoveOut = effect('mob.move.out', (_b, a: MobMove, p: number) => {
  if (a.m.dead) { a.m.dx = 0; a.m.dy = 0; return; }
  a.m.dx = a.px * p; a.m.dy = a.py * p - Math.sin(p * Math.PI) * a.arc;
});
const mobMoveBack = effect('mob.move.back', (_b, a: MobMove, p: number) => {
  a.m.dx = a.px * (1 - p); a.m.dy = a.py * (1 - p) - Math.sin(p * Math.PI) * a.arc * 0.5;
});
/** Head home: hop back, or (back = 0) reappear on its own panel, like a Battle Network virus after a dash. */
const mobMoveHome = effect('mob.move.home', (b, a: MobMove) => {
  if (a.back > 0 && !a.m.dead) b.anim(a.back, mobMoveBack(a));
  else { a.m.dx = 0; a.m.dy = 0; }
});
const mobMoveGo = effect('mob.move.go', (b, a: MobMove) => {
  if (a.m.dead || b.phase !== 'fight') return;
  b.anim(a.out, mobMoveOut(a));
  b.later(a.out + a.hold, mobMoveHome(a));
});
/** After `delay`, move monster `f`'s sprite to panel (col, row) over `out`s, stay `hold`s, then come back over `back`s. */
function mobMove(b: Battle, f: Fighter, delay: number, col: number, row: number, out: number, hold: number, back: number, arc = 0): void {
  const a: MobMove = { m: f, px: (col - f.col) * PANEL_W, py: (row - f.row) * PANEL_H, arc, out, hold, back };
  if (delay > 0) b.later(delay, mobMoveGo(a));
  else b.runEffect(mobMoveGo(a), undefined);
}
/** Leap onto (col, row) so it lands as the `secs`-long warning there runs out, then hop home. */
function leapAt(b: Battle, f: Fighter, secs: number, col: number, row: number, arc = 14, air = 0.25): void {
  mobMove(b, f, Math.max(0, secs - air), col, row, Math.min(air, secs), 0.2, 0.25, arc);
}
/** A dash down `row`: the monster itself runs the row (the shot that does the damage is invisible and keeps pace). */
function dash(b: Battle, f: Fighter, row: number, speed: number, onHit: EffectRec<ShotHit>): void {
  b.shoot(f, { row, speed: -speed, kind: 'wolf', body: true, reflectable: false, onHit });
  const end = -1.5; // off the left edge
  mobMove(b, f, 0, end, row, (f.col - end) / speed, 0, 0);
}

// ---------- forest regulars ----------

/** STUMPKIN: lines up with you, winds up, slams a root shockwave down the row (BN's Mettaur). */
const stumpkin: MobBrain = {
  tick(b, f, dt) {
    if (!ready(f, dt)) return;
    const m = f.mob!;
    if (m.step === 0) {
      if (towardRow(b, f, me(b).row)) { wait(b, f, 0.5, 0.3); return; }
      windUp(b, f, 0.5);
      return;
    }
    b.shoot(f, { speed: -4.5, kind: 'gust', reflectable: true, onHit: mobShot({ dmg: 300 * m.tier, fx: 'groundSlam' }) });
    done(b, f, 2.2);
  },
};

/** GREY WOLF: finds your row, howls (the row flashes), then a fast dash down it. */
const wolf: MobBrain = {
  tick(b, f, dt) {
    if (!ready(f, dt)) return;
    const m = f.mob!;
    if (m.step === 0) {
      if (towardRow(b, f, me(b).row)) { wait(b, f, 0.4, 0.2); return; }
      windUp(b, f, 0.7, 'AWOO');
      b.warn(f, rowCells(f.row), 0.7);
      return;
    }
    dash(b, f, f.row, 10, mobShot({ dmg: 400 * m.tier, fx: 'bite' }));
    done(b, f, 2.8);
  },
};

/** WEBSPINNER: stays at the back, lines up and spits a web that roots you. */
const webspinner: MobBrain = {
  tick(b, f, dt) {
    if (!ready(f, dt)) return;
    const m = f.mob!;
    if (m.step === 0) {
      if (towardRow(b, f, me(b).row)) { wait(b, f, 0.6, 0.3); return; }
      windUp(b, f, 0.45);
      return;
    }
    b.shoot(f, { speed: -6, kind: 'net', reflectable: true, onHit: mobShot({ dmg: 150 * m.tier, root: 1.5, fx: 'netHit' }) });
    done(b, f, 3.2);
  },
};

/** WISP: drifts in the back row and heals the most hurt ally; alone, it flicks weak sparks. */
const wisp: MobBrain = {
  tick(b, f, dt) {
    if (!ready(f, dt)) return;
    const m = f.mob!;
    const allies = b.mobs.filter(x => !x.dead && x !== f && x.hp < x.maxHp);
    if (m.step === 0) {
      // drift a row, then act on the next beat
      const r = Math.floor(b.rand() * ROWS);
      towardRow(b, f, r);
      m.step = 2;
      wait(b, f, 1.2, 0.8);
      return;
    }
    if (allies.length) {
      const hurt = allies.reduce((a, x) => (x.hp / x.maxHp < a.hp / a.maxHp ? x : a));
      b.heal(hurt, 300 * m.tier);
      b.addFx('prayer', 1, hurt.col, hurt.row, 0.5);
      b.addFx('prayer', 1, f.col, f.row, 0.4);
    } else if (b.mobs.every(x => x === f || x.dead)) {
      b.shoot(f, { speed: -5, kind: 'spark', reflectable: true, onHit: mobShot({ dmg: 100 * m.tier }) });
    }
    m.step = 0;
    wait(b, f, 4.2, 1.2);
  },
};

/** BARKGUARD: keeps itself between you and the pack, and slams the panel in front of it if you come close. */
const barkguard: MobBrain = {
  tick(b, f, dt) {
    if (!ready(f, dt)) return;
    const m = f.mob!, p = me(b);
    if (m.step === 0) {
      const front = b.frontCol(0);
      if (p.col === front && p.row === f.row && f.col === front + 1) {
        windUp(b, f, 0.6);
        b.warn(f, [[front, f.row]], 0.6, mobHit({ m: f, cells: [[front, f.row]], dmg: 350 * m.tier, fx: 'groundSlam', el: 'steel' }));
        return;
      }
      towardRow(b, f, p.row);
      wait(b, f, 0.9, 0.3);
      return;
    }
    done(b, f, 1.6);
  },
  onHurt(_b, f) { if (f.st.flinch > 0) f.st.flinch = 0; },
};

// ---------- forest elites ----------

/** ALPHA WOLF: Pounce on your panel, a two-row Ripping Dash, and a Pack Howl once under half HP. */
const alpha: MobBrain = {
  tick(b, f, dt) {
    if (!ready(f, dt)) return;
    const m = f.mob!, p = me(b);
    if (m.phase === 0 && f.hp < f.maxHp / 2) {
      m.phase = 1;
      windUp(b, f, 0.9, 'AWOOO');
      for (const [col, row] of freeCells(b, 2, [3, 5, 4])) b.later(0.6, mobSpawn({ kind: 'wolf', col, row }));
      m.step = 9;
      return;
    }
    if (m.step === 9) { done(b, f, 1.2); return; }
    if (m.step === 0) {
      m.n = (m.n + 1) % 3;
      if (m.n === 2) {
        // Ripping Dash: your row, then another
        towardRow(b, f, p.row);
        const r2 = (p.row + 1 + Math.floor(b.rand() * 2)) % ROWS;
        windUp(b, f, 0.6, 'GRR');
        b.warn(f, rowCells(p.row), 0.6);
        b.warn(f, rowCells(r2), 1.2);
        m.n = 2 + r2 * 10;
        return;
      }
      // Pounce: your panel lights, then the wolf lands on it
      windUp(b, f, 0.6);
      b.warn(f, [[p.col, p.row]], 0.6, mobHit({ m: f, cells: [[p.col, p.row]], dmg: 500 * m.tier, fx: 'claw' }));
      leapAt(b, f, 0.6, p.col + 1, p.row);
      m.step = 3;
      return;
    }
    if (m.step === 1 && m.n >= 2) {
      // one wolf, two passes: down your row, then back around for the second row as its warning runs out
      dash(b, f, f.row, 11, mobShot({ dmg: 450 * m.tier, fx: 'bite' }));
      b.later(0.65, mobRun({ m: f, row: Math.floor(m.n / 10), dmg: 450 * m.tier, fx: 'bite' }));
      m.n = 2;
      done(b, f, 1.8);
      return;
    }
    done(b, f, 1.6);
  },
};

/** THORNMOTHER: never moves. Bramble Burst on your column, Bark Skin every 10s, and a Wisp whenever none is up. */
const thornmother: MobBrain = {
  tick(b, f, dt) {
    const m = f.mob!;
    // Bark Skin on its own clock (n counts it down in tenths)
    m.n -= dt;
    if (m.n <= 0) {
      m.n = 10;
      b.addShield(f, 'barrier', 600 * m.tier, 10);
      b.text(f, 'BARK SKIN', '#a4e4fc');
      b.addFx('arcaneBarrier', 1, f.col, f.row, 0.5);
    }
    if (!ready(f, dt)) return;
    const p = me(b);
    if (m.step === 0) {
      m.phase = (m.phase + 1) % 3;
      if (m.phase === 2 && !b.mobs.some(x => !x.dead && x.mob?.kind === 'wisp')) {
        const at = freeCells(b, 1, [4, 5, 3])[0];
        if (at) { windUp(b, f, 0.5, 'SPROUT'); b.later(0.5, mobSpawn({ kind: 'wisp', col: at[0], row: at[1] })); return; }
      }
      windUp(b, f, 0.8);
      b.warn(f, colCells(p.col), 0.8, mobHit({ m: f, cells: colCells(p.col), dmg: 350 * m.tier, root: 1.5, fx: 'pillar' }));
      return;
    }
    done(b, f, 1.9);
  },
};

// ---------- forest boss ----------

/** OLD OAKHEART: three phases at 66% and 33% HP; each adds a move and calls helpers. */
const oakheart: MobBrain = {
  tick(b, f, dt) {
    if (!ready(f, dt)) return;
    const m = f.mob!, p = me(b);
    const want = f.hp < f.maxHp / 3 ? 2 : f.hp < (f.maxHp * 2) / 3 ? 1 : 0;
    if (want > m.phase) {
      m.phase = want;
      windUp(b, f, 1.1, 'ROAR');
      b.shake = Math.max(b.shake, 0.5);
      b.addFx('roar', 1, f.col, f.row, 0.6);
      const helpers = want === 1 ? ['barkguard'] : ['wisp', 'wisp'];
      const at = freeCells(b, helpers.length, want === 1 ? [3, 5] : [5, 3]);
      helpers.forEach((kind, i) => { if (at[i]) b.later(0.5 + i * 0.3, mobSpawn({ kind, col: at[i][0], row: at[i][1] })); });
      m.step = 9;
      return;
    }
    if (m.step === 9) { done(b, f, 1); return; }
    if (m.step === 1) {
      // the slam that was wound up: a shockwave down the row
      b.shoot(f, { speed: -5, kind: 'gust', reflectable: true, onHit: mobShot({ dmg: 350 * m.tier, fx: 'groundSlam' }) });
      done(b, f, 1.6 - m.phase * 0.25);
      return;
    }
    const moves = m.phase === 0 ? 2 : m.phase === 1 ? 3 : 4;
    m.n = (m.n + 1) % moves;
    if (m.n === 0) {
      // Root Shockwave: line up, wind up
      towardRow(b, f, p.row);
      windUp(b, f, 0.6);
      return;
    }
    if (m.n === 1) {
      // Acorn Drop: your panel and, later on, the ones beside it
      const cells: Array<[number, number]> = [[p.col, p.row]];
      if (m.phase >= 1) for (const [dc, dr] of [[1, 0], [-1, 0]] as const) if (b.inGrid(p.col + dc, p.row + dr) && p.col + dc <= 2) cells.push([p.col + dc, p.row + dr]);
      b.warn(f, cells, 0.7, mobHit({ m: f, cells, dmg: 300 * m.tier, fx: 'groundSlam' }));
      b.text(f, '!', '#f8b800');
      done(b, f, 1.4);
      return;
    }
    if (m.n === 2) {
      // Vine Sweep: your row and the one beside it, the whole home side
      const r2 = p.row === 2 ? 1 : p.row + 1;
      const cells = [...rowCells(p.row), ...rowCells(r2)];
      b.warn(f, cells, 1.0, mobHit({ m: f, cells, dmg: 400 * m.tier, root: 1, fx: 'pillar' }));
      b.text(f, 'VINES', '#58d854');
      done(b, f, 2);
      return;
    }
    // Falling Branches: three random panels on your side
    const cells: Array<[number, number]> = [];
    while (cells.length < 3) {
      const c = Math.floor(b.rand() * 3), r = Math.floor(b.rand() * ROWS);
      if (!cells.some(([x, y]) => x === c && y === r)) cells.push([c, r]);
    }
    b.warn(f, cells, 0.8, mobHit({ m: f, cells, dmg: 350 * m.tier, fx: 'groundSlam', el: 'steel' }));
    done(b, f, 1.5);
  },
  onHurt(_b, f) { f.st.flinch = 0; },
};

// ---------- crypt regulars ----------

const SHADOW_EL: Element = 'shadow';

/** SKELETON ARCHER: back row, lines up, draws (the row flashes), and looses a fast arrow. */
const skelarcher: MobBrain = {
  tick(b, f, dt) {
    if (!ready(f, dt)) return;
    const m = f.mob!;
    if (m.step === 0) {
      if (towardRow(b, f, me(b).row)) { wait(b, f, 0.45, 0.2); return; }
      windUp(b, f, 0.6);
      b.warn(f, rowCells(f.row), 0.6);
      return;
    }
    b.shoot(f, { speed: -9, kind: 'arrow', reflectable: true, onHit: mobShot({ dmg: 280 * m.tier, fx: 'arrowHit', el: 'steel' }) });
    done(b, f, 2.4);
  },
};

/** BONE RATTLER: the crypt's Mettaur: lines up, rattles, and sends a faster shockwave. */
const rattler: MobBrain = {
  tick(b, f, dt) {
    if (!ready(f, dt)) return;
    const m = f.mob!;
    if (m.step === 0) {
      if (towardRow(b, f, me(b).row)) { wait(b, f, 0.4, 0.2); return; }
      windUp(b, f, 0.45, 'RATTLE');
      return;
    }
    b.shoot(f, { speed: -6, kind: 'gust', reflectable: true, onHit: mobShot({ dmg: 320 * m.tier, fx: 'shard', el: SHADOW_EL }) });
    done(b, f, 2);
  },
};

/** GHOUL: marks the panel you stand on, then leaps onto it. Step away. */
const ghoul: MobBrain = {
  tick(b, f, dt) {
    if (!ready(f, dt)) return;
    const m = f.mob!, p = me(b);
    if (m.step === 0) {
      windUp(b, f, 0.75, 'HUNGRY');
      b.warn(f, [[p.col, p.row]], 0.75, mobHit({ m: f, cells: [[p.col, p.row]], dmg: 380 * m.tier, fx: 'claw', el: SHADOW_EL }));
      leapAt(b, f, 0.75, p.col, p.row, 18);
      return;
    }
    towardRow(b, f, p.row);
    done(b, f, 2.4);
  },
};

/** BANSHEE: drifts, then screams down your column; the scream stuns. */
const banshee: MobBrain = {
  tick(b, f, dt) {
    if (!ready(f, dt)) return;
    const m = f.mob!, p = me(b);
    if (m.step === 0) {
      windUp(b, f, 0.9, 'SHRIEK');
      b.warn(f, colCells(p.col), 0.9, mobHit({ m: f, cells: colCells(p.col), dmg: 200 * m.tier, stun: 2, fx: 'psychicScream', el: SHADOW_EL }));
      return;
    }
    towardRow(b, f, Math.floor(b.rand() * ROWS));
    done(b, f, 3.6, 1);
  },
};

/** GRAVE BELL: tolls every few seconds: its allies hit 20% harder for 4s. Alone, it tolls at you. */
const gravebell: MobBrain = {
  tick(b, f, dt) {
    if (!ready(f, dt)) return;
    const m = f.mob!;
    const allies = b.mobs.filter(x => !x.dead && x !== f);
    if (m.step === 0) { windUp(b, f, 0.5, 'DONG'); return; }
    if (allies.length) {
      for (const a of allies) { a.power = 1.2; b.text(a, 'ENRAGED', '#f83800'); b.later(4, mobUnbuff({ m: a })); }
      b.addFx('deathMark', 1, f.col, f.row, 0.5);
    } else {
      const p = me(b);
      b.warn(f, [[p.col, p.row]], 0.6, mobHit({ m: f, cells: [[p.col, p.row]], dmg: 250 * m.tier, fx: 'swPain', el: SHADOW_EL }));
    }
    done(b, f, 5, 1);
  },
};

// ---------- crypt elites ----------

/** DEATH KNIGHT: blade waves down your row, a three-panel cleave on your column, and archers once hurt. */
const deathknight: MobBrain = {
  tick(b, f, dt) {
    if (!ready(f, dt)) return;
    const m = f.mob!, p = me(b);
    if (m.phase === 0 && f.hp < f.maxHp / 2) {
      m.phase = 1;
      windUp(b, f, 0.9, 'RISE');
      for (const [col, row] of freeCells(b, 2, [5, 3, 4])) b.later(0.6, mobSpawn({ kind: 'skelarcher', col, row }));
      m.step = 9;
      return;
    }
    if (m.step === 9) { done(b, f, 1.2); return; }
    if (m.step === 0) {
      m.n = (m.n + 1) % 3;
      if (m.n === 2) {
        windUp(b, f, 0.8, 'REAP');
        b.warn(f, colCells(p.col), 0.8, mobHit({ m: f, cells: colCells(p.col), dmg: 550 * m.tier, fx: 'cleaveHeavy', el: SHADOW_EL }));
        leapAt(b, f, 0.8, p.col + 1, 1, 10, 0.2);
        m.step = 3;
        return;
      }
      towardRow(b, f, p.row);
      windUp(b, f, 0.55);
      return;
    }
    if (m.step === 1) b.shoot(f, { speed: -7, kind: 'gust', reflectable: true, onHit: mobShot({ dmg: 500 * m.tier, fx: 'cleave', el: SHADOW_EL }) });
    done(b, f, 1.5);
  },
};

/** BONE COLOSSUS: never moves. Bone Spears on your column and the next, falling bones, and a stomp shockwave. */
const colossus: MobBrain = {
  tick(b, f, dt) {
    if (!ready(f, dt)) return;
    const m = f.mob!, p = me(b);
    if (m.step === 1) {
      b.shoot(f, { row: p.row, speed: -5, kind: 'gust', reflectable: true, onHit: mobShot({ dmg: 400 * m.tier, fx: 'groundSlam', el: 'steel' }) });
      done(b, f, 1.6);
      return;
    }
    m.n = (m.n + 1) % 3;
    if (m.n === 0) { windUp(b, f, 0.6, 'STOMP'); return; }
    if (m.n === 1) {
      const c2 = p.col === 2 ? 1 : p.col + 1;
      const cells = [...colCells(p.col), ...colCells(c2)];
      b.warn(f, cells, 1.1, mobHit({ m: f, cells, dmg: 350 * m.tier, fx: 'shard', el: 'steel' }));
      b.text(f, 'SPEARS', '#fcfcfc');
      done(b, f, 2.2);
      return;
    }
    const bones = randomCells(b, 4);
    b.warn(f, bones, 0.8, mobHit({ m: f, cells: bones, dmg: 320 * m.tier, fx: 'groundSlam', el: 'steel' }));
    done(b, f, 1.8);
  },
};

// ---------- crypt boss ----------

/** THE BONE KING: bone spears and skeletons; then he blinks between rows and curses panels with frost;
 *  last, he raises the fallen and comes faster. Phases at 66% and 33%. */
const boneking: MobBrain = {
  tick(b, f, dt) {
    if (!ready(f, dt)) return;
    const m = f.mob!, p = me(b);
    const want = f.hp < f.maxHp / 3 ? 2 : f.hp < (f.maxHp * 2) / 3 ? 1 : 0;
    if (want > m.phase) {
      // he opens (phase -1 to 0) by calling an archer; each later phase calls more
      m.phase = want;
      windUp(b, f, 1.1, want ? 'ARISE' : 'KNEEL');
      b.shake = Math.max(b.shake, 0.4);
      b.addFx('roar', 1, f.col, f.row, 0.6);
      const kinds = want === 0 ? ['skelarcher'] : want === 1 ? ['banshee'] : ['rattler', 'rattler'];
      const at = freeCells(b, kinds.length, [5, 3]);
      kinds.forEach((kind, i) => { if (at[i]) b.later(0.5 + i * 0.3, mobSpawn({ kind, col: at[i][0], row: at[i][1] })); });
      m.step = 9;
      return;
    }
    if (m.step === 9) { done(b, f, 1); return; }
    const moves = m.phase === 0 ? 2 : 3;
    m.n = (m.n + 1) % moves;
    const speed = 1.1 - m.phase * 0.1;
    if (m.n === 1) {
      // Bone Spears: your column
      b.warn(f, colCells(p.col), 0.8 * speed, mobHit({ m: f, cells: colCells(p.col), dmg: 380 * m.tier, fx: 'shard', el: SHADOW_EL }));
      b.text(f, 'SPEARS', '#fcfcfc');
      done(b, f, 1.6 * speed);
      return;
    }
    if (m.n === 2) {
      // Blink and Frost Curse: a new row, then your panel and one beside it freeze
      const rows = [0, 1, 2].filter(r => r !== f.row && b.canStand(f, f.col, r));
      if (rows.length) { f.row = rows[Math.floor(b.rand() * rows.length)]; b.addFx('shadowBlink', 1, f.col, f.row, 0.4); }
      const cells: Array<[number, number]> = [[p.col, p.row]];
      const side = p.col === 0 ? 1 : p.col === 2 ? -1 : b.rand() < 0.5 ? -1 : 1;
      cells.push([p.col + side, p.row]);
      b.warn(f, cells, 0.9 * speed, mobHit({ m: f, cells, dmg: 250 * m.tier, freeze: 2, fx: 'deepFreeze', el: 'frost' }));
      b.text(f, 'CURSE', '#a4e4fc');
      done(b, f, 1.8 * speed);
      return;
    }
    // Soul Bolt: line up and fire down the row
    towardRow(b, f, p.row);
    b.shoot(f, { speed: -7, kind: 'orb', reflectable: true, onHit: mobShot({ dmg: 300 * m.tier, fx: 'swPain', el: SHADOW_EL }) });
    done(b, f, 1.4 * speed);
  },
};

// ---------- volcano regulars ----------

const FIRE_EL: Element = 'fire';

/** IMP: hops about the back and drops fire on your panel (and the panel burns). */
const imp: MobBrain = {
  tick(b, f, dt) {
    if (!ready(f, dt)) return;
    const m = f.mob!, p = me(b);
    if (m.step === 0) {
      towardRow(b, f, Math.floor(b.rand() * ROWS));
      windUp(b, f, 0.65, 'HEHE');
      b.warn(f, [[p.col, p.row]], 0.65, mobHit({ m: f, cells: [[p.col, p.row]], dmg: 380 * m.tier, fx: 'fireballBlast', el: FIRE_EL }));
      return;
    }
    done(b, f, 2.2);
  },
};

/** SALAMANDER: lines up and spits a fireball down its row. */
const salamander: MobBrain = {
  tick(b, f, dt) {
    if (!ready(f, dt)) return;
    const m = f.mob!;
    if (m.step === 0) {
      if (towardRow(b, f, me(b).row)) { wait(b, f, 0.4, 0.2); return; }
      windUp(b, f, 0.5);
      return;
    }
    b.shoot(f, { speed: -7, kind: 'fireball', reflectable: true, onHit: mobShot({ dmg: 420 * m.tier, fx: 'fireballBlast', el: FIRE_EL }) });
    done(b, f, 2.2);
  },
};

/** MAGMA GOLEM: plods to your row and slams your column; the panels it hits crack. */
const golem: MobBrain = {
  tick(b, f, dt) {
    if (!ready(f, dt)) return;
    const m = f.mob!, p = me(b);
    if (m.step === 0) {
      windUp(b, f, 1, 'SLAM');
      b.warn(f, colCells(p.col), 1, mobHit({ m: f, cells: colCells(p.col), dmg: 550 * m.tier, fx: 'titanFall', el: FIRE_EL, crack: true }));
      return;
    }
    towardRow(b, f, p.row);
    done(b, f, 2.8);
  },
};

/** EMBER BAT: dives across your side on a diagonal through your panel. */
const emberbat: MobBrain = {
  tick(b, f, dt) {
    if (!ready(f, dt)) return;
    const m = f.mob!, p = me(b);
    if (m.step === 0) {
      const dir = b.rand() < 0.5 ? 1 : -1, cells: Array<[number, number]> = [];
      for (let c = 0; c < 3; c++) { const r = p.row + (c - p.col) * dir; if (r >= 0 && r < ROWS) cells.push([c, r]); }
      windUp(b, f, 0.7, 'SKREE');
      b.warn(f, cells, 0.7, mobHit({ m: f, cells, dmg: 350 * m.tier, fx: 'scorch', el: FIRE_EL }));
      leapAt(b, f, 0.7, p.col, p.row, -6, 0.2);
      return;
    }
    towardRow(b, f, Math.floor(b.rand() * ROWS));
    done(b, f, 2.4);
  },
};

/** CINDER SHAMAN: shields the ally with the least HP; alone, it throws embers. */
const shaman: MobBrain = {
  tick(b, f, dt) {
    if (!ready(f, dt)) return;
    const m = f.mob!;
    const allies = b.mobs.filter(x => !x.dead && x !== f);
    if (m.step === 0) { windUp(b, f, 0.5); return; }
    if (allies.length) {
      const low = allies.reduce((a, x) => (x.hp / x.maxHp < a.hp / a.maxHp ? x : a));
      b.addShield(low, 'barrier', 350 * m.tier, 8);
      b.text(low, 'WARDED', '#f8b800');
      b.addFx('arcaneBarrier', 1, low.col, low.row, 0.5);
    } else {
      towardRow(b, f, me(b).row);
      b.shoot(f, { speed: -6, kind: 'fireball', reflectable: true, onHit: mobShot({ dmg: 250 * m.tier, fx: 'scorch', el: FIRE_EL }) });
    }
    done(b, f, 4.5, 1);
  },
};

// ---------- volcano elites ----------

/** DRAKE RIDER: a lance charge down your row and another, and fire breath down its own row. */
const drakerider: MobBrain = {
  tick(b, f, dt) {
    if (!ready(f, dt)) return;
    const m = f.mob!, p = me(b);
    if (m.step === 0) {
      m.n = (m.n + 1) % 2;
      towardRow(b, f, p.row);
      if (m.n === 1) {
        const r2 = (p.row + 1 + Math.floor(b.rand() * 2)) % ROWS;
        windUp(b, f, 0.7, 'CHARGE');
        b.warn(f, rowCells(p.row), 0.7);
        b.warn(f, rowCells(r2), 1.2);
        m.phase = r2;
        return;
      }
      windUp(b, f, 0.7, 'BREATH');
      b.warn(f, rowCells(f.row), 0.7, mobHit({ m: f, cells: rowCells(f.row), dmg: 500 * m.tier, fx: 'dragonsBreath', el: FIRE_EL }));
      m.step = 3;
      return;
    }
    if (m.step === 1) {
      dash(b, f, f.row, 11, mobShot({ dmg: 500 * m.tier, fx: 'thrust', el: 'steel' }));
      b.later(0.65, mobRun({ m: f, row: m.phase, dmg: 500 * m.tier, fx: 'thrust', el: 'steel' }));
    }
    done(b, f, 1.8);
  },
};


/** OBSIDIAN TITAN: never moves. Quakes on random panels, a shockwave, and an obsidian shell every 12s. */
const titan: MobBrain = {
  tick(b, f, dt) {
    const m = f.mob!;
    m.phase -= dt;
    if (m.phase <= 0) {
      m.phase = 14;
      b.addShield(f, 'barrier', 400 * m.tier, 8);
      b.text(f, 'OBSIDIAN', '#7c7c7c');
      b.addFx('ironSkin', 1, f.col, f.row, 0.5);
    }
    if (!ready(f, dt)) return;
    const p = me(b);
    if (m.step === 1) {
      b.shoot(f, { row: p.row, speed: -5, kind: 'gust', reflectable: true, onHit: mobShot({ dmg: 450 * m.tier, fx: 'groundSlam', el: FIRE_EL }) });
      done(b, f, 1.6);
      return;
    }
    m.n = (m.n + 1) % 2;
    if (m.n === 0) { windUp(b, f, 0.6, 'QUAKE'); return; }
    const cells = randomCells(b, 4);
    b.warn(f, cells, 0.9, mobHit({ m: f, cells, dmg: 400 * m.tier, fx: 'titanFall', el: FIRE_EL, crack: true }));
    done(b, f, 1.8);
  },
};

// ---------- volcano boss ----------

/** EMBERWYRM: fire breath down your row and a tail sweep on your front column; then it takes wing and dives
 *  on marked panels; last, lava cracks your back column and the breath covers two rows. 66% / 33%. */
const emberwyrm: MobBrain = {
  tick(b, f, dt) {
    if (!ready(f, dt)) return;
    const m = f.mob!, p = me(b);
    const want = f.hp < f.maxHp / 3 ? 2 : f.hp < (f.maxHp * 2) / 3 ? 1 : 0;
    if (want > m.phase) {
      m.phase = want;
      windUp(b, f, 1.1, 'ROAR');
      b.shake = Math.max(b.shake, 0.6);
      b.addFx('roar', 1, f.col, f.row, 0.6);
      const kinds = want === 1 ? ['imp'] : ['emberbat', 'imp'];
      const at = freeCells(b, kinds.length, [5, 3]);
      kinds.forEach((kind, i) => { if (at[i]) b.later(0.5 + i * 0.3, mobSpawn({ kind, col: at[i][0], row: at[i][1] })); });
      m.step = 9;
      return;
    }
    if (m.step === 9) { done(b, f, 1); return; }
    const moves = m.phase === 0 ? 2 : 3;
    m.n = (m.n + 1) % moves;
    if (m.n === 0) {
      // Fire Breath: your row (and a second row in the last phase)
      towardRow(b, f, p.row);
      const cells = rowCells(p.row);
      if (m.phase === 2) cells.push(...rowCells(p.row === 2 ? 1 : p.row + 1));
      b.warn(f, cells, 0.9, mobHit({ m: f, cells, dmg: 500 * m.tier, fx: 'dragonsBreath', el: FIRE_EL }));
      b.text(f, 'BREATH', '#f83800');
      done(b, f, 1.8);
      return;
    }
    if (m.n === 1) {
      // Tail Sweep: the front column of your side
      const col = 2, cells = colCells(col);
      b.warn(f, cells, 0.8, mobHit({ m: f, cells, dmg: 420 * m.tier, fx: 'cleaveHeavy', el: 'steel' }));
      b.text(f, 'TAIL', '#fcfcfc');
      done(b, f, 1.6);
      return;
    }
    if (m.phase === 1) {
      // Dive: your panel and two more, marked
      const cells: Array<[number, number]> = [[p.col, p.row], ...randomCells(b, 2).filter(([c, r]) => c !== p.col || r !== p.row)];
      b.warn(f, cells, 1, mobHit({ m: f, cells, dmg: 550 * m.tier, fx: 'meteorBlast', el: FIRE_EL }));
      leapAt(b, f, 1, p.col, p.row, 40, 0.4);
      b.text(f, 'DIVE', '#f8b800');
      done(b, f, 2);
      return;
    }
    // Lava: your back column cracks and burns
    const cells = colCells(0);
    b.warn(f, cells, 1, mobHit({ m: f, cells, dmg: 450 * m.tier, fx: 'inferno', el: FIRE_EL, crack: true }));
    b.text(f, 'LAVA', '#f83800');
    done(b, f, 1.8);
  },
};

/** `n` different random panels on your side. */
function randomCells(b: Battle, n: number): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  while (cells.length < n) {
    const c = Math.floor(b.rand() * 3), r = Math.floor(b.rand() * ROWS);
    if (!cells.some(([x, y]) => x === c && y === r)) cells.push([c, r]);
  }
  return cells;
}

/** Elites and the boss shrug off flinches and knockback: they'd be pushed off their pattern otherwise. */
const heavy = (brain: MobBrain): MobBrain => ({ ...brain, onHurt(b, f, amt) { f.st.flinch = 0; f.st.noKnock = 1; brain.onHurt?.(b, f, amt); } });

const BRAINS: Record<string, MobBrain> = {
  stumpkin, wolf, webspinner, wisp, barkguard, alpha: heavy(alpha), thornmother: heavy(thornmother), oakheart: heavy(oakheart),
  skelarcher, rattler, ghoul, banshee, gravebell, deathknight: heavy(deathknight), colossus: heavy(colossus), boneking: heavy(boneking),
  imp, salamander, golem, emberbat, shaman, drakerider: heavy(drakerider), titan: heavy(titan), emberwyrm: heavy(emberwyrm),
};
for (const [id, brain] of Object.entries(BRAINS)) MOB_BRAINS.set(id, brain);

// ---------- packs ----------

/** Put monster `kind` on the field. */
export function spawn(b: Battle, kind: string, col: number, row: number, tier = 1): Fighter {
  const d = MOBS[kind];
  const f = makeMob(kind, d.name, Math.round(d.hp * (1 + (tier - 1) * 0.6)), col, row, tier);
  if (kind === 'thornmother') f.mob!.n = 3;
  if (kind === 'titan') f.mob!.phase = 4;
  if (kind === 'boneking') f.mob!.phase = -1;
  f.mob!.t = 1 + b.rand() * 0.8;
  b.mobs.push(f);
  return f;
}

/** Replace the right-hand fighter with a pack of monsters, each on its preferred column. */
export function setupPack(b: Battle, kinds: string[], tier = 1): void {
  b.mobs = [];
  // the fighter the Battle was built with steps off the field
  b.f[1].dead = true;
  b.f[1].col = -9;
  const rows = kinds.length === 1 ? [1] : kinds.length === 2 ? [0, 2] : [1, 0, 2];
  kinds.forEach((kind, i) => {
    let col = MOBS[kind].col, row = rows[i];
    while (b.fighterAt(col, row) && col < COLS - 1) col++;
    while (b.fighterAt(col, row)) row = (row + 1) % ROWS;
    spawn(b, kind, col, row, tier);
  });
  b.f[1] = b.mobs[0];
  b.retarget();
}

/** The pack's total HP (for the nameplate). */
export function packHp(b: Battle): { hp: number; max: number } {
  return b.mobs.reduce((a, m) => ({ hp: a.hp + Math.max(0, m.hp), max: a.max + m.maxHp }), { hp: 0, max: 0 });
}
