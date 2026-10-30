// Rogue CPU: its three playstyles, Hard's pick per matchup, and how far its basic attacks reach.
import { TUNING, AGGRO, CONSERVATIVE, DEFENSIVE, type ClassCpu } from '../../api';

const cpu: ClassCpu = {
  styles: [
    { ...AGGRO, id: 'rogue_cutthroat', name: 'Cutthroat', cls: 'rogue', deck: 'assassin', desc: 'Blinks in over and over, never waits for Stealth.' },
    { ...CONSERVATIVE, bigMin: 4, id: 'rogue_shadow', name: 'Shadow', cls: 'rogue', deck: 'shadow', desc: 'Waits in Stealth for a big Ambush or Eviscerate.' },
    { ...DEFENSIVE, range: 0, id: 'rogue_duelist', name: 'Duelist', cls: 'rogue', deck: 'poisoner', desc: 'Dodges, parries and cloaks while Poison ticks.' },
  ],
  /** Hard's style against each player class, from `npm run balance -- --pools style-starter --cpu hard`. */
  counter: { warrior: 'rogue_cutthroat', mage: 'rogue_cutthroat', ranger: 'rogue_duelist', priest: 'rogue_cutthroat' },
  reach(_b, _f, _foe, dist, aligned, seen) {
    // the Stab reaches TUNING.rogue.stabReach panels; the Throwing Knife flies down the whole row
    const light = seen && aligned && dist >= 1 && dist <= TUNING.rogue.stabReach;
    return { light, heavy: seen && aligned };
  },
  taps: true,
  windup: true,
};
export default cpu;
