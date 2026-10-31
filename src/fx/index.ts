// Which battle fx play a pixelfx-method effect (see docs/FX.md). Any fx kind not registered here keeps its
// hand-drawn version in src/game/fxView.ts.
import { registerPfx, registerShotPfx, type PfxModule } from '../game/pfx';

/** Every effect module, by id ("warrior/cleave-a"), for the labs and the contact-sheet tool. */
export const EFFECTS: Record<string, PfxModule> = Object.fromEntries(
  Object.entries(import.meta.glob<{ default: PfxModule }>('./*/*.ts', { eager: true }))
    .filter(([, m]) => m.default).map(([path, m]) => [path.slice(2, -3), m.default]),
);

/** The effect each fx kind plays in the game. */
export const PLAYS: Record<string, string> = {
  cleave: 'warrior/cleave',
  cleaveHeavy: 'warrior/cleave-heavy',
  stepSlash: 'warrior/step-slash',
  thrust: 'warrior/thrust',
  leapSmash: 'warrior/leap-smash',
  execute: 'warrior/execute',
  hammer: 'warrior/hammer',
  shieldSlam: 'warrior/shield-slam',
  mortal: 'warrior/mortal',
  rampage: 'warrior/rampage',
  groundSlam: 'warrior/ground-slam',
  shatter: 'warrior/shatter',
  lastStandBlast: 'warrior/last-stand-blast',
  wide: 'warrior/wide',
  seismic: 'warrior/seismic',
  titanFall: 'warrior/titan-fall',
  battleShout: 'warrior/battle-shout',
  roar: 'warrior/roar',
  berserk: 'warrior/berserk',
  rally: 'warrior/rally',
  avatar: 'warrior/avatar',
  lastStand: 'warrior/last-stand',
  guardUp: 'warrior/guard-up',
  ironSkin: 'warrior/iron-skin',
  unbreakable: 'warrior/unbreakable',
  reflectUp: 'warrior/reflect-up',
  wallRise: 'warrior/wall-rise',
  banner: 'warrior/banner',
  // Mage
  arcaneHit: 'mage/arcane-blast',
  arcaneSurge: 'mage/arcane-surge',
  blink: 'mage/blink',
  counter: 'mage/counterspell',
  arcaneFocus: 'mage/arcane-focus',
  arcaneBarrier: 'mage/arcane-barrier',
  arcaneIntellect: 'mage/arcane-intellect',
  arcanePower: 'mage/arcane-power',
  evocation: 'mage/evocation',
  ascendance: 'mage/ascendance',
  fireballBlast: 'mage/fireball-blast',
  pillar: 'mage/flamestrike',
  meteorFall: 'mage/meteor-fall',
  meteorBlast: 'mage/meteor',
  comet: 'mage/comet',
  dragonsBreath: 'mage/dragons-breath',
  inferno: 'mage/inferno',
  ignite: 'mage/ignite',
  scorch: 'mage/scorch',
  novaZone: 'mage/frost-nova-zone',
  nova: 'mage/frost-nova',
  shard: 'mage/blizzard',
  deepFreeze: 'mage/deep-freeze',
  iceWall: 'mage/ice-wall',
  iceBlock: 'mage/ice-block',
  glacialFortress: 'mage/glacial-fortress',
  // Rogue
  dagger: 'rogue/flick-cut',
  knifeHit: 'rogue/spinning-knife-hit',
  shadowBlink: 'rogue/blink',
  vanish: 'rogue/vanish',
  shadowstep: 'rogue/shadowstep',
  ambush: 'rogue/ambush',
  shiv: 'rogue/shiv',
  evasion: 'rogue/evasion',
  kick: 'rogue/kick',
  vialLob: 'rogue/poison-vial',
  vialBurst: 'rogue/poison-vial-burst',
  deadlyPoison: 'rogue/deadly-poison',
  envenom: 'rogue/envenom',
  fanKnife: 'rogue/fan-of-knives',
  flurry: 'rogue/blade-flurry',
  cloak: 'rogue/cloak-of-shadows',
  pickpocket: 'rogue/pickpocket',
  riposte: 'rogue/riposte',
  riposteHit: 'rogue/riposte-hit',
  coldBlood: 'rogue/cold-blood',
  smokescreen: 'rogue/smokescreen',
  eviscerate: 'rogue/eviscerate',
  spree: 'rogue/killing-spree',
  shadowDance: 'rogue/shadow-dance',
  blind: 'rogue/blind',
  adrenaline: 'rogue/adrenaline-rush',
  kidneyShot: 'rogue/kidney-shot',
  shadowClone: 'rogue/shadow-clone',
  nightsEmbrace: 'rogue/nights-embrace',
  pandemic: 'rogue/pandemic',
  deathMark: 'rogue/death-mark',
};

