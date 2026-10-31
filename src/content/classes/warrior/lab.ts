// What the dev build's Art Lab shows for the Warrior (DEV TOOLS > ART LAB).
import type { ClassLab } from '../registry';

export default {
  spells: [
    { card: 'step_slash', foeCol: 4, loop: 1.6 }, { card: 'lunge', foeCol: 4, loop: 1.6 }, { card: 'leap_strike', foeCol: 4, loop: 2.4 },
    { card: 'execute', loop: 1.6 }, { card: 'chain_hook', foeCol: 4 }, { card: 'shieldbreaker' },
    { card: 'shield_slam', loop: 1.6 }, { card: 'mortal_strike', loop: 1.6 }, { card: 'wide_cleave', loop: 1.6 },
    { card: 'ground_slam', loop: 2.2 }, { card: 'seismic_wave', loop: 2.4 }, { card: 'ground_shatter', loop: 2.6 },
    { card: 'rampage', foeCol: 4, loop: 2.4 }, { card: 'titans_fall', foeCol: 4, loop: 2.6 }, { card: 'war_banner', loop: 3 },
    { card: 'battle_shout', loop: 1.4 }, { card: 'intimidating_roar', loop: 1.6 }, { card: 'berserk', loop: 1.6 },
    { card: 'rallying_cry', loop: 1.6 }, { card: 'avatar_of_war' }, { card: 'last_stand', loop: 6.2, hp: 0.4 },
    { card: 'guard', loop: 1.2 }, { card: 'iron_skin', loop: 1.4 }, { card: 'unbreakable', loop: 1.6 },
    { card: 'spell_reflection', loop: 1.4 }, { card: 'shield_wall', loop: 1.6 },
  ],
  // the pixelfx pass (#93) split these off older shared kinds
  was: {
    stepSlash: 'cleaveHeavy', rampage: 'cleaveHeavy', leapSmash: 'smash', execute: 'smash', hammer: 'smash', shieldSlam: 'smash', mortal: 'smash',
    groundSlam: 'shockwave', shatter: 'shockwave', lastStandBlast: 'shockwave', seismic: 'quake', titanFall: 'quake',
    battleShout: 'shout', roar: 'shout', berserk: 'shout', rally: 'shout', avatar: 'transform', lastStand: 'transform',
    guardUp: null, ironSkin: null, unbreakable: null, reflectUp: null, wallRise: null,
  },
  drafts: [],
} satisfies ClassLab;
