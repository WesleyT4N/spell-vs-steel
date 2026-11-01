# Developing Spell VS Steel

The developer guide: running the game, tests, dev tools, online play internals and the code map. For the game itself see the [README](../README.md); for how the systems fit together see [ARCHITECTURE.md](ARCHITECTURE.md).

## Run it

```sh
npm install
npm run dev      # local dev server
npm run build    # DEV build: type-check, then dist/index.html (one self-contained file)
                 # and dist/artifact.html (the same game, shaped for a claude.ai artifact). Dev tools on.
npm run build:prod  # player-facing build in dist-prod/: dev tools off and their code left out
npm run build:native  # the player build for the desktop and Android apps (dist-native/): real asset files
                      # beside index.html instead of packed into it (see docs/ASSETS.md)
npm run sim      # headless CPU-vs-CPU matches; prints win rates, match length, damage sources
npm run sim -- 100 --cards   # same, with per-card casts, damage and win rate when cast
npm run netcheck # two seeded battles fed the same inputs must stay identical (online play depends on it)
npm run rollcheck # battles played through rollback (late inputs, wrong guesses, replays) must end identical to straight play
npm run netsoak -- 440  # whole online matches between two simulated machines over lag, jitter, loss, dropouts and tabbed-out players; fails on any desync or stuck match
npm run fuzz -- 500   # rules fuzzer: random legal decks, mashing/random/CPU inputs, odd Draw picks, training
                      # resets; checks invariants every frame and replays each match to prove determinism
```

Browser checks (need Playwright with Chromium; they create `dist-fuzz/` and `fuzz-out/`, both ignored):

```
npm run fuzz:ui -- 10 90      # random keys, clicks and taps on every screen at 5 screen shapes; reports thrown
                              # errors, frozen frame loops and screens you can't back out of
npm run perf -- 4 5           # CPU vs CPU on every stage at phone sizes with 4x CPU throttle: fps, canvas
                              # calls and main-thread time per frame (opens #bench=stage,classA,classB)
node scripts/pixeldiff.mjs old/index.html new/index.html   # golden frames: two builds on a fake clock and a
                              # seeded Math.random must match pixel for pixel (use after rendering speedups)
```

## Tests

CI (`.github/workflows/ci.yml`) runs on every PR, against the PR merged into main, so two PRs that each pass alone but break each other once merged get caught. It also runs on every push to main.

```sh
npm run typecheck     # the game and the tests
npm test              # full matches, online determinism, combo counter (a few seconds)
npm run test:screens  # every screen at every screen shape, saved to test-results/screens
```

- **Full matches** (`tests/matches.ts`): CPU vs CPU for every class pair (mirrors included) at every CPU level, plus every ready-made deck, three seeds each. Every frame checks rules that hold whatever the balance is (HP and resources in range, fighters on the grid and apart, nothing piling up), and every match must end in a KO. Ready-made decks must be legal. A failure prints its seed: `npx tsx tests/matches.ts --seed 123 --only warrior,mage` replays it.
- **Mods** (`tests/mods.ts`): the test fixture and every file in `mods/` parse, and broken or hostile mod files (unknown keys, `__proto__`, bad colors, wrong sizes) are refused. The format is in [MODDING.md](MODDING.md).
- **Screens** (`tests/screens/`): `src/dev/screens.ts` opens each screen the way the game does (title, options, every select step, stage select, each deck builder, online lobby, the Draw screen, a fight, pause, a whole round to the results, training, each tutorial, dev tools), and `run.ts` shoots it at 4:3, 3:2, 16:9, 21:9, 32:9, phone portrait and phone landscape. A shot fails if the page throws or logs an error, the screen is blank, or it doesn't fill the window the way `fit()` promises. Shots are seeded with a frozen clock, so the same code always draws the same pixels. **Add new screens to `src/dev/screens.ts`** (the Art Lab's Screens tab lists them too).
- **Visual diff**: on a PR, CI also shoots main and lists every screen whose pixels changed (in the job summary), with base, PR and diff images side by side in the `screens-report` artifact (`report/report.html`). Changes there are expected when a PR touches visuals, so they never fail the build; they're there to spot changes nobody meant to make.

