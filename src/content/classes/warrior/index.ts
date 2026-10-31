// The Warrior module: everything the game needs to know about the class, gathered from this folder.
import type { ClassModule } from '../../api';
import rules from './rules';
import decks from './decks';
import cpu from './cpu';
import lessons from './tutorial';

export default {
  id: 'warrior',
  info: { name: 'WARRIOR', res: 'RAGE', resColor: '#f87858', gem: '#d82800', pipBase: '#503000', pip: '#d82800', refill: 'PAY ON CAST' },
  rules, decks, cpu, lessons,
} satisfies ClassModule;
