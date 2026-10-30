// Priest CPU: its three playstyles, Hard's pick per matchup, and how far its basic attacks reach.
import { TUNING, AGGRO, CONSERVATIVE, DEFENSIVE, type ClassCpu } from '../../api';

const cpu: ClassCpu = {
  styles: [
    { ...AGGRO, id: 'priest_zealot', name: 'Zealot', cls: 'priest', deck: 'holy', desc: 'Holy Fire and Penance on cooldown, pushes up to Smite range.' },
    { ...CONSERVATIVE, id: 'priest_plaguelord', name: 'Plaguelord', cls: 'priest', deck: 'shadow', desc: 'Curses and DoTs first, waits for them to stack before spending big.' },
    { ...DEFENSIVE, id: 'priest_shepherd', name: 'Shepherd', cls: 'priest', deck: 'sanctum', desc: 'Shields, heals and blessed ground; outlasts the enemy.' },
  ],
  /** Hard's style against each player class, from `npm run balance -- --pools style-starter --cpu hard`. */
  counter: { warrior: 'priest_plaguelord', mage: 'priest_plaguelord', rogue: 'priest_plaguelord', ranger: 'priest_shepherd' },
  reach(b, _f, foe, dist, aligned, seen) {
    // Smite finds the enemy in any row within its reach, so the Priest releases its heavy whenever they're that close
    const light = seen && aligned;
    return { light, heavy: b.targetable(foe) && dist >= 1 && dist <= TUNING.priest.smiteRange };
  },
  stay: (b, f) => (b.blessUnder(f) ? 0.9 : 0),
};
export default cpu;
