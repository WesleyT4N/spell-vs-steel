// What the dev build's Art Lab shows for the Priest (DEV TOOLS > ART LAB).
import type { ClassLab } from '../registry';

export default {
  basicsFoeCol: 3,
  spells: [
    { card: 'prayer', foeCol: 3, loop: 1.4 }, { card: 'flash_heal', foeCol: 3, loop: 1.4 }, { card: 'holy_fire', foeCol: 3, loop: 1.4 },
    { card: 'penance', foeCol: 3, loop: 1.6 }, { card: 'power_word_shield', foeCol: 3, loop: 1.4 }, { card: 'hallowed_ground', foeCol: 3, loop: 1.4 },
    { card: 'sanctuary', foeCol: 3, loop: 1.4 }, { card: 'wellspring', foeCol: 3, loop: 1.4 }, { card: 'aegis_field', foeCol: 3, loop: 1.4 },
    { card: 'sacred_ground', foeCol: 3, loop: 1.6 }, { card: 'holy_nova', foeCol: 3, loop: 1.4 }, { card: 'holy_wall', loop: 1.4 },
    { card: 'shadow_word_pain', foeCol: 3, loop: 1.4 }, { card: 'devouring_plague', foeCol: 3, loop: 1.4 }, { card: 'desecrate', foeCol: 3, loop: 1.4 },
    { card: 'hex', foeCol: 3, loop: 1.4 }, { card: 'mind_sear', foeCol: 3, loop: 1.4 }, { card: 'void_rift', loop: 1.4 },
    { card: 'shadow_word_death', foeCol: 3, loop: 1.4 }, { card: 'psychic_scream', foeCol: 3, loop: 2.4 }, { card: 'divine_hymn', foeCol: 3, loop: 3.6 },
    { card: 'halo', foeCol: 3, loop: 3.4 }, { card: 'power_infusion', foeCol: 3, loop: 1.6 }, { card: 'wrath_of_heaven', loop: 2.8 },
    { card: 'holy_sanctum', foeCol: 3, loop: 1.8 }, { card: 'shadowform', loop: 1.8 },
  ],
  // the pixelfx pass split these off older shared kinds (null: it had no effect)
  was: {
    smite: 'holyPillar', sparkHit: null, prayer: null, flashHeal: 'healBurst', holyFire: 'holyPillar', penanceBolt: 'holyPillar', pwShield: null,
    blessPower: 'healBurst', blessHeal: 'healBurst', blessMana: 'healBurst', blessShield: 'healBurst', blessSacred: 'healBurst', holyWallRise: null,
    swPain: 'shadowHit', plague: 'shadowHit', desecrate: 'shadowHit', hex: 'shadowHit', mindSear: 'shadowHit', voidRift: 'shadowHit', swDeath: 'shadowHit',
    psychicScream: 'shout', hymnTick: 'healBurst', haloBolt: 'holyPillar', powerInfusion: 'transform', wrath: 'holyPillar',
    sanctum: 'transform', sanctumBless: 'healBurst', shadowform: 'transform', shadowformCurse: 'shadowHit',
  },
  drafts: [],
} satisfies ClassLab;
