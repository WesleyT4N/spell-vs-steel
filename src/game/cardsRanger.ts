// Ranger draft kit (class-drafts page, 2026-10-25). Arrows, hidden traps and companions; Energy comes from standing still.
import type { Battle, CastCtx, Fighter, Trap } from './battle';
import type { CardDef } from './cards';
import { sfx } from '../engine/audio';
import { shuffle } from './rng';
import { allEnemyPanels, sameRow } from './cardUtil';

/** Hide a trap on a panel. It arms after 1s and only its owner can see it. */
function trap(b: Battle, f: Fighter, col: number, row: number, kind: Trap['kind'], t = 12): void {
  if (!b.inGrid(col, row)) return;
  b.traps = b.traps.filter(x => !(x.col === col && x.row === row));
  b.traps.push({ side: f.side, col, row, arm: 1, t, kind });
}

/** An arrow-type projectile down the caster's row. */
function arrow(x: CastCtx, kind: 'arrow' | 'net' | 'wolf' | 'sting', speed: number, onFoe: (b: Battle, t: Fighter) => void, wallDmg = 20): void {
  x.b.shoot(x.f, {
    speed: speed * x.dir, kind, reflectable: true,
    onHit: (b, t, w) => {
      if (w) { b.hitWall(w, wallDmg, x.f, {}); return; }
      if (t) onFoe(b, t);
    },
  });
}

const enemyNear = (b: Battle, f: Fighter, n: number): boolean => Math.abs(b.foe(f).col - f.col) <= n;

