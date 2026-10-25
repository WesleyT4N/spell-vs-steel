// Rogue draft kit (class-drafts page, 2026-10-25). Stealth, Poison and backstabs; spells cost Energy.
import type { CastCtx } from './battle';
import type { CardDef } from './cards';
import { sfx } from '../engine/audio';
import { ahead, allEnemyPanels, cellsAhead, lunge, sameRow } from './cardUtil';

/** Blink behind the enemy wherever they are, hit after `delay`, blink home. A Tripwire stops it. */
function backstab(x: CastCtx, hold: number, fn: () => void, delay = 0.12): void {
  const { b, f, foe } = x;
  if (!b.blinkIn(f)) return;
  const behind = Math.max(0, Math.min(5, foe.col + x.dir));
  b.addFx('smoke', f.side, f.col, f.row, 0.3);
  lunge(x, behind, foe.row, 0.08, hold, 0.1);
  b.later(delay, () => fn());
}

/** A blade hit on the enemy (picks them wherever they are). */
function stab(x: CastCtx, dmg: number, extra: { stun?: number; knockback?: boolean } = {}): boolean {
  const { b, f, foe } = x;
  b.addFx('stab', f.side, foe.col, foe.row, 0.25);
  sfx('slash');
  return b.damage(foe, dmg * x.mult, f, { spell: true, element: 'shadow', targeted: true, ...extra }).dealt > 0;
}

