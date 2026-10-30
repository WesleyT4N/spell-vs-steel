// Priest ready-made spell decks: the starter, then one deck per Mythic.
import type { ClassDecks } from '../../api';

const decks: ClassDecks = {
  starterName: 'Disciple',
  starter: {
    prayer: 2, flash_heal: 3, holy_fire: 3, penance: 3, power_word_shield: 2, hallowed_ground: 2, sanctuary: 2, shadow_word_pain: 3, devouring_plague: 2, desecrate: 2,
    wellspring: 1, hex: 1, mind_sear: 1,
    halo: 1, void_rift: 1,
    wrath_of_heaven: 1,
  },
  mythic: [
    {
      id: 'lightbringer', name: 'Lightbringer', mythic: 'wrath_of_heaven', cards: {
        prayer: 3, flash_heal: 2, holy_fire: 4, penance: 4, power_word_shield: 2, hallowed_ground: 4, sanctuary: 2, shadow_word_pain: 2,
        wellspring: 2, holy_nova: 1,
        halo: 1, power_infusion: 1, shadow_word_death: 1,
        wrath_of_heaven: 1,
      },
    },
    {
      id: 'sanctifier', name: 'Sanctifier', mythic: 'holy_sanctum', cards: {
        prayer: 3, flash_heal: 3, holy_fire: 3, penance: 3, power_word_shield: 2, hallowed_ground: 3, sanctuary: 3, shadow_word_pain: 3,
        wellspring: 2, holy_wall: 1,
        aegis_field: 1, sacred_ground: 1, halo: 1,
        holy_sanctum: 1,
      },
    },
    {
      id: 'voidcaller', name: 'Voidcaller', mythic: 'shadowform', cards: {
        prayer: 2, flash_heal: 1, holy_fire: 3, penance: 3, power_word_shield: 2, shadow_word_pain: 4, devouring_plague: 4, desecrate: 3, hallowed_ground: 1,
        mind_sear: 1, hex: 1, wellspring: 1,
        void_rift: 1, shadow_word_death: 1, halo: 1,
        shadowform: 1,
      },
    },
  ],
};
export default decks;
