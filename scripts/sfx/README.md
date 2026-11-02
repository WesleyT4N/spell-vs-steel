# Sound effects

The game's sound effects are recorded samples in `assets/audio/sfx/`, generated with ElevenLabs text to sound
(`eleven_text_to_sound_v2`) in the Storybook JRPG style picked in the 2026-11 overhaul.

- `prompts.tsv`: slot name and the prompt it was generated from. Slots missing here (explode, shard, arcaneHit,
  holyPillar, heal, hit_steel, ui_confirm) reuse the style-pick takes from round 1.
- `process.py <raw dir> <out dir>`: trims, caps length per slot, fades and normalizes raw takes (`<slot>-<n>.mp3`).
  Copy the take you want to `assets/audio/sfx/<slot>.mp3`.
- `mkmap.py`: rewrites `assets/audio/sfx/sfx.json`: per-slot mix gain, and which slots each game sound
  (and each spell effect, `fx:<kind>`) plays. Any name it leaves out falls back to the synthesized sound in
  `src/engine/sfxReal.ts`.

`tests/sfx.ts` checks every slot has its file and every sound the game plays is mapped. DEV TOOLS > SOUND TEST
plays every slot and switches the game between the new and original sounds.
