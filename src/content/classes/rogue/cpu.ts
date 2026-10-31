// Rogue CPU: its three playstyles, Hard's pick per matchup, and how far its basic attacks reach.
import { TUNING, AGGRO, CONSERVATIVE, DEFENSIVE, meleeGoal, type ClassCpu } from '../../api';

const STEALTH = ['vanish', 'shadow_clone', 'smokescreen', 'nights_embrace'];
/** Chain order: setup 0, blinks and openers 1, everything else (the finishers) 2. */
const RANK: Record<string, number> = {
  vanish: 0, shadow_clone: 0, smokescreen: 0, nights_embrace: 0, cold_blood: 0, deadly_poison: 0, adrenaline_rush: 0, shadow_dance: 0,
  pandemic: 0, death_mark: 0, poison_vial: 0, evasion: 0, riposte: 0, cloak_of_shadows: 0,
  shadowstep: 1, ambush: 1, blade_flurry: 1, killing_spree: 1,
};

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
  goal: meleeGoal,
  // spend the full Energy bar on a chain: setup first, then a blink, then the finishers that want to be up close;
  // Ambush only comes with a Stealth card cast before it
  pick({ offer, idx, res, cost, want }) {
    let energy = res;
    const chosen: number[] = [];
    const take = (i: number): void => {
      if (chosen.includes(i) || cost(i) > energy) return;
      chosen.push(i);
      energy -= cost(i);
      if (offer[i] === 'pickpocket') energy += 1;
    };
    const hide = idx.find(i => STEALTH.includes(offer[i]));
    const ambush = idx.find(i => offer[i] === 'ambush');
    if (hide !== undefined && ambush !== undefined && cost(hide) + cost(ambush) <= energy) { take(hide); take(ambush); }
    for (const i of idx.filter(i => offer[i] !== 'ambush').sort((a, c) => want(c) - want(a))) take(i);
    // finishers (Shiv, Kidney Shot, Envenom, Eviscerate...) go last, after the chain is set up
    return chosen.sort((a, c) => (RANK[offer[a]] ?? 2) - (RANK[offer[c]] ?? 2));
  },
};
export default cpu;
