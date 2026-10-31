// What the dev build's Art Lab shows for the Ranger (DEV TOOLS > ART LAB).
import type { ClassLab } from '../registry';

export default {
  spells: [
    { card: 'steady_focus', loop: 1.4 }, { card: 'hawk_strike', loop: 1.4 }, { card: 'hunters_mark', loop: 1.4 },
    { card: 'net', loop: 1.6 }, { card: 'disengage', foeCol: 3, loop: 1.2 }, { card: 'multi_shot', loop: 1.4 },
    { card: 'call_wolf', loop: 2 }, { card: 'power_shot', loop: 1.4 }, { card: 'rapid_fire', loop: 1.2 },
    { card: 'light_footed', loop: 1.4 }, { card: 'volley', loop: 2.2 }, { card: 'spirit_bear', loop: 1.6 },
    { card: 'kill_shot', loop: 2 }, { card: 'barrage', loop: 4.2 }, { card: 'explosive_shot', loop: 3.4 },
    { card: 'wyvern_sting', loop: 1.6 }, { card: 'bestial_wrath', loop: 2.4 }, { card: 'feign_death', loop: 1.6 },
    { card: 'deadeye', loop: 1.6 }, { card: 'hunters_domain', loop: 1.8 }, { card: 'call_of_the_wild', loop: 2.4 },
    { card: 'freezing_trap', loop: 1.2 }, { card: 'explosive_trap', loop: 1.2 }, { card: 'tripwire', loop: 1.2 },
    { card: 'minefield', loop: 1.2 }, { card: 'kill_command', loop: 1.4 },
  ],
  basicsFoeCol: 4,
  // the pixelfx pass split these off older shared kinds (null: it had no effect). The Ranger-only drawings ('aimed',
  // 'trapPop', 'arrowRain', 'bite', 'claw', 'hawkDive' and the arrow, aimed, sting, net, wolf and hawk shots) were
  // removed with it, so those BEFORE looks show nothing; 'smoke', 'explode', 'shout' and 'transform' are still drawn
  // for other classes and show as they were. Traps only go off when the foe steps on one (Hunter's Domain fires the
  // one under them at once).
  was: {
    arrowHit: null, aimedHit: null, hawkStrikeHit: null, netHit: null,
    disengage: 'smoke', trapFreeze: 'trapPop', trapWire: 'trapPop', trapMine: 'trapPop', trapExplode: 'explode', trapBlast: 'explode',
    killShot: 'aimed', barrage: 'arrowRain', explosiveShot: 'explode', killCommand: 'shout', deadeye: 'transform',
    steadyFocus: null, huntersMark: null, rapidFire: null, lightFooted: null, spiritBear: null, killShotAim: null,
    bestialWrath: null, feignDeath: null, huntersDomain: null, callOfTheWild: null,
  },
  drafts: [],
} satisfies ClassLab;
