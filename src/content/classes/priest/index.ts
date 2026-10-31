// The Priest module: everything the game needs to know about the class, gathered from this folder.
import type { ClassModule } from '../../api';
import rules from './rules';
import decks from './decks';
import cpu from './cpu';
import lessons from './tutorial';

export default {
  id: 'priest',
  info: {
    name: 'PRIEST', res: 'MANA', resColor: '#a4e4fc', gem: '#0058f8', pipBase: '#0000a8', pip: '#3cbcfc', refill: '+3 PER DRAW',
    basics: ['HOLY SPARK', 'SMITE'],
    blurb: ['OUTLASTS AND CHIPS', 'HEALS AND CURSES'],
    backdrop: ['#503000', '#ac7c00', '#f8d878'],
  },
  rules, decks, cpu, lessons,
} satisfies ClassModule;
