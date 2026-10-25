# Spell VS Steel

A fantasy, class-based take on Mega Man Battle Network: real-time fights on a 6x3 grid, broken up by a paused Draw screen where you draft spells from your grimoire.

This is the **Warrior vs Mage prototype**: title screen, Versus CPU, match setup, a deck builder, all Warrior and Mage spells from the design doc, a CPU opponent (Easy and Normal), chiptune sound effects and two original 16-bit tracks.

## Play

```sh
npm install
npm run dev      # local dev server
npm run build    # type-check, then build dist/index.html (one self-contained file)
                 # and dist/artifact.html (the same game, shaped for a claude.ai artifact)
npm run sim      # headless CPU-vs-CPU matches; prints win rates, match length, damage sources
npm run netcheck # two seeded battles fed the same inputs must stay identical (online play depends on it)
```

## Online Versus (prototype)

Title > **Online Versus**. Pick your fighter, then **Create Room** and share the 5-letter code (or the link, `?room=CODE`), or **Join Room** and type a code. The host's match length is used. Either player can open the Draw screen; the fight waits until both have picked. There is no pause online.

How it works: **delay-based lockstep**. Both machines run the same battle from a shared seed and only trade controls. Each press is scheduled a few frames ahead (picked from the measured ping, shown during the fight) so it arrives in time; on a lag spike the fight waits instead of rubber-banding, and both players get the same delay. Every packet repeats all inputs the other side hasn't confirmed, so lost or merged packets cost nothing. A checksum every half second flags a desync on screen.

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

These are the defaults. **Options** (title menu or pause menu) has master, music and sound effect volume, music and sound effect on/off, and **Key Mapping**, which rebinds movement, attack, cast, Draw screen and pause. Settings save in the browser; arrows, Esc and M always work.

**Menus are mouse-first.** Hover highlights, click picks, right-click backs out. Draw screen: the 5 drawn spells are a hand of cards; hover one to read it, click to queue it (cast order is pick order), right-click to undo, click FIGHT! to start. Deck builder: hover a spell to read it, click to add a copy, right-click to remove one, wheel to scroll, click the class tabs to switch. The keyboard still works everywhere (J picks, K undoes, Space fights; in the deck builder D/A add and remove, Q/E switch class). Combat is keyboard only.

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
- `src/scenes/` title, setup, deck builder, battle (Draw screen, pause, results), online lobby and online battle, options, controls, card faces (`cardView.ts`); clickable zones live in `scene.ts`
- `src/net/` online play: packets, transports, the lockstep session, the desync checksum