// Priest: Smite, the Holy Spark's hit, and a kind per spell (cards.ts)
Object.assign(PLAYS, {
  smite: 'priest/judgment',
  sparkHit: 'priest/holy-spark-hit',
  prayer: 'priest/prayer',
  flashHeal: 'priest/flash-heal',
  holyFire: 'priest/holy-fire',
  penanceBolt: 'priest/penance',
  pwShield: 'priest/power-word-shield',
  blessPower: 'priest/hallowed-ground',
  blessHeal: 'priest/sanctuary',
  blessMana: 'priest/wellspring',
  blessShield: 'priest/aegis-field',
  blessSacred: 'priest/sacred-ground',
  holyNova: 'priest/holy-nova',
  holyWallRise: 'priest/holy-wall',
  swPain: 'priest/shadow-word-pain',
  plague: 'priest/devouring-plague',
  desecrate: 'priest/desecrate',
  hex: 'priest/hex',
  mindSear: 'priest/mind-sear',
  voidRift: 'priest/void-rift',
  swDeath: 'priest/shadow-word-death',
  psychicScream: 'priest/psychic-scream',
  hymnTick: 'priest/divine-hymn',
  haloBolt: 'priest/halo',
  powerInfusion: 'priest/power-infusion',
  wrath: 'priest/wrath-of-heaven',
  sanctum: 'priest/holy-sanctum',
  sanctumBless: 'priest/holy-sanctum-bless',
  shadowform: 'priest/shadowform',
  shadowformCurse: 'priest/shadowform-curse',
});

// Ranger: the Arrow's and Aimed Shot's hits, the pets' attacks, the traps going off, and a kind per spell (cards.ts)
Object.assign(PLAYS, {
  arrowHit: 'ranger/clean-shaft-hit',
  aimedHit: 'ranger/sonic-boom-hit',
  hawkStrikeHit: 'ranger/hawk-strike-hit',
  netHit: 'ranger/net-hit',
  bite: 'ranger/bite',
  hawkDive: 'ranger/hawk-dive',
  claw: 'ranger/spirit-bear-claw',
  aimed: 'ranger/power-shot',
  arrowRain: 'ranger/volley',
  steadyFocus: 'ranger/steady-focus',
  huntersMark: 'ranger/hunters-mark',
  disengage: 'ranger/disengage',
  trapFreeze: 'ranger/freezing-trap',
  trapExplode: 'ranger/explosive-trap',
  trapBlast: 'ranger/explosive-trap',
  trapWire: 'ranger/tripwire',
  trapMine: 'ranger/minefield',
  rapidFire: 'ranger/rapid-fire',
  lightFooted: 'ranger/light-footed',
  spiritBear: 'ranger/spirit-bear',
  killShotAim: 'ranger/kill-shot-aim',
  killShot: 'ranger/kill-shot',
  barrage: 'ranger/barrage',
  explosiveShot: 'ranger/explosive-shot',
  killCommand: 'ranger/kill-command',
  bestialWrath: 'ranger/bestial-wrath',
  feignDeath: 'ranger/feign-death',
  deadeye: 'ranger/deadeye',
  huntersDomain: 'ranger/hunters-domain',
  callOfTheWild: 'ranger/call-of-the-wild',
});

for (const [kind, id] of Object.entries(PLAYS)) registerPfx(kind, EFFECTS[id]);

/** The effect each flying projectile kind plays (Projectile.kind); kinds not listed keep their hand-drawn shot. */
export const SHOT_PLAYS: Record<string, string> = {
  orb: 'mage/rune-star',
  beam: 'mage/rune-comet',
  missile: 'mage/arcane-missiles',
  gust: 'mage/repulse',
  fireball: 'mage/fireball',
  // Rogue
  knife: 'rogue/spinning-knife',
};

// Priest: the Holy Spark (its hit is the sparkHit fx above)
Object.assign(SHOT_PLAYS, { spark: 'priest/holy-spark' });

// Ranger: the Arrow, Aimed Shot, the Hawk, Net, the wolf, Wyvern Sting, and the arrows Multi-Shot and Explosive
// Shot fire (Projectile.look: they are still 'arrow' shots to the battle)
Object.assign(SHOT_PLAYS, {
  arrow: 'ranger/clean-shaft',
  aimed: 'ranger/sonic-boom',
  hawk: 'ranger/hawk-strike',
  net: 'ranger/net',
  wolf: 'ranger/call-wolf',
  sting: 'ranger/wyvern-sting',
  multiArrow: 'ranger/multi-shot',
  explosiveArrow: 'ranger/explosive-arrow',
});

for (const [kind, id] of Object.entries(SHOT_PLAYS)) registerShotPfx(kind, EFFECTS[id]);
