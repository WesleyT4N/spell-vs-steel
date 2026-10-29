# Spell VS Steel architecture

How the game is put together, one section per system. Describes `main` at 16e8390 (2026-10-28).

The full version, with a drawn diagram per system, is the living doc: https://claude.ai/artifact/TSKxaHfJ3qJXaK4SC4az2V. Keep this file and that doc in step: when a PR changes the structure described here, update the matching section in the same PR.

- [Overview](#overview)
- [Sim and game loop](#sim-and-game-loop)
- [Netcode](#netcode)
- [Characters and cards](#characters-and-cards)
- [Stages](#stages)
- [Rendering and art pipeline](#rendering-and-art-pipeline)
- [Audio](#audio)
- [UI and screens](#ui-and-screens)
- [Input and platform](#input-and-platform)
- [CPU AI and styles](#cpu-ai-and-styles)
- [Balance tooling](#balance-tooling)
- [Build and publish](#build-and-publish)
- [Testing and CI](#testing-and-ci)
- [In flight](#in-flight)

## Overview

TypeScript + plain Canvas 2D, no engine, built by Vite into one self-contained HTML file. A single seeded `Battle` holds all the rules. Keyboard, CPU and online controllers all hand it the same `Intent` each frame; views, sound and observers only read it.

```mermaid
flowchart LR
  shell["Shell: main.ts + scenes/<br/>fixed 60 Hz step, one active Scene"] --> battle
  subgraph controllers [Controllers]
    kb["Keyboard and touch<br/>engine/input.ts, touch.ts"]
    cpu["CPU<br/>game/ai.ts"]
    net["Online rival<br/>net/session.ts"]
  end
  subgraph sim ["Simulation (game/)"]
    battle["Battle<br/>battle.ts"]
    cards["Spells<br/>content/classes/*/cards.ts"]
    tune["tuning.ts, rng.ts"]
  end
  subgraph pres [Presentation]
    view["battleView, fxView, fighterAnim"]
    art["art/: sprites, frames, stages"]
    audio["engine/audio + voice"]
  end
  kb -- Intent --> battle
  cpu -- Intent --> battle
  net -- Intent --> battle
  battle --> view
  battle --> audio
  view --> art
  obs["Observers (read only)<br/>stats.ts, dev/instrument.ts"] -.wrap.-> battle
  tools["Headless tools<br/>scripts/sim, netcheck, lab"] -.drive.-> battle
```

| Folder | What lives there |
| --- | --- |
| `src/content/` | Built-in content: each class's spells in `classes/<id>/cards.ts`, stages in `stages/`, `api.ts` (the only engine surface content imports) |
| `src/game/` | Rules (`battle.ts`, `cards.ts` gathers every class's spells, `ai.ts`, `tuning.ts`, `rng.ts`, decks, stats, combo) and the battle views |
| `src/scenes/` | Every screen: title, select, stage select, battle, online, training, tutorial, deck builder, options, dev tools |
| `src/art/` | Generated sprites and frames, Inked stages, logo |
| `src/engine/` | Pixel gfx, bitmap font, input, gamepad, touch pad, audio, sampled music, battle audio, voice, save |
| `src/net/` | Rollback netplay, snapshots, session, packet protocol, transports, desync hash |
| `src/dev/` | Instrumentation, headless sims, live tuning edits (dev builds only) |
| `scripts/` | `sim`, `netcheck`, `combo-check`, artifact packer, TTS voice generator |

Platform decision (2026-10-26): stay on TypeScript; Steam through Electron, mobile through Capacitor; no consoles for now.

## Sim and game loop

`src/main.ts` runs a fixed 60 Hz accumulator on `requestAnimationFrame`: for each whole 1/60 s step it calls `scene.update(1/60)` and clears input edges, then draws once (world layer 240×160 scaled 2×, sharp UI layer 480×320 on top) and commits this frame's click zones.

The scene owns the `Battle`. Local Versus asks each side's controller for an `Intent` and calls `b.update(dt, intents)`; online only steps when both sides' inputs for that frame are in.

```mermaid
stateDiagram-v2
  [*] --> custom
  custom --> fight: endCustom(picks)
  fight --> custom: gauge full + DRAW (beginCustom)
  fight --> ko: a fighter hits 0 HP
  ko --> over: after 2.2 s
  over --> [*]: scene builds a new Battle for the next round
```

- `beginCustom()`: uncast picks go to the discard, class resources refill or grow, 5 spells drawn with a seeded reshuffle.
- Each fight step, in order: timers and anims, marks, warnings, panels, walls, fighters (with intents), projectiles, traps, pets, zones, then the KO check.

| Battle state | Holds |
| --- | --- |
| `f: [Fighter, Fighter]` | HP, position, resource, cooldowns, deck / queue / discard, statuses `st`, shields, DoTs, pose |
| `panels[6][3]` | Owner (grid steal), cracked / hole, burn, toxic, bless, curse, smoke |
| `walls`, `projectiles`, `traps`, `pets`, `warns` | Spawned objects; warnings flash panels 0.5 s before area hits |
| `timers`, `anims` | Closures from `later(delay, fn)` and `anim(dur, fn)` |
| `rand` | Seeded mulberry32; every rule roll goes through it |
| `fx`, `texts`, `shake`, `combo` | Display-only state for the views |

Determinism rules:

- Rule randomness comes from `b.rand()` or `shuffle(list, b.rand)`, never `Math.random`. `npm run netcheck` catches drift.
- Observers wrap methods on one instance and only read state.
- Each CPU rolls from `substream(b.seed, side)` (`game/rng.ts`), a stream separate from `b.rand`, so a CPU match replays exactly from its seed. Card `ai` hints get that `rand`. `tests/matches.ts` gives `Math.random` a new stream on every play, so a leak fails its replay check. Voice-line choice still uses `Math.random` (sound only).
- Double K.O.: if both fighters hit 0 HP on the same frame, the round is a draw (`winner` stays null, nobody scores, the set plays another round).
- Battle state is plain data. Anything that happens later (a timer, an animation, a projectile's hit, a telegraph's strike) is an effect record `{ fx, a }`: the id of an effect registered in `content/effects.ts` and its arguments. Spells register their later steps with `spellStep('<card>.<step>', (x, a, h) => ...)`, which rebuilds the cast's `CastCtx` from a plain `CastRef` when it runs. State the steps share (Blizzard's hit count) is an object in their arguments. `npm run rollcheck` fails on any function found in the battle's state. The one exception is `b.rand`, whose state is saved with `rand.setState`.
- Replays (`game/replay.ts`): a match is a list of round tapes (seed, decks, per-frame inputs) plus a rules fingerprint, so playback just reruns the Battle. `npm run replaycheck` checks a replay ends with the same hash.

## Netcode

Rollback (GGPO style, #44): both machines run the same seeded Battle and only trade controls. The rival's missing input is guessed; a wrong guess is fixed by rewinding to the last confirmed frame and replaying.

```mermaid
flowchart LR
  read["Read local input"] --> sched["Schedule at frame + delay<br/>delay 2..8 from ping, +1 on room"]
  sched --> send["Send packet every frame<br/>inputs, picks, hash, frame fr"]
  send --> tr{{"Transport<br/>room / peer / local"}}
  tr --> recv["Rival input arrives"]
  recv --> known{"Rival input<br/>for frame N?"}
  known -- yes --> run["Run frame N"]
  known -- "no, under 10 guessed" --> guess["Guess: held keys,<br/>no new presses"] --> run
  known -- "no, 10 guessed" --> stall[Stall]
  recv --> wrong{"Guess was wrong?"}
  wrong -- yes --> rb["Restore confirmed snapshot,<br/>replay silently, re-save,<br/>guess forward again"]
  run --> conf["Confirmed frames only:<br/>Draw screen, round end,<br/>hash every 30, replay tape"]
```

| File | Job |
| --- | --- |
| `net/netplay.ts` | `Netplay`: drives one online round for the scene and `netsoak`; input delay, pacing against the rival's frame `fr` (runs 2 frames when behind, skips a tick when ahead) |
| `net/rollback.ts` | `Rollback`: one confirmed snapshot, guesses up to `MAX_ROLLBACK = 10` frames, rewind and replay, `onConfirmed` feeds the replay `TapeWriter` |
| `net/snapshot.ts` | Snapshots the Battle object graph and restores it in place; watchers (post-match stats) pass extra roots |
| `net/session.ts` | `NetSession`: handshake, readiness, input buffers, RTT, status (waiting / connected / reconnecting / lost), desync flag |
| `net/protocol.ts` | `Packet`, `PROTOCOL = 8`, 10-bit input packing (2 chars per frame), room codes |
| `net/transport.ts` | `room` (claude.ai artifact presence), `peer` (WebRTC via PeerJS), `local` (BroadcastChannel, fake lag) |
| `net/hash.ts` | `battleHash(b)`, FNV-1a over everything the rules read |
| `scenes/online.ts`, `scenes/onlineBattle.ts` | Online menu and the Versus scene driven by `Netplay` |

- Every packet is the sender's whole current state, never a one-off event, so drops and merges lose nothing (this is what lets it ride on room presence, which keeps only the latest value).
- Draw picks travel in `packet.picks`; there is no pause online. Each round reseeds as `seed + r × 0x9e3779b9`.
- Bump `PROTOCOL` whenever rules or packets change.
- Silence: after 1.5 s the screen says RECONNECTING and holds; after 30 s the match counts as dropped. A backgrounded tab sends `away` and only pings, so the rival waits longer instead of timing out.
- `npm run netsoak` plays whole headless online matches over a fake bad network (lag, jitter, loss, duplicates, outages, latest-value-only delivery, hitches, background tabs) and compares every checksum.
- `npm run rollcheck` (in CI) proves rollback play ends exactly like straight play.

### Online services

Everything online rides on the artifact's `room` presence plus a small `db` for ratings; there is no game server.

```mermaid
flowchart LR
  menu[ONLINE menu] --> lobby["Lobby + chat<br/>presence field lb"]
  menu --> rq["Ranked queue<br/>presence field rq"]
  menu --> tb["Tournament bracket<br/>presence fields tb / tr"]
  menu --> room[Create / join room code]
  lobby --> match[Rollback match]
  rq --> match
  tb --> match
  room --> match
  match --> elo["Elo update<br/>db ratings/{user}"]
  match --> rep["Replay saved<br/>seed + inputs"]
```

| File | Job |
| --- | --- |
| `scenes/lobby.ts` | Who's online, chat, challenges |
| `scenes/ranked.ts` | Queue, pairing, Elo in the artifact db (`ratings`), pending result recovery |
| `scenes/tournament.ts` | Bracket host and players over presence |
| `scenes/replays.ts` | Replay list and playback |

- Both links must publish with the `room`, `db` (ratings rules) and `user` (profile) capabilities, or ranked breaks.
- `npm run rankedcheck` exercises the ranked flow by hand.

## Characters and cards

```mermaid
flowchart LR
  pick["Draw pick<br/>cast order"] --> queue["f.queue<br/>top casts on K"]
  queue --> gates{"castTop gates<br/>0.5 s cooldown, silence,<br/>stealth need, can afford"}
  gates -- fail --> deny["NEED X text, 0.15 s lock"]
  gates -- pass --> pay["Pay resource, discard,<br/>callout + voice"]
  pay --> counter{"Rival Counterspell?"}
  counter -- yes --> silenced["Cast eaten, caster silenced"]
  counter -- no --> mult["Multipliers<br/>Shout, Rally, Cold Blood"]
  mult --> cast["card.cast(ctx)"]
  cast --> helpers["Battle helpers<br/>strike, shoot, warn, freeze, stun, walls, bless, curse, later"]
```

`CardDef` (`game/cards.ts`, which also gathers every class's spells into `ALL_CARDS` / `CARDS` in class order). Spells live in `content/classes/<id>/cards.ts` and import engine helpers only through `content/api.ts`. A spell's delayed steps are registered effects (`spellStep`), never closures. Fields: `id, name, cls, cost (0..5 | 'all'), rarity, element, damaging, lock, dmg, short, gain, needsStealth, cast(ctx), ai(b, f)`.

| Class | HP | Light / heavy | Resource | Comes back | Cards |
| --- | --- | --- | --- | --- | --- |
| Warrior | 9650 | 100 / 280 | Rage, max 5 | Heavy hits +1.5, taking damage 1 per 400 (max 1 per hit) | `content/classes/warrior/cards.ts` |
| Mage | 6900 | 60 / 280 | Mana | Max 1, +1 per Draw (cap 5), refills each Draw | `content/classes/mage/cards.ts` |
| Rogue | 6500 | 100 / 220 | Energy | Topped up to 5 each Draw | `content/classes/rogue/cards.ts` |
| Ranger | 7650 | 100 / 200 | Energy | Starts 2, +1 per Draw, grows standing still | `content/classes/ranger/cards.ts` |
| Priest | 6600 | 60 / 280 | Mana | Starts 3, +3 per Draw (cap 5) | `content/classes/priest/cards.ts` |

`tuning.ts` is the source of truth for numbers. Each class has 26 cards, a starter deck and 3 Mythic decks (`game/deck.ts`). Deck rules: exactly 30, 4 / 2 / 1 copies by rarity, max 5 Legendaries, exactly 1 Mythic. Players keep up to 10 named spell decks per class in `save.json` (`createCustom` / `renameCustom` / `cloneCustom` / `deleteCustom` in `deck.ts`); a match setup names one as `custom:<id>`. The deck builder opens on that list (edit, rename, clone, delete, or start a new one from a ready-made deck, an empty one or YAML), and `scenes/nameEntry.ts` is the name box (typing, a phone's keyboard, or an on-screen QWERTY keyboard for gamepads). `game/deckYaml.ts` imports and exports YAML; an import becomes a new deck.

Adding a class today touches: `art/sprites.ts` (+ generated sprites and frames), `game/classes.ts`, a `tuning.ts` block, `content/classes/<id>/cards.ts` (listed in `game/cards.ts`), resource rules in `battle.ts`, decks in `deck.ts`, `game/fighterAnim.ts`, voice lines, and tutorial lessons (every new character gets tutorial support). Only the spells live in the class folder so far (#62); the rest moves there next.

## Stages

Stages are scenery only: same 6×3 grid, same red / blue rims, same rules.

```mermaid
flowchart BT
  back["back(c): sky, far scenery (painted once)"] --> behind["behind(c, t): animated"]
  behind --> front["front(c): near scenery (painted once)"]
  front --> over["over(c, t): animated"]
  over --> grid["Panel grid 6×3: faces from the stage, state from Battle"]
  grid --> fighters["Fighters and effects"]
  fighters --> hud["HUD (UI layer)"]
```

| Id | Name | File |
| --- | --- | --- |
| `colosseum` | Grand Colosseum | `content/stages/colosseum.ts` |
| `courtyard` | Castle Courtyard | `content/stages/courtyard.ts` |
| `archive` | Arcane Archive | `content/stages/archive.ts` |
| `frostpeak` | Frostpeak Pass | `content/stages/frostpeak.ts` |
| `emberforge` | Emberforge | `content/stages/emberforge.ts` |
| `elderwood` | Elderwood Ruins | `content/stages/elderwood.ts` |

Each stage is a module in `content/stages/`, registered in `content/stages/index.ts` (order = stage select and online vote order; new stages go at the end). `StageDef` (`content/stages/inked.ts`) = id, name, tag, `PanelLook`, panel `tex()`, up to four layer painters; `inkedStage(def)` wraps one as a `StageModule`. `getStage(id)` builds and caches; `STAGE_IDS` feeds stage select. `art/ink.ts` is the Inked toolkit. Online, both players vote; a tie wins, otherwise a seeded coin flip.

## Rendering and art pipeline

```mermaid
flowchart LR
  subgraph offline ["Offline (Python, project files)"]
    ref["Reference sheet<br/>art/hi-res/sheet.png"] --> down["Downscale + clean<br/>24×24, 1px outline"]
    down --> rig["Frame rig<br/>art/char-anims/rig/"]
  end
  rig --> gen["Generated TS<br/>hiresSprites.ts, fighterFrames.ts"]
  gen --> recolor["getSprite / getFrame<br/>skin recolour, canvas per tint"]
  recolor --> pose["fighterAnim.ts<br/>WeakMap, reads Battle"]
  pose --> draw["battleView + fxView"]
  draw --> compose["world 240×160 at 2× + UI 480×320<br/>nearest-neighbour"]
```

- Fighters stay 24×24 and are never stretched in menus; spell effects keep a 24×24 footprint and take their element's colour.
- Visual state never goes into the Battle, so rollback and the hash never see it. Hit feel (#34, #73): the hit pause and slow-mo are rules (`Battle.hitStop` / `stopT` / `slowmo`, by hit tier from `TUNING.hitStop` and `TUNING.slowmo`; presses made during a pause are buffered and played after it), so they stay in lockstep and rollback. `game/hitFeel.ts` is the render-only part: a directional screen kick, a 1 px shudder while a pause runs, element impact sparks and popping damage numbers, deduped so a rollback doesn't replay them.
- Basic shots are real projectiles at a constant speed (`TUNING.<cls>.shotSpeed`, capped by `maxShotSpeed` 15; only Aimed Shot may pass it), so full-row heavies can be dodged. A shot lights its row in the shooter's team colour until it is gone.
- Team colours (#75, `game/teamColors.ts`, view-only): `team(side)` makes the watching player blue and the opponent red for panel rims and faces, telegraphs, reticles, shot paths and HUD ribbons. P1 is "you" in local 2P and CPU vs CPU.
- The canvas fits the window between 4:3 and 21:9 (shows more stage, no letterbox); phones in portrait give the bottom half to the touch pad.
- Screens with a full-height phone layout (`Scene.tall`: title, fighter select, spell deck select (#69), decks, stages, options, online, lobby, ranked, replays, tournament, arcade, training, tutorial, spell encyclopedia) take the whole portrait screen instead and draw big controls from `scenes/touchUi.ts`: the action bar, tabs, scrolling row lists, sheets and swipes.
- UI skin: Parchment (`scenes/skin.ts`). Cards: `scenes/cardView.ts`. Font: `engine/font.ts` (5×7).

## Audio

Effects are synthesized live in WebAudio. Music is an original sampled soundtrack (#40): `scripts/music/` renders a score DSL offline with a soundfont, and `engine/musicTracks.ts` holds the base64 MP3s. Voice clips are recorded TTS (`engine/voiceClips.ts`, from `scripts/voices/gen.py`).

```mermaid
flowchart LR
  spell["Spell and hit sounds<br/>sfxReal.ts"] --> real["realBus<br/>compressor, limiter, room"] --> sfxBus
  blips["Menu blips, charge hum"] --> sfxBus
  sting["Announcer stingers"] --> sfxBus
  voice["Voices, announcer clips"] --> vbus["voiceBus / annBus"]
  music["playMusic(id)<br/>musicTracks.ts, looped"] --> mbus["musicBus"]
  sfxBus --> master
  vbus --> master
  mbus --> master["master (M mutes)"]
```

The Battle never calls audio (#55). It emits events through `b.sink`; `main.ts` sets `engine/battleAudio.ts` as the default sink, headless sims get none, and rollback switches it off while replaying corrections.

```mermaid
flowchart LR
  battle["Battle<br/>b.sound / b.voice / emit"] --> ev["BattleEvent<br/>sound, fxSound, voice, hit, cast, ko"]
  ev --> sink{"b.sink<br/>(not snapshotted)"}
  sink --> ba["battleAudio.ts<br/>sfx + voice lines, voice dice"]
  sink -. none .-> sims[Headless sims, rollback replays]
```

Each stage has its own theme; the menu and victory have theirs. Volume and mute live in `save.json`.

## UI and screens

Screens live on a stack (`scenes/stack.ts`, re-exported by `scenes/scene.ts`). A `Scene` has `update`, `draw(world, tick, ui)`, `enter?` (first open), `resume?` (shown again after the screen on top closes), `pad?` and `suspend?` (the game went to the background).

```mermaid
flowchart LR
  push["pushScene(s)<br/>open on top"] --> st[(stack<br/>title at the bottom)]
  st --> pop["popScene()<br/>BACK: resume the one underneath as left"]
  st --> rep["replaceScene(s)<br/>next round, rematch,<br/>fight replaces stage select"]
  st --> to["popTo(pred, orElse)<br/>CHARACTER SELECT after a set"]
  st --> home["goHome()<br/>TITLE / QUIT: fresh title"]
```

Scenes never import `TitleScene`; `main.ts` registers it with `setHome`. Screens with a `back` callback default it to `popScene`. `tests/scene-stack.ts` checks the rules.

```mermaid
flowchart LR
  title[Title menu]
  title -- ARCADE --> cs0[Fighter select] --> dk0[Spell deck select] --> ar["Arcade ladder<br/>4 rivals at 60-90% power<br/>+ Shadow Self boss"] --> bs
  title -- VERSUS --> cs1[Fighter select] --> dk1[Spell deck select] --> ss1[Stage select] --> bs[BattleScene]
  title -- ONLINE --> om["Online menu<br/>LOBBY, RANKED MATCH, TOURNAMENT,<br/>MATCH, CREATE/JOIN ROOM"] --> cs2[Fighter select] --> dk2["Spell deck select<br/>both lock in"] --> ss2[Stage vote] --> ob[OnlineBattleScene]
  title -- REPLAYS --> rp[Replay list] --> bs
  title -- TRAINING --> cs3[Fighter select] --> dk3[Spell deck select] --> tr[TrainingScene]
  title -- TUTORIAL --> cs4[Fighter select] --> tu[TutorialScene]
  title -- SPELL DECKS --> db[Deck builder]
  title -- OPTIONS --> op[Options + Key Mapping]
  title -. DEV TOOLS, dev builds .-> dev[Encyclopedia, sandbox, lab, voices]
```

- Pre-match flow (#69): fighter, then spell deck (`scenes/deckSelect.ts`: both sides' decks side by side, EDIT, CPU level, match length), then stage; a step trail (1 FIGHTER / 2 SPELL DECK / 3 STAGE) runs across the three screens. Tapping a stage only selects it; FIGHT! starts.
- `OnlineBattleScene` and `TrainingScene` extend `BattleScene`; `TutorialScene` drives one. Card previews run their own tiny muted Battle.
- Menus are mouse-first: scenes register click zones while drawing (`zone(...)`), the next update reads `hotZone()`. Combat is keyboard, gamepad or the touch pad (`engine/touch.ts`); see Input and platform.
- Everything kept between sessions goes through the save module (see Saves).

### Phones (#51)

```mermaid
flowchart TB
  fit["main.ts fit()"] --> q{"Scene hook?"}
  q -- "tall()" --> tall["Full-height portrait layout<br/>spread.tall"]
  q -- "split()" --> split["Scene drawn in the top part<br/>shiftZones offsets its hit zones"]
  split --> below["drawBelow(ui)<br/>controls under it"]
  q -- neither --> std["Standard fit, touch pad below"]
```

- Every menu has a `tall()` layout (#51, #63) except key mapping, the dev tools and the balance lab. Battle and tutorial use `split()`.
- `engine/input.ts` exports `gesture` (swipe, start, delta, held, fling); a swipe in from the left edge presses `PadBack`.
- `scenes/touchUi.ts` is the touch kit: `bigButton`, `actionBar`, `tabs`, `swipeIn` / `flickIn`, `dots`, `Scroller`, `rowList` (scrolling panel of big rows), `panel`, `sheet`, `tallArea` (safe-area insets from `touch.ts` `safeInsets()`).
- Touch settings (pad size S/M/L, left-handed, vibration) live in `engine/touch.ts` and save in the `touch` section of `save.json` (#63, old `svs:touch` imported once); `layout()` applies them.

## CPU AI and styles

`Cpu.intent(b, f, dt)` (`game/ai.ts`) returns the same `Intent` a keyboard player would. When its think timer runs out it re-decides, in priority order: 1. dodge warned panels and shots, 2. cast the top spell when `card.ai()` agrees or it has waited long enough, 3. basic attacks (hold heavy when it will reach), 4. position (track the row, plus class habits).

| Level | Think | Aim | Dodge | Cast patience |
| --- | --- | --- | --- | --- |
| Easy | 0.6 s | 0.55 | 0 | 3 s |
| Normal | 0.22 s | 0.9 | 0.85 | 1.5 s |
| Hard | 0.12 s | 1 | 1 | 0.4 s |

Each class has 3 playstyles (aggro, conservative, defensive) in `game/playstyles.ts`, played at half strength. Difficulty sets both execution and which style shows up:

```mermaid
flowchart LR
  e[Easy] --> ea[Class aggro style]
  n[Normal] --> nr[Random of the 3]
  h[Hard] --> hc["Counter-pick<br/>COUNTER table vs your class"]
```

Hard also holds heavies (not Ranger or Rogue) and sidesteps out of the row when it can't hit back.

## Balance tooling

`dev/simulate.ts`: `runMatch` plays a real Battle with two `Cpu`s at 60 Hz (600 s cap = draw); `dev/instrument.ts` tags every hit with its spell. `runSeries` aggregates wins with a Wilson 95% range, time, turns, damage split and per-card stats.

| Tool | Run | Gives |
| --- | --- | --- |
| Sim CLI | `npm run sim -- 100 --cards` | All class pairs with starters, per-card table |
| Balance lab | dev build, `#lab` | The same in the browser: full grid on web workers, live `TUNING`, script box (`hp.mage = 7000`, `card.power = 110%`) |
| Sandbox | `#sandbox` | Cast anything, dummies, can't-die, slow time, frame step, hit log |
| Encyclopedia | `#cards` | Every card face with filters |
| Grid CLI | `npm run balance -- --pools starter,archetype --n 40` | Full matchup grid on worker threads (~750 matches/s), `--set` / `--script` tweaks |
| Sweep | `npx tsx scripts/sweep.ts --out dir` | Every class pair at every CPU level over shipped decks, styles, starters and random decks |
| Tuner | `npx tsx scripts/tune.ts --out dir` | Searches small HP / attack / power / shot speed tweaks that put every wheel matchup in the target band |

```mermaid
flowchart LR
  script["Balance script<br/>dev/script.ts"] --> pool["SimPool<br/>worker threads"]
  decks["Deck pools<br/>dev/archetypes.ts"] --> pool
  pool --> runMatch["runMatch x N<br/>two Cpus, 60 Hz"] --> lib["balancelib.ts<br/>class rates, band, loss"]
  lib --> grid[Grid report]
  lib --> tune["tune.ts<br/>least-squares step, recheck"]
```

Reports live in project files under `balance/`.

## Input and platform

Keys, pads and the touch pad all become digital codes before any scene reads them, so the sim and `NetInput` only see on/off presses (lockstep and rollback stay deterministic). Full detail: [PLATFORM.md](PLATFORM.md).

```mermaid
flowchart LR
  KB[Keyboard events] --> P[press code]
  TP["Touch pad<br/>Pad* codes"] --> P
  GP["engine/gamepad.ts<br/>polled each fixed step<br/>Gp1A, Gp2Start ..."] --> P
  P --> B["BINDINGS<br/>P1 keys + P1 pad buttons, every pad"] --> A[isDown / wasPressed / heldDir]
  P --> L["LOCAL_KEYS (2P Versus)<br/>P1: keys + pad 1, P2: keys + numpad + pad 2"] --> LA[localDown / localPressed]
  A --> I[Intent / NetInput]
  LA --> I
```

- Pads use the standard mapping; the left stick becomes the d-pad with hysteresis. Pad 1 is player 1 and pad 2 player 2 in local Versus. Key Mapping has a PAD column per player; bindings save as `pads`.
- `platform/index.ts` exports one `platform`: `storage` (the `PlatformStorage` the save module uses), `fullscreen` (Options FULLSCREEN row) and `lifecycle` (background: release input, suspend audio, `scene.suspend()`; QUIT on the title only when `canQuit`). A native shell overrides parts by setting `window.svsNative` before the game script runs; the desktop app does this in `electron/preload.cjs` (QUIT, window fullscreen).

```mermaid
flowchart TB
  G[Game code] --> PF[platform]
  PF --> ST[storage] & FS[fullscreen] & LC[lifecycle]
  W["web: localStorage, Fullscreen API, visibilitychange"] -.default.-> PF
  N["window.svsNative<br/>Electron preload / Capacitor"] -.overrides.-> PF
```

## Saves

One module, `engine/save.ts`, on top of the platform's file storage (`platform/storage.ts`). Nothing else touches `localStorage`. Full detail: [SAVES.md](SAVES.md).

```mermaid
flowchart LR
  callers["input, audio, deck, match, arcade,<br/>training, tutorial, touch, replay, net/rating"] -->|getSave / updateSave| S["save.ts<br/>in-memory SaveData"]
  S -->|read once at boot<br/>flush at end of tick| P[PlatformStorage]
  P --> web["webStorage<br/>localStorage svs:file:NAME"]
  P -.later.-> native[Steam / Capacitor files]
```

| File | Holds |
| --- | --- |
| `save.json` | keys, P2 keys, pads, audio, mute, spell decks (a list per class), last match, training, tutorial done, arcade, rating, pending ranked result, lab script, touch controls |
| `replays.json` | 20 recent + up to 20 starred replays, about 3 MB budget |

- Each file is `{game, v, data}`. Changing the shape means bumping `SAVE_VERSION` and adding `MIGRATIONS[n]`; never edit a shipped one.
- First load imports the 14 old `svs:*` keys and deletes them once the new file reads back. A corrupt file is kept as `save.json.bad`; a save from a newer build is read-only.
- Native builds `await initSave(storage)` before the game starts; the browser loads on first use.

## Build and publish

```mermaid
flowchart LR
  src[src on latest main] --> tsc[tsc --noEmit] --> vite["vite build<br/>singlefile, inline assets"] --> page["scripts/artifact.mjs<br/>artifact.html"]
  page --> dev["Dev link<br/>npm run build, dev tools on"]
  page --> prod["Main link<br/>npm run build:prod, room + db + user capabilities"]
  vite --> desk["Desktop (#59)<br/>Electron around dist-prod,<br/>portable .exe + AppImage"]
```

| Link | Build |
| --- | --- |
| Main (prod): https://claude.ai/artifact/1kBiHGD35b15oWBEWxcAcr | `npm run build:prod` → `dist-prod/artifact.html` |
| Dev: https://claude.ai/artifact/8xAkx41kQdJWmNQKZpBVJU | `npm run build` → `dist/artifact.html` |
| Desktop app | `npm run desktop` to play, `npm run dist:win` / `dist:linux` to package; a `v*` tag builds both into a GitHub Release (`desktop.yml`). See [DESKTOP.md](DESKTOP.md) |

Release: PR → Wes says "lgtm" → merge → rebuild from latest main → publish the main link and the dev link from the same commit. `DEV_TOOLS` (`src/flags.ts`) gates dev-only code; the dev menu is a dynamic import so prod ships none of it.

## Testing and CI

`.github/workflows/ci.yml` runs on every PR.

```mermaid
flowchart LR
  pr[Pull request] --> a["Job 1<br/>typecheck, dev build, prod build"]
  a --> sv["tests/saves.ts<br/>migrations, legacy import"] --> m["tests/matches.ts<br/>CPU vs CPU, every class pair"]
  m --> ss["tests/scene-stack.ts<br/>BACK rules"] --> gp["tests/gamepad.ts<br/>fake pads"] --> n["netcheck 25<br/>online determinism"]
  n --> c[combocheck] --> rc["rollcheck 25<br/>rollback = straight play"]
  pr --> b["Job 2: screens<br/>Playwright, every screen at 7 shapes"]
  b --> d["Pixel diff vs base branch<br/>screens-report artifact"]
```

| Command | Where | Fails on |
| --- | --- | --- |
| `npm run typecheck` | CI | Type errors, unused locals |
| `npm run rollcheck` | CI | Rollback play ending differently from straight play |
| `npx tsx tests/saves.ts` | CI | Save migrations, legacy import, caps |
| `npx tsx tests/matches.ts` | CI | Crashes, stuck or broken full matches, a seed not replaying (unseeded CPU or rule rolls) |
| `npx tsx tests/scene-stack.ts` | CI | BACK not returning to the screen it came from |
| `npx tsx tests/gamepad.ts` | CI | Pad buttons, stick, 2P pad split or pad rebinding broken |
| `npm run netcheck` | CI | Two seeded battles with the same inputs drifting apart |
| `npm run combocheck` | CI | Combo counter counting escapable hits |
| `tests/screens/run.ts` | CI | Screens changing vs the base branch (report, not a hard fail) |
| `npm run replaycheck`, `npm run rankedcheck` | By hand | Replays not reproducing, ranked flow broken |
| `npm run fuzz`, `npm run fuzz:ui` | By hand | Random inputs crashing the sim or the menus |
| `npm run netsoak` | By hand | Desyncs or hangs over a fake bad network |
| `npm run perf` | By hand | Frame time regressions |
| `npm run golden` | By hand (refactor PRs) | Any behaviour change: 100 seeded CPU matches plus the card, class, deck and `TUNING` tables vs `scripts/golden.txt`; gameplay PRs run `golden:write` |
| `npm run sim` | By hand | Surprising win rates |

New screens go in `tests/screens/harness.ts`.
`window.__svs.getScene()` is exposed for automated playtests.

## In flight

- Modularize: stages are modules (#35) and spells sit in `src/content/classes/<id>/` (#62); next the rest of each class (sprites, tuning, decks, voices, lessons).
- BN indicators (#32).