## Dev tools

In dev builds (`npm run dev`, `npm run build`): **Title > DEV TOOLS**, or open the page with `#cards`, `#sandbox`, `#lab` or `#art` (`#bench=stage,classA,classB` starts a CPU vs CPU match to watch, for profiling). The `DEV_TOOLS` flag (`src/flags.ts`, set per build in `vite.config.ts`) hides the menu item and routes in `npm run build:prod`, and since the tools load through a dynamic import, none of their code ships in that build. Gate any future dev-only feature on the same flag.

- **Card encyclopedia**: every spell of every class as card faces, filtered by class, rarity and element. Hover to read, J (or the button) tests the card in the sandbox. Classes come from `cards.ts`, so new classes show up on their own.
- **Sandbox** (debug mode): a real fight with a panel docked on the right. Cast any spell for either side on demand or queue it for K, pick the enemy (still dummy, walker, turret, CPU easy/normal), turn on can't-die and free spells, slow time to 0.1×, pause and step frames (P, .), freeze or stun either side, set enemy HP, move fighters by clicking panels, and read live state plus a hit log that names the spell behind every hit.
- **Balance lab**: CPU-vs-CPU matches in the browser. Win rate with a 95% range, match length, damage split, per-card stats (casts, damage per cast, share, win rate when cast) and a class-vs-class matrix. Every number in `tuning.ts` and a damage % per card can be edited live; edits apply to the whole game until reload, and "Copy overrides" gives the JSON to paste back or commit.
- **Art lab**: each class tab has four sections (keys 1-4, or R / pad Y to cycle). **Spell FX**: every class's light and heavy attack and every spell on loop, with the real battle drawing it. Pick IN GAME (what ships), BEFORE (the look the last art pass replaced) or a draft under review, slow it down or step frame by frame, with sound. Every class shows its basics and all its spells with no setup; a class folder's optional `lab.ts` (`ClassLab`) tunes and orders spells (foe column, loop length), maps renamed fx kinds for BEFORE, and lists `drafts` (fx kinds to effect ids in `src/fx`). To put a draft up for review, add its effect modules and a `drafts` entry, then publish the branch's dev build to the lab preview link. **Animations**: every move the fighter animates (idle, steps, knockback, small and big hits, light, heavy, charge and release, cast, frozen, stunned, K.O.), scripted on the real battle, in any skin, with whole-pixel zoom (1-3×). **Sprites**: the drawn frames of `src/art/fighterFrames.ts` (all at once or one big), the game's tints (hit flash, frozen, stunned, ghost), the portrait and every spell icon, in any skin or the opponent colors, with a native pixel grid and the 24×24 body box. **Sounds**: each voice line on its own (a missing clip says so), and every basic and spell with each sound it fires listed as it plays; tap a listed sound to hear it alone. The **Stages** tab shows every registered stage idle, with every panel state laid out (cracked, hole, burning, toxic, blessed, cursed, smoke), or under a CPU vs CPU fight; left/right flips stages. The **Screens** tab lists every screen in `src/dev/screens.ts` (the same set the screen tests shoot) and opens the picked one full window at the current window shape; saves are paused first (`pauseSaves()`: the game keeps playing on an in-memory copy until reload, since some entries make decks), and a corner button returns to the lab.

Code lives in `src/dev/` (instrumentation, sims, tuning edits, DOM helpers) and `src/scenes/` (`devMenu`, `encyclopedia`, `sandbox`, `lab`). The instrumentation wraps one Battle instance, so `battle.ts` has no dev-only code.

## Online Versus (prototype)

