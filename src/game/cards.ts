// Every Warrior and Mage spell from the design doc. Numbers follow the doc; prototype-only
// interpretations are called out in the `short` text or a comment.
import type { Battle, CastCtx, Fighter, Side } from './battle';
import type { ClassId } from '../art/sprites';
import { sfx } from '../engine/audio';

export type Element = 'steel' | 'fire' | 'frost' | 'arcane';
export type Rarity = 'common' | 'uncommon' | 'legendary' | 'mythic';

export interface CardDef {
  id: string;
  name: string;
  cls: ClassId;
  cost: number | 'all';
  rarity: Rarity;
  element: Element;
  /** Whether Battle Shout / Rallying Cry bonuses apply. */
  damaging: boolean;
  /** Seconds the caster is locked out after casting. */
  lock?: number;
  /** Damage shown on the card. */
  dmg: string;
  /** One-line rules text (keep under ~90 chars, it has to fit a 240px screen). */
  short: string;
  cast: (x: CastCtx) => void;
  /** CPU hint: is now a good moment to cast this? */
  ai?: (b: Battle, f: Fighter) => boolean;
}

export const MAX_COPIES: Record<Rarity, number> = { common: 4, uncommon: 2, legendary: 1, mythic: 1 };

// ---------- shared helpers ----------
const sameRow = (b: Battle, f: Fighter): boolean => b.foe(f).row === f.row;
const ahead = (b: Battle, f: Fighter, n: number): boolean => {
  const foe = b.foe(f), d = b.dir(f);
  if (foe.row !== f.row) return false;
  const dist = (foe.col - f.col) * d;
  return dist >= 1 && dist <= n;
};
const cellsAhead = (x: CastCtx, from: number, to: number, row = x.f.row): Array<[number, number]> => {
  const out: Array<[number, number]> = [];
  for (let i = from; i <= to; i++) out.push([x.f.col + i * x.dir, row]);
  return out;
};
const allEnemyPanels = (b: Battle, side: Side): Array<[number, number]> => {
  const out: Array<[number, number]> = [];
  for (let c = 0; c < 6; c++) for (let r = 0; r < 3; r++) if (b.panels[c][r].owner !== side) out.push([c, r]);
  return out;
};
const lowHp = (f: Fighter, pct: number): boolean => f.hp / f.maxHp < pct;

/** Move the caster's sprite out and back (dash/leap), purely visual. */
function lunge(x: CastCtx, toCol: number, toRow: number, out: number, hold: number, back: number, arc = 0): void {
  const { b, f } = x;
  const px = (toCol - f.col) * 38, py = (toRow - f.row) * 19;
  b.anim(out, p => { f.dx = px * p; f.dy = py * p - Math.sin(p * Math.PI) * arc; });
  b.later(out + hold, () => b.anim(back, p => { f.dx = px * (1 - p); f.dy = py * (1 - p) - Math.sin(p * Math.PI) * arc * 0.5; }));
}

