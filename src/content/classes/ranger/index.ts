// The Ranger module: everything the game needs to know about the class, gathered from this folder.
import type { ClassModule } from '../../api';
import rules from './rules';
import decks from './decks';
import cpu from './cpu';
import lessons from './tutorial';

export default { id: 'ranger', rules, decks, cpu, lessons } satisfies ClassModule;
