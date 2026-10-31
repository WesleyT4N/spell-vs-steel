// Warrior kit from the design doc. Spells cost Rage, built by heavy hits and by taking damage.
import { type CardDef, type ShotHit, TUNING, sameRow, ahead, cellsAhead, allEnemyPanels, lowHp, lunge, spellStep } from '../../api';

type Cells = Array<[number, number]>;

// Spells' later steps (see spellStep): what lands after a delay, a telegraph or a flight.
const stepSlashHit = spellStep('step_slash.hit', x => {
  x.b.addFx('stepSlash', x.f.side, x.f.col + 2 * x.dir, x.f.row, 0.3);
  x.b.strike(x.f, cellsAhead(x, 2, 3), 700 * x.mult, { spell: true, element: 'steel' });
});
const lungeHit = spellStep('lunge.hit', x => { x.b.strike(x.f, cellsAhead(x, 1, 3), 900 * x.mult, { spell: true, element: 'steel' }); });
const leapStrikeHit = spellStep('leap_strike.hit', (x, { tc, tr, cells }: { tc: number; tr: number; cells: Cells }) => {
  x.b.addFx('leapSmash', x.f.side, tc, tr, 0.4);
  x.b.shake = 0.2;
  x.b.strike(x.f, cells, 1050 * x.mult, { spell: true, element: 'steel' });
});
const executeHit = spellStep('execute.hit', x => {
  x.b.addFx('execute', x.f.side, x.f.col + x.dir, x.f.row, 0.45);
  const dmg = (lowHp(x.foe, 0.3) ? 1800 : 900) * x.mult;
  x.b.strike(x.f, cellsAhead(x, 1, 2), dmg, { spell: true, element: 'steel' });
});
const chainHookHit = spellStep('chain_hook.hit', (x, _a, h: ShotHit) => {
  const { b } = x, t = h.t;
  if (h.w) { b.hitWall(h.w, 200, x.f, {}); return; }
  if (!t) return;
  const src = b.f[h.p.side];
  const res = b.damage(t, 180 * x.mult, src, { spell: true, element: 'steel' });
  if (res.blocked && !res.dealt) return;
  const front = b.frontCol(t.side), was = t.col;
  if (t.st.noKnock <= 0 && b.canStand(t, front, t.row)) { t.col = front; }
  // render-only: the bite and the yank, from where the foe was hooked (its box runs back toward the caster)
  b.addFx('chainHookHit', t.side, was, t.row, 0.45, { pull: Math.abs(was - t.col), reach: Math.abs(was - src.col) });
  b.stun(t, 2);
  b.gainRage(src, 1, true);
});
const shieldbreakerHit = spellStep('shieldbreaker.hit', x => {
  x.b.addFx('hammer', x.f.side, x.f.col + x.dir, x.f.row, 0.5);
  x.b.strike(x.f, cellsAhead(x, 1, 2), 550 * x.mult, { spell: true, breaks: true, element: 'steel' });
});
const groundSlamHit = spellStep('ground_slam.hit', (x, { col, cells }: { col: number; cells: Cells }) => {
  x.b.addFx('groundSlam', x.f.side, col, 1, 0.5);
  x.b.shake = 0.2;
  x.b.strike(x.f, cells, 550 * x.mult, { spell: true, element: 'steel' });
  for (let r = 0; r < 3; r++) x.b.panels[col][r].cracked = true;
});
const seismicHit = spellStep('seismic_wave.hit', (x, { cells }: { cells: Cells }) => {
  const { b, f } = x;
  for (const [c, rr] of cells) if (b.inGrid(c, rr)) b.addFx('seismic', f.side, c, rr, 0.4);
  b.strike(f, cells, 550 * x.mult, { spell: true, element: 'steel' });
});
const rampageHit = spellStep('rampage.hit', x => {
  const { b, f, foe } = x;
  b.addFx('rampage', f.side, foe.col, foe.row, 0.25);
  b.damage(foe, 440 * x.mult, f, { spell: true, element: 'steel', targeted: true });
});
const shatterHit = spellStep('ground_shatter.hit', (x, { col, cells }: { col: number; cells: Cells }) => {
  const { b, f, foe } = x;
  b.shake = 0.3;
  b.addFx('shatter', f.side, col, 1, 0.6);
  b.strike(f, cells, 1000 * x.mult, { spell: true, element: 'steel' });
  b.walls = b.walls.filter(w => w.col !== col);
  for (let r = 0; r < 3; r++) b.panels[col][r].hole = 4;
  if (foe.col === col) { if (!b.knockback(foe, 1)) b.relocate(foe); }
});
const mortalStrikeHit = spellStep('mortal_strike.hit', x => {
  x.b.addFx('mortal', x.f.side, x.f.col + x.dir, x.f.row, 0.45);
  const res = x.b.strike(x.f, cellsAhead(x, 1, 2), 1300 * x.mult, { spell: true, element: 'steel' });
  if (res.fighter) x.foe.st.mortal = 10;
});
const titansFallHit = spellStep('titans_fall.hit', (x, { cells }: { cells: Cells }) => {
  const { b, f } = x;
  b.shake = 0.5;
  b.cheer = 2;
  for (const [c, r] of cells) { b.addFx('titanFall', f.side, c, r, 0.5); b.panels[c][r].cracked = true; }
  b.strike(f, cells, 1250 * x.mult, { spell: true, element: 'steel' });
});