export const rogue: CardDef[] = [
  {
    id: 'shiv', name: 'Shiv', cls: 'rogue', cost: 0, rarity: 'common', element: 'steel', damaging: true, lock: 0.25,
    dmg: '30', short: 'Quick stab at the panel right in front of you. +1 Energy on hit.',
    cast: x => {
      x.b.addFx('stab', x.f.side, x.f.col + x.dir, x.f.row, 0.2);
      if (x.b.strike(x.f, cellsAhead(x, 1, 1), 30 * x.mult, { spell: true, element: 'steel' }).dealt > 0) x.b.gainRes(x.f, 1);
    },
    ai: (b, f) => ahead(b, f, 1),
  },
  {
    id: 'evasion', name: 'Evasion', cls: 'rogue', cost: 0, rarity: 'common', element: 'shadow', damaging: false, lock: 0.15,
    dmg: '-', short: 'For 4s, dodge the next 2 hits. +1 Energy per dodge.',
    cast: x => { x.f.st.evasion = 4; x.f.dodges = 2; x.b.addFx('smoke', x.f.side, x.f.col, x.f.row, 0.3); },
  },
  {
    id: 'vanish', name: 'Vanish', cls: 'rogue', cost: 1, rarity: 'common', element: 'shadow', damaging: false, lock: 0.15,
    dmg: '-', short: 'Enter Stealth for 3s: targeted and homing spells miss you. Attacking ends it.',
    cast: x => x.b.stealth(x.f, 3),
  },
  {
    id: 'shadowstep', name: 'Shadowstep', cls: 'rogue', cost: 1, rarity: 'common', element: 'shadow', damaging: true, lock: 0.35,
    dmg: '70', short: 'Blink behind the enemy, stab, blink back.',
    cast: x => backstab(x, 0.12, () => stab(x, 70)),
  },
  {
    id: 'ambush', name: 'Ambush', cls: 'rogue', cost: 3, rarity: 'common', element: 'shadow', damaging: true, lock: 0.4,
    dmg: '100/200', short: 'Shadowstep with a bigger blade. Double damage if cast from Stealth.',
    cast: x => { const dmg = x.stealthed ? 200 : 100; backstab(x, 0.16, () => stab(x, dmg)); },
    ai: (_b, f) => f.st.stealth > 0 || f.res >= 4,
  },
  {
    id: 'deadly_poison', name: 'Deadly Poison', cls: 'rogue', cost: 1, rarity: 'common', element: 'poison', damaging: false, lock: 0.2,
    dmg: '-', short: 'For 6s, your basic attacks apply 1 Poison stack.',
    cast: x => { x.f.st.deadlyPoison = 6; x.b.addFx('toxicPuff', x.f.side, x.f.col, x.f.row, 0.4); },
  },
  {
    id: 'poison_vial', name: 'Poison Vial', cls: 'rogue', cost: 1, rarity: 'common', element: 'poison', damaging: true, lock: 0.3,
    dmg: '20', short: 'Lob a vial 3 panels ahead: 2 Poison stacks on hit, the panel stays toxic for 4s.',
    cast: x => {
      const { b, f } = x;
      const c = f.col + 3 * x.dir, r = f.row;
      b.addFx('lob', f.side, f.col, r, 0.4, { to: c, color: '#b8f818' });
      b.later(0.4, () => {
        const p = b.panel(c, r);
        if (!p) return;
        b.addFx('toxicPuff', f.side, c, r, 0.5);
        if (b.strike(f, [[c, r]], 20 * x.mult, { spell: true, element: 'poison' }).dealt > 0) b.addPoison(x.foe, 2);
        p.toxic = 4; p.toxicSide = f.side;
      });
    },
    ai: (b, f) => sameRow(b, f) && (b.foe(f).col - f.col) * b.dir(f) === 3,
  },
  {
    id: 'envenom', name: 'Envenom', cls: 'rogue', cost: 2, rarity: 'common', element: 'poison', damaging: true, lock: 0.3,
    dmg: '30+40/stack', short: 'Hits the enemy wherever they are and consumes their Poison: +40 per stack.',
    cast: x => {
      const stacks = x.foe.st.pandemic > 0 ? 0 : x.foe.poison;
      x.b.addFx('toxicPuff', x.f.side, x.foe.col, x.foe.row, 0.4);
      const hit = x.b.damage(x.foe, (30 + 40 * stacks) * x.mult, x.f, { spell: true, element: 'poison', targeted: true }).dealt > 0;
      if (hit && stacks) { x.foe.poison = 0; x.foe.poisonT = 0; }
    },
    ai: (b, f) => b.foe(f).poison >= 2,
  },
  {
    id: 'fan_of_knives', name: 'Fan of Knives', cls: 'rogue', cost: 2, rarity: 'common', element: 'poison', damaging: true, lock: 0.35,
    dmg: '50', short: 'Knives hit all 3 panels of the enemy front column. 1 Poison stack on hit.',
    cast: x => {
      const col = x.b.frontCol(x.foe.side);
      for (let r = 0; r < 3; r++) x.b.addFx('stab', x.f.side, col, r, 0.25);
      if (x.b.strike(x.f, [[col, 0], [col, 1], [col, 2]], 50 * x.mult, { spell: true, element: 'poison' }).dealt > 0) x.b.addPoison(x.foe, 1);
    },
    ai: (b, f) => b.foe(f).col === b.frontCol(b.foe(f).side),
  },
  {
    id: 'kick', name: 'Kick', cls: 'rogue', cost: 1, rarity: 'common', element: 'steel', damaging: true, lock: 0.3,
    dmg: '20', short: 'Kick 2 panels ahead. Silences for 2s: no spells, moving and basics still work.',
    cast: x => {
      x.b.addFx('smash', x.f.side, x.f.col + x.dir, x.f.row, 0.2);
      if (x.b.strike(x.f, cellsAhead(x, 1, 2), 20 * x.mult, { spell: true, element: 'steel' }).dealt > 0) x.b.silence(x.foe, 2);
    },
    ai: (b, f) => ahead(b, f, 2),
  },
  {
    id: 'garrote', name: 'Garrote', cls: 'rogue', cost: 1, rarity: 'uncommon', element: 'poison', damaging: true, lock: 0.35,
    dmg: '20', short: 'Wire down your row pulls the enemy to their front column. 2 Poison stacks.',
    cast: x => {
      x.b.shoot(x.f, {
        speed: 14 * x.dir, kind: 'hook', reflectable: true,
        onHit: (b, t, w, _c, p) => {
          if (w) { b.hitWall(w, 20, x.f, {}); return; }
          if (!t) return;
          const res = b.damage(t, 20 * x.mult, b.f[p.side], { spell: true, element: 'poison' });
          if (res.blocked && !res.dealt) return;
          const front = b.frontCol(t.side);
          if (t.st.noKnock <= 0 && b.canStand(t, front, t.row)) t.col = front;
          b.addPoison(t, 2);
        },
      });
    },
    ai: (b, f) => sameRow(b, f),
  },
  {
    id: 'cheap_shot', name: 'Cheap Shot', cls: 'rogue', cost: 2, rarity: 'uncommon', element: 'shadow', damaging: true, lock: 0.35,
    dmg: '30', short: 'Blink behind the enemy and stun them for 1.5s.',
    cast: x => backstab(x, 0.12, () => { stab(x, 30, { stun: 1.5 }); }),
  },
  {
    id: 'blade_flurry', name: 'Blade Flurry', cls: 'rogue', cost: 3, rarity: 'uncommon', element: 'shadow', damaging: true, lock: 0.7,
    dmg: '30x4', short: 'Blink to the enemy, 4 fast slashes, blink back.',
    cast: x => backstab(x, 0.5, () => { for (let i = 0; i < 4; i++) x.b.later(i * 0.12, () => stab(x, 30)); }),
  },
  {
    id: 'cloak_of_shadows', name: 'Cloak of Shadows', cls: 'rogue', cost: 2, rarity: 'uncommon', element: 'shadow', damaging: false, lock: 0.15,
    dmg: '-', short: 'Immune to spells for 3s (basics still hit). Removes Poison, burning and freeze.',
    cast: x => { x.b.cleanse(x.f); x.f.st.spellImmune = 3; },
    ai: (b, f) => f.poison >= 2 || b.marks.some(m => m.col === f.col && m.row === f.row),
  },
  {
    id: 'pickpocket', name: 'Pickpocket', cls: 'rogue', cost: 0, rarity: 'uncommon', element: 'steel', damaging: true, lock: 0.25,
    dmg: '20', short: 'Stab 2 panels ahead. On hit, they lose 1 Rage, Mana or Energy and you gain 1.',
    cast: x => {
      x.b.addFx('stab', x.f.side, x.f.col + x.dir, x.f.row, 0.2);
      if (x.b.strike(x.f, cellsAhead(x, 1, 2), 20 * x.mult, { spell: true, element: 'steel' }).dealt > 0) {
        x.foe.res = Math.max(0, x.foe.res - 1);
        x.b.gainRes(x.f, 1);
        x.b.text(x.foe, '-1', '#f8d878');
      }
    },
    ai: (b, f) => ahead(b, f, 2),
  },
  // Legendaries
  {
    id: 'eviscerate', name: 'Eviscerate', cls: 'rogue', cost: 5, rarity: 'legendary', element: 'shadow', damaging: true, lock: 0.5,
    dmg: '200+40/stack', short: 'Blink behind the enemy and gut them. +40 per Poison stack, consumed.',
    cast: x => backstab(x, 0.2, () => {
      const stacks = x.foe.st.pandemic > 0 ? 0 : x.foe.poison;
      x.b.shake = 0.3;
      if (stab(x, 200 + 40 * stacks) && stacks) { x.foe.poison = 0; x.foe.poisonT = 0; }
    }, 0.16),
  },
  {
    id: 'killing_spree', name: 'Killing Spree', cls: 'rogue', cost: 4, rarity: 'legendary', element: 'shadow', damaging: true, lock: 2.1,
    dmg: '35x5', short: 'Blink-strike the enemy 5 times over 2s. Untargetable during it.',
    cast: x => {
      const { b, f } = x;
      if (!b.blinkIn(f)) return;
      f.st.untargetable = 2.1;
      for (let i = 0; i < 5; i++) b.later(0.1 + i * 0.45, () => {
        lunge(x, x.foe.col, x.foe.row, 0.06, 0.12, 0.08);
        stab(x, 35);
      });
    },
  },
  {
    id: 'shadow_dance', name: 'Shadow Dance', cls: 'rogue', cost: 3, rarity: 'legendary', element: 'shadow', damaging: false, lock: 0.2,
    dmg: '-', short: 'For 6s, re-enter Stealth 1s after every attack or spell.',
    cast: x => { x.f.st.shadowDance = 6; x.b.stealth(x.f, 2); },
  },
  {
    id: 'blind', name: 'Blind', cls: 'rogue', cost: 2, rarity: 'legendary', element: 'shadow', damaging: false, lock: 0.3,
    dmg: '-', short: 'Dust 2 panels ahead puts the enemy to sleep for 3s. Any damage wakes them (+50%).',
    cast: x => {
      x.b.addFx('toxicPuff', x.f.side, x.f.col + x.dir, x.f.row, 0.4);
      const foe = x.foe, d = (foe.col - x.f.col) * x.dir;
      if (foe.row === x.f.row && d >= 1 && d <= 2) x.b.sleep(foe, 3);
    },
    ai: (b, f) => ahead(b, f, 2),
  },
  {
    id: 'death_mark', name: 'Death Mark', cls: 'rogue', cost: 3, rarity: 'legendary', element: 'shadow', damaging: true, lock: 0.25,
    dmg: '50% back', short: 'Mark the enemy for 6s. When it ends, they take 50% of the damage taken during it.',
    cast: x => {
      if (!x.b.targetable(x.foe)) { x.b.text(x.foe, 'MISS', '#bcbcbc'); return; }
      x.foe.st.deathMark = 6; x.foe.deathMarkAcc = 0;
      x.b.text(x.foe, 'MARKED', '#9878f8');
    },
  },
  {
    id: 'toxic_cloud', name: 'Toxic Cloud', cls: 'rogue', cost: 3, rarity: 'legendary', element: 'poison', damaging: true, lock: 0.3,
    dmg: '1 stack/s', short: 'Poison cloud fills the enemy middle column for 6s: 1 Poison stack per second.',
    cast: x => {
      const col = x.b.frontCol(x.foe.side) + x.dir;
      for (let r = 0; r < 3; r++) {
        const p = x.b.panel(col, r);
        if (p) { p.toxic = 6; p.toxicSide = x.f.side; p.toxicAcc = 0.99; }
        x.b.addFx('toxicPuff', x.f.side, col, r, 0.5);
      }
    },
  },
  {
    id: 'preparation', name: 'Preparation', cls: 'rogue', cost: 0, rarity: 'legendary', element: 'shadow', damaging: false, lock: 0.2,
    dmg: '-', short: 'Refill your Energy to 5.', gain: { refill: true },
    cast: x => { x.f.res = Math.max(x.f.res, 5); x.b.text(x.f, 'ENERGY FULL', '#f8d878'); },
    ai: (_b, f) => f.res <= 2,
  },
  {
    id: 'crimson_vial', name: 'Crimson Vial', cls: 'rogue', cost: 2, rarity: 'legendary', element: 'shadow', damaging: false, lock: 0.3,
    dmg: '-', short: 'Heal 100 and remove Poison, burning and freeze from yourself.',
    cast: x => { x.b.cleanse(x.f); x.b.heal(x.f, 100); },
    ai: (_b, f) => f.maxHp - f.hp >= 100,
  },
  // Mythics
  {
    id: 'nights_embrace', name: "Night's Embrace", cls: 'rogue', cost: 5, rarity: 'mythic', element: 'shadow', damaging: false, lock: 0.3,
    dmg: '-', short: 'For 10s you stay in Stealth even while attacking. Shadowstep and Ambush cost 0.',
    cast: x => { x.f.st.revealed = 0; x.f.st.nightsEmbrace = 10; x.b.stealth(x.f, 10); x.b.cheer = 2; },
  },
  {
    id: 'pandemic', name: 'Pandemic', cls: 'rogue', cost: 5, rarity: 'mythic', element: 'poison', damaging: true, lock: 0.4,
    dmg: 'up to ~300', short: 'Apply 5 Poison stacks. For 10s Poison ticks twice as fast and cannot be cleansed.',
    cast: x => {
      if (!x.b.targetable(x.foe)) { x.b.text(x.foe, 'MISS', '#bcbcbc'); return; }
      x.foe.st.pandemic = 10;
      x.b.addPoison(x.foe, 5);
      x.foe.poisonT = 10;
      for (const [c, r] of allEnemyPanels(x.b, x.f.side)) x.b.addFx('toxicPuff', x.f.side, c, r, 0.5);
      x.b.cheer = 2;
    },
  },
  {
    id: 'thousand_cuts', name: 'Thousand Cuts', cls: 'rogue', cost: 5, rarity: 'mythic', element: 'shadow', damaging: true, lock: 2.6,
    dmg: '30x10', short: 'Untargetable, blink around the enemy for 10 strikes over 2.5s. The last knocks back.',
    cast: x => {
      const { b, f } = x;
      if (!b.blinkIn(f)) return;
      f.st.untargetable = 2.6;
      b.cheer = 2;
      for (let i = 0; i < 10; i++) b.later(0.1 + i * 0.25, () => {
        lunge(x, x.foe.col + (i % 2 ? x.dir : -x.dir), x.foe.row, 0.05, 0.1, 0.06);
        stab(x, 30, i === 9 ? { knockback: true } : {});
      });
    },
  },
];
