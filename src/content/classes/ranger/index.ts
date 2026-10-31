// The Ranger module: everything the game needs to know about the class, gathered from this folder.
import type { ClassModule } from '../../api';
import rules from './rules';
import decks from './decks';
import cpu from './cpu';
import lessons from './tutorial';
import lab from './lab';

export default {
  id: 'ranger',
  info: {
    name: 'RANGER', res: 'ENERGY', resColor: '#f8d878', gem: '#ac7c00', pipBase: '#503000', pip: '#f8b800', refill: 'STAND STILL',
    basics: ['ARROW', 'AIMED SHOT'],
    blurb: ['ARROWS, TRAPS AND PETS', 'STAND STILL FOR ENERGY'],
    backdrop: ['#002800', '#005800', '#00a800'],
  },
  rules, decks, cpu, lessons, lab,
} satisfies ClassModule;
