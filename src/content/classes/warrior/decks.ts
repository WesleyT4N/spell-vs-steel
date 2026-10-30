// Warrior ready-made spell decks: the starter, then one deck per Mythic.
import type { ClassDecks } from '../../api';

const decks: ClassDecks = {
  starterName: 'Brawler',
  starter: {
    step_slash: 4, guard: 3, lunge: 3, iron_skin: 2, shield_wall: 2, execute: 3, chain_hook: 3, shieldbreaker: 2, battle_shout: 2,
    leap_strike: 1, wide_cleave: 1,
    rampage: 1, shield_slam: 1, rallying_cry: 1,
    titans_fall: 1,
  },
  mythic: [
    {
      id: 'earthshaker', name: 'Earthshaker', mythic: 'titans_fall', cards: {
        step_slash: 3, guard: 3, lunge: 3, iron_skin: 3, shield_wall: 2, execute: 2, chain_hook: 3, shieldbreaker: 2, battle_shout: 2,
        ground_slam: 2, leap_strike: 1,
        ground_shatter: 1, shield_slam: 1, rallying_cry: 1,
        titans_fall: 1,
      },
    },
    {
      id: 'juggernaut', name: 'Juggernaut', mythic: 'avatar_of_war', cards: {
        step_slash: 3, guard: 4, lunge: 3, iron_skin: 3, execute: 3, chain_hook: 3, shieldbreaker: 2, battle_shout: 2,
        leap_strike: 2, wide_cleave: 1,
        rampage: 1, mortal_strike: 1, berserk: 1,
        avatar_of_war: 1,
      },
    },
    {
      id: 'bulwark', name: 'Bulwark', mythic: 'last_stand', cards: {
        guard: 3, iron_skin: 3, shield_wall: 2, step_slash: 4, lunge: 3, execute: 3, chain_hook: 3, intimidating_roar: 2,
        wide_cleave: 2, leap_strike: 1,
        unbreakable: 1, rallying_cry: 1, spell_reflection: 1,
        last_stand: 1,
      },
    },
  ],
};
export default decks;
