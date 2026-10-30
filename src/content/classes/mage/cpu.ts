// Mage CPU: its three playstyles, Hard's pick per matchup, and how far its basic attacks reach.
import { AGGRO, CONSERVATIVE, DEFENSIVE, type ClassCpu } from '../../api';

const cpu: ClassCpu = {
  styles: [
    { ...AGGRO, id: 'mage_blaster', name: 'Blaster', cls: 'mage', deck: 'pyromancer', desc: 'Casts everything as soon as it can, from the front of its area.' },
    { ...CONSERVATIVE, id: 'mage_archmage', name: 'Archmage', cls: 'mage', deck: 'arcanist', desc: 'Ramps Mana and waits for the right moment for Meteor and Arcane Surge.' },
    { ...DEFENSIVE, id: 'mage_kiter', name: 'Kiter', cls: 'mage', deck: 'cryomancer', desc: 'Keeps to the back column behind ice, freezes anyone who comes close.' },
  ],
  /** Hard's style against each player class, from `npm run balance -- --pools style-starter --cpu hard`. */
  counter: { warrior: 'mage_archmage', rogue: 'mage_blaster', ranger: 'mage_blaster', priest: 'mage_blaster' },
  reach(_b, _f, _foe, _dist, aligned, seen) {
    const light = seen && aligned;
    return { light, heavy: light };
  },
};
export default cpu;
