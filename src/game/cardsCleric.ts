// Cleric draft kit (class-drafts page, 2026-10-25). Heals, holy shields and blessed panels; Mana +3 per Draw, carries over.
import type { Battle, CastCtx, Fighter } from './battle';
import { BUFF_KEYS } from './battle';
import type { CardDef } from './cards';
import { sfx } from '../engine/audio';
import { allEnemyPanels, lowHp, sameRow } from './cardUtil';
import { TUNING } from './tuning';

/** Run `fn` every `step` seconds for `secs` seconds. */
function overTime(b: Battle, secs: number, step: number, fn: (i: number) => void): void {
  for (let i = 1; i * step <= secs + 1e-6; i++) b.later(i * step, () => fn(i));
}

const hurt = (f: Fighter, amt: number): boolean => f.maxHp - f.hp >= amt;

/** Holy damage on the enemy wherever they are, healing the caster on a hit. */
function smite(x: CastCtx, dmg: number, healOnHit: number, targeted = true): boolean {
  x.b.addFx('holyPillar', x.f.side, x.foe.col, x.foe.row, 0.35);
  const hit = x.b.damage(x.foe, dmg * x.mult, x.f, { spell: true, element: 'holy', targeted }).dealt > 0;
  if (hit && healOnHit) x.b.heal(x.f, healOnHit);
  return hit;
}

