// Warrior CPU: its three playstyles, Hard's pick per matchup, and how far its basic attacks reach.
import { AGGRO, CONSERVATIVE, DEFENSIVE, meleeGoal, type ClassCpu } from '../../api';

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
  crowds: true,
  goal: meleeGoal,
  // builders first, then spenders we can expect to afford this turn
  pick({ idx, res, cost, want, style }) {
    let budget = res + 3;
    const builders = idx.filter(i => cost(i) === 0 && want(i) > -1);
    const spenders = idx.filter(i => cost(i) > 0).sort((a, c) => cost(a) - cost(c) || want(c) - want(a));
    const chosen = [...builders];
    // a big finisher is worth banking for: queue it last and keep only what still leaves room for it
    const bigMin = style.bigMin;
    const big = bigMin ? spenders.filter(i => cost(i) >= bigMin).pop() : undefined;
    if (big !== undefined) budget -= cost(big);
    for (const i of spenders) if (i !== big && cost(i) <= budget) { chosen.push(i); budget -= cost(i); }
    if (big !== undefined) chosen.push(big);
    return chosen;
  },
};
export default cpu;
