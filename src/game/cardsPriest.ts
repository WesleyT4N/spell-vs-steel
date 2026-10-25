// Priest kit (design doc Priest tab, 2026-10-25). Out-sustain and chip: blessed fields on your own panels, cursed
// fields on the enemy's, DoTs and auto-targeted holy damage. Fields, curses and the shield pool last until the next Draw.
import type { Battle, BlessKind, CastCtx, Fighter } from './battle';
import type { CardDef } from './cards';
import { allEnemyPanels, lowHp } from './cardUtil';

/** Run `fn` every `step` seconds for `secs` seconds. */
function overTime(b: Battle, secs: number, step: number, fn: (i: number) => void): void {
  for (let i = 1; i * step <= secs + 1e-6; i++) b.later(i * step, () => fn(i));
}

const hurt = (f: Fighter, amt: number): boolean => f.maxHp - f.hp >= amt;
const canPick = (b: Battle, f: Fighter): boolean => b.targetable(b.foe(f));

/** Holy or shadow damage on the enemy wherever they are. Misses a stealthed or untargetable enemy. */
function zap(x: CastCtx, dmg: number, element: 'holy' | 'shadow', noFlinch = false): boolean {
  const { b, f } = x, foe = b.foe(f);
  b.addFx(element === 'holy' ? 'holyPillar' : 'shadowHit', f.side, foe.col, foe.row, 0.35);
  return b.damage(foe, dmg * x.mult, f, { spell: true, element, targeted: true, noFlinch }).dealt > 0;
}

/** Bless panels of the caster's own area. */
function blessCells(x: CastCtx, cells: Array<[number, number]>, kind: BlessKind): void {
  for (const [c, r] of cells) {
    if (x.b.panel(c, r)?.owner !== x.f.side) continue;
    x.b.bless(c, r, kind);
    x.b.addFx('healBurst', x.f.side, c, r, 0.35);
  }
}

/** Curse panels of the enemy's area. */
function curseCells(x: CastCtx, cells: Array<[number, number]>): void {
  for (const [c, r] of cells) {
    if (!x.b.inGrid(c, r) || x.b.panels[c][r].owner === x.f.side) continue;
    x.b.curse(x.f.side, c, r);
    x.b.addFx('shadowHit', x.f.side, c, r, 0.35);
  }
}

const ownPanels = (b: Battle, f: Fighter): Array<[number, number]> => {
  const out: Array<[number, number]> = [];
  for (let c = 0; c < 6; c++) for (let r = 0; r < 3; r++) if (b.panels[c][r].owner === f.side) out.push([c, r]);
  return out;
};
const column = (f: Fighter): Array<[number, number]> => [[f.col, 0], [f.col, 1], [f.col, 2]];
const row = (f: Fighter): Array<[number, number]> => [[0, f.row], [1, f.row], [2, f.row], [3, f.row], [4, f.row], [5, f.row]];

