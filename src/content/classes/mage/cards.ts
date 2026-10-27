// Mage kit from the design doc: Arcane, Fire and Frost. Spells cost Mana, whose cap grows every Draw.
import { type CardDef, shuffle, TUNING, targeted, sameRow, allEnemyPanels, lowHp, spellStep, type ShotHit } from '../../api';

type Cells = Array<[number, number]>;

// Spells' later steps (see spellStep): what lands after a delay, a telegraph or a flight.
const missile = spellStep('arcane_missiles.fire', x => {
  x.b.projectiles.push({
    side: x.f.side, row: x.f.row, x: x.f.col, speed: 0, kind: 'missile', reflectable: true,
    homing: { p: 0, dur: 0.4, sx: x.f.col, sy: x.f.row, target: x.foe.side },
    onHit: missileHit(x),
  });
  x.b.sound('missile');
});
const missileHit = spellStep('arcane_missiles.hit', (x, _a, h: ShotHit) => {
  if (h.t) x.b.damage(h.t, 25 * x.mult, x.b.f[1 - h.t.side], { spell: true, element: 'arcane', noFlinch: true });
});
const repulseHit = spellStep('repulse.hit', (x, _a, h: ShotHit) => {
  const { b } = x;
  if (h.w) { b.hitWall(h.w, 25, x.f, {}); return; }
  if (!h.t) return;
  b.knockback(h.t, 3);
  b.damage(h.t, 25 * x.mult, b.f[h.p.side], { spell: true, element: 'arcane', stun: 1 });
});
const fireballHit = spellStep('fireball.hit', (x, _a, { col, p }: ShotHit) => {
  const { b } = x;
  const src = b.f[p.side];
  const d = b.dir(src);
  const row = p.row;
  const r2 = row === 2 ? 1 : row + 1;
  const cells: Cells = [[col, row], [col + d, row], [col, r2], [col + d, r2]];
  b.shake = 0.2;
  for (const [c, rr] of cells) { b.addFx('explode', src.side, c, rr, 0.35); b.burn(c, rr, 5, 15); }
  b.strike(src, cells, 120 * x.mult, { spell: true, element: 'fire' });
});
const scorchHit = spellStep('scorch.hit', (x, { cells }: { cells: Cells }) => {
  for (const [c, r] of cells) x.b.addFx('explode', x.f.side, c, r, 0.35);
  x.b.strike(x.f, cells, 75 * x.mult, { spell: true, element: 'fire' });
});
const arcaneBlastHit = spellStep('arcane_blast.hit', x => {
  x.b.addFx('arcaneHit', x.f.side, x.foe.col, x.foe.row, 0.35);
  x.b.damage(x.foe, 110 * x.mult, x.f, { spell: true, element: 'arcane', targeted: true });
});
const flamestrikeHit = spellStep('flamestrike.hit', (x, { c, r }: { c: number; r: number }) => {
  x.b.addFx('pillar', x.f.side, c, r, 0.45);
  x.b.sound('explode');
  x.b.strike(x.f, [[c, r]], 155 * x.mult, { spell: true, element: 'fire' });
  for (let rr = 0; rr < 3; rr++) x.b.burn(c, rr, 5, 15);
});
/** Shards landed on the enemy so far, shared by one Blizzard's shards. */
interface Hits { hits: number }
const blizzardShard = spellStep('blizzard.shard', (x, { n }: { n: Hits }) => {
  const { b, f, foe } = x;
  const cells = allEnemyPanels(b, f.side);
  const aim = b.rand() < 0.4;
  const [c, r] = aim ? [foe.col, foe.row] : cells[Math.floor(b.rand() * cells.length)];
  b.warn(f, [[c, r]], 0.5, blizzardHit(x, { c, r, n }));
});
const blizzardHit = spellStep('blizzard.hit', (x, { c, r, n }: { c: number; r: number; n: Hits }) => {
  const { b, f, foe } = x;
  b.addFx('shard', f.side, c, r, 0.3);
  const res = b.strike(f, [[c, r]], 30 * x.mult, { spell: true, element: 'frost', noFlinch: true });
  if (res.fighter && ++n.hits === 2) b.freeze(foe, 2);
});
const meteorHit = spellStep('meteor.hit', (x, { cells }: { cells: Cells }) => {
  x.b.shake = 0.5;
  x.b.cheer = 2;
  for (const [c, r] of cells) { x.b.addFx('explode', x.f.side, c, r, 0.5); x.b.burn(c, r, 5, 15); }
  x.b.strike(x.f, cells, 220 * x.mult, { spell: true, element: 'fire' });
});
const surgeHit = spellStep('arcane_surge.hit', (x, { dmg }: { dmg: number }) => {
  x.b.addFx('arcaneHit', x.f.side, x.foe.col, x.foe.row, 0.5);
  x.b.shake = 0.3;
  x.b.damage(x.foe, dmg, x.f, { spell: true, element: 'arcane', targeted: true });
});
const cometWarn = spellStep('comet_storm.warn', (x, { c, r }: { c: number; r: number }) => x.b.warn(x.f, [[c, r]], 0.5, cometHit(x, { c, r })));
const cometHit = spellStep('comet_storm.hit', (x, { c, r }: { c: number; r: number }) => {
  const { b, f } = x;
  b.addFx('explode', f.side, c, r, 0.35);
  b.burn(c, r, 5, 15);
  b.strike(f, [[c, r]], 60 * x.mult, { spell: true, element: 'fire', noFlinch: true });
});

