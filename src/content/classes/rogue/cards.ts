// Rogue kit from the design doc's Rogue tab (2026-10-25). Stealth, Poison and backstabs; spells cost Energy, which refills every Draw.
import { type CastCtx, type HitResult, type CardDef, TUNING, ahead, allEnemyPanels, cellsAhead, spellStep } from '../../api';

/** Blink to the panel in front of the enemy and attack the panel they stand on (a wall in the way takes it instead).
 *  Opens the backstab window: the Rogue may keep acting from there until a move or the window blinks them home. */
function backstab(x: CastCtx, hit: (col: number, row: number) => void, window = true): void {
  const { b, f, foe } = x;
  if (!b.targetable(foe)) { b.text(foe, 'MISS', '#bcbcbc'); return; }
  const at = b.blinkFront(f);
  if (window) f.st.backstab = TUNING.rogue.backstabWindow;
  hit(at.col, at.row);
}

/** A shadow blade on the given panels. */
function slash(x: CastCtx, cells: Array<[number, number]>, dmg: number): HitResult {
  for (const [c, r] of cells) x.b.addFx('stab', x.f.side, c, r, 0.25);
  return x.b.strike(x.f, cells, dmg * x.mult, { spell: true, element: 'shadow' });
}

/** A dagger thrust from the Rogue's panel over `reach` panels ahead. */
function thrust(x: CastCtx, reach: number, dmg: number): HitResult {
  x.b.addFx('dagger', x.f.side, x.f.col, x.f.row, 0.2, { reach });
  return x.b.strike(x.f, cellsAhead(x, 1, reach), dmg * x.mult, { spell: true, element: 'steel' });
}

/** Poison stacks a finisher cashes in (Pandemic Poison can't be consumed). */
const stacksOf = (x: CastCtx): number => (x.foe.st.pandemic > 0 ? 0 : x.foe.poison);
const consume = (x: CastCtx): void => { if (x.foe.st.pandemic <= 0) { x.foe.poison = 0; x.foe.poisonT = 0; } };

type Cells = Array<[number, number]>;

// Spells' later steps (see spellStep): what lands after a delay or a telegraph.
const vialHit = spellStep('poison_vial.hit', (x, { cells }: { cells: Cells }) => {
  const { b, f } = x;
  for (const [cc, rr] of cells) {
    const p = b.panel(cc, rr);
    if (!p) continue;
    b.addFx('toxicPuff', f.side, cc, rr, 0.5);
    p.toxic = 4; p.toxicSide = f.side;
  }
  if (b.strike(f, cells, 240 * x.mult, { spell: true, element: 'poison' }).dealt > 0) b.addPoison(x.foe, 2);
});
const flurrySweep = spellStep('blade_flurry.sweep', (x, { c, r }: { c: number; r: number }) => { slash(x, [[c, r - 1], [c, r], [c, r + 1]], 360); });
const spreeStrike = spellStep('killing_spree.strike', x => { const at = x.b.blinkFront(x.f); slash(x, [[at.col, at.row]], 420); });
const spreeEnd = spellStep('killing_spree.end', x => x.b.blinkHome(x.f));

