// The recorded sound effects map (assets/audio/sfx/sfx.json): every slot has its file, every sound points at real
// slots, and every name the synthesized set knows (sfxReal.ts) and every menu blip is covered by a recording.
import { readFileSync, existsSync } from 'node:fs';
import { recipeNames } from '../src/engine/sfxReal';

const dir = new URL('../assets/audio/sfx/', import.meta.url);
const map = JSON.parse(readFileSync(new URL('sfx.json', dir), 'utf8')) as { slots: Record<string, unknown>; sounds: Record<string, string | string[]> };
const fail: string[] = [];
for (const slot of Object.keys(map.slots)) if (!existsSync(new URL(`${slot}.mp3`, dir))) fail.push(`slot ${slot} has no ${slot}.mp3`);
const ELEMENTS = ['steel', 'fire', 'frost', 'arcane', 'holy', 'shadow', 'poison', 'nature'];
for (const [name, v] of Object.entries(map.sounds)) {
  for (const s of Array.isArray(v) ? v : [v]) {
    for (const el of s.includes('{element}') ? ELEMENTS : ['']) {
      const slot = s.replace('{element}', el);
      if (!(slot in map.slots)) fail.push(`${name} -> ${slot}: no such slot`);
    }
  }
}
// menu blips from audio.ts and every synthesized recipe
const MENU = ['step', 'move', 'select', 'back', 'open', 'confirm', 'charged', 'pip', 'deny', 'win', 'cast', 'ko'];
for (const name of [...MENU, ...recipeNames()]) if (!(name in map.sounds)) fail.push(`${name}: not in the map (would fall back to the synth)`);
if (fail.length) { console.error(fail.join('\n')); process.exit(1); }
console.log(`sfx: ${Object.keys(map.slots).length} slots, ${Object.keys(map.sounds).length} sounds, all covered`);