export const mage: CardDef[] = [
  {
    id: 'arcane_missiles', name: 'Arcane Missiles', cls: 'mage', cost: 1, rarity: 'common', element: 'arcane', damaging: true, lock: 0.45,
    dmg: '25x3', short: '3 homing missiles strike the enemy wherever they are.',
    cast: x => {
      for (let i = 0; i < 3; i++) x.b.later(i * 0.12, missile(x));
    },
  },
  {
    id: 'arcane_focus', name: 'Arcane Focus', cls: 'mage', cost: 0, rarity: 'common', element: 'arcane', damaging: false, lock: 0.2,
    dmg: '-', short: 'Gain +1 Mana this turn. Can go above your max.', gain: { res: 1 },
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
    dmg: '25', short: 'Gust down your row knocks the enemy to their back column and stuns them 1s.',
    cast: x => {
      x.b.shoot(x.f, { speed: 16 * x.dir, kind: 'gust', reflectable: true, onHit: repulseHit(x) });
    },
    ai: (b, f) => sameRow(b, f) && b.foe(f).cls === 'warrior' && b.foe(f).col === b.frontCol(b.foe(f).side),
  },
  {
    id: 'ignite', name: 'Ignite', cls: 'mage', cost: 1, rarity: 'common', element: 'fire', damaging: true, lock: 0.3,
    dmg: '18/s', short: 'The column the enemy stands in burns for 5s.',
    cast: x => { for (let r = 0; r < 3; r++) x.b.burn(x.foe.col, r, 5, 18 * x.mult); },
  },
  {
    id: 'fireball', name: 'Fireball', cls: 'mage', cost: 3, rarity: 'common', element: 'fire', damaging: true, lock: 0.4,
    dmg: '120', short: 'Fireball down your row. Explodes on a 2x2 square and leaves it burning.',
    cast: x => {
      x.b.shoot(x.f, { speed: 9 * x.dir, kind: 'fireball', reflectable: true, onHit: fireballHit(x) });
    },
    ai: (b, f) => sameRow(b, f),
  },
  {
    id: 'scorch', name: 'Scorch', cls: 'mage', cost: 2, rarity: 'common', element: 'fire', damaging: true, lock: 0.3,
    dmg: '75', short: 'Every burning panel erupts. 75 to anyone on one.',
    cast: x => {
      const cells: Array<[number, number]> = [];
      for (let c = 0; c < 6; c++) for (let r = 0; r < 3; r++) if (x.b.panels[c][r].burn > 0 && x.b.panels[c][r].owner !== x.f.side) cells.push([c, r]);
      x.b.warn(x.f, cells, TUNING.warnTime, scorchHit(x, { cells }));
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
    dmg: '25', short: 'Hits an enemy within 3 columns of you for 25 and freezes them 2s. If none, lingers 6s until one comes close.',
    cast: x => { x.f.st.frostNova = 6; x.f.frostNovaUsed = false; x.b.addFx('novaZone', x.f.side, x.f.col, x.f.row, 0.6); },
    ai: (b, f) => b.foe(f).cls === 'warrior' || Math.abs(b.foe(f).col - f.col) <= 3,
  },
  {
    id: 'arcane_intellect', name: 'Arcane Intellect', cls: 'mage', cost: 1, rarity: 'uncommon', element: 'arcane', damaging: false, lock: 0.3,
    dmg: '-', short: 'Permanently +1 max Mana (cap 5).', gain: { max: 1, res: 1 },
    cast: x => { if (x.f.resMax < 5) { x.f.resMax += 1; x.f.res += 1; } x.b.text(x.f, '+1 MAX MANA', '#f878f8'); },
  },
  {
    id: 'arcane_blast', name: 'Arcane Blast', cls: 'mage', cost: 2, rarity: 'uncommon', element: 'arcane', damaging: true, lock: 0.35,
    dmg: '110', short: 'Arcane hit on the enemy wherever they are.',
    cast: x => {
      x.b.later(0.15, arcaneBlastHit(x));
    },
  },
  {
    id: 'flamestrike', name: 'Flamestrike', cls: 'mage', cost: 3, rarity: 'uncommon', element: 'fire', damaging: true, lock: 0.35,
    dmg: '155', short: 'After 1s, a fire pillar hits their panel and sets that whole column burning.',
    cast: x => {
      // BN Canodumb style: a crosshair locks onto their panel, then the pillar comes down
      x.b.warn(x.f, [[x.foe.col, x.foe.row]], 1, undefined, 'reticle');
      targeted(x, 1, (c, r) => flamestrikeHit(x, { c, r }));
    },
  },
  {
    id: 'blizzard', name: 'Blizzard', cls: 'mage', cost: 4, rarity: 'uncommon', element: 'frost', damaging: true, lock: 0.4,
    dmg: '30 each', short: '4s of ice shards on random enemy panels. Hit 2 times = frozen 2s.',
    cast: x => {
      // ~2 shards/s; each telegraphs 0.5s. Prototype: 40% of shards aim at the enemy's panel.
      const n: Hits = { hits: 0 };
      for (let i = 0; i < 8; i++) x.b.later(i * 0.5, blizzardShard(x, { n }));
    },
  },
  {
    id: 'ice_block', name: 'Ice Block', cls: 'mage', cost: 2, rarity: 'uncommon', element: 'frost', damaging: false, lock: 0,
    dmg: '-', short: 'Immune to everything for 2s, but you cannot move or act.',
    cast: x => { x.f.st.iceBlock = 2; },
    ai: (b, f) => b.warned(f.col, f.row, f.side) || (lowHp(f, 0.3) && Math.abs(b.foe(f).col - f.col) <= 2),
  },
  {
    id: 'counterspell', name: 'Counterspell', cls: 'mage', cost: 2, rarity: 'legendary', element: 'arcane', damaging: false, lock: 0.2,
    dmg: '-', short: 'For 4s, the next spell the enemy casts is cancelled and they are silenced for 3s.',
    cast: x => { x.f.st.counterspell = 4; x.b.addFx('counter', x.f.side, x.f.col, x.f.row, 0.5); },
    ai: (b, f) => b.foe(f).queue.length > 0,
  },
  {
    id: 'meteor', name: 'Meteor', cls: 'mage', cost: 5, rarity: 'legendary', element: 'fire', damaging: true, lock: 0.4,
    dmg: '220', short: 'After 1.5s, crashes on their panel in a plus shape and leaves it burning.',
    cast: x => {
      const c0 = x.foe.col, r0 = x.foe.row;
      const cells: Array<[number, number]> = [[c0, r0], [c0 - 1, r0], [c0 + 1, r0], [c0, r0 - 1], [c0, r0 + 1]];
      x.b.addFx('meteorFall', x.f.side, c0, r0, 1.5);
      x.b.warn(x.f, cells, 1.5, meteorHit(x, { cells }));
    },
  },
  {
    id: 'arcane_surge', name: 'Arcane Surge', cls: 'mage', cost: 'all', rarity: 'legendary', element: 'arcane', damaging: true, lock: 0.45,
    dmg: '60/Mana', short: 'Spend ALL Mana: arcane blast on the enemy, 60 damage per Mana spent.',
    cast: x => {
      const dmg = 60 * x.spent * x.mult;
      x.b.later(0.2, surgeHit(x, { dmg }));
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
    dmg: '-', short: 'Refill Mana to max, but you cannot cast for 2s.', gain: { refill: true },
    cast: x => { x.f.res = Math.max(x.f.res, x.f.resMax); x.f.st.evoLock = 2; },
    ai: (_b, f) => f.res <= 1,
  },
  {
    id: 'dragons_breath', name: "Dragon's Breath", cls: 'mage', cost: 3, rarity: 'legendary', element: 'fire', damaging: true, lock: 0.5,
    dmg: '120 each', short: 'Cone of flame hits the enemy front two columns and leaves them burning.',
    cast: x => {
      const { b, f, foe } = x;
      const c1 = b.frontCol(foe.side), c2 = c1 + x.dir;
      const cells: Array<[number, number]> = [];
      for (const c of [c1, c2]) for (let r = 0; r < 3; r++) cells.push([c, r]);
      // like BN's fire arms, the breath is instant; the burning panels it leaves are the warning
      for (const [c, r] of cells) { b.addFx('explode', f.side, c, r, 0.4); b.burn(c, r, 5, 15); }
      b.strike(f, cells, 120 * x.mult, { spell: true, element: 'fire' });
    },
    ai: (b, f) => { const foe = b.foe(f); return Math.abs(foe.col - b.frontCol(foe.side)) <= 1; },
  },
  {
    id: 'comet_storm', name: 'Comet Storm', cls: 'mage', cost: 5, rarity: 'legendary', element: 'fire', damaging: true, lock: 0.4,
    dmg: '60 each', short: '6 comets fall on random enemy panels, leaving them burning.',
    cast: x => {
      const { b, f } = x;
      const cells = shuffle(allEnemyPanels(b, f.side), b.rand).slice(0, 6);
      cells.forEach(([c, r], i) => b.later(i * 0.25, cometWarn(x, { c, r })));
    },
  },
  {
    id: 'deep_freeze', name: 'Deep Freeze', cls: 'mage', cost: 3, rarity: 'legendary', element: 'frost', damaging: false, lock: 0.3,
    dmg: '-', short: 'Freeze the enemy for 3s. They cannot move or act.',
    cast: x => {
      if (!x.b.targetable(x.foe)) { x.b.text(x.foe, 'MISS', '#bcbcbc'); return; }
      x.b.addFx('shard', x.f.side, x.foe.col, x.foe.row, 0.4);
      x.b.freeze(x.foe, 3);
    },
  },
  // Mythics
  {
    id: 'ascendance', name: 'Ascendance', cls: 'mage', cost: 5, rarity: 'mythic', element: 'arcane', damaging: false, lock: 0.5,
    dmg: '-', short: 'Transform for 8s: your spells cost 0 Mana and every spell fires twice.',
    cast: x => { x.f.st.ascendance = 8; x.b.cheer = 2; x.b.addFx('transform', x.f.side, x.f.col, x.f.row, 0.8); },
  },
  {
    id: 'inferno', name: 'Inferno', cls: 'mage', cost: 5, rarity: 'mythic', element: 'fire', damaging: true, lock: 0.5,
    dmg: '24/s', short: 'All enemy panels burn for 10s. Outlasts the next custom screen.',
    cast: x => {
      x.b.cheer = 2;
      for (const [c, r] of allEnemyPanels(x.b, x.f.side)) { x.b.burn(c, r, 10, 24 * x.mult); x.b.addFx('explode', x.f.side, c, r, 0.3); }
    },
  },
  {
    id: 'glacial_fortress', name: 'Glacial Fortress', cls: 'mage', cost: 5, rarity: 'mythic', element: 'frost', damaging: false, lock: 0.5,
    dmg: '-', short: '10s: ice fills the column in front of you, blocking all shots. Touching it freezes 2.5s.',
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