export const warrior: CardDef[] = [
  {
    id: 'step_slash', name: 'Step Slash', cls: 'warrior', cost: 1, rarity: 'common', element: 'steel', damaging: true, lock: 0.55,
    dmg: '700', short: 'Dash 2 panels forward, slash the panel ahead, snap back.',
    cast: x => {
      lunge(x, x.f.col + 2 * x.dir, x.f.row, 0.12, 0.2, 0.15);
      x.b.later(0.12, stepSlashHit(x));
    },
    ai: (b, f) => ahead(b, f, 3) && (b.foe(f).col - f.col) * b.dir(f) >= 2,
  },
  {
    id: 'guard', name: 'Guard', cls: 'warrior', cost: 0, rarity: 'common', element: 'steel', damaging: false, lock: 0.2,
    dmg: '-', short: 'For 2s, block the next hit completely. A block gives 1 Rage.',
    cast: x => { x.b.addShield(x.f, 'guard', 1, 2); x.b.addFx('guardUp', x.f.side, x.f.col, x.f.row, 0.35); },
    ai: (b, f, rand) => b.projectiles.some(p => p.side !== f.side && p.row === f.row) || b.foe(f).lock > 0 || rand() < 0.3,
  },
  {
    id: 'lunge', name: 'Lunge', cls: 'warrior', cost: 2, rarity: 'common', element: 'steel', damaging: true, lock: 0.45,
    dmg: '900', short: 'Piercing thrust hits 3 panels in a line ahead. You stay put.',
    cast: x => {
      x.b.addFx('thrust', x.f.side, x.f.col, x.f.row, 0.25, { len: 3 });
      x.b.later(0.1, lungeHit(x));
    },
    ai: (b, f) => ahead(b, f, 3),
  },
  {
    id: 'leap_strike', name: 'Leap Strike', cls: 'warrior', cost: 3, rarity: 'uncommon', element: 'steel', damaging: true, lock: 0.8,
    dmg: '1050', short: 'Leap in front of the enemy and smash their panel plus above and below.',
    cast: x => {
      const tc = x.foe.col, tr = x.foe.row, w = TUNING.warnTime;
      const cells: Array<[number, number]> = [[tc, tr - 1], [tc, tr], [tc, tr + 1]];
      lunge(x, tc - x.dir, tr, 0.3, w - 0.3 + 0.2, 0.25, 14);
      x.b.warn(x.f, cells, w, leapStrikeHit(x, { tc, tr, cells }));
    },
  },
  {
    id: 'iron_skin', name: 'Iron Skin', cls: 'warrior', cost: 0, rarity: 'common', element: 'steel', damaging: false, lock: 0.2,
    dmg: '-', short: 'Absorb the next 600 damage over 5s. Each absorbed hit gives 1 Rage (max 2).',
    cast: x => { x.b.addShield(x.f, 'ironSkin', 600, 5); x.b.addFx('ironSkin', x.f.side, x.f.col, x.f.row, 0.5); },
  },
  {
    id: 'shield_wall', name: 'Shield Wall', cls: 'warrior', cost: 0, rarity: 'common', element: 'steel', damaging: false, lock: 0.3,
    dmg: '-', short: 'Wall (800 HP) on the panel in front blocks shots in your row. Each block: 1 Rage.',
    cast: x => { if (x.b.placeWall(x.f, x.f.col + x.dir, x.f.row, 800, 'stone', 12)) x.b.addFx('wallRise', x.f.side, x.f.col + x.dir, x.f.row, 0.4); else x.b.text(x.f, 'BLOCKED', '#bcbcbc'); },
    ai: (b, f) => sameRow(b, f) && b.foe(f).cls === 'mage',
  },
  {
    id: 'execute', name: 'Execute', cls: 'warrior', cost: 3, rarity: 'common', element: 'steel', damaging: true, lock: 0.5,
    dmg: '900/1800', short: 'Heavy strike on the 2 panels ahead. Double damage below 30% HP.',
    cast: x => {
      x.b.later(0.18, executeHit(x));
    },
    ai: (b, f) => ahead(b, f, 2),
  },
  {
    id: 'chain_hook', name: 'Chain Hook', cls: 'warrior', cost: 1, rarity: 'common', element: 'steel', damaging: true, lock: 0.35,
    dmg: '180', short: 'Chain down your row. On hit: pull them to their front column, stun 2s, gain 1 Rage.',
    cast: x => {
      x.b.shoot(x.f, { speed: 12 * x.dir, kind: 'hook', reflectable: true, onHit: chainHookHit(x) });
    },
    ai: (b, f) => sameRow(b, f) && b.foe(f).col !== b.frontCol(b.foe(f).side),
  },
  {
    id: 'war_banner', name: 'War Banner', cls: 'warrior', cost: 2, rarity: 'uncommon', element: 'steel', damaging: true, lock: 0.4,
    dmg: '90', short: 'Steal the enemy front column for 5s. Anyone there is knocked back.',
    cast: x => {
      const { b, f, foe } = x;
      const col = b.frontCol(foe.side);
      if (col === b.backCol(foe.side)) { b.text(f, 'NO ROOM', '#bcbcbc'); return; }
      if (foe.col === col) {
        b.damage(foe, 90 * x.mult, f, { spell: true });
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
    dmg: '550/1100', short: 'Slow hammer on 2 panels ahead. Shatters shields and walls, double dmg on a break.',
    cast: x => {
      x.b.later(0.4, shieldbreakerHit(x));
    },
    ai: (b, f) => ahead(b, f, 2) || b.walls.some(w => w.side !== f.side && w.row === f.row && Math.abs(w.col - f.col) <= 2),
  },
  {
    id: 'battle_shout', name: 'Battle Shout', cls: 'warrior', cost: 1, rarity: 'common', element: 'steel', damaging: false, lock: 0.3,
    dmg: '-', short: 'Your next spell deals +50% damage.',
    cast: x => { x.f.shout = 1.5; x.b.addFx('battleShout', x.f.side, x.f.col, x.f.row, 0.5); },
  },
  {
    id: 'intimidating_roar', name: 'Intimidating Roar', cls: 'warrior', cost: 2, rarity: 'common', element: 'steel', damaging: false, lock: 0.4,
    dmg: '-', short: 'Enemy deals 30% less damage for 5s. Not a shield, so Break cannot remove it.',
    cast: x => { x.foe.st.roared = 5; x.b.addFx('roar', x.f.side, x.f.col, x.f.row, 0.6); x.b.text(x.foe, 'WEAKENED', '#bcbcbc'); },
  },
  {
    id: 'wide_cleave', name: 'Wide Cleave', cls: 'warrior', cost: 2, rarity: 'uncommon', element: 'steel', damaging: true, lock: 0.45,
    dmg: '800', short: 'Sweeping slash hits all 3 panels of the enemy front column.',
    cast: x => {
      const col = x.b.frontCol(x.foe.side);
      const cells: Array<[number, number]> = [[col, 0], [col, 1], [col, 2]];
      // BN WideSword: a sword swing lands instantly, no warning
      x.b.addFx('wide', x.f.side, col, 1, 0.35);
      x.b.strike(x.f, cells, 800 * x.mult, { spell: true, element: 'steel' });
    },
    ai: (b, f) => b.foe(f).col === b.frontCol(b.foe(f).side),
  },
  {
    id: 'ground_slam', name: 'Ground Slam', cls: 'warrior', cost: 2, rarity: 'uncommon', element: 'steel', damaging: true, lock: 0.45,
    dmg: '550', short: 'Shockwave hits the enemy front column and cracks those panels.',
    cast: x => {
      const col = x.b.frontCol(x.foe.side);
      const cells: Array<[number, number]> = [[col, 0], [col, 1], [col, 2]];
      x.b.warn(x.f, cells, TUNING.warnTime, groundSlamHit(x, { col, cells }));
    },
  },
  {
    id: 'seismic_wave', name: 'Seismic Wave', cls: 'warrior', cost: 3, rarity: 'uncommon', element: 'steel', damaging: true, lock: 0.5,
    dmg: '550 each', short: 'Quake rolls down your row and spreads into a cone of 6 enemy panels.',
    cast: x => {
      const { b, f, foe } = x;
      const r = f.row, front = b.frontCol(foe.side), d = x.dir;
      const waves: Array<Array<[number, number]>> = [[[front, r]], [[front + d, r - 1], [front + d, r], [front + d, r + 1]], [[front + 2 * d, r - 1], [front + 2 * d, r + 1]]];
      // the whole cone flashes first, then the quake rolls through it wave by wave
      waves.forEach((cells, i) => b.warn(f, cells, TUNING.warnTime + 0.1 * i, seismicHit(x, { cells })));
    },
  },
  {
    id: 'rampage', name: 'Rampage', cls: 'warrior', cost: 5, rarity: 'legendary', element: 'steel', damaging: true, lock: 1.3,
    dmg: '440x3', short: 'Charge the enemy wherever they are: 3 heavy slashes. Cannot be interrupted.',
    cast: x => {
      const { b, f, foe } = x;
      f.st.noKnock = 1.4;
      lunge(x, foe.col - x.dir, foe.row, 0.18, 0.85, 0.2);
      for (let i = 0; i < 3; i++) b.later(0.22 + i * 0.25, rampageHit(x));
    },
  },
  {
    id: 'unbreakable', name: 'Unbreakable', cls: 'warrior', cost: 2, rarity: 'legendary', element: 'steel', damaging: false, lock: 0.3,
    dmg: '-', short: 'Unbreakable barrier absorbs 1500 over 6s. When it ends: 1 Rage per hit (max 3).',
    cast: x => { x.b.addShield(x.f, 'unbreakable', 1500, 6); x.b.addFx('unbreakable', x.f.side, x.f.col, x.f.row, 0.6); },
  },
  {
    id: 'berserk', name: 'Berserk', cls: 'warrior', cost: 1, rarity: 'legendary', element: 'steel', damaging: false, lock: 0.3,
    dmg: '-', short: 'For 10s, basic attacks build double Rage and you cannot be knocked back.',
    cast: x => { x.f.st.berserk = 10; x.b.addFx('berserk', x.f.side, x.f.col, x.f.row, 0.6); },
  },
  {
    id: 'ground_shatter', name: 'Ground Shatter', cls: 'warrior', cost: 3, rarity: 'legendary', element: 'steel', damaging: true, lock: 0.5,
    dmg: '1000', short: 'Turn the enemy front column into holes for 4s. 1000 to anyone caught.',
    cast: x => {
      const { b, f, foe } = x;
      const col = b.frontCol(foe.side);
      if (col === b.backCol(foe.side)) { b.text(f, 'NO ROOM', '#bcbcbc'); return; }
      const cells: Array<[number, number]> = [[col, 0], [col, 1], [col, 2]];
      b.warn(f, cells, TUNING.warnTime, shatterHit(x, { col, cells }));
    },
  },
  {
    id: 'shield_slam', name: 'Shield Slam', cls: 'warrior', cost: 0, rarity: 'legendary', element: 'steel', damaging: true, lock: 0.45,
    dmg: '700', short: 'Bash 2 panels ahead: break shields, stun 2s. Gain 2 Rage on hit.',
    cast: x => {
      x.b.addFx('shieldSlam', x.f.side, x.f.col + x.dir, x.f.row, 0.35);
      const res = x.b.strike(x.f, cellsAhead(x, 1, 2), 700 * x.mult, { spell: true, breaks: true, stun: 2, element: 'steel' });
      if (res.fighter) x.b.gainRage(x.f, 2, true);
    },
    ai: (b, f) => ahead(b, f, 2),
  },
  {
    id: 'rallying_cry', name: 'Rallying Cry', cls: 'warrior', cost: 2, rarity: 'legendary', element: 'steel', damaging: false, lock: 0.4,
    dmg: '-', short: 'Heal 1500 HP. Your next 2 spells deal +30% damage.',
    cast: x => { x.b.heal(x.f, 1500); x.f.rallyLeft = 2; x.b.addFx('rally', x.f.side, x.f.col, x.f.row, 0.6); },
    ai: (_b, f) => f.maxHp - f.hp >= 1500,
  },
  {
    id: 'mortal_strike', name: 'Mortal Strike', cls: 'warrior', cost: 3, rarity: 'legendary', element: 'steel', damaging: true, lock: 0.5,
    dmg: '1300', short: 'Heavy hit on 2 panels ahead. Halves enemy healing for 10s.',
    cast: x => {
      x.b.later(0.15, mortalStrikeHit(x));
    },
    ai: (b, f) => ahead(b, f, 2),
  },
  {
    id: 'spell_reflection', name: 'Spell Reflection', cls: 'warrior', cost: 1, rarity: 'legendary', element: 'steel', damaging: false, lock: 0.2,
    dmg: 'theirs', short: 'For 6s, the next projectile spell that hits you bounces back at the caster.',
    cast: x => { x.f.st.reflect = 6; x.b.addFx('reflectUp', x.f.side, x.f.col, x.f.row, 0.4); },
    ai: (b, f) => b.foe(f).cls === 'mage' && sameRow(b, f),
  },
  // Mythics
  {
    id: 'avatar_of_war', name: 'Avatar of War', cls: 'warrior', cost: 5, rarity: 'mythic', element: 'steel', damaging: false, lock: 0.5,
    dmg: '-', short: 'Transform for 12s: spells cost no Rage, no knockback, Cleave hits twice.', costMod: { free: true },
    cast: x => { x.f.st.avatar = 12; x.b.cheer = 2; x.b.addFx('avatar', x.f.side, x.f.col, x.f.row, 0.8); },
  },
  {
    id: 'last_stand', name: 'Last Stand', cls: 'warrior', cost: 5, rarity: 'mythic', element: 'steel', damaging: true, lock: 0.4,
    dmg: '=absorbed', short: 'For 5s you cannot drop below 1 HP. Then a shockwave deals the damage you took.',
    cast: x => { x.f.st.lastStand = 5; x.f.lastStandAbsorbed = 0; x.b.addFx('lastStand', x.f.side, x.f.col, x.f.row, 0.8); },
    ai: (_b, f) => lowHp(f, 0.5),
  },
  {
    id: 'titans_fall', name: "Titan's Fall", cls: 'warrior', cost: 5, rarity: 'mythic', element: 'steel', damaging: true, lock: 1.1,
    dmg: '1250', short: 'Leap into the enemy area and smash all their panels, cracking them. Only blockable.',
    cast: x => {
      const { b, f, foe } = x;
      const mid = b.frontCol(foe.side) + x.dir;
      lunge(x, mid, 1, 0.45, 0.25, 0.3, 30);
      const cells = allEnemyPanels(b, f.side);
      b.warn(f, cells, 0.45, titansFallHit(x, { cells }));
    },
  },
];