// ---------- Warrior ----------
const warrior: CardDef[] = [
  {
    id: 'step_slash', name: 'Step Slash', cls: 'warrior', cost: 1, rarity: 'common', element: 'steel', damaging: true, lock: 0.55,
    dmg: '80', short: 'Dash 2 panels forward, slash the panel ahead, snap back.',
    cast: x => {
      lunge(x, x.f.col + 2 * x.dir, x.f.row, 0.12, 0.2, 0.15);
      x.b.later(0.12, () => {
        x.b.addFx('cleaveHeavy', x.f.side, x.f.col + 2 * x.dir, x.f.row, 0.2);
        x.b.strike(x.f, cellsAhead(x, 2, 3), 80 * x.mult, { spell: true, element: 'steel' });
      });
    },
    ai: (b, f) => ahead(b, f, 3) && (b.foe(f).col - f.col) * b.dir(f) >= 2,
  },
  {
    id: 'guard', name: 'Guard', cls: 'warrior', cost: 0, rarity: 'common', element: 'steel', damaging: false, lock: 0.2,
    dmg: '-', short: 'For 2s, block the next hit completely. A block gives 1 Rage.',
    cast: x => x.b.addShield(x.f, 'guard', 1, 2),
    ai: (b, f) => b.projectiles.some(p => p.side !== f.side && p.row === f.row) || b.foe(f).lock > 0 || Math.random() < 0.3,
  },
  {
    id: 'lunge', name: 'Lunge', cls: 'warrior', cost: 2, rarity: 'common', element: 'steel', damaging: true, lock: 0.45,
    dmg: '100', short: 'Piercing thrust hits 3 panels in a line ahead. You stay put.',
    cast: x => {
      x.b.addFx('thrust', x.f.side, x.f.col, x.f.row, 0.25, { len: 3 });
      x.b.later(0.1, () => x.b.strike(x.f, cellsAhead(x, 1, 3), 100 * x.mult, { spell: true, element: 'steel' }));
    },
    ai: (b, f) => ahead(b, f, 3),
  },
  {
    id: 'leap_strike', name: 'Leap Strike', cls: 'warrior', cost: 3, rarity: 'uncommon', element: 'steel', damaging: true, lock: 0.8,
    dmg: '120', short: 'Leap in front of the enemy and smash their panel plus above and below.',
    cast: x => {
      const tc = x.foe.col, tr = x.foe.row;
      lunge(x, tc - x.dir, tr, 0.3, 0.2, 0.25, 14);
      x.b.later(0.3, () => {
        x.b.addFx('smash', x.f.side, tc, tr, 0.3);
        x.b.shake = 0.2;
        x.b.strike(x.f, [[tc, tr - 1], [tc, tr], [tc, tr + 1]], 120 * x.mult, { spell: true, element: 'steel' });
      });
    },
  },
  {
    id: 'iron_skin', name: 'Iron Skin', cls: 'warrior', cost: 0, rarity: 'common', element: 'steel', damaging: false, lock: 0.2,
    dmg: '-', short: 'Absorb the next 60 damage over 5s. Each absorbed hit gives 1 Rage (max 2).',
    cast: x => x.b.addShield(x.f, 'ironSkin', 60, 5),
  },
  {
    id: 'shield_wall', name: 'Shield Wall', cls: 'warrior', cost: 0, rarity: 'common', element: 'steel', damaging: false, lock: 0.3,
    dmg: '-', short: 'Wall (80 HP) on the panel in front blocks shots in your row. Each block: 1 Rage.',
    cast: x => { if (!x.b.placeWall(x.f, x.f.col + x.dir, x.f.row, 80, 'stone', 12)) x.b.text(x.f, 'BLOCKED', '#bcbcbc'); },
    ai: (b, f) => sameRow(b, f) && b.foe(f).cls === 'mage',
  },
  {
    id: 'execute', name: 'Execute', cls: 'warrior', cost: 3, rarity: 'common', element: 'steel', damaging: true, lock: 0.5,
    dmg: '100/200', short: 'Heavy strike on the 2 panels ahead. Double damage below 30% HP.',
    cast: x => {
      x.b.later(0.18, () => {
        x.b.addFx('smash', x.f.side, x.f.col + x.dir, x.f.row, 0.25);
        const dmg = (lowHp(x.foe, 0.3) ? 200 : 100) * x.mult;
        x.b.strike(x.f, cellsAhead(x, 1, 2), dmg, { spell: true, element: 'steel' });
      });
    },
    ai: (b, f) => ahead(b, f, 2),
  },
  {
    id: 'chain_hook', name: 'Chain Hook', cls: 'warrior', cost: 0, rarity: 'common', element: 'steel', damaging: true, lock: 0.35,
    dmg: '20', short: 'Chain down your row. On hit: pull them to their front column, gain 1 Rage.',
    cast: x => {
      x.b.shoot(x.f, {
        speed: 14 * x.dir, kind: 'hook', reflectable: true,
        onHit: (b, t, w, _c, p) => {
          if (w) { b.hitWall(w, 20, x.f, {}); return; }
          if (!t) return;
          const src = b.f[p.side];
          const res = b.damage(t, 20 * x.mult, src, { spell: true, element: 'steel' });
          if (res.blocked && !res.dealt) return;
          const front = b.frontCol(t.side);
          if (t.st.noKnock <= 0 && b.canStand(t, front, t.row)) { t.col = front; }
          b.gainRage(src, 1, true);
        },
      });
    },
    ai: (b, f) => sameRow(b, f) && b.foe(f).col !== b.frontCol(b.foe(f).side),
  },
  {
    id: 'war_banner', name: 'War Banner', cls: 'warrior', cost: 2, rarity: 'uncommon', element: 'steel', damaging: true, lock: 0.4,
    dmg: '10', short: 'Steal the enemy front column for 5s. Anyone there is knocked back.',
    cast: x => {
      const { b, f, foe } = x;
      const col = b.frontCol(foe.side);
      if (col === b.backCol(foe.side)) { b.text(f, 'NO ROOM', '#bcbcbc'); return; }
      if (foe.col === col) {
        b.damage(foe, 10 * x.mult, f, { spell: true });
        if (!b.knockback(foe, 1)) b.relocate(foe);
      }
      for (let r = 0; r < 3; r++) {
        const p = b.panels[col][r];
        p.owner = f.side;
        p.ownerT = 5;
      }
      b.walls = b.walls.filter(w => !(w.col === col && w.side === foe.side));
      if (foe.col === col) b.relocate(foe);
      b.addFx('banner', f.side, col, 1, 5);
    },
  },
  {
    id: 'shieldbreaker', name: 'Shieldbreaker', cls: 'warrior', cost: 2, rarity: 'common', element: 'steel', damaging: true, lock: 0.7,
    dmg: '60/120', short: 'Slow hammer on 2 panels ahead. Shatters shields and walls, double dmg on a break.',
    cast: x => {
      x.b.later(0.4, () => {
        x.b.addFx('smash', x.f.side, x.f.col + x.dir, x.f.row, 0.3);
        const res = x.b.strike(x.f, cellsAhead(x, 1, 2), 60 * x.mult, { spell: true, breaks: true, element: 'steel' });
        void res;
      });
    },
    ai: (b, f) => ahead(b, f, 2) || b.walls.some(w => w.side !== f.side && w.row === f.row && Math.abs(w.col - f.col) <= 2),
  },
  {
    id: 'battle_shout', name: 'Battle Shout', cls: 'warrior', cost: 1, rarity: 'common', element: 'steel', damaging: false, lock: 0.3,
    dmg: '-', short: 'Your next spell deals +50% damage.',
    cast: x => { x.f.shout = 1.5; x.b.addFx('shout', x.f.side, x.f.col, x.f.row, 0.5); },
  },
  {
    id: 'intimidating_roar', name: 'Intimidating Roar', cls: 'warrior', cost: 2, rarity: 'common', element: 'steel', damaging: false, lock: 0.4,
    dmg: '-', short: 'Enemy deals 30% less damage for 5s. Not a shield, so Break cannot remove it.',
    cast: x => { x.foe.st.roared = 5; x.b.addFx('shout', x.f.side, x.f.col, x.f.row, 0.6); x.b.text(x.foe, 'WEAKENED', '#bcbcbc'); },
  },
  {
    id: 'wide_cleave', name: 'Wide Cleave', cls: 'warrior', cost: 2, rarity: 'uncommon', element: 'steel', damaging: true, lock: 0.45,
    dmg: '90', short: 'Sweeping slash hits all 3 panels of the enemy front column.',
    cast: x => {
      const col = x.b.frontCol(x.foe.side);
      x.b.addFx('wide', x.f.side, col, 1, 0.3);
      x.b.strike(x.f, [[col, 0], [col, 1], [col, 2]], 90 * x.mult, { spell: true, element: 'steel' });
    },
    ai: (b, f) => b.foe(f).col === b.frontCol(b.foe(f).side),
  },
  {
    id: 'ground_slam', name: 'Ground Slam', cls: 'warrior', cost: 2, rarity: 'uncommon', element: 'steel', damaging: true, lock: 0.45,
    dmg: '60', short: 'Shockwave hits the enemy front column and cracks those panels.',
    cast: x => {
      const col = x.b.frontCol(x.foe.side);
      x.b.addFx('shockwave', x.f.side, col, 1, 0.4);
      x.b.shake = 0.2;
      x.b.strike(x.f, [[col, 0], [col, 1], [col, 2]], 60 * x.mult, { spell: true, element: 'steel' });
      for (let r = 0; r < 3; r++) x.b.panels[col][r].cracked = true;
    },
  },
  {
    id: 'seismic_wave', name: 'Seismic Wave', cls: 'warrior', cost: 3, rarity: 'uncommon', element: 'steel', damaging: true, lock: 0.5,
    dmg: '60 each', short: 'Quake rolls down your row and spreads into a cone of 6 enemy panels.',
    cast: x => {
      const { b, f, foe } = x;
      const r = f.row, front = b.frontCol(foe.side), d = x.dir;
      const waves: Array<Array<[number, number]>> = [[[front, r]], [[front + d, r - 1], [front + d, r], [front + d, r + 1]], [[front + 2 * d, r - 1], [front + 2 * d, r + 1]]];
      waves.forEach((cells, i) => b.later(0.1 * i, () => {
        for (const [c, rr] of cells) if (b.inGrid(c, rr)) b.addFx('quake', f.side, c, rr, 0.3);
        b.strike(f, cells, 60 * x.mult, { spell: true, element: 'steel' });
      }));
    },
  },
  {
    id: 'rampage', name: 'Rampage', cls: 'warrior', cost: 5, rarity: 'legendary', element: 'steel', damaging: true, lock: 1.3,
    dmg: '70x3', short: 'Charge the enemy wherever they are: 3 heavy slashes. Cannot be interrupted.',
    cast: x => {
      const { b, f, foe } = x;
      f.st.noKnock = 1.4;
      lunge(x, foe.col - x.dir, foe.row, 0.18, 0.85, 0.2);
      for (let i = 0; i < 3; i++) b.later(0.22 + i * 0.25, () => {
        b.addFx('cleaveHeavy', f.side, foe.col, foe.row, 0.18);
        sfx('slashHeavy');
        b.damage(foe, 70 * x.mult, f, { spell: true, element: 'steel' });
      });
    },
  },
  {
    id: 'unbreakable', name: 'Unbreakable', cls: 'warrior', cost: 2, rarity: 'legendary', element: 'steel', damaging: false, lock: 0.3,
    dmg: '-', short: 'Unbreakable barrier absorbs 150 over 6s. When it ends: 1 Rage per hit (max 3).',
    cast: x => x.b.addShield(x.f, 'unbreakable', 150, 6),
  },
  {
    id: 'berserk', name: 'Berserk', cls: 'warrior', cost: 3, rarity: 'legendary', element: 'steel', damaging: false, lock: 0.3,
    dmg: '-', short: 'For 8s, basic attacks build double Rage and you cannot be knocked back.',
    cast: x => { x.f.st.berserk = 8; x.b.addFx('shout', x.f.side, x.f.col, x.f.row, 0.6); },
  },
  {
    id: 'ground_shatter', name: 'Ground Shatter', cls: 'warrior', cost: 3, rarity: 'legendary', element: 'steel', damaging: true, lock: 0.5,
    dmg: '80', short: 'Turn the enemy front column into holes for 8s. 80 to anyone caught.',
    cast: x => {
      const { b, f, foe } = x;
      const col = b.frontCol(foe.side);
      if (col === b.backCol(foe.side)) { b.text(f, 'NO ROOM', '#bcbcbc'); return; }
      b.shake = 0.3;
      b.addFx('shockwave', f.side, col, 1, 0.4);
      b.strike(f, [[col, 0], [col, 1], [col, 2]], 80 * x.mult, { spell: true, element: 'steel' });
      b.walls = b.walls.filter(w => w.col !== col);
      for (let r = 0; r < 3; r++) b.panels[col][r].hole = 8;
      if (foe.col === col) { if (!b.knockback(foe, 1)) b.relocate(foe); }
    },
  },
  {
    id: 'shield_slam', name: 'Shield Slam', cls: 'warrior', cost: 0, rarity: 'legendary', element: 'steel', damaging: true, lock: 0.45,
    dmg: '80', short: 'Bash 2 panels ahead: break shields, stun 1s. Gain 2 Rage on hit.',
    cast: x => {
      x.b.addFx('smash', x.f.side, x.f.col + x.dir, x.f.row, 0.25);
      const res = x.b.strike(x.f, cellsAhead(x, 1, 2), 80 * x.mult, { spell: true, breaks: true, stun: 1, element: 'steel' });
      if (res.fighter) x.b.gainRage(x.f, 2, true);
    },
    ai: (b, f) => ahead(b, f, 2),
  },
  {
    id: 'rallying_cry', name: 'Rallying Cry', cls: 'warrior', cost: 2, rarity: 'legendary', element: 'steel', damaging: false, lock: 0.4,
    dmg: '-', short: 'Heal 150 HP. Your next 2 spells deal +30% damage.',
    cast: x => { x.b.heal(x.f, 150); x.f.rallyLeft = 2; x.b.addFx('shout', x.f.side, x.f.col, x.f.row, 0.6); },
    ai: (_b, f) => f.maxHp - f.hp >= 150,
  },
  {
    id: 'mortal_strike', name: 'Mortal Strike', cls: 'warrior', cost: 3, rarity: 'legendary', element: 'steel', damaging: true, lock: 0.5,
    dmg: '120', short: 'Heavy hit on 2 panels ahead. Halves enemy healing for 10s.',
    cast: x => {
      x.b.later(0.15, () => {
        x.b.addFx('smash', x.f.side, x.f.col + x.dir, x.f.row, 0.25);
        const res = x.b.strike(x.f, cellsAhead(x, 1, 2), 120 * x.mult, { spell: true, element: 'steel' });
        if (res.fighter) x.foe.st.mortal = 10;
      });
    },
    ai: (b, f) => ahead(b, f, 2),
  },
  {
    id: 'spell_reflection', name: 'Spell Reflection', cls: 'warrior', cost: 2, rarity: 'legendary', element: 'steel', damaging: false, lock: 0.2,
    dmg: 'theirs', short: 'For 4s, the next projectile spell that hits you bounces back at the caster.',
    cast: x => { x.f.st.reflect = 4; },
    ai: (b, f) => b.foe(f).cls === 'mage' && sameRow(b, f),
  },
  // Mythics
  {
    id: 'avatar_of_war', name: 'Avatar of War', cls: 'warrior', cost: 5, rarity: 'mythic', element: 'steel', damaging: false, lock: 0.5,
    dmg: '-', short: 'Transform for 10s: spells cost no Rage, no knockback, Cleave hits twice.',
    cast: x => { x.f.st.avatar = 10; x.b.cheer = 2; x.b.addFx('transform', x.f.side, x.f.col, x.f.row, 0.8); },
  },
  {
    id: 'last_stand', name: 'Last Stand', cls: 'warrior', cost: 5, rarity: 'mythic', element: 'steel', damaging: true, lock: 0.4,
    dmg: '=absorbed', short: 'For 5s you cannot drop below 1 HP. Then a shockwave deals the damage you took.',
    cast: x => { x.f.st.lastStand = 5; x.f.lastStandAbsorbed = 0; x.b.addFx('transform', x.f.side, x.f.col, x.f.row, 0.8); },
    ai: (_b, f) => lowHp(f, 0.5),
  },
  {
    id: 'titans_fall', name: "Titan's Fall", cls: 'warrior', cost: 5, rarity: 'mythic', element: 'steel', damaging: true, lock: 1.1,
    dmg: '200', short: 'Leap into the enemy area and smash all their panels, cracking them. Only blockable.',
    cast: x => {
      const { b, f, foe } = x;
      const mid = b.frontCol(foe.side) + x.dir;
      lunge(x, mid, 1, 0.45, 0.25, 0.3, 30);
      b.later(0.45, () => {
        b.shake = 0.5;
        b.cheer = 2;
        const cells = allEnemyPanels(b, f.side);
        for (const [c, r] of cells) { b.addFx('quake', f.side, c, r, 0.4); b.panels[c][r].cracked = true; }
        b.strike(f, cells, 200 * x.mult, { spell: true, element: 'steel' });
      });
      void foe;
    },
  },
];

