// Warrior CPU: its three playstyles, Hard's pick per matchup, and how far its basic attacks reach.
import { AGGRO, CONSERVATIVE, DEFENSIVE, type ClassCpu } from '../../api';

const cpu: ClassCpu = {
  styles: [
    { ...AGGRO, id: 'warrior_berserker', name: 'Berserker', cls: 'warrior', deck: 'berserker', desc: 'Lives on the border, swings constantly and spends Rage the moment it has it.' },
    { ...CONSERVATIVE, id: 'warrior_warlord', name: 'Warlord', cls: 'warrior', deck: 'warlord', desc: 'Hooks and zones first, banks Rage for Titan\'s Fall and Rampage.' },
    { ...DEFENSIVE, range: 0, id: 'warrior_juggernaut', name: 'Juggernaut', cls: 'warrior', deck: 'juggernaut', desc: 'Guards and walls up, builds Rage from blocked hits, punishes from behind its shield.' },
  ],
  /** Hard's style against each player class, from `npm run balance -- --pools style-starter --cpu hard`. */
  counter: { mage: 'warrior_juggernaut', rogue: 'warrior_berserker', ranger: 'warrior_juggernaut', priest: 'warrior_juggernaut' },
  reach(_b, _f, _foe, dist, aligned, seen) {
    // the Cleave reaches the 2 panels ahead
    const light = seen && aligned && dist >= 1 && dist <= 2;
    return { light, heavy: light };
  },
};
export default cpu;
