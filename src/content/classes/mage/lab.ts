// What the dev build's Art Lab shows for the Mage (DEV TOOLS > ART LAB).
import type { ClassLab } from '../registry';

export default {
  spells: [
    { card: 'arcane_missiles', loop: 1.6 }, { card: 'arcane_blast', loop: 1.4 }, { card: 'arcane_surge', loop: 1.6 },
    { card: 'repulse', foeCol: 3, loop: 1.6 }, { card: 'blink', foeCol: 3, loop: 1.2 }, { card: 'counterspell', loop: 1.4 },
    { card: 'arcane_focus', loop: 1.2 }, { card: 'arcane_barrier', loop: 1.4 }, { card: 'arcane_intellect', loop: 1.4 },
    { card: 'arcane_power', loop: 1.4 }, { card: 'evocation', loop: 1.5 }, { card: 'ascendance', loop: 1.8 },
    { card: 'fireball', foeCol: 3, loop: 1.6 }, { card: 'flamestrike', foeCol: 3, loop: 2.2 }, { card: 'meteor', loop: 2.8 },
    { card: 'comet_storm', loop: 2.8 }, { card: 'dragons_breath', foeCol: 3, loop: 1.6 }, { card: 'inferno', loop: 1.6 },
    { card: 'ignite', loop: 1.6 }, { card: 'scorch', loop: 1.8 }, { card: 'frost_nova', foeCol: 3, loop: 1.8 },
    { card: 'blizzard', loop: 4.8 }, { card: 'deep_freeze', loop: 1.4 }, { card: 'ice_wall', loop: 1.4 },
    { card: 'ice_block', loop: 1.4 }, { card: 'glacial_fortress', loop: 1.8 },
  ],
  basicsFoeCol: 4,
  // the pixelfx pass split these off older shared kinds, or gave a spell its first effect
  was: {
    fireballBlast: 'explode', scorch: 'explode', meteorBlast: 'explode', comet: 'explode', dragonsBreath: 'explode', inferno: 'explode',
    arcaneSurge: 'arcaneHit', deepFreeze: 'shard', ascendance: 'transform',
    arcaneFocus: null, arcaneBarrier: null, arcaneIntellect: null, arcanePower: null, evocation: null,
    ignite: null, iceWall: null, iceBlock: null, glacialFortress: null,
  },
  drafts: [],
} satisfies ClassLab;