// ---------- Mage ----------
function targeted(x: CastCtx, delay: number, fn: (c: number, r: number) => void): void {
  // Locks onto the enemy's panel at cast time (dodgeable when there is a telegraph).
  const c = x.foe.col, r = x.foe.row;
  x.b.later(delay, () => fn(c, r));
}

const mage: CardDef[] = [
  {
    id: 'arcane_missiles', name: 'Arcane Missiles', cls: 'mage', cost: 1, rarity: 'common', element: 'arcane', damaging: true, lock: 0.45,
    dmg: '20x3', short: '3 homing missiles strike the enemy wherever they are.',
    cast: x => {
      for (let i = 0; i < 3; i++) x.b.later(i * 0.12, () => {
        x.b.projectiles.push({
          side: x.f.side, row: x.f.row, x: x.f.col, speed: 0, kind: 'missile', reflectable: true,
          homing: { p: 0, dur: 0.4, sx: x.f.col, sy: x.f.row, target: x.foe.side },
          onHit: (b, t) => { if (t) b.damage(t, 20 * x.mult, b.f[1 - t.side], { spell: true, element: 'arcane', noFlinch: true }); },
        });
        sfx('missile');
      });
    },
  },
  {
    id: 'arcane_focus', name: 'Arcane Focus', cls: 'mage', cost: 0, rarity: 'common', element: 'arcane', damaging: false, lock: 0.2,
    dmg: '-', short: 'Gain +1 Mana this turn. Can go above your max.',
    cast: x => { x.f.res += 1; x.b.text(x.f, '+1 MANA', '#f878f8'); },
  },
  {
    id: 'arcane_barrier', name: 'Arcane Barrier', cls: 'mage', cost: 1, rarity: 'common', element: 'arcane', damaging: false, lock: 0.2,
    dmg: '-', short: 'Absorb 60 damage for 5s. If it breaks, +1 Mana next turn.',
    cast: x => x.b.addShield(x.f, 'barrier', 60, 5),
    ai: (b, f) => b.foe(f).cls === 'warrior' ? Math.abs(b.foe(f).col - f.col) <= 2 : sameRow(b, f),
  },
  {
    id: 'blink', name: 'Blink', cls: 'mage', cost: 1, rarity: 'common', element: 'arcane', damaging: false, lock: 0.15,
    dmg: '-', short: 'Teleport in your area. Hold a direction to pick the far panel that way.',
    cast: x => {
      const { b, f, foe, held } = x;
      const cands: Array<[number, number]> = [];
      for (let c = 0; c < 6; c++) for (let r = 0; r < 3; r++) if (b.canStand(f, c, r) && !(c === f.col && r === f.row)) cands.push([c, r]);
      if (!cands.length) return;
      const back = -x.dir;
      const score = ([c, r]: [number, number]): number => {
        if (held === 'up') return -r * 10 - Math.abs(c - f.col);
        if (held === 'down') return r * 10 - Math.abs(c - f.col);
        if (held === 'left' || held === 'right') {
          const s = held === 'right' ? 1 : -1;
          return c * s * 10 - Math.abs(r - f.row);
        }
        // safest: away from the enemy's row, toward the back
        return Math.abs(r - foe.row) * 10 + c * back * 3;
      };
      cands.sort((a, b2) => score(b2) - score(a));
      b.addFx('blink', f.side, f.col, f.row, 0.3);
      f.col = cands[0][0]; f.row = cands[0][1];
      b.addFx('blink', f.side, f.col, f.row, 0.3);
    },
    ai: (b, f) => b.foe(f).cls === 'warrior' && Math.abs(b.foe(f).col - f.col) <= 2 && sameRow(b, f),
  },
  {
    id: 'repulse', name: 'Repulse', cls: 'mage', cost: 1, rarity: 'common', element: 'arcane', damaging: true, lock: 0.3,
    dmg: '20', short: 'Gust down your row knocks the enemy to their back column.',
    cast: x => {
      x.b.shoot(x.f, {
        speed: 16 * x.dir, kind: 'gust', reflectable: true,
        onHit: (b, t, w, _c, p) => {
          if (w) { b.hitWall(w, 20, x.f, {}); return; }
          if (!t) return;
          b.damage(t, 20 * x.mult, b.f[p.side], { spell: true, element: 'arcane' });
          b.knockback(t, 3);
        },
      });
    },
    ai: (b, f) => sameRow(b, f) && b.foe(f).cls === 'warrior' && b.foe(f).col === b.frontCol(b.foe(f).side),
  },
  {
    id: 'ignite', name: 'Ignite', cls: 'mage', cost: 1, rarity: 'common', element: 'fire', damaging: true, lock: 0.3,
    dmg: '15/s', short: 'The column the enemy stands in burns for 5s.',
    cast: x => { for (let r = 0; r < 3; r++) x.b.burn(x.foe.col, r, 5, 15 * x.mult); },
  },
  {
    id: 'fireball', name: 'Fireball', cls: 'mage', cost: 3, rarity: 'common', element: 'fire', damaging: true, lock: 0.4,
    dmg: '100', short: 'Fireball down your row. Explodes on a 2x2 square and leaves it burning.',
    cast: x => {
      x.b.shoot(x.f, {
        speed: 9 * x.dir, kind: 'fireball', reflectable: true,
        onHit: (b, _t, _w, col, p) => {
          const src = b.f[p.side];
          const d = b.dir(src);
          const row = p.row;
          const r2 = row === 2 ? 1 : row + 1;
          const cells: Array<[number, number]> = [[col, row], [col + d, row], [col, r2], [col + d, r2]];
          sfx('explode');
          b.shake = 0.2;
          for (const [c, rr] of cells) { b.addFx('explode', src.side, c, rr, 0.35); b.burn(c, rr, 5, 15); }
          b.strike(src, cells, 100 * x.mult, { spell: true, element: 'fire' });
        },
      });
    },
    ai: (b, f) => sameRow(b, f),
  },
  {
    id: 'scorch', name: 'Scorch', cls: 'mage', cost: 2, rarity: 'common', element: 'fire', damaging: true, lock: 0.3,
    dmg: '60', short: 'Every burning panel erupts. 60 to anyone on one.',
    cast: x => {
      const cells: Array<[number, number]> = [];
      for (let c = 0; c < 6; c++) for (let r = 0; r < 3; r++) if (x.b.panels[c][r].burn > 0 && x.b.panels[c][r].owner !== x.f.side) cells.push([c, r]);
      for (const [c, r] of cells) x.b.addFx('explode', x.f.side, c, r, 0.35);
      x.b.strike(x.f, cells, 60 * x.mult, { spell: true, element: 'fire' });
    },
    ai: (b, f) => { const foe = b.foe(f); return b.panels[foe.col][foe.row].burn > 0.4; },
  },
  {
    id: 'ice_wall', name: 'Ice Wall', cls: 'mage', cost: 1, rarity: 'common', element: 'frost', damaging: false, lock: 0.3,
    dmg: '-', short: 'Ice block (60 HP) on the panel in front of you blocks shots in your row.',
    cast: x => { if (!x.b.placeWall(x.f, x.f.col + x.dir, x.f.row, 60, 'ice', 12)) x.b.text(x.f, 'BLOCKED', '#bcbcbc'); },
    ai: (b, f) => sameRow(b, f),
  },
  {
    id: 'frost_nova', name: 'Frost Nova', cls: 'mage', cost: 2, rarity: 'common', element: 'frost', damaging: true, lock: 0.3,
    dmg: '20', short: 'Hits an enemy within 2 columns of you for 20 and freezes them 1.5s. If none, lingers 6s until one comes close.',
    cast: x => { x.f.st.frostNova = 6; x.f.frostNovaUsed = false; x.b.addFx('novaZone', x.f.side, x.f.col, x.f.row, 0.6); },
    ai: (b, f) => b.foe(f).cls === 'warrior' || Math.abs(b.foe(f).col - f.col) <= 2,
  },
  {
    id: 'arcane_intellect', name: 'Arcane Intellect', cls: 'mage', cost: 1, rarity: 'uncommon', element: 'arcane', damaging: false, lock: 0.3,
    dmg: '-', short: 'Permanently +1 max Mana (cap 5).',
    cast: x => { if (x.f.resMax < 5) { x.f.resMax += 1; x.f.res += 1; } x.b.text(x.f, '+1 MAX MANA', '#f878f8'); },
  },
  {
    id: 'arcane_blast', name: 'Arcane Blast', cls: 'mage', cost: 2, rarity: 'uncommon', element: 'arcane', damaging: true, lock: 0.35,
    dmg: '90', short: 'Arcane hit on the enemy wherever they are.',
    cast: x => {
      x.b.later(0.15, () => {
        x.b.addFx('arcaneHit', x.f.side, x.foe.col, x.foe.row, 0.35);
        x.b.damage(x.foe, 90 * x.mult, x.f, { spell: true, element: 'arcane' });
      });
    },
  },
  {
    id: 'flamestrike', name: 'Flamestrike', cls: 'mage', cost: 3, rarity: 'uncommon', element: 'fire', damaging: true, lock: 0.35,
    dmg: '130', short: 'After 1s, a fire pillar hits their panel and sets that whole column burning.',
    cast: x => {
      x.b.mark(x.foe.col, x.foe.row, 1, '#f83800');
      targeted(x, 1, (c, r) => {
        x.b.addFx('pillar', x.f.side, c, r, 0.45);
        sfx('explode');
        x.b.strike(x.f, [[c, r]], 130 * x.mult, { spell: true, element: 'fire' });
        for (let rr = 0; rr < 3; rr++) x.b.burn(c, rr, 5, 15);
      });
    },
  },
  {
    id: 'blizzard', name: 'Blizzard', cls: 'mage', cost: 4, rarity: 'uncommon', element: 'frost', damaging: true, lock: 0.4,
    dmg: '25 each', short: '4s of ice shards on random enemy panels. Hit 3 times = frozen 1.5s.',
    cast: x => {
      const { b, f, foe } = x;
      let hits = 0;
      // ~2 shards/s; each telegraphs 0.5s. Prototype: 40% of shards aim at the enemy's panel.
      for (let i = 0; i < 8; i++) b.later(i * 0.5, () => {
        const cells = allEnemyPanels(b, f.side);
        const aim = Math.random() < 0.4;
        const [c, r] = aim ? [foe.col, foe.row] : cells[Math.floor(Math.random() * cells.length)];
        b.mark(c, r, 0.5, '#3cbcfc');
        b.later(0.5, () => {
          b.addFx('shard', f.side, c, r, 0.3);
          const res = b.strike(f, [[c, r]], 25 * x.mult, { spell: true, element: 'frost', noFlinch: true });
          if (res.fighter && ++hits === 3) b.freeze(foe, 1.5);
        });
      });
    },
  },
  {
    id: 'ice_block', name: 'Ice Block', cls: 'mage', cost: 2, rarity: 'uncommon', element: 'frost', damaging: false, lock: 0,
    dmg: '-', short: 'Immune to everything for 2s, but you cannot move or act.',
    cast: x => { x.f.st.iceBlock = 2; },
    ai: (b, f) => b.marks.some(m => m.col === f.col && m.row === f.row) || (lowHp(f, 0.3) && Math.abs(b.foe(f).col - f.col) <= 2),
  },
  {
    id: 'counterspell', name: 'Counterspell', cls: 'mage', cost: 2, rarity: 'legendary', element: 'arcane', damaging: false, lock: 0.2,
    dmg: '-', short: 'For 4s, the next spell the enemy casts is cancelled.',
    cast: x => { x.f.st.counterspell = 4; x.b.addFx('counter', x.f.side, x.f.col, x.f.row, 0.5); },
    ai: (b, f) => b.foe(f).queue.length > 0,
  },
  {
    id: 'meteor', name: 'Meteor', cls: 'mage', cost: 5, rarity: 'legendary', element: 'fire', damaging: true, lock: 0.4,
    dmg: '180', short: 'After 1.5s, crashes on their panel in a plus shape and leaves it burning.',
    cast: x => {
      const c0 = x.foe.col, r0 = x.foe.row;
      const cells: Array<[number, number]> = [[c0, r0], [c0 - 1, r0], [c0 + 1, r0], [c0, r0 - 1], [c0, r0 + 1]];
      for (const [c, r] of cells) x.b.mark(c, r, 1.5, '#f83800');
      x.b.addFx('meteorFall', x.f.side, c0, r0, 1.5);
      x.b.later(1.5, () => {
        x.b.shake = 0.5;
        x.b.cheer = 2;
        sfx('explode');
        for (const [c, r] of cells) { x.b.addFx('explode', x.f.side, c, r, 0.5); x.b.burn(c, r, 5, 15); }
        x.b.strike(x.f, cells, 180 * x.mult, { spell: true, element: 'fire' });
      });
    },
  },
  {
    id: 'arcane_surge', name: 'Arcane Surge', cls: 'mage', cost: 'all', rarity: 'legendary', element: 'arcane', damaging: true, lock: 0.45,
    dmg: '50/Mana', short: 'Spend ALL Mana: arcane blast on the enemy, 50 damage per Mana spent.',
    cast: x => {
      const dmg = 50 * x.spent * x.mult;
      x.b.later(0.2, () => {
        x.b.addFx('arcaneHit', x.f.side, x.foe.col, x.foe.row, 0.5);
        x.b.shake = 0.3;
        x.b.damage(x.foe, dmg, x.f, { spell: true, element: 'arcane' });
      });
    },
    ai: (_b, f) => f.res >= 4,
  },
  {
    id: 'arcane_power', name: 'Arcane Power', cls: 'mage', cost: 2, rarity: 'legendary', element: 'arcane', damaging: false, lock: 0.3,
    dmg: '-', short: 'Your next 3 spells cost 1 less Mana.',
    cast: x => { x.f.powerLeft = 3; },
  },
  {
    id: 'evocation', name: 'Evocation', cls: 'mage', cost: 0, rarity: 'legendary', element: 'arcane', damaging: false, lock: 0.3,
    dmg: '-', short: 'Refill Mana to max, but you cannot cast for 2s.',
    cast: x => { x.f.res = Math.max(x.f.res, x.f.resMax); x.f.st.evoLock = 2; },
    ai: (_b, f) => f.res <= 1,
  },
  {
    id: 'dragons_breath', name: "Dragon's Breath", cls: 'mage', cost: 3, rarity: 'legendary', element: 'fire', damaging: true, lock: 0.5,
    dmg: '100 each', short: 'Cone of flame hits the enemy front two columns and leaves them burning.',
    cast: x => {
      const { b, f, foe } = x;
      const c1 = b.frontCol(foe.side), c2 = c1 + x.dir;
      const cells: Array<[number, number]> = [];
      for (const c of [c1, c2]) for (let r = 0; r < 3; r++) cells.push([c, r]);
      for (const [c, r] of cells) { b.addFx('explode', f.side, c, r, 0.4); b.burn(c, r, 5, 15); }
      b.strike(f, cells, 100 * x.mult, { spell: true, element: 'fire' });
    },
    ai: (b, f) => { const foe = b.foe(f); return Math.abs(foe.col - b.frontCol(foe.side)) <= 1; },
  },
  {
    id: 'comet_storm', name: 'Comet Storm', cls: 'mage', cost: 5, rarity: 'legendary', element: 'fire', damaging: true, lock: 0.4,
    dmg: '50 each', short: '6 comets fall on random enemy panels, leaving them burning.',
    cast: x => {
      const { b, f } = x;
      const cells = allEnemyPanels(b, f.side).sort(() => Math.random() - 0.5).slice(0, 6);
      cells.forEach(([c, r], i) => {
        b.later(i * 0.25, () => b.mark(c, r, 0.5, '#f83800'));
        b.later(i * 0.25 + 0.5, () => {
          b.addFx('explode', f.side, c, r, 0.35);
          sfx('explode');
          b.burn(c, r, 5, 15);
          b.strike(f, [[c, r]], 50 * x.mult, { spell: true, element: 'fire', noFlinch: true });
        });
      });
    },
  },
  {
    id: 'deep_freeze', name: 'Deep Freeze', cls: 'mage', cost: 3, rarity: 'legendary', element: 'frost', damaging: false, lock: 0.3,
    dmg: '-', short: 'Freeze the enemy for 2.5s. They cannot move or act.',
    cast: x => { x.b.addFx('shard', x.f.side, x.foe.col, x.foe.row, 0.4); x.b.freeze(x.foe, 2.5); },
  },
  // Mythics
  {
    id: 'ascendance', name: 'Ascendance', cls: 'mage', cost: 5, rarity: 'mythic', element: 'arcane', damaging: false, lock: 0.5,
    dmg: '-', short: 'Transform for 8s: your spells cost 0 Mana and every spell fires twice.',
    cast: x => { x.f.st.ascendance = 8; x.b.cheer = 2; x.b.addFx('transform', x.f.side, x.f.col, x.f.row, 0.8); },
  },
  {
    id: 'inferno', name: 'Inferno', cls: 'mage', cost: 5, rarity: 'mythic', element: 'fire', damaging: true, lock: 0.5,
    dmg: '20/s', short: 'All enemy panels burn for 10s. Outlasts the next custom screen.',
    cast: x => {
      x.b.cheer = 2;
      for (const [c, r] of allEnemyPanels(x.b, x.f.side)) { x.b.burn(c, r, 10, 20 * x.mult); x.b.addFx('explode', x.f.side, c, r, 0.3); }
    },
  },
  {
    id: 'glacial_fortress', name: 'Glacial Fortress', cls: 'mage', cost: 5, rarity: 'mythic', element: 'frost', damaging: false, lock: 0.5,
    dmg: '-', short: '10s: ice fills the column in front of you, blocking all shots. Touching it freezes 2s.',
    cast: x => {
      const { b, f } = x;
      // Ice goes in your own front column; if you stand there you step back first.
      const col = b.frontCol(f.side);
      if (f.col === col && !b.knockback(f, 1)) { b.text(f, 'NO ROOM', '#bcbcbc'); return; }
      b.walls = b.walls.filter(w => w.col !== col || w.side !== f.side);
      for (let r = 0; r < 3; r++) b.placeWall(f, col, r, 999, 'glacial', 10, true);
      f.st.glacial = 10;
      b.cheer = 2;
    },
  },
];

export const ALL_CARDS: CardDef[] = [...warrior, ...mage];
export const CARDS: Record<string, CardDef> = Object.fromEntries(ALL_CARDS.map(c => [c.id, c]));
export const cardsFor = (cls: ClassId): CardDef[] => ALL_CARDS.filter(c => c.cls === cls);

export const ELEMENT_COLOR: Record<Element, string> = { steel: '#bcbcbc', fire: '#f87800', frost: '#3cbcfc', arcane: '#f878f8' };
export const RARITY_COLOR: Record<Rarity, string> = { common: '#bcbcbc', uncommon: '#58d854', legendary: '#f8b800', mythic: '#f878f8' };
