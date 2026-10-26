# Developing Spell VS Steel

The developer guide: running the game, tests, dev tools, online play internals and the code map. For the game itself see the [README](../README.md); for how the systems fit together see [ARCHITECTURE.md](ARCHITECTURE.md).

## Run it

```sh
npm install
npm run dev      # local dev server
npm run build    # DEV build: type-check, then dist/index.html (one self-contained file)
                 # and dist/artifact.html (the same game, shaped for a claude.ai artifact). Dev tools on.
npm run build:prod  # player-facing build in dist-prod/: dev tools off and their code left out
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
- **Screens** (`tests/screens/`): `harness.ts` opens each screen the way the game does (title, options, every select step, stage select, each deck builder, online lobby, the Draw screen, a fight, pause, a whole round to the results, training, each tutorial, dev tools), and `run.ts` shoots it at 4:3, 3:2, 16:9, 21:9, 32:9, phone portrait and phone landscape. A shot fails if the page throws or logs an error, the screen is blank, or it doesn't fill the window the way `fit()` promises. Shots are seeded with a frozen clock, so the same code always draws the same pixels. **Add new screens to `harness.ts`.**
- **Visual diff**: on a PR, CI also shoots main and lists every screen whose pixels changed (in the job summary), with base, PR and diff images side by side in the `screens-report` artifact (`report/report.html`). Changes there are expected when a PR touches visuals, so they never fail the build; they're there to spot changes nobody meant to make.

## Dev tools

In dev builds (`npm run dev`, `npm run build`): **Title > DEV TOOLS**, or open the page with `#cards`, `#sandbox` or `#lab` (`#bench=stage,classA,classB` starts a CPU vs CPU match to watch, for profiling). The `DEV_TOOLS` flag (`src/flags.ts`, set per build in `vite.config.ts`) hides the menu item and routes in `npm run build:prod`, and since the tools load through a dynamic import, none of their code ships in that build. Gate any future dev-only feature on the same flag.

- **Card encyclopedia**: every spell of every class as card faces, filtered by class, rarity and element. Hover to read, J (or the button) tests the card in the sandbox. Classes come from `cards.ts`, so new classes show up on their own.
- **Sandbox** (debug mode): a real fight with a panel docked on the right. Cast any spell for either side on demand or queue it for K, pick the enemy (still dummy, walker, turret, CPU easy/normal), turn on can't-die and free spells, slow time to 0.1×, pause and step frames (P, .), freeze or stun either side, set enemy HP, move fighters by clicking panels, and read live state plus a hit log that names the spell behind every hit.
- **Balance lab**: CPU-vs-CPU matches in the browser. Win rate with a 95% range, match length, damage split, per-card stats (casts, damage per cast, share, win rate when cast) and a class-vs-class matrix. Every number in `tuning.ts` and a damage % per card can be edited live; edits apply to the whole game until reload, and "Copy overrides" gives the JSON to paste back or commit.

Code lives in `src/dev/` (instrumentation, sims, tuning edits, DOM helpers) and `src/scenes/` (`devMenu`, `encyclopedia`, `sandbox`, `lab`). The instrumentation wraps one Battle instance, so `battle.ts` has no dev-only code.

## Online Versus (prototype)

Title > **Online Versus**. Pick your fighter, then **Create Room** and share the 5-letter code (or the link, `?room=CODE`), or **Join Room** and type a code. The host's match length is used. Either player can open the Draw screen; the fight waits until both have picked. There is no pause online.

How it works: **rollback netcode** (GGPO style). Both machines run the same battle from a shared seed and only trade controls. Your press goes in a couple of frames ahead (a little more on a slow connection). The battle never waits for the other player's inputs: it guesses them (still holding what they held, pressing nothing new), and when the real ones arrive it rewinds to the last frame both inputs were known, replays, and runs forward again, so a wrong guess shows as a short correction instead of a freeze. Only a long silence (over 10 frames of guessing) makes it wait. The Draw screen opens and the round ends only on frames both sides agree on, and replayed frames are silent. Every packet repeats all inputs the other side hasn't confirmed, so lost or merged packets cost nothing. A checksum every half second flags a desync on screen. The readout during the fight shows ping, input delay and the latest correction length.

Rollback rules for the sim (`src/net/snapshot.ts` saves and restores the battle in place, so closures in timers and projectiles stay valid): state a spell's timers share must live in `b.keep({...})`, not in a `let` the closure captures; anything that watches the battle and keeps its own state (like post-match stats) must hand that state to the rollback as an extra root; render-only effects (hit-stop, sparks, screen kick) stay out of the battle. `npm run rollcheck` catches slips.

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
- Spell costs are paid on cast. Warrior Rage (max 5) comes from heavy hits (+1.5) and taking damage (1 pip per 40, max 1 per hit); light attacks build none. Mage Mana starts at 1 max, +1 max per Draw screen (cap 5), and refills each turn.
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
- `src/net/` online play: packets, transports, the session, rollback (`rollback.ts`, `snapshot.ts`), the desync checksum
