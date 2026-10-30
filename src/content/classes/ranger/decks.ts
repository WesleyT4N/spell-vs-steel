// Ranger ready-made spell decks: the starter, then one deck per Mythic.
import type { ClassDecks } from '../../api';

const decks: ClassDecks = {
  starterName: 'Hunter',
  starter: {
    steady_focus: 3, hawk_strike: 4, hunters_mark: 2, net: 2, disengage: 2, freezing_trap: 2, explosive_trap: 2, multi_shot: 3, call_wolf: 2, power_shot: 3,
    rapid_fire: 1, volley: 1,
    kill_shot: 1, explosive_shot: 1,
    deadeye: 1,
  },
  mythic: [
    {
      id: 'marksman', name: 'Marksman', mythic: 'deadeye', cards: {
        steady_focus: 4, hawk_strike: 3, hunters_mark: 3, net: 2, disengage: 2, multi_shot: 3, power_shot: 4, freezing_trap: 2,
        rapid_fire: 2, light_footed: 1,
        kill_shot: 1, explosive_shot: 1, feign_death: 1,
        deadeye: 1,
      },
    },
    {
      id: 'trapper', name: 'Trapper', mythic: 'hunters_domain', cards: {
        freezing_trap: 3, explosive_trap: 4, power_shot: 3, hawk_strike: 4, multi_shot: 3, steady_focus: 3, net: 2, disengage: 1,
        tripwire: 2, rapid_fire: 1,
        explosive_shot: 1, minefield: 1, kill_shot: 1,
        hunters_domain: 1,
      },
    },
    {
      id: 'beastmaster', name: 'Beastmaster', mythic: 'call_of_the_wild', cards: {
        call_wolf: 3, hawk_strike: 2, steady_focus: 3, hunters_mark: 2, net: 3, disengage: 3, multi_shot: 2, power_shot: 1, freezing_trap: 2, explosive_trap: 2,
        spirit_bear: 1, rapid_fire: 1, light_footed: 1,
        kill_command: 1, bestial_wrath: 1, feign_death: 1,
        call_of_the_wild: 1,
      },
    },
  ],
};
export default decks;