Title > **Online Versus**. Pick your fighter, then **Create Room** and share the 5-letter code (or the link, `?room=CODE`), or **Join Room** and type a code. The host's match length is used. Either player can open the Draw screen; the fight waits until both have picked. There is no pause online.

How it works: **rollback netcode** (GGPO style). Both machines run the same battle from a shared seed and only trade controls. Your press goes in a couple of frames ahead (a little more on a slow connection). The battle never waits for the other player's inputs: it guesses them (still holding what they held, pressing nothing new), and when the real ones arrive it rewinds to the last frame both inputs were known, replays, and runs forward again, so a wrong guess shows as a short correction instead of a freeze. Only a long silence (over 10 frames of guessing) makes it wait. The Draw screen opens and the round ends only on frames both sides agree on, and replayed frames are silent. Every packet repeats all inputs the other side hasn't confirmed, so lost or merged packets cost nothing. A checksum every half second flags a desync on screen. The readout during the fight shows ping, input delay and the latest correction length.

Rollback rules for the sim (`src/net/snapshot.ts` saves and restores the battle in place): battle state is plain data, so anything a spell does later is an effect record (`spellStep` in `src/content/effects.ts`), never a closure, and state its steps share goes in their arguments; anything that watches the battle and keeps its own state (like post-match stats) must hand that state to the rollback as an extra root; render-only effects (sparks, screen kick, the hit-pause shudder) stay out of the battle, while the hit pause and slow-mo themselves (`Battle.hitStop`, `Battle.slowmo`) change timing and so live in it. `npm run rollcheck` catches slips.

Connections (`src/net/transport.ts`):

| Where | How | Notes |
| --- | --- | --- |
| claude.ai artifact | the artifact `room` capability (presence in a named room) | Publish with `capabilities: { room: {} }`. Both players need access to the artifact. |
| Hosted build or `npm run dev` | WebRTC via PeerJS, signaling on the free public PeerJS server | `?peer=host:port` uses your own server instead (`npm run peerserver` runs one on 9000). |
| Testing on one machine | `?net=local`: BroadcastChannel between two tabs | Add `&lag=80&jitter=30&drop=0.2` to fake a bad connection. |

`?net=room|peer|local` forces a transport. Rules or protocol changes should bump `PROTOCOL` in `src/net/protocol.ts` so mismatched builds refuse to play.

Anything random in the rules must use the battle's generator (`b.rand()`, `shuffle(list, b.rand)`), never `Math.random`, or online games drift apart. `npm run netcheck` catches it.

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

### Phones and tablets

On a touch screen the game shows an on-screen pad during fights: a d-pad (slide your thumb to change direction), **J / ATTACK** (tap for light, hold and release for heavy), **K / CAST** (hold a direction to aim), **DRAW** (lights up when the gauge is full) and **PAUSE**. Menus are tapped directly: a quick tap clicks, touching and holding a card reads it without picking it, dragging scrolls lists, and a **BACK** button stands in for right-click. On the Draw screen, tap a picked card again to undo it. Room codes are typed by tapping the code boxes. Portrait puts the pad under the screen; landscape puts it on either side.

The pad follows the last input: a touch turns it on, a key press turns it off. `?touch=1` forces it on (handy for testing on a desktop), `?touch=0` forces it off. Code: `src/engine/touch.ts`; screens say which controls they want through `Scene.pad()`.

These are the defaults. **Options** (title menu or pause menu) has master, music and sound effect volume, music and sound effect on/off, and **Key Mapping**, which rebinds movement, attack, cast, Draw screen and pause. Settings save in the browser; arrows, Esc and M always work.

**Menus are mouse-first.** Hover highlights, click picks, right-click backs out. Draw screen: the 5 drawn spells are a hand of cards; hover one to read it, click to queue it (cast order is pick order), right-click to undo, click FIGHT! to start. Deck builder: hover a spell to read it, click to add a copy, right-click to remove one, wheel to scroll, click the class tabs to switch. The keyboard still works everywhere (J picks, K undoes, Space fights; in the deck builder D/A add and remove, Q/E switch class). Combat is keyboard only.

