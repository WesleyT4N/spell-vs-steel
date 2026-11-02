// The game's ears on the battle: turns battle events into sound effects and voice lines.
import { sfx, sfxFx, voiceLine } from './audio';
import type { BattleEvent } from '../game/events';

export function playBattleEvent(e: BattleEvent): void {
  switch (e.type) {
    case 'sound': sfx(e.name, e.opts); break;
    case 'fxSound': sfxFx(e.kind, e.opts); break;
    case 'voice':
      if (e.chance === undefined || e.chance >= 1 || Math.random() < e.chance) voiceLine(e.cls, e.kind, e.pan, e.side, e.element, e.skin);
      break;
    default: break; // hits, casts and K.O.s already sound through their own sound events
  }
}