export const rogue: CardDef[] = [
  // ---------- Commons ----------
  {
    id: 'vanish', name: 'Vanish', cls: 'rogue', cost: 1, rarity: 'common', element: 'shadow', damaging: false, lock: 0.15,
    dmg: '-', short: 'Enter Stealth for 3s. Your next attack spell stuns for 2s.',
    cast: x => { x.b.stealth(x.f, 3); x.f.st.vanishStun = 10; },
  },
  {
    id: 'shadowstep', name: 'Shadowstep', cls: 'rogue', cost: 1, rarity: 'common', element: 'shadow', damaging: true, lock: 0.35,
    dmg: '700', short: 'Blink in front of the enemy and stab. 2s to keep comboing before you blink home.',
    cast: x => backstab(x, (c, r) => slash(x, [[c, r]], 700)),
    ai: (b, f) => b.targetable(b.foe(f)),
  },
  {
    id: 'ambush', name: 'Ambush', cls: 'rogue', cost: 2, rarity: 'common', element: 'shadow', damaging: true, lock: 0.4, needsStealth: true,
    dmg: '1450', short: 'Stealth only. Blink in front of the enemy and strike with a bigger blade.',
    cast: x => backstab(x, (c, r) => { x.b.shake = 0.2; slash(x, [[c, r]], 1450); }),
    ai: (_b, f) => f.st.stealth > 0,
  },
  {
    id: 'shiv', name: 'Shiv', cls: 'rogue', cost: 1, rarity: 'common', element: 'steel', damaging: true, lock: 0.25,
    dmg: '360/720', short: 'Stab up to 2 panels ahead. Double damage if you cast another spell in the last 2s.',
    cast: x => { thrust(x, 2, x.castsWithin(2) > 0 ? 720 : 360); },
    ai: (b, f) => ahead(b, f, 2),
  },
  {
    id: 'evasion', name: 'Evasion', cls: 'rogue', cost: 1, rarity: 'common', element: 'shadow', damaging: false, lock: 0.15,
    dmg: '-', short: 'Dodge the next 2 hits within 3s.',
    cast: x => { x.f.st.evasion = 3; x.f.dodges = 2; x.b.addFx('smoke', x.f.side, x.f.col, x.f.row, 0.3); },
    ai: (b, f) => b.projectiles.some(p => p.side !== f.side) || b.foe(f).charging || b.warns.some(w => w.side !== f.side),
  },
  {
    id: 'kick', name: 'Kick', cls: 'rogue', cost: 1, rarity: 'common', element: 'steel', damaging: true, lock: 0.3,
    dmg: '240', short: 'Kick 2 panels ahead. Silences for 2s: no spells, moving and basics still work.',
    cast: x => {
      x.b.addFx('smash', x.f.side, x.f.col + x.dir, x.f.row, 0.2);
      if (x.b.strike(x.f, cellsAhead(x, 1, 2), 240 * x.mult, { spell: true, element: 'steel' }).dealt > 0) x.b.silence(x.foe, 2);
    },
    ai: (b, f) => ahead(b, f, 2),
  },
  {
    id: 'poison_vial', name: 'Poison Vial', cls: 'rogue', cost: 2, rarity: 'common', element: 'poison', damaging: true, lock: 0.3,
    dmg: '240', short: 'Lob a vial 3 ahead: 2x2 burst, 2 Poison stacks on hit, panels toxic for 4s.',
    cast: x => {
      const { b, f } = x;
      const c = f.col + 3 * x.dir, r = f.row, r2 = r < 2 ? r + 1 : r - 1;
      const cells: Array<[number, number]> = [[c, r], [c + x.dir, r], [c, r2], [c + x.dir, r2]];
      // a lob, like BN's MiniBomb: a shadow grows on the landing panels while it falls
      b.addFx('lob', f.side, f.col, r, 0.4, { to: c, color: '#b8f818' });
      b.warn(f, cells, 0.4, vialHit(x, { cells }), 'shadow');
    },
    ai: (b, f) => {
      const foe = b.foe(f), d = (foe.col - f.col) * b.dir(f), r2 = f.row < 2 ? f.row + 1 : f.row - 1;
      return (d === 3 || d === 4) && (foe.row === f.row || foe.row === r2);
    },
  },
  {
    id: 'deadly_poison', name: 'Deadly Poison', cls: 'rogue', cost: 1, rarity: 'common', element: 'poison', damaging: false, lock: 0.2,
    dmg: '-', short: 'For 6s, basic attacks and attack spells apply 1 Poison stack on hit (once per spell).',
    cast: x => { x.f.st.deadlyPoison = 6; x.b.addFx('toxicPuff', x.f.side, x.f.col, x.f.row, 0.4); },
  },
  {
    id: 'envenom', name: 'Envenom', cls: 'rogue', cost: 2, rarity: 'common', element: 'poison', damaging: true, lock: 0.3,
    dmg: '360+480/stk', short: 'Hits the enemy wherever they are and consumes their Poison: +480 per stack.',
    cast: x => {
      const stacks = stacksOf(x);
      x.b.addFx('toxicPuff', x.f.side, x.foe.col, x.foe.row, 0.4);
      if (x.b.damage(x.foe, (360 + 480 * stacks) * x.mult, x.f, { spell: true, element: 'poison', targeted: true }).dealt > 0 && stacks) consume(x);
    },
    ai: (b, f) => b.foe(f).poison >= 2 && b.targetable(b.foe(f)),
  },
  {
    id: 'fan_of_knives', name: 'Fan of Knives', cls: 'rogue', cost: 2, rarity: 'common', element: 'steel', damaging: true, lock: 0.35,
    dmg: '600', short: 'Knives hit all 3 panels of the enemy front column.',
    cast: x => {
      const col = x.b.frontCol(x.foe.side);
      const cells: Array<[number, number]> = [[col, 0], [col, 1], [col, 2]];
      // thrown blades, instant like BN's sword-type chips
      for (let r = 0; r < 3; r++) x.b.addFx('stab', x.f.side, col, r, 0.25);
      x.b.strike(x.f, cells, 600 * x.mult, { spell: true, element: 'steel' });
    },
    ai: (b, f) => b.foe(f).col === b.frontCol(b.foe(f).side),
  },
  // ---------- Uncommons ----------
  {
    id: 'blade_flurry', name: 'Blade Flurry', cls: 'rogue', cost: 3, rarity: 'uncommon', element: 'shadow', damaging: true, lock: 0.5,
    dmg: '360x3', short: 'Blink in front of the enemy: 3 sweeps over their panel and the ones above and below.',
    cast: x => backstab(x, (c, r) => {
      for (let i = 0; i < 3; i++) x.b.later(i * 0.12, flurrySweep(x, { c, r }));
    }),
    ai: (b, f) => b.targetable(b.foe(f)),
  },
  {
    id: 'cloak_of_shadows', name: 'Cloak of Shadows', cls: 'rogue', cost: 2, rarity: 'uncommon', element: 'shadow', damaging: false, lock: 0.15,
    dmg: '-', short: 'Immune to spells for 3s (basics still hit). Removes Poison, burning and freeze.',
    cast: x => { x.b.cleanse(x.f); x.f.st.spellImmune = 3; },
    ai: (b, f) => f.poison >= 2 || b.warned(f.col, f.row, f.side),
  },
  {
    id: 'pickpocket', name: 'Pickpocket', cls: 'rogue', cost: 0, rarity: 'uncommon', element: 'steel', damaging: true, lock: 0.25,
    dmg: '240', short: 'Stab 2 panels ahead. On hit, gain 1 Energy.',
    cast: x => { if (thrust(x, 2, 240).dealt > 0) x.b.gainRes(x.f, 1); },
    ai: (b, f) => ahead(b, f, 2),
  },
  {
    id: 'riposte', name: 'Riposte', cls: 'rogue', cost: 2, rarity: 'uncommon', element: 'steel', damaging: false, lock: 0.15,
    dmg: '800', short: 'For 1.5s, parry the next hit and counter the attacker wherever they are.',
    cast: x => { x.f.st.riposte = 1.5; x.b.addFx('guard', x.f.side, x.f.col, x.f.row, 0.3); },
    ai: (b, f) => {
      const foe = b.foe(f);
      return foe.charging || foe.lock > 0 || b.projectiles.some(p => p.side !== f.side && p.row === f.row) || (foe.row === f.row && Math.abs(foe.col - f.col) <= 2);
    },
  },
  {
    id: 'cold_blood', name: 'Cold Blood', cls: 'rogue', cost: 1, rarity: 'uncommon', element: 'shadow', damaging: false, lock: 0.15,
    dmg: '-', short: 'Your next attack spell deals double damage.',
    cast: x => { x.f.coldBlood = true; x.b.text(x.f, 'COLD BLOOD', '#9878f8'); },
  },
  // ---------- Legendaries ----------
  {
    id: 'smokescreen', name: 'Smokescreen', cls: 'rogue', cost: 3, rarity: 'legendary', element: 'shadow', damaging: false, lock: 0.3,
    dmg: '-', short: 'Claim the enemy front column for 5s. Smoke on both front columns hides you inside it.',
    cast: x => {
      const { b, f, foe } = x;
      const own = b.frontCol(f.side), col = b.frontCol(foe.side);
      if (col === b.backCol(foe.side)) { b.text(f, 'NO ROOM', '#bcbcbc'); return; }
      if (foe.col === col) b.knockback(foe, 1);
      for (let r = 0; r < 3; r++) {
        const p = b.panels[col][r];
        p.owner = f.side;
        p.ownerT = 5;
        for (const c of [own, col]) { b.panels[c][r].smoke = 5; b.panels[c][r].smokeSide = f.side; b.addFx('smoke', f.side, c, r, 0.5); }
      }
      b.walls = b.walls.filter(w => !(w.col === col && w.side === foe.side));
      if (foe.col === col) b.relocate(foe);
    },
    ai: (b, f) => b.frontCol(b.foe(f).side) !== b.backCol(b.foe(f).side),
  },
  {
    id: 'eviscerate', name: 'Eviscerate', cls: 'rogue', cost: 5, rarity: 'legendary', element: 'shadow', damaging: true, lock: 0.5,
    dmg: '2400+480/stk', short: 'Blink in front of the enemy and gut them. +480 per Poison stack, consumed.',
    cast: x => backstab(x, (c, r) => {
      const stacks = stacksOf(x);
      x.b.shake = 0.3;
      if (slash(x, [[c, r]], 2400 + 480 * stacks).dealt > 0 && stacks) consume(x);
    }),
    ai: (b, f) => b.targetable(b.foe(f)),
  },
  {
    id: 'killing_spree', name: 'Killing Spree', cls: 'rogue', cost: 4, rarity: 'legendary', element: 'shadow', damaging: true, lock: 2.1,
    dmg: '420x5', short: '5 blink-strikes over 2s that follow the enemy. Untargetable during it.',
    cast: x => {
      const { b, f, foe } = x;
      if (!b.targetable(foe)) { b.text(foe, 'MISS', '#bcbcbc'); return; }
      f.st.backstab = 0;
      f.st.untargetable = 2.1;
      for (let i = 0; i < 5; i++) b.later(0.1 + i * 0.45, spreeStrike(x));
      b.later(2.15, spreeEnd(x));
    },
    ai: (b, f) => b.targetable(b.foe(f)),
  },
  {
    id: 'shadow_dance', name: 'Shadow Dance', cls: 'rogue', cost: 2, rarity: 'legendary', element: 'shadow', damaging: false, lock: 0.2,
    dmg: '-', short: 'For 8s, re-enter Stealth 1s after every attack or spell.',
    cast: x => { x.f.st.shadowDance = 8; x.b.stealth(x.f, 2); },
  },
  {
    id: 'blind', name: 'Blind', cls: 'rogue', cost: 2, rarity: 'legendary', element: 'shadow', damaging: false, lock: 0.3,
    dmg: '-', short: 'Dust 2 panels ahead stuns the enemy for 3s. Any damage breaks it (+50% on that hit).',
    cast: x => {
      x.b.addFx('toxicPuff', x.f.side, x.f.col + x.dir, x.f.row, 0.4);
      if (ahead(x.b, x.f, 2)) x.b.sleep(x.foe, 3);
    },
    ai: (b, f) => ahead(b, f, 2),
  },
  {
    id: 'adrenaline_rush', name: 'Adrenaline Rush', cls: 'rogue', cost: 2, rarity: 'legendary', element: 'shadow', damaging: false, lock: 0.15,
    dmg: '-', short: 'For 6s, every spell you cast refunds 1 Energy.',
    cast: x => { x.f.st.adrenaline = 6; x.b.text(x.f, 'ADRENALINE', '#f8d878'); },
  },
  {
    id: 'kidney_shot', name: 'Kidney Shot', cls: 'rogue', cost: 2, rarity: 'legendary', element: 'steel', damaging: true, lock: 0.3,
    dmg: '360', short: 'Hit the panel ahead. Stuns 2s, plus 0.25s per spell you cast in the last 3s (max 2.5s).',
    cast: x => {
      const stun = Math.min(2.5, 2 + 0.25 * x.castsWithin(3));
      if (thrust(x, 1, 360).dealt > 0 && stun > 0) x.b.stun(x.foe, stun);
    },
    ai: (b, f) => ahead(b, f, 1),
  },
  {
    id: 'shadow_clone', name: 'Shadow Clone', cls: 'rogue', cost: 2, rarity: 'legendary', element: 'shadow', damaging: false, lock: 0.15,
    dmg: '-', short: 'Leave a decoy for 4s and enter Stealth. The next hit on you hits the decoy instead.',
    cast: x => { x.f.st.decoy = 4; x.f.decoyCol = x.f.col; x.f.decoyRow = x.f.row; x.b.stealth(x.f, 3); },
  },
  // ---------- Mythics (1 Energy, so a Mythic turn still chains combos) ----------
  {
    id: 'nights_embrace', name: "Night's Embrace", cls: 'rogue', cost: 1, rarity: 'mythic', element: 'shadow', damaging: false, lock: 0.3,
    dmg: '-', short: 'For 10s you stay in Stealth while attacking, and dodge the next 2 hits.',
    cast: x => {
      x.f.st.revealed = 0;
      x.f.st.nightsEmbrace = 10;
      x.b.stealth(x.f, 10);
      x.f.st.evasion = 10; x.f.dodges = 2;
      x.b.cheer = 2;
    },
  },
  {
    id: 'pandemic', name: 'Pandemic', cls: 'rogue', cost: 1, rarity: 'mythic', element: 'poison', damaging: false, lock: 0.4,
    dmg: 'up to ~2400', short: 'Apply 4 Poison stacks. For 6s Poison ticks twice as fast and cannot be cleansed.',
    cast: x => {
      if (!x.b.targetable(x.foe)) { x.b.text(x.foe, 'MISS', '#bcbcbc'); return; }
      x.foe.st.pandemic = 6;
      x.b.addPoison(x.foe, 4);
      x.foe.poisonT = 6;
      for (const [c, r] of allEnemyPanels(x.b, x.f.side)) x.b.addFx('toxicPuff', x.f.side, c, r, 0.5);
      x.b.cheer = 2;
    },
    ai: (b, f) => b.targetable(b.foe(f)),
  },
  {
    id: 'death_mark', name: 'Death Mark', cls: 'rogue', cost: 1, rarity: 'mythic', element: 'shadow', damaging: false, lock: 0.25,
    dmg: '50% back', short: 'Mark the enemy for 6s. When it ends, they take 50% of the damage you dealt in it.',
    cast: x => {
      if (!x.b.targetable(x.foe)) { x.b.text(x.foe, 'MISS', '#bcbcbc'); return; }
      x.foe.st.deathMark = 6; x.foe.deathMarkAcc = 0;
      x.b.text(x.foe, 'MARKED', '#9878f8');
      x.b.cheer = 2;
    },
    ai: (b, f) => b.targetable(b.foe(f)),
  },
];