export const ranger: CardDef[] = [
  {
    id: 'steady_focus', name: 'Steady Focus', cls: 'ranger', cost: 0, rarity: 'common', element: 'nature', damaging: false, lock: 0.2,
    dmg: '-', short: 'Root yourself for 1.5s. +2 Energy.', gain: { res: 2 },
    cast: x => { x.f.st.rooted = 1.5; x.b.gainRes(x.f, 2); x.b.text(x.f, '+2 ENERGY', '#f8d878'); },
  },
  {
    id: 'hawk_strike', name: 'Hawk Strike', cls: 'ranger', cost: 1, rarity: 'common', element: 'nature', damaging: true, lock: 0.3,
    dmg: '40', short: 'A hawk dives on the enemy wherever they are.',
    cast: x => {
      x.b.projectiles.push({
        side: x.f.side, row: x.f.row, x: x.f.col, speed: 0, kind: 'hawk', reflectable: false,
        homing: { p: 0, dur: 0.5, sx: x.f.col, sy: x.f.row, target: x.foe.side },
        onHit: (b, t) => { if (t) b.damage(t, 40 * x.mult, b.f[1 - t.side], { spell: true, element: 'nature' }); },
      });
      sfx('missile');
    },
  },
  {
    id: 'hunters_mark', name: "Hunter's Mark", cls: 'ranger', cost: 1, rarity: 'common', element: 'nature', damaging: false, lock: 0.2,
    dmg: '-', short: 'For 6s the enemy takes +25% damage from you and cannot enter Stealth.',
    cast: x => {
      // a mark finds a stealthed target: it is how the Ranger hunts Rogues
      x.foe.st.hunted = 6; x.foe.st.stealth = 0;
      x.b.text(x.foe, 'HUNTED', '#f83800');
    },
  },
  {
    id: 'net', name: 'Net', cls: 'ranger', cost: 1, rarity: 'common', element: 'nature', damaging: true, lock: 0.3,
    dmg: '10', short: 'Net down your row. Roots the enemy for 2s: no moving, can still attack.',
    cast: x => arrow(x, 'net', 12, (b, t) => { b.damage(t, 10 * x.mult, x.f, { spell: true, element: 'nature' }); b.root(t, 2); }),
    ai: (b, f) => sameRow(b, f),
  },
  {
    id: 'disengage', name: 'Disengage', cls: 'ranger', cost: 1, rarity: 'common', element: 'nature', damaging: true, lock: 0.3,
    dmg: '20', short: 'Backflip to your back column. An enemy within 2 panels is knocked back.',
    cast: x => {
      const { b, f, foe } = x;
      if (Math.abs(foe.col - f.col) <= 2) { b.damage(foe, 20 * x.mult, f, { spell: true, element: 'nature' }); b.knockback(foe, 1); }
      const back = b.backCol(f.side);
      if (b.canStand(f, back, f.row)) { b.addFx('smoke', f.side, f.col, f.row, 0.3); f.col = back; }
    },
    ai: (b, f) => enemyNear(b, f, 2),
  },
  {
    id: 'freezing_trap', name: 'Freezing Trap', cls: 'ranger', cost: 1, rarity: 'common', element: 'frost', damaging: true, lock: 0.25,
    dmg: '20', short: "Hidden trap on the enemy's panel. Arms in 1s, freezes for 1.5s.",
    cast: x => trap(x.b, x.f, x.foe.col, x.foe.row, 'freeze'),
  },
  {
    id: 'explosive_trap', name: 'Explosive Trap', cls: 'ranger', cost: 2, rarity: 'common', element: 'fire', damaging: true, lock: 0.25,
    dmg: '90', short: "Hidden trap on the enemy's panel. Blasts it and the 4 panels around it.",
    cast: x => trap(x.b, x.f, x.foe.col, x.foe.row, 'explode'),
  },
  {
    id: 'multi_shot', name: 'Multi-Shot', cls: 'ranger', cost: 2, rarity: 'common', element: 'steel', damaging: true, lock: 0.35,
    dmg: '50', short: 'Three arrows, one down each row.',
    cast: x => {
      const { b, f } = x;
      const row = f.row;
      for (let r = 0; r < 3; r++) {
        f.row = r;
        const end = b.rowShot(f, 50 * x.mult, { spell: true, element: 'steel' });
        b.addFx('arrow', f.side, f.col, r, 0.25, { to: end.col });
      }
      f.row = row;
    },
  },
  {
    id: 'call_wolf', name: 'Call Wolf', cls: 'ranger', cost: 2, rarity: 'common', element: 'nature', damaging: true, lock: 0.3,
    dmg: '25x3', short: 'A wolf runs down your row and bites the first enemy 3 times.',
    cast: x => arrow(x, 'wolf', 7, (b, t) => {
      for (let i = 0; i < 3; i++) b.later(i * 0.25, () => {
        b.addFx('bite', x.f.side, t.col, t.row, 0.25);
        b.damage(t, 25 * x.mult, x.f, { spell: true, element: 'nature', noFlinch: i < 2 });
      });
    }, 40),
    ai: (b, f) => sameRow(b, f),
  },
  {
    id: 'power_shot', name: 'Power Shot', cls: 'ranger', cost: 3, rarity: 'common', element: 'steel', damaging: true, lock: 0.45,
    dmg: '120', short: 'Piercing arrow down your row: through walls and barriers, knocks to their back column.',
    cast: x => {
      const end = x.b.rowShot(x.f, 120 * x.mult, { spell: true, element: 'steel', pierce: true }, true);
      x.b.addFx('aimed', x.f.side, x.f.col, x.f.row, 0.35, { to: end.col });
      if (end.hit) x.b.knockback(x.foe, 3);
      x.b.shake = 0.15;
    },
    ai: (b, f) => sameRow(b, f),
  },
  {
    id: 'tripwire', name: 'Tripwire', cls: 'ranger', cost: 1, rarity: 'uncommon', element: 'nature', damaging: true, lock: 0.2,
    dmg: '40', short: 'For 10s, the first enemy that blinks or dashes into your area is revealed and stunned 1s.',
    cast: x => { x.f.st.tripwire = 10; },
    ai: (b, f) => b.foe(f).cls === 'rogue' || b.foe(f).cls === 'warrior',
  },
  {
    id: 'flare', name: 'Flare', cls: 'ranger', cost: 1, rarity: 'uncommon', element: 'fire', damaging: true, lock: 0.25,
    dmg: '30', short: 'Lights up the enemy area for 6s: breaks Stealth and stops it.',
    cast: x => {
      const { b, f, foe } = x;
      for (const [c, r] of allEnemyPanels(b, f.side)) b.addFx('flare', f.side, c, r, 0.5);
      foe.st.stealth = 0; foe.st.revealed = 6;
      b.damage(foe, 30 * x.mult, f, { spell: true, element: 'fire' });
    },
    ai: (b, f) => b.foe(f).st.stealth > 0 || b.foe(f).cls === 'rogue',
  },
  {
    id: 'camouflage', name: 'Camouflage', cls: 'ranger', cost: 2, rarity: 'uncommon', element: 'nature', damaging: false, lock: 0.2,
    dmg: '-', short: 'Stealth for up to 6s while you stand still. Attacking is fine; moving ends it.',
    cast: x => { x.b.stealth(x.f, 6); if (x.f.st.stealth > 0) x.f.st.camo = 6; },
  },
  {
    id: 'volley', name: 'Volley', cls: 'ranger', cost: 3, rarity: 'uncommon', element: 'steel', damaging: true, lock: 0.35,
    dmg: '50', short: 'After a 1s telegraph, arrows rain on the enemy middle and back columns.',
    cast: x => {
      const { b, f } = x;
      const front = b.frontCol(x.foe.side);
      const cells: Array<[number, number]> = [];
      for (const c of [front + x.dir, front + 2 * x.dir]) for (let r = 0; r < 3; r++) if (b.inGrid(c, r)) cells.push([c, r]);
      for (const [c, r] of cells) b.mark(c, r, 1, '#fcfcfc');
      b.later(1, () => {
        for (const [c, r] of cells) b.addFx('arrowRain', f.side, c, r, 0.35);
        b.strike(f, cells, 50 * x.mult, { spell: true, element: 'steel' });
      });
    },
    ai: (b, f) => b.foe(f).col !== b.frontCol(b.foe(f).side),
  },
  {
    id: 'spirit_bear', name: 'Spirit Bear', cls: 'ranger', cost: 3, rarity: 'uncommon', element: 'nature', damaging: true, lock: 0.3,
    dmg: '40/swipe', short: 'A bear (120 HP) stands in front of you for 6s, blocks shots, swipes the enemy in its row.',
    cast: x => {
      const { b, f } = x;
      const c = f.col + x.dir, r = f.row;
      if (!b.placeWall(f, c, r, 120, 'bear', 6)) { b.text(f, 'BLOCKED', '#bcbcbc'); return; }
      b.pets.push({ side: f.side, kind: 'bear', row: r, col: c, t: 6, cd: 0.6, period: 1, dmg: 40 * x.mult });
    },
  },
  // Legendaries
  {
    id: 'kill_shot', name: 'Kill Shot', cls: 'ranger', cost: 5, rarity: 'legendary', element: 'steel', damaging: true, lock: 1.1,
    dmg: '220', short: 'A laser locks on for 1s, then the arrow hits the enemy wherever they are. Ignores barriers.',
    cast: x => {
      const { b, f, foe } = x;
      b.addFx('laser', f.side, f.col, f.row, 1);
      b.later(1, () => {
        b.addFx('aimed', f.side, f.col, f.row, 0.35, { to: foe.col, toRow: foe.row });
        b.shake = 0.3;
        b.damage(foe, 220 * x.mult, f, { spell: true, element: 'steel', targeted: true, pierce: true });
      });
    },
  },
  {
    id: 'barrage', name: 'Barrage', cls: 'ranger', cost: 4, rarity: 'legendary', element: 'steel', damaging: true, lock: 0.4,
    dmg: '30 each', short: '12 arrows fall on random enemy panels over 3s.',
    cast: x => {
      const { b, f, foe } = x;
      // like Blizzard: some arrows aim at the enemy's panel, each telegraphs 0.4s
      for (let i = 0; i < 12; i++) b.later(i * 0.25, () => {
        const cells = allEnemyPanels(b, f.side);
        const [c, r] = b.rand() < 0.35 ? [foe.col, foe.row] : cells[Math.floor(b.rand() * cells.length)];
        b.mark(c, r, 0.4, '#fcfcfc');
        b.later(0.4, () => {
          b.addFx('arrowRain', f.side, c, r, 0.3);
          b.strike(f, [[c, r]], 30 * x.mult, { spell: true, element: 'steel', noFlinch: true });
        });
      });
    },
  },
  {
    id: 'explosive_shot', name: 'Explosive Shot', cls: 'ranger', cost: 3, rarity: 'legendary', element: 'fire', damaging: true, lock: 0.35,
    dmg: '40+120', short: 'Arrow down your row sticks to the enemy and explodes 2s later on them and around them.',
    cast: x => arrow(x, 'arrow', 16, (b, t) => {
      if (b.damage(t, 40 * x.mult, x.f, { spell: true, element: 'fire' }).dealt <= 0) return;
      b.text(t, 'STUCK', '#f87800');
      b.later(2, () => {
        const cells: Array<[number, number]> = [[t.col, t.row], [t.col - 1, t.row], [t.col + 1, t.row], [t.col, t.row - 1], [t.col, t.row + 1]];
        sfx('explode');
        b.shake = 0.25;
        for (const [c, r] of cells) if (b.inGrid(c, r)) b.addFx('explode', x.f.side, c, r, 0.4);
        b.strike(x.f, cells, 120 * x.mult, { spell: true, element: 'fire' });
      });
    }),
    ai: (b, f) => sameRow(b, f),
  },
  {
    id: 'snipers_nest', name: "Sniper's Nest", cls: 'ranger', cost: 3, rarity: 'legendary', element: 'steel', damaging: false, lock: 0.2,
    dmg: '-', short: 'For 8s you cannot move, gain 1 Energy per second, and Aimed Shot charges instantly.',
    cast: x => { x.f.st.nest = 8; x.b.addFx('shout', x.f.side, x.f.col, x.f.row, 0.5); },
  },
  {
    id: 'wyvern_sting', name: 'Wyvern Sting', cls: 'ranger', cost: 2, rarity: 'legendary', element: 'poison', damaging: false, lock: 0.3,
    dmg: '-', short: 'Arrow down your row puts the enemy to sleep for 3s. Any damage wakes them (+50%).',
    cast: x => arrow(x, 'sting', 16, (b, t) => b.sleep(t, 3)),
    ai: (b, f) => sameRow(b, f),
  },
  {
    id: 'minefield', name: 'Minefield', cls: 'ranger', cost: 3, rarity: 'legendary', element: 'nature', damaging: true, lock: 0.3,
    dmg: '50 each', short: '4 hidden traps on random enemy panels for 12s. Each knocks back.',
    cast: x => {
      const { b, f, foe } = x;
      const cells = shuffle(allEnemyPanels(b, f.side).filter(([c, r]) => !(c === foe.col && r === foe.row)), b.rand).slice(0, 4);
      for (const [c, r] of cells) trap(b, f, c, r, 'mine');
    },
  },
  {
    id: 'bestial_wrath', name: 'Bestial Wrath', cls: 'ranger', cost: 3, rarity: 'legendary', element: 'nature', damaging: true, lock: 0.3,
    dmg: '25/30', short: 'For 6s a hawk dives every second and a wolf bites whenever the enemy is in your row.',
    cast: x => {
      const { b, f } = x;
      b.pets.push({ side: f.side, kind: 'hawk', row: null, col: b.backCol(f.side), t: 6, cd: 0.5, period: 1, dmg: 25 * x.mult });
      b.pets.push({ side: f.side, kind: 'wolf', row: null, col: b.backCol(f.side), t: 6, cd: 0.3, period: 1, dmg: 30 * x.mult });
    },
  },
  {
    id: 'feign_death', name: 'Feign Death', cls: 'ranger', cost: 1, rarity: 'legendary', element: 'nature', damaging: false, lock: 0.3,
    dmg: '-', short: 'Untargetable for 2s; homing shots in flight fizzle. +2 Energy.', gain: { res: 2 },
    cast: x => {
      x.f.st.untargetable = 2;
      x.b.projectiles = x.b.projectiles.filter(p => !(p.homing && p.homing.target === x.f.side));
      x.b.gainRes(x.f, 2);
    },
    ai: (b, f) => b.marks.some(m => m.col === f.col && m.row === f.row) || b.projectiles.some(p => p.side !== f.side),
  },
  // Mythics
  {
    id: 'deadeye', name: 'Deadeye', cls: 'ranger', cost: 5, rarity: 'mythic', element: 'steel', damaging: false, lock: 0.3,
    dmg: '-', short: 'For 8s Aimed Shot charges instantly and pierces, and light arrows deal triple damage.',
    cast: x => { x.f.st.deadeye = 8; x.b.cheer = 2; x.b.addFx('transform', x.f.side, x.f.col, x.f.row, 0.8); },
  },
  {
    id: 'hunters_domain', name: "Hunter's Domain", cls: 'ranger', cost: 5, rarity: 'mythic', element: 'nature', damaging: true, lock: 0.4,
    dmg: '60/freeze', short: 'Hidden traps on every enemy panel but theirs for 10s: freezing traps and 60 blasts.',
    cast: x => {
      const { b, f, foe } = x;
      allEnemyPanels(b, f.side).filter(([c, r]) => !(c === foe.col && r === foe.row))
        .forEach(([c, r], i) => trap(b, f, c, r, i % 2 ? 'freeze' : 'blast', 10));
      b.cheer = 2;
    },
  },
  {
    id: 'call_of_the_wild', name: 'Call of the Wild', cls: 'ranger', cost: 5, rarity: 'mythic', element: 'nature', damaging: true, lock: 0.4,
    dmg: '30/bite', short: 'Three wolves for 10s, one per row. Each bites when the enemy is in its row.',
    cast: x => {
      const { b, f } = x;
      for (let r = 0; r < 3; r++) b.pets.push({ side: f.side, kind: 'wolf', row: r, col: b.backCol(f.side), t: 10, cd: 0.3 + r * 0.2, period: 1, dmg: 30 * x.mult });
      b.cheer = 2;
    },
  },
];
