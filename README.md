# Spell VS Steel

A fantasy, class-based take on Mega Man Battle Network: real-time fights on a 6x3 grid, broken up by a paused Draw screen where you draft spells from your grimoire.

This is the **Warrior vs Mage prototype**: title screen, an interactive tutorial, Versus CPU, match setup, a deck builder, all Warrior and Mage spells from the design doc, a CPU opponent (Easy and Normal), chiptune sound effects and two original 16-bit tracks.

## Play

```sh
npm install
npm run dev      # local dev server
npm run build    # DEV build: type-check, then dist/index.html (one self-contained file)
                 # and dist/artifact.html (the same game, shaped for a claude.ai artifact). Dev tools on.
npm run build:prod  # player-facing build in dist-prod/: dev tools off and their code left out
npm run sim      # headless CPU-vs-CPU matches; prints win rates, match length, damage sources
npm run sim -- 100 --cards   # same, with per-card casts, damage and win rate when cast
```

## Dev tools

In dev builds (`npm run dev`, `npm run build`): **Title > DEV TOOLS**, or open the page with `#cards`, `#sandbox` or `#lab`. The `DEV_TOOLS` flag (`src/flags.ts`, set per build in `vite.config.ts`) hides the menu item and routes in `npm run build:prod`, and since the tools load through a dynamic import, none of their code ships in that build. Gate any future dev-only feature on the same flag.

- **Card encyclopedia**: every spell of every class as card faces, filtered by class, rarity and element. Hover to read, J (or the button) tests the card in the sandbox. Classes come from `cards.ts`, so new classes show up on their own.
- **Sandbox** (debug mode): a real fight with a panel docked on the right. Cast any spell for either side on demand or queue it for K, pick the enemy (still dummy, walker, turret, CPU easy/normal), turn on can't-die and free spells, slow time to 0.1×, pause and step frames (P, .), freeze or stun either side, set enemy HP, move fighters by clicking panels, and read live state plus a hit log that names the spell behind every hit.
- **Balance lab**: CPU-vs-CPU matches in the browser. Win rate with a 95% range, match length, damage split, per-card stats (casts, damage per cast, share, win rate when cast) and a class-vs-class matrix. Every number in `tuning.ts` and a damage % per card can be edited live; edits apply to the whole game until reload, and "Copy overrides" gives the JSON to paste back or commit.

Code lives in `src/dev/` (instrumentation, sims, tuning edits, DOM helpers) and `src/scenes/` (`devMenu`, `encyclopedia`, `sandbox`, `lab`). The instrumentation wraps one Battle instance, so `battle.ts` has no dev-only code.

## Controls

| Key | Action |
| --- | --- |
| WASD (arrows also work) | Move |
| J (tap) | Light attack |
| J (hold, release) | Heavy attack |
| K | Cast the next spell (hold a direction to aim it) |
| Space | Open the Draw screen when the gauge is full |
| Enter / Esc | Pause |
| M | Mute |

These are the defaults. **Options** (title menu or pause menu) has master, music and sound effect volume, music and sound effect on/off, and **Key Mapping**, which rebinds movement, attack, cast, Draw screen and pause. Settings save in the browser; arrows, Esc and M always work.

**Menus are mouse-first.** Hover highlights, click picks, right-click backs out. Draw screen: the 5 drawn spells are a hand of cards; hover one to read it, click to queue it (cast order is pick order), right-click to undo, click FIGHT! to start. Deck builder: hover a spell to read it, click to add a copy, right-click to remove one, wheel to scroll, click the class tabs to switch. The keyboard still works everywhere (J picks, K undoes, Space fights; in the deck builder D/A add and remove, Q/E switch class). Combat is keyboard only.

## Tutorial

**Tutorial** on the title menu teaches someone who has never played Battle Network, as Warrior or Mage, in 8 short lessons against a training dummy: the grid and moving, light attacks, heavy attacks (and Rage), dodging telegraphed shots, the Draw gauge, the Draw screen (costs, cast order, Mana growth), casting, then a final knockout with real draws from the starter grimoire. Each lesson opens with a page or two of explanation, then a goal box with a progress counter; arrows point at the HUD piece being taught. The pause menu can skip a step. The clock is stopped on the tutorial's Draw screens. It all lives in `src/scenes/tutorial.ts`, which drives a normal `BattleScene` with a scripted dummy in place of the CPU.

## Rules in the prototype

- One shared Draw gauge fills in 10s; only the player can open the Draw screen, and both sides draft when it opens. 5 spells drawn each time, 20s timer. Picked-but-uncast spells are discarded at the next Draw screen.
- Spell costs are paid on cast. Warrior Rage (max 5) comes from heavy hits (+1.5) and taking damage (1 pip per 40, max 1 per hit); light attacks build none. Mage Mana starts at 1 max, +1 max per Draw screen (cap 5), and refills each turn.
- Frozen or stunned targets take +50% damage. No slows.
- Grimoires: exactly 30 spells, up to 4 copies of a common, 2 of an uncommon, 1 of each Legendary (max 5), exactly 1 Mythic. Custom decks save in the browser.
- Skins: 8 fighting-game colors per class, picked on the setup screen for you and the CPU. If both pick the same class and color, the CPU takes the next color.
- Matches are a single round, best of 3 (default) or best of 5, picked on the setup screen.

Every number worth tuning is in [`src/game/tuning.ts`](src/game/tuning.ts). Spells live in [`src/game/cards.ts`](src/game/cards.ts), one entry each.

## Code map

- `src/main.ts` the loop. The fight (arena, panels, sprites, effects) draws at 240×160 and is scaled 2× under a sharp 480×320 UI layer for menus, cards, the battle HUD, status tags, damage numbers and cast callouts
- `src/engine/` canvas helpers, bitmap font, keyboard and mouse input, sound effects and the music sequencer, song data
- `src/art/` Cartridge NES sprites, the Grand Colosseum arena, the logo
- `src/game/` battle rules (`battle.ts`), spells, decks, CPU, drawing (`battleView.ts`)
- `src/scenes/` title, tutorial, setup, deck builder, battle (Draw screen, pause, results), options, controls, card faces (`cardView.ts`); clickable zones live in `scene.ts`
