// Mage tutorial lessons: what the tutorial says and deals that is specific to this class.
import type { ClassLessons } from '../../api';

const lessons: ClassLessons = {
  dummyCol: 4,
  hand: ['arcane_missiles', 'ignite', 'arcane_focus', 'frost_nova', 'fireball'],
  tryText: 'TRY ARCANE MISSILES, THEN IGNITE',
  light: [
    `TAP {attack} TO FIRE A BOLT FROM YOUR STAFF. IT FLIES DOWN YOUR WHOLE ROW AND HITS THE FIRST THING IN ITS WAY.`,
    'ALL THAT MATTERS IS BEING IN THE SAME ROW AS YOUR TARGET, SO YOU CAN STAY BACK WHERE IT IS SAFE.',
    'THE DUMMY HOPS TO A NEW ROW EVERY TIME YOU HIT IT. FOLLOW IT!',
  ],
  lightTip: 'GET IN ITS ROW AND TAP {attack}',
  resLine: 'MAGES RUN ON MANA (TOP LEFT). ATTACKS DON\'T BUILD MANA: IT COMES FROM THE DRAW SCREEN, WHICH YOU WILL SEE SOON.',
  heavyTip: 'HOLD {attack} UNTIL HEAVY!, THEN RELEASE',
  pointRes: false,
  spend: {
    title: 'SPENDING MANA',
    body: [
      'EVERY SPELL COSTS MANA (TOP RIGHT). MANA REFILLS TO FULL EACH TIME YOU OPEN THIS SCREEN, AND YOUR MAX GROWS BY 1 EACH TIME, UP TO 5.',
      'YOU HAVE 2 MANA NOW. KEEP THE TOTAL COST OF YOUR PICKS WITHIN IT: IT TURNS RED WHEN YOU GO OVER.',
      'EARLY TURNS ARE SMALL, LATE TURNS ARE HUGE. THAT IS THE MAGE\'S GAME.',
    ],
  },
  castLine: 'ARCANE MISSILES HOME IN WHEREVER THE TARGET IS. IGNITE SETS THE TARGET\'S COLUMN ON FIRE.',
  short: 'NOT ENOUGH MANA. IT REFILLS AT THE NEXT DRAW',
  refillsAtDraw: true,
  ccLine: 'MAGE FROST SPELLS LIKE FROST NOVA FREEZE. FREEZE FIRST, THEN HIT HARD.',
};
export default lessons;