export const priest: CardDef[] = [
  // Commons
  {
    id: 'prayer', name: 'Prayer', cls: 'priest', cost: 0, rarity: 'common', element: 'holy', damaging: false, lock: 0.2,
    dmg: '-', short: 'Gain 1 Mana now and heal 20.', gain: { res: 1 },
    cast: x => { x.b.gainRes(x.f, 1); x.b.heal(x.f, 20); },
  },
  {
    id: 'flash_heal', name: 'Flash Heal', cls: 'priest', cost: 1, rarity: 'common', element: 'holy', damaging: false, lock: 0.25,
    dmg: '-', short: 'Heal 40 instantly.',
    cast: x => { x.b.addFx('healBurst', x.f.side, x.f.col, x.f.row, 0.4); x.b.heal(x.f, 40); },
    ai: (_b, f) => hurt(f, 40),
  },
  {
    id: 'holy_fire', name: 'Holy Fire', cls: 'priest', cost: 2, rarity: 'common', element: 'holy', damaging: true, lock: 0.3,
    dmg: '50', short: 'Instant holy flame on the enemy wherever they are.',
    cast: x => { zap(x, 50, 'holy'); },
    ai: canPick,
  },
  {
    id: 'penance', name: 'Penance', cls: 'priest', cost: 2, rarity: 'common', element: 'holy', damaging: true, lock: 0.45,
    dmg: '25x3', short: 'Three holy bolts that hit the enemy wherever they are.',
    cast: x => { for (let i = 0; i < 3; i++) x.b.later(i * 0.15, () => { zap(x, 25, 'holy', i < 2); }); },
    ai: canPick,
  },
  {
    id: 'power_word_shield', name: 'Power Word: Shield', cls: 'priest', cost: 1, rarity: 'common', element: 'holy', damaging: false, lock: 0.2,
    dmg: '-', short: 'Shield absorbs 60 damage for 6s. Holy shields share one pool (max 100).',
    cast: x => x.b.addHolyShield(x.f, 60, 6),
  },
  {
    id: 'hallowed_ground', name: 'Hallowed Ground', cls: 'priest', cost: 1, rarity: 'common', element: 'holy', damaging: false, lock: 0.2,
    dmg: '+35%', short: 'Bless the panel you are on until the Draw. Deal +35% damage while on it.',
    cast: x => blessCells(x, [[x.f.col, x.f.row]], 'power'),
  },
  {
    id: 'sanctuary', name: 'Sanctuary', cls: 'priest', cost: 2, rarity: 'common', element: 'holy', damaging: false, lock: 0.3,
    dmg: '12 HP/s', short: 'Bless your column until the Draw. Heal 12 per second while on it.',
    cast: x => blessCells(x, column(x.f), 'heal'),
  },
  {
    id: 'shadow_word_pain', name: 'Shadow Word: Pain', cls: 'priest', cost: 1, rarity: 'common', element: 'shadow', damaging: true, lock: 0.2,
    dmg: '8/s 8s', short: 'Shadow damage over time on the enemy wherever they are: 8 per second for 8s.',
    cast: x => { x.b.addDot(x.foe, x.f, 'shadow_word_pain', 8 * x.mult, 8); },
    ai: (b, f) => canPick(b, f) && !b.foe(f).dots.some(d => d.id === 'shadow_word_pain'),
  },
  {
    id: 'devouring_plague', name: 'Devouring Plague', cls: 'priest', cost: 2, rarity: 'common', element: 'shadow', damaging: true, lock: 0.25,
    dmg: '12/s 5s', short: '12 per second for 5s wherever they are. Lasts twice as long on a cursed panel.',
    cast: x => { x.b.addDot(x.foe, x.f, 'devouring_plague', 12 * x.mult, 5); },
    ai: (b, f) => canPick(b, f) && !b.foe(f).dots.some(d => d.id === 'devouring_plague'),
  },
  {
    id: 'desecrate', name: 'Desecrate', cls: 'priest', cost: 2, rarity: 'common', element: 'shadow', damaging: true, lock: 0.3,
    dmg: '10/s', short: 'Curse 3 random enemy panels until the Draw: 10 per second and Weakened on them.',
    cast: x => {
      const free = allEnemyPanels(x.b, x.f.side).filter(([c, r]) => x.b.panels[c][r].curse <= 0);
      const picks: Array<[number, number]> = [];
      while (picks.length < 3 && free.length) picks.push(free.splice(Math.floor(x.b.rand() * free.length), 1)[0]);
      curseCells(x, picks);
    },
  },
  // Uncommons
  {
    id: 'wellspring', name: 'Wellspring', cls: 'priest', cost: 1, rarity: 'uncommon', element: 'holy', damaging: false, lock: 0.2,
    dmg: '+1 Mana/2s', short: 'Bless your row until the Draw. Gain 1 Mana every 2s while on it.',
    cast: x => blessCells(x, row(x.f), 'mana'),
  },
  {
    id: 'holy_nova', name: 'Holy Nova', cls: 'priest', cost: 2, rarity: 'uncommon', element: 'holy', damaging: true, lock: 0.35,
    dmg: '40', short: 'Light bursts on every panel around you, enemy panel in front included. Knockback.',
    cast: x => {
      const { b, f } = x;
      const cells: Array<[number, number]> = [];
      for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) if ((dc || dr) && b.inGrid(f.col + dc, f.row + dr)) cells.push([f.col + dc, f.row + dr]);
      b.addFx('holyNova', f.side, f.col, f.row, 0.45);
      b.strike(f, cells, 40 * x.mult, { spell: true, element: 'holy', knockback: true });
    },
    ai: (b, f) => Math.abs(b.foe(f).col - f.col) <= 1 && Math.abs(b.foe(f).row - f.row) <= 1,
  },
  {
    id: 'holy_wall', name: 'Holy Wall', cls: 'priest', cost: 2, rarity: 'uncommon', element: 'holy', damaging: false, lock: 0.3,
    dmg: '-', short: 'Wall of light (100 HP) in front of you blocks shots in your row for 6s.',
    cast: x => { if (!x.b.placeWall(x.f, x.f.col + x.dir, x.f.row, 100, 'holy', 6)) x.b.text(x.f, 'BLOCKED', '#bcbcbc'); },
    ai: (b, f) => b.foe(f).row === f.row,
  },
  {
    id: 'hex', name: 'Hex', cls: 'priest', cost: 2, rarity: 'uncommon', element: 'shadow', damaging: true, lock: 0.3,
    dmg: '20', short: 'Hits the enemy wherever they are and Weakens them (-25% damage) for 6s.',
    cast: x => { if (zap(x, 20, 'shadow')) { x.foe.st.weakened = Math.max(x.foe.st.weakened, 6); x.b.text(x.foe, 'WEAKENED', '#9878f8'); } },
    ai: canPick,
  },
  {
    id: 'mind_sear', name: 'Mind Sear', cls: 'priest', cost: 3, rarity: 'uncommon', element: 'shadow', damaging: true, lock: 0.3,
    dmg: '10/s', short: 'Curse the whole row the enemy is in (their 3 panels) until the Draw.',
    cast: x => curseCells(x, row(x.foe)),
  },
  // Legendaries
  {
    id: 'divine_hymn', name: 'Divine Hymn', cls: 'priest', cost: 5, rarity: 'legendary', element: 'holy', damaging: false, lock: 0.2,
    dmg: '300 heal', short: 'Channel for 3s (no moving or attacking, cannot be knocked back). Heal 100 per second.',
    cast: x => {
      x.f.st.channel = 3; x.f.st.noKnock = 3;
      overTime(x.b, 3, 0.5, () => { x.b.heal(x.f, 50); x.b.addFx('healBurst', x.f.side, x.f.col, x.f.row, 0.4); });
    },
    ai: (_b, f) => hurt(f, 250),
  },
  {
    id: 'void_rift', name: 'Void Rift', cls: 'priest', cost: 3, rarity: 'legendary', element: 'shadow', damaging: true, lock: 0.3,
    dmg: '10/s', short: "Curse the enemy's panel and the 4 around it until the Draw.",
    cast: x => { const { col: c, row: r } = x.foe; curseCells(x, [[c, r], [c - 1, r], [c + 1, r], [c, r - 1], [c, r + 1]]); },
  },
  {
    id: 'power_infusion', name: 'Power Infusion', cls: 'priest', cost: 3, rarity: 'legendary', element: 'holy', damaging: false, lock: 0.2,
    dmg: '-', short: 'For 8s, every spell costs 1 less Mana.',
    cast: x => { x.f.st.powerInfusion = 8; x.b.addFx('transform', x.f.side, x.f.col, x.f.row, 0.6); },
  },
  {
    id: 'aegis_field', name: 'Aegis Field', cls: 'priest', cost: 3, rarity: 'legendary', element: 'holy', damaging: false, lock: 0.3,
    dmg: '15/s shield', short: 'Bless your column until the Draw. Gain 15 shield per second on it (pool max 100).',
    cast: x => blessCells(x, column(x.f), 'shield'),
  },
  {
    id: 'sacred_ground', name: 'Sacred Ground', cls: 'priest', cost: 3, rarity: 'legendary', element: 'holy', damaging: false, lock: 0.3,
    dmg: '12 HP/s', short: 'Bless every panel of your area until the Draw. Heal 12 per second on them.',
    cast: x => blessCells(x, ownPanels(x.b, x.f), 'heal'),
  },
  {
    id: 'psychic_scream', name: 'Psychic Scream', cls: 'priest', cost: 3, rarity: 'legendary', element: 'shadow', damaging: true, lock: 0.3,
    dmg: '20', short: 'Knock the enemy to their back column and stun them for 1.5s.',
    cast: x => {
      const { b, f, foe } = x;
      if (!b.targetable(foe)) { b.text(foe, 'MISS', '#bcbcbc'); return; }
      b.addFx('shout', f.side, f.col, f.row, 0.5);
      b.knockback(foe, 3);
      b.damage(foe, 20 * x.mult, f, { spell: true, element: 'shadow', stun: 1.5 });
    },
    ai: (b, f) => canPick(b, f) && Math.abs(b.foe(f).col - f.col) <= 2,
  },
  {
    id: 'shadow_word_death', name: 'Shadow Word: Death', cls: 'priest', cost: 4, rarity: 'legendary', element: 'shadow', damaging: true, lock: 0.3,
    dmg: '60/180', short: 'Shadow damage wherever the enemy is: 60, or 180 if they are under 25% HP.',
    cast: x => { zap(x, lowHp(x.foe, 0.25) ? 180 : 60, 'shadow'); },
    ai: (b, f) => canPick(b, f) && lowHp(b.foe(f), 0.25),
  },
  {
    id: 'halo', name: 'Halo', cls: 'priest', cost: 4, rarity: 'legendary', element: 'holy', damaging: true, lock: 0.25,
    dmg: '15x8', short: 'A ring of light circles you for 8s, firing a bolt at the enemy every second.',
    cast: x => { x.f.st.halo = 8; overTime(x.b, 8, 1, () => { if (!x.f.dead) zap(x, 15, 'holy', true); }); },
  },
  // Mythics
  {
    id: 'wrath_of_heaven', name: 'Wrath of Heaven', cls: 'priest', cost: 5, rarity: 'mythic', element: 'holy', damaging: true, lock: 0.4,
    dmg: '80 each', short: 'After 1.5s, pillars of light hit all 9 enemy panels.',
    cast: x => {
      const { b, f } = x;
      const cells = allEnemyPanels(b, f.side);
      for (const [c, r] of cells) b.mark(c, r, 1.5, '#f8d878');
      b.later(1.5, () => {
        b.shake = 0.4; b.cheer = 2;
        for (const [c, r] of cells) b.addFx('holyPillar', f.side, c, r, 0.45);
        b.strike(f, cells, 80 * x.mult, { spell: true, element: 'holy' });
      });
    },
  },
  {
    id: 'holy_sanctum', name: 'Holy Sanctum', cls: 'priest', cost: 5, rarity: 'mythic', element: 'holy', damaging: false, lock: 0.4,
    dmg: '-', short: 'Every panel of your area gets all four blessings (heal, Mana, shield, damage) for the round.',
    cast: x => { x.b.cheer = 2; x.b.addFx('transform', x.f.side, x.f.col, x.f.row, 0.8); blessCells(x, ownPanels(x.b, x.f), 'all'); },
  },
  {
    id: 'shadowform', name: 'Shadowform', cls: 'priest', cost: 5, rarity: 'mythic', element: 'shadow', damaging: true, lock: 0.4,
    dmg: '10/s, DoTs x2', short: 'Curse every enemy panel for the round. Your DoTs tick twice as fast.',
    cast: x => {
      x.b.cheer = 2; x.f.st.shadowform = 999;
      x.b.addFx('transform', x.f.side, x.f.col, x.f.row, 0.8);
      curseCells(x, allEnemyPanels(x.b, x.f.side));
    },
  },
];
