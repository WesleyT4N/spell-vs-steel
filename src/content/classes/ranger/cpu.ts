// Ranger CPU: its three playstyles, Hard's pick per matchup, and how far its basic attacks reach.
import { AGGRO, CONSERVATIVE, DEFENSIVE, rangedGoal, crowding, poolPick, type ClassCpu } from '../../api';

const cpu: ClassCpu = {
  styles: [
    { ...AGGRO, range: 0, id: 'ranger_skirmisher', name: 'Skirmisher', cls: 'ranger', deck: 'beastmaster', desc: 'Keeps the pets and arrows coming, chases the enemy\'s row.' },
    { ...CONSERVATIVE, id: 'ranger_sniper', name: 'Sniper', cls: 'ranger', deck: 'marksman', desc: 'Stands still for Energy and holds for Power Shot and Kill Shot.' },
    { ...DEFENSIVE, id: 'ranger_trapper', name: 'Trapper', cls: 'ranger', deck: 'trapper', desc: 'Hangs back, mines the enemy area and Disengages from anyone close.' },
  ],
  /** Hard's style against each player class, from `npm run balance -- --pools style-starter --cpu hard`. */
  counter: { warrior: 'ranger_sniper', mage: 'ranger_sniper', rogue: 'ranger_sniper', priest: 'ranger_sniper' },
  reach(_b, _f, foe, _dist, aligned, seen) {
    // Hunter's Mark: the Ranger's shots home in from any row
    const light = seen && (aligned || foe.st.hunted > 0);
    return { light, heavy: light };
  },
  taps: true,
  stay: (_b, _f, aligned, seen) => (aligned || !seen ? 0.85 : 0),
  goal: x => rangedGoal(x, crowding(x.b, x.foe)),
  // it earns about 2 more Energy standing still; the core combo is Steady Focus, Hunter's Mark, Rapid Fire
  pick: x => poolPick(x, { expect: 2, first: { steady_focus: -9, hunters_mark: -8, rapid_fire: -7 } }),
};
export default cpu;