export const cleric: CardDef[] = [
  {
    id: 'prayer', name: 'Prayer', cls: 'cleric', cost: 0, rarity: 'common', element: 'holy', damaging: false, lock: 0.2,
    dmg: '-', short: 'Gain 1 Mana now and heal 20.', gain: { res: 1 },
    cast: x => { x.b.gainRes(x.f, 1); x.b.heal(x.f, 20); },
  },
  {
    id: 'flash_heal', name: 'Flash Heal', cls: 'cleric', cost: 1, rarity: 'common', element: 'holy', damaging: false, lock: 0.25,
    dmg: '-', short: 'Heal 60 instantly.',
    cast: x => { x.b.addFx('healBurst', x.f.side, x.f.col, x.f.row, 0.4); x.b.heal(x.f, 60); },
    ai: (_b, f) => hurt(f, 60),
  },
  {
    id: 'renew', name: 'Renew', cls: 'cleric', cost: 1, rarity: 'common', element: 'holy', damaging: false, lock: 0.2,
    dmg: '-', short: 'Heal 15 per second for 6s.',
    cast: x => overTime(x.b, 6, 1, () => x.b.heal(x.f, 15)),
    ai: (_b, f) => hurt(f, 60),
  },
  {
    id: 'power_word_shield', name: 'Power Word: Shield', cls: 'cleric', cost: 1, rarity: 'common', element: 'holy', damaging: false, lock: 0.2,
    dmg: '-', short: 'Barrier absorbs 70 damage for 6s.',
    cast: x => x.b.addShield(x.f, 'holy', 70, 6),
  },
  {
    id: 'purify', name: 'Purify', cls: 'cleric', cost: 1, rarity: 'common', element: 'holy', damaging: false, lock: 0.2,
    dmg: '-', short: 'Remove Poison, burning and marks from yourself. Immune to new debuffs for 3s.',
    cast: x => { x.b.cleanse(x.f); x.f.st.purified = 3; },
    ai: (b, f) => f.poison > 0 || f.st.mortal > 0 || f.st.hunted > 0 || b.panels[f.col][f.row].burn > 0,
  },
  {
    id: 'sanctuary', name: 'Sanctuary', cls: 'cleric', cost: 2, rarity: 'common', element: 'holy', damaging: false, lock: 0.3,
    dmg: '12 HP/s', short: 'Bless your whole column for 8s. Standing on a blessed panel heals 12 per second.',
    cast: x => { for (let r = 0; r < 3; r++) x.b.bless(x.f.col, r, 8); },
    ai: (_b, f) => hurt(f, 40),
  },
  {
    id: 'holy_fire', name: 'Holy Fire', cls: 'cleric', cost: 2, rarity: 'common', element: 'holy', damaging: true, lock: 0.3,
    dmg: '60', short: 'Holy flame on the enemy wherever they are. Heals you 30.',
    cast: x => x.b.later(0.15, () => smite(x, 60, 30)),
  },
  {
    id: 'penance', name: 'Penance', cls: 'cleric', cost: 2, rarity: 'common', element: 'holy', damaging: true, lock: 0.45,
    dmg: '30x3', short: 'Three holy bolts down your row. Each hit heals you 10.',
    cast: x => {
      for (let i = 0; i < 3; i++) x.b.later(i * 0.15, () => {
        const end = x.b.rowShot(x.f, 30 * x.mult, { spell: true, element: 'holy', noFlinch: i < 2 });
        x.b.addFx('holySpark', x.f.side, x.f.col, x.f.row, 0.2, { to: end.col });
        if (end.hit) x.b.heal(x.f, 10);
      });
    },
    ai: (b, f) => sameRow(b, f),
  },
  {
    id: 'holy_nova', name: 'Holy Nova', cls: 'cleric', cost: 2, rarity: 'common', element: 'holy', damaging: true, lock: 0.35,
    dmg: '50', short: 'Light bursts on every panel around you, enemy panel in front included. Knockback, heal 40.',
    cast: x => {
      const { b, f } = x;
      const cells: Array<[number, number]> = [];
      for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) if ((dc || dr) && b.inGrid(f.col + dc, f.row + dr)) cells.push([f.col + dc, f.row + dr]);
      b.addFx('holyNova', f.side, f.col, f.row, 0.45);
      b.strike(f, cells, 50 * x.mult, { spell: true, element: 'holy', knockback: true });
      b.heal(f, 40);
    },
    ai: (b, f) => Math.abs(b.foe(f).col - f.col) <= 1 && Math.abs(b.foe(f).row - f.row) <= 1,
  },
  {
    id: 'hammer_of_justice', name: 'Hammer of Justice', cls: 'cleric', cost: 3, rarity: 'common', element: 'holy', damaging: true, lock: 0.35,
    dmg: '80', short: 'A golden hammer flies down your row and stuns for 2s.',
    cast: x => {
      x.b.shoot(x.f, {
        speed: 11 * x.dir, kind: 'hammer', reflectable: true,
        onHit: (b, t, w, _c, p) => {
          if (w) { b.hitWall(w, 80, x.f, {}); return; }
          if (t) b.damage(t, 80 * x.mult, b.f[p.side], { spell: true, element: 'holy', stun: 2 });
        },
      });
    },
    ai: (b, f) => sameRow(b, f),
  },
  {
    id: 'prayer_of_mending', name: 'Prayer of Mending', cls: 'cleric', cost: 2, rarity: 'uncommon', element: 'holy', damaging: false, lock: 0.2,
    dmg: '-', short: 'For 10s, the next 4 times you get hit you heal 30.',
    cast: x => { x.f.st.mending = 10; x.f.mending = 4; },
  },
  {
    id: 'holy_wall', name: 'Holy Wall', cls: 'cleric', cost: 2, rarity: 'uncommon', element: 'holy', damaging: false, lock: 0.3,
    dmg: '-', short: 'Wall of light (100 HP) in front of you blocks shots in your row for 6s.',
    cast: x => { if (!x.b.placeWall(x.f, x.f.col + x.dir, x.f.row, 100, 'holy', 6)) x.b.text(x.f, 'BLOCKED', '#bcbcbc'); },
    ai: (b, f) => sameRow(b, f),
  },
  {
    id: 'purge', name: 'Purge', cls: 'cleric', cost: 2, rarity: 'uncommon', element: 'holy', damaging: true, lock: 0.3,
    dmg: '40', short: 'Hits the enemy wherever they are and strips shields, barriers, buffs and Stealth.',
    cast: x => {
      const foe = x.foe;
      foe.shields = [];
      for (const k of BUFF_KEYS) foe.st[k] = 0;
      foe.shout = 0; foe.rallyLeft = 0; foe.powerLeft = 0; foe.dodges = 0; foe.mending = 0;
      x.b.text(foe, 'PURGED', '#f8d878');
      smite(x, 40, 0, false);
    },
    ai: (b, f) => { const foe = b.foe(f); return foe.shields.length > 0 || BUFF_KEYS.some(k => foe.st[k] > 0) || foe.shout > 0; },
  },
  {
    id: 'atonement', name: 'Atonement', cls: 'cleric', cost: 3, rarity: 'uncommon', element: 'holy', damaging: true, lock: 0.3,
    dmg: '40+heal/2', short: 'Hits the enemy wherever they are: 40 plus half the healing you did since the last Draw.',
    cast: x => { const dmg = 40 + x.f.healedTurn / 2; x.b.later(0.15, () => smite(x, dmg, 0)); },
    ai: (_b, f) => f.healedTurn >= 80,
  },
  {
    id: 'consecration', name: 'Consecration', cls: 'cleric', cost: 3, rarity: 'uncommon', element: 'holy', damaging: true, lock: 0.3,
    dmg: '15/s', short: 'The enemy front column burns with holy fire for 6s and your column is blessed.',
    cast: x => {
      const { b, f } = x;
      const col = b.frontCol(x.foe.side);
      for (let r = 0; r < 3; r++) {
        const p = b.panels[col][r];
        p.smite = 6; p.smiteDps = 15 * x.mult;
        b.bless(f.col, r, 6);
      }
    },
  },
  // Legendaries
  {
    id: 'divine_hymn', name: 'Divine Hymn', cls: 'cleric', cost: 5, rarity: 'legendary', element: 'holy', damaging: false, lock: 0.2,
    dmg: '300 heal', short: 'Channel for 3s (no moving or attacking, cannot be knocked back). Heal 100 per second.',
    cast: x => {
      x.f.st.channel = 3; x.f.st.noKnock = 3;
      overTime(x.b, 3, 0.5, () => { x.b.heal(x.f, 50); x.b.addFx('healBurst', x.f.side, x.f.col, x.f.row, 0.4); });
    },
    ai: (_b, f) => hurt(f, 250),
  },
  {
    id: 'wrath_of_heaven', name: 'Wrath of Heaven', cls: 'cleric', cost: 5, rarity: 'legendary', element: 'holy', damaging: true, lock: 0.4,
    dmg: '80 each', short: 'After 1.5s, pillars of light hit all 9 enemy panels. Heal half the damage dealt.',
    cast: x => {
      const { b, f } = x;
      const cells = allEnemyPanels(b, f.side);
      b.warn(f, cells, 1.5, () => {
        b.shake = 0.4; b.cheer = 2;
        for (const [c, r] of cells) b.addFx('holyPillar', f.side, c, r, 0.45);
        const res = b.strike(f, cells, 80 * x.mult, { spell: true, element: 'holy' });
        if (res.dealt > 0) b.heal(f, res.dealt / 2);
      });
    },
  },
  {
    id: 'holy_word_serenity', name: 'Holy Word: Serenity', cls: 'cleric', cost: 3, rarity: 'legendary', element: 'holy', damaging: false, lock: 0.3,
    dmg: '-', short: 'Heal 180 instantly.',
    cast: x => { x.b.addFx('healBurst', x.f.side, x.f.col, x.f.row, 0.6); x.b.heal(x.f, 180); },
    ai: (_b, f) => hurt(f, 180),
  },
  {
    id: 'guardian_spirit', name: 'Guardian Spirit', cls: 'cleric', cost: 3, rarity: 'legendary', element: 'holy', damaging: false, lock: 0.2,
    dmg: '-', short: 'For 10s, the first hit that would kill you instead heals you to 200.',
    cast: x => { x.f.st.guardian = 10; },
    ai: (_b, f) => lowHp(f, 0.4),
  },
  {
    id: 'pain_suppression', name: 'Pain Suppression', cls: 'cleric', cost: 2, rarity: 'legendary', element: 'holy', damaging: false, lock: 0.2,
    dmg: '-', short: 'Take 50% less damage for 5s.',
    cast: x => { x.f.st.painSup = 5; },
  },
  {
    id: 'lightwell', name: 'Lightwell', cls: 'cleric', cost: 3, rarity: 'legendary', element: 'holy', damaging: false, lock: 0.3,
    dmg: '150 heal', short: 'For 10s, heal 15 per second wherever you are.',
    cast: x => overTime(x.b, 10, 1, () => x.b.heal(x.f, 15)),
    ai: (_b, f) => hurt(f, 100),
  },
  {
    id: 'psychic_scream', name: 'Psychic Scream', cls: 'cleric', cost: 3, rarity: 'legendary', element: 'holy', damaging: true, lock: 0.3,
    dmg: '20', short: 'Knock the enemy to their back column and stun them for 2s.',
    cast: x => {
      const { b, f, foe } = x;
      if (!b.targetable(foe)) { b.text(foe, 'MISS', '#bcbcbc'); return; }
      b.addFx('shout', f.side, f.col, f.row, 0.5);
      b.knockback(foe, 3);
      b.damage(foe, 20 * x.mult, f, { spell: true, element: 'holy', stun: 2 });
    },
    ai: (b, f) => Math.abs(b.foe(f).col - f.col) <= 2,
  },
  {
    id: 'mass_dispel', name: 'Mass Dispel', cls: 'cleric', cost: 3, rarity: 'legendary', element: 'holy', damaging: false, lock: 0.3,
    dmg: '-', short: 'Clears every panel effect: burning, traps, toxic panels, walls. Stolen panels return.',
    cast: x => {
      const { b, f } = x;
      b.traps = [];
      b.walls = [];
      for (const g of b.f) { g.st.glacial = 0; g.st.tripwire = 0; }
      for (let c = 0; c < 6; c++) for (let r = 0; r < 3; r++) {
        const p = b.panels[c][r];
        p.burn = 0; p.burnDps = 0; p.toxic = 0; p.smite = 0; p.bless = 0;
        if (p.ownerT > 0) { p.ownerT = 0; p.owner = p.baseOwner; }
        b.addFx('flare', f.side, c, r, 0.4);
      }
      for (const g of b.f) b.relocate(g);
      sfx('break');
    },
    ai: (b, f) => b.walls.some(w => w.side !== f.side) || b.panels.some(col => col.some(p => p.burn > 0 && p.owner === f.side)),
  },
  // Mythics
  {
    id: 'avatar_of_light', name: 'Avatar of Light', cls: 'cleric', cost: 5, rarity: 'mythic', element: 'holy', damaging: true, lock: 0.4,
    dmg: '= heals', short: 'For 10s your heals are doubled and every heal also smites the enemy for that amount.',
    cast: x => { x.f.st.avatarLight = 10; x.b.cheer = 2; x.b.addFx('transform', x.f.side, x.f.col, x.f.row, 0.8); },
  },
  {
    id: 'ascension', name: 'Ascension', cls: 'cleric', cost: 5, rarity: 'mythic', element: 'holy', damaging: false, lock: 0.4,
    dmg: '240 heal', short: 'For 6s you cannot drop below 1 HP, and heal 40 per second.',
    cast: x => {
      x.f.st.ascension = 6; x.b.cheer = 2;
      x.b.addFx('transform', x.f.side, x.f.col, x.f.row, 0.8);
      overTime(x.b, 6, 1, () => x.b.heal(x.f, 40));
    },
    ai: (_b, f) => lowHp(f, 0.5),
  },
  {
    id: 'day_of_judgment', name: 'Day of Judgment', cls: 'cleric', cost: 5, rarity: 'mythic', element: 'holy', damaging: true, lock: 0.4,
    dmg: '40x10', short: '10 pillars of light hunt the enemy, one every 0.4s with a 1-panel telegraph. Heal 20 each.',
    cast: x => {
      const { b, f, foe } = x;
      b.cheer = 2;
      for (let i = 0; i < 10; i++) b.later(i * 0.4, () => {
        const c = foe.col, r = foe.row;
        b.warn(f, [[c, r]], TUNING.warnTime, () => {
          b.addFx('holyPillar', f.side, c, r, 0.35);
          if (b.strike(f, [[c, r]], 40 * x.mult, { spell: true, element: 'holy', noFlinch: true }).dealt > 0) b.heal(f, 20);
        });
      });
    },
  },
];
