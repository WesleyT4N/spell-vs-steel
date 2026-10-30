// Rogue ready-made spell decks: the starter, then one deck per Mythic.
import type { ClassDecks } from '../../api';

const decks: ClassDecks = {
  starterName: 'Assassin',
  starter: {
    vanish: 3, shadowstep: 4, ambush: 3, shiv: 4, evasion: 1, kick: 2, poison_vial: 2, deadly_poison: 2, envenom: 2,
    cold_blood: 2, riposte: 1, pickpocket: 1,
    eviscerate: 1, kidney_shot: 1,
    death_mark: 1,
  },
  mythic: [
    {
      id: 'executioner', name: 'Executioner', mythic: 'death_mark', cards: {
        vanish: 3, shadowstep: 4, ambush: 3, shiv: 4, evasion: 1, kick: 2, fan_of_knives: 2, deadly_poison: 2, envenom: 2,
        cold_blood: 2, blade_flurry: 1,
        eviscerate: 1, killing_spree: 1, kidney_shot: 1,
        death_mark: 1,
      },
    },
    {
      id: 'plaguebringer', name: 'Plaguebringer', mythic: 'pandemic', cards: {
        shadowstep: 4, shiv: 3, envenom: 4, deadly_poison: 4, poison_vial: 3, vanish: 2, kick: 2,
        pickpocket: 2, cold_blood: 2,
        eviscerate: 1, kidney_shot: 1, adrenaline_rush: 1,
        pandemic: 1,
      },
    },
    {
      id: 'phantom', name: 'Phantom', mythic: 'nights_embrace', cards: {
        vanish: 4, shadowstep: 4, ambush: 4, shiv: 3, evasion: 2, kick: 2, fan_of_knives: 2, deadly_poison: 1,
        cold_blood: 2, blade_flurry: 1, riposte: 1,
        shadow_dance: 1, shadow_clone: 1, eviscerate: 1,
        nights_embrace: 1,
      },
    },
  ],
};
export default decks;
