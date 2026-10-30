// Mage ready-made spell decks: the starter, then one deck per Mythic.
import type { ClassDecks } from '../../api';

const decks: ClassDecks = {
  starterName: 'Elementalist',
  starter: {
    arcane_missiles: 4, arcane_focus: 3, arcane_barrier: 2, blink: 2, repulse: 2, ignite: 3, fireball: 3, scorch: 2, ice_wall: 2, frost_nova: 2,
    arcane_blast: 1, flamestrike: 1,
    meteor: 1, deep_freeze: 1,
    inferno: 1,
  },
  mythic: [
    {
      id: 'pyromancer', name: 'Pyromancer', mythic: 'inferno', cards: {
        arcane_missiles: 4, arcane_focus: 3, arcane_barrier: 2, blink: 2, ignite: 4, fireball: 4, scorch: 3, frost_nova: 1,
        flamestrike: 2, arcane_blast: 1,
        dragons_breath: 1, meteor: 1, deep_freeze: 1,
        inferno: 1,
      },
    },
    {
      id: 'archmage', name: 'Archmage', mythic: 'ascendance', cards: {
        arcane_missiles: 4, arcane_focus: 4, arcane_barrier: 3, blink: 2, repulse: 2, ignite: 2, fireball: 3, frost_nova: 2,
        arcane_intellect: 2, arcane_blast: 2,
        arcane_surge: 1, arcane_power: 1, counterspell: 1,
        ascendance: 1,
      },
    },
    {
      id: 'cryomancer', name: 'Cryomancer', mythic: 'glacial_fortress', cards: {
        arcane_missiles: 4, arcane_focus: 3, arcane_barrier: 2, blink: 2, repulse: 1, ice_wall: 2, frost_nova: 4, fireball: 3, ignite: 1, scorch: 1,
        blizzard: 2, arcane_blast: 1,
        deep_freeze: 1, meteor: 1, arcane_surge: 1,
        glacial_fortress: 1,
      },
    },
  ],
};
export default decks;