## Tutorial

**Tutorial** on the title menu teaches someone who has never played Battle Network, with any class, in short lessons against a training dummy: the grid and moving, light attacks, heavy attacks (and Rage), dodging telegraphed shots, the Draw gauge, the Draw screen (costs, cast order, Mana growth), casting, then a final knockout with real draws from the starter spell deck. Each lesson opens with a page or two of explanation, then a goal box with a progress counter; arrows point at the HUD piece being taught. The pause menu can skip a step. The clock is stopped on the tutorial's Draw screens. It all lives in `src/scenes/tutorial.ts`, which drives a normal `BattleScene` with a scripted dummy in place of the CPU.

## Rules in the prototype

- One shared Draw gauge fills in 10s; only the player can open the Draw screen, and both sides draft when it opens. 5 spells drawn each time, 20s timer. Picked-but-uncast spells are discarded at the next Draw screen.
- Spell costs are paid on cast. Warrior Rage (max 5) comes from heavy hits (+1.5) and taking damage (1 pip per 400, max 1 per hit); light attacks build none. Mage Mana starts at 1 max, +1 max per Draw screen (cap 5), and refills each turn.
- Frozen or stunned targets take +50% damage. No slows.
- Spell decks: exactly 30 spells, up to 4 copies of a common, 2 of an uncommon, 1 of each Legendary (max 5), exactly 1 Mythic. Custom decks save in the browser.
- Skins: 8 fighting-game colors per class, picked on the setup screen for you and the CPU. If both pick the same class and color, the CPU takes the next color.
- Matches are a single round, best of 3 (default) or best of 5, picked on the setup screen.

Every number worth tuning is in [`src/game/tuning.ts`](../src/game/tuning.ts). Spells live in [`src/game/cards.ts`](../src/game/cards.ts), one entry each.

## Code map

- `src/main.ts` the loop. The fight (arena, panels, sprites, effects) draws at 240×160 and is scaled 2× under a sharp 480×320 UI layer for menus, cards, the battle HUD, status tags, damage numbers and cast callouts
- `src/engine/` canvas helpers, bitmap font, keyboard and mouse input, sound effects and the music sequencer, song data
- `src/art/` Cartridge NES sprites, the Grand Colosseum arena, the logo
- `src/game/` battle rules (`battle.ts`), spells, decks, CPU, drawing (`battleView.ts`)
- `src/scenes/` title, tutorial, setup, deck builder, battle (Draw screen, pause, results), online lobby and online battle, options, controls, card faces (`cardView.ts`); clickable zones live in `scene.ts`
- `src/mods/` the data-only mod format (`format.ts`) and the loader for `mods/*.json` (`index.ts`); see [MODDING.md](MODDING.md)
- `src/net/` online play: packets, transports, the session, rollback (`rollback.ts`, `snapshot.ts`), the desync checksum

## PixelLab art

The fighters and stage backdrops are made with PixelLab (the PixelLab MCP connector) and baked into TypeScript by the scripts in `tools/pixellab/`. Source images live in the project files under `art/pixellab/` (`<class>_48_pl.png` bases, `idle/` loops, `anim/<class>_<move>_<n>.png` frames, `stages/<id>.png`).

