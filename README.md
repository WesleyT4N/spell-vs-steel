# Spell VS Steel

A fantasy, class-based take on Mega Man Battle Network: real-time fights on a 6x3 grid, broken up by a paused custom screen where you draft spells from your grimoire.

This is the **Warrior vs Mage prototype**: title screen, Versus CPU, match setup, a deck builder, all Warrior and Mage spells from the design doc, a CPU opponent (Easy and Normal), chiptune sound effects and two original 16-bit tracks.

## Play

```sh
npm install
npm run dev      # local dev server
npm run build    # type-check, then build dist/index.html (one self-contained file)
                 # and dist/artifact.html (the same game, shaped for a claude.ai artifact)
npm run sim      # headless CPU-vs-CPU matches; prints win rates, match length, damage sources
```

## Controls

| Key | Action |
| --- | --- |
| Arrows / WASD | Move |
| Z (tap) | Light attack |
| Z (hold, release) | Heavy attack |
| X | Cast the next spell (hold a direction to aim Blink) |
| Space | Open the custom screen when the gauge is full |
| Enter / Esc | Pause |
| M | Mute |

Custom screen: Z picks or unpicks a spell (cast order is pick order), X undoes the last pick, Space starts the fight. Deck builder: Right or Z adds a copy, Left or X removes one, Q / E switch class, Enter finishes.

## Rules in the prototype

- One shared custom gauge fills in 10s; only the player can open the custom screen, and both sides draft when it opens. 5 spells drawn each time, 15s timer. Picked-but-uncast spells are discarded at the next custom screen.
- Spell costs are paid on cast. Warrior Rage (max 5) comes from heavy hits (+1) and taking hits (+1/2); light attacks build none. Mage Mana starts at 1 max, +1 max per custom screen (cap 5), and refills each turn.
- Frozen or stunned targets take +50% damage. No slows.
- Grimoires: exactly 30 spells, up to 4 copies of a common, 2 of an uncommon, 1 of each Legendary (max 5), exactly 1 Mythic. Custom decks save in the browser.
- Mirror matches give the CPU an alternate palette.

Every number worth tuning is in [`src/game/tuning.ts`](src/game/tuning.ts). Spells live in [`src/game/cards.ts`](src/game/cards.ts), one entry each.

## Code map

- `src/engine/` canvas helpers, bitmap font, keyboard input, sound effects and the music sequencer, song data
- `src/art/` Cartridge NES sprites, the Grand Colosseum arena, the logo
- `src/game/` battle rules (`battle.ts`), spells, decks, CPU, drawing (`battleView.ts`)
- `src/scenes/` title, setup, deck builder, battle (custom screen, pause, results), controls
