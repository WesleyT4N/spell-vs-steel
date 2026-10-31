// What the dev build's Art Lab shows for the Rogue (DEV TOOLS > ART LAB).
import type { ClassLab } from '../registry';

export default {
  spells: [
    { card: 'shadowstep', foeCol: 3, loop: 1.4 }, { card: 'ambush', loop: 1.6 }, { card: 'shiv', loop: 1.2 },
    { card: 'kick', foeCol: 2, loop: 1.4 }, { card: 'pickpocket', foeCol: 2, loop: 1.4 }, { card: 'kidney_shot', foeCol: 2, loop: 1.6 },
    { card: 'fan_of_knives', loop: 1.4 }, { card: 'blade_flurry', loop: 1.6 }, { card: 'eviscerate', loop: 1.8 },
    { card: 'killing_spree', loop: 2.8 }, { card: 'riposte', loop: 1.8 }, { card: 'poison_vial', foeCol: 4, loop: 1.8 },
    { card: 'deadly_poison', loop: 1.4 }, { card: 'envenom', loop: 1.4 }, { card: 'pandemic', loop: 1.6 },
    { card: 'blind', loop: 1.6 }, { card: 'vanish', loop: 1.4 }, { card: 'evasion', loop: 1.2 },
    { card: 'cloak_of_shadows', loop: 1.4 }, { card: 'cold_blood', loop: 1.4 }, { card: 'smokescreen', loop: 1.8 },
    { card: 'shadow_dance', loop: 1.4 }, { card: 'adrenaline_rush', loop: 1.2 }, { card: 'shadow_clone', loop: 1.4 },
    { card: 'nights_embrace', loop: 1.8 }, { card: 'death_mark', loop: 1.4 },
  ],
  basicsFoeCol: 2,
  // the pixelfx pass split these off older shared kinds. The Rogue-only drawings ('dagger', 'stab', 'toxicPuff',
  // 'lob' and the 'knife' shot) were removed with it, so those BEFORE looks show nothing; 'smoke', 'smash' and
  // 'guard' are still drawn for other classes and show as they were.
  was: {
    knifeHit: null,
    shadowBlink: 'smoke', vanish: 'smoke', evasion: 'smoke', smokescreen: 'smoke', shadowDance: 'smoke', shadowClone: 'smoke', nightsEmbrace: 'smoke',
    shadowstep: 'stab', ambush: 'stab', flurry: 'stab', spree: 'stab', eviscerate: 'stab', fanKnife: 'stab', riposteHit: 'stab',
    shiv: 'dagger', pickpocket: 'dagger', kidneyShot: 'dagger', kick: 'smash', riposte: 'guard',
    vialLob: 'lob', vialBurst: 'toxicPuff', deadlyPoison: 'toxicPuff', envenom: 'toxicPuff', blind: 'toxicPuff', pandemic: 'toxicPuff',
    cloak: null, coldBlood: null, adrenaline: null, deathMark: null,
  },
  drafts: [],
} satisfies ClassLab;