- **Fighters** are 48x48 on a 64x64 canvas, drawn at 2 sprite pixels per world pixel (`Sprite.res`). Both canvas layers have an HD backing store (`HD` in `src/engine/gfx.ts`): scenes still draw in 240x160 / 480x320 coordinates, and a half-pixel lands on a whole backing pixel, so the sprites stay native, never stretched. `python3 tools/pixellab/build_frames.py [srcDir] [class...]` cleans every frame (`clean.py`: one outline ink, no stray pixels, closed gaps), quantizes one palette per class (index 0 is the outline), picks which generated frame plays each game frame (`MAP`), crops a 40x32 portrait and writes `assets/fighters/<class>.png` (every frame side by side, indexed PNG in palette order), `<class>-portrait.png` and `<class>.json` (frame layout, palette, feet column, team color). Skins hue-shift the class's main color family (`plPalette` in `src/art/sprites.ts`).
- **Stages** keep their panels, name and music; `src/content/stages/backdrop.ts` swaps the Inked scenery for a tall master image, cropped to fit each window shape (mirrored bands repeat past its edges only on extreme shapes). Masters are drawn simple and outlined to match the 48px fighters (no reference image, a fighter style strip, max 20 colors, no text). PixelLab caps one image at 792x336, so each master is that panorama (`art/pixellab/stages-simple/raw/<id>.png`) grown by `python3 tools/pixellab/extend_stage.py raw.png master.png`: plain sky or ceiling continues on top and the floor continues below in one flat tone, so tall phones see no stripes or repeats. `python3 tools/pixellab/build_stages.py /mnt/project-files/art/pixellab/stages-simple` writes `assets/stages/<id>.png`; set the image row where the wall meets the floor (`foot`) in `src/content/stages/index.ts`.
- **Spell icons**: the card frames draw a 40x40 PixelLab icon per spell (`create_image_pixen`, 1 generation each, black outline, low detail; prompts in `tools/pixellab/card_icons.json`), the same density as the 48px fighters. Picks live in `art/pixellab/cards/<id>.png`; `python3 tools/pixellab/build_card_icons.py` writes `assets/cards/<id>.png`. The 20px icons are `assets/cards/small/<id>.png` (authored grids in the project files' `art/card-icons/`, written by its `emit.py`). `drawIconAt` (`src/art/cardIcons.ts`) uses the HD icon wherever it is drawn at a whole multiple of 2 UI px per old icon pixel and the old 20px icon elsewhere (tiny list thumbnails), so nothing is ever scaled down.
- Every battle stage has a screen (`battle-stage-<id>`) in `src/dev/screens.ts`.
- **Expedition monsters** are PixelLab `create_image_pro` sprites facing right (48px regulars, 56px elites, 80px bosses, with `art/pixellab/warrior_48_pl.png` as the style image). Put the picked candidate at `art/pixellab/mobs/<id>.png` in the project files and run `python3 tools/pixellab/build_mobs.py`, which cleans, crops and quantizes each one into `assets/monsters/<id>.png` + `<id>.json` (palette, feet column; 2 sprite pixels per world pixel, like the fighters).
- **Effects** made in PixelLab's VFX workbench (`vfx_workbench`) are baked sprite sheets at the fighters' pixel density (2 sheet pixels per world pixel). List each export in `tools/pixellab/fx.json` (its download folder + file stem, the origin `ax`/`ay` in sheet pixels: a hit's panel feet or a shot's center, and optional `frames` / `fps` / `loop` / `panels`, `rows: 3` for column spells drawn on every row, `hollow: k` to keep only a k px band inside an aura's outline so the fighter shows through), then `python3 tools/pixellab/build_fx.py` writes `assets/fx/<id>.png` (the frame strip) and `assets/fx/<id>.json` (frame data; sources cached under `art/pixellab/fx/` in the project files). Every sheet under `assets/fx/` registers itself as effect `hd/<id>` (`src/fx/index.ts`); map fx kinds to it there like any effect; `src/fx/hd/picks.ts` holds effects that pick a sheet per hit, like the element hit spark (`impact`: small for light hits, big for big hits and KOs). Look at it in battle with `npm run fx:sheet`, which now draws at the game's HD density. Sheets are render-only: the frame is a pure function of the fx's age. Spells reuse one sheet per look across kinds and classes (e.g. `hd/warrior/shield-slam` for every stun hit); kinds not mapped in `HD_SPELLS` keep their pixelfx module.
