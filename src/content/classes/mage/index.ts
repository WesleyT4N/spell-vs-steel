// The Mage module: everything the game needs to know about the class, gathered from this folder.
import type { ClassModule } from '../../api';
import rules from './rules';
import decks from './decks';
import cpu from './cpu';
import lessons from './tutorial';
import lab from './lab';

export default {
  id: 'mage',
  info: {
    name: 'MAGE', res: 'MANA', resColor: '#a4e4fc', gem: '#0058f8', pipBase: '#0000a8', pip: '#3cbcfc', refill: 'REFILLS',
    basics: ['ARCANE BOLT', 'CHARGED BOLT'],
    blurb: ['GLASS CANNON', 'MANA GROWS EVERY DRAW'],
    backdrop: ['#1c1c38', '#4428bc', '#940084'],
  },
  rules, decks, cpu, lessons, lab,
} satisfies ClassModule;
