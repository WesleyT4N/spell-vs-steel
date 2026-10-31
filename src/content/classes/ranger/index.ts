// The Ranger module: everything the game needs to know about the class, gathered from this folder.
import type { ClassModule } from '../../api';
import rules from './rules';
import decks from './decks';
import cpu from './cpu';
import lessons from './tutorial';

export default {
  id: 'ranger',
  info: { name: 'RANGER', res: 'ENERGY', resColor: '#f8d878', gem: '#ac7c00', pipBase: '#503000', pip: '#f8b800', refill: 'STAND STILL' },
  rules, decks, cpu, lessons,
} satisfies ClassModule;
