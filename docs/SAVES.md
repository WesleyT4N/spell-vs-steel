# Saves

Everything the game keeps between sessions goes through one module, `src/engine/save.ts`, which sits on the
platform's file storage (`src/platform/storage.ts`). Nothing else touches `localStorage`.

```mermaid
flowchart LR
  subgraph Game
    input[input.ts keys] --> S
    audio[audio.ts volume, mute] --> S
    deck[deck.ts spell decks] --> S
    match[match.ts last setup] --> S
    arcade[arcade.ts bests] --> S
    scenes[training, tutorial] --> S
    touch[touch.ts pad size, left-handed, vibration] --> S
    replays[replays] -->|getReplays / setReplays| S
  end
  S[save.ts<br/>in-memory SaveData<br/>migrations, caps] -->|read once at boot<br/>write at end of tick| P[PlatformStorage]
  P --> web[webStorage<br/>localStorage svs:file:NAME]
  P -.later.-> steam[Steam Remote Storage]
  P -.later.-> cap[Capacitor Filesystem]
```

## Files

| File | Holds | Written |
| --- | --- | --- |
| `save.json` | key bindings (P1, P2, pads), audio + mute, custom spell deck per class, last match setup, training settings, tutorial done, arcade bests, ranked rating + pending match, lab script, touch controls | on every change |
| `replays.json` | saved replays, newest first | when replays change |

Each file is `{ "game": "spell-vs-steel", "v": <SAVE_VERSION>, "data": ... }`.

## Load path

```mermaid
flowchart TD
  A[first getSave / initSave] --> B{save.json?}
  B -- missing --> L{old svs:* keys?}
  L -- yes --> I[import them, write save.json,<br/>remove old keys once it reads back]
  L -- no --> D[defaults]
  B -- unreadable --> K[keep it as save.json.bad, start from defaults]
  B -- v newer than this build --> R[read what we understand,<br/>READ-ONLY: never write over it]
  B -- v older or same --> M[run MIGRATIONS v+1..SAVE_VERSION] --> N[normalize: fill missing sections,<br/>drop wrong types and __proto__ keys]
```

## Rules

- Change the shape: bump `SAVE_VERSION` and add `MIGRATIONS[n]` that turns version n-1 into n. Never edit a shipped migration. `npx tsx tests/saves.ts` must pass.
- Reads are synchronous from memory. The browser loads on first use; native builds `await initSave(platform.storage)` before the game starts.
- Replays: 20 most recent + up to 20 starred, and the oldest unstarred go first if the file passes ~3 MB. Enforced in `setReplays`.
- Old keys imported once: `svs:keys`, `svs:p2keys`, `svs:pads`, `svs:audio`, `svs:muted`, `svs:deck:<class>`, `svs:match`, `svs:training`, `svs:tutorial`, `svs:arcade`, `svs:replays`, `svs:rating`, `svs:ranked-pending`, `svs:lab:script`, `svs:touch`.
- `svs:touch` (touch controls) was its own key for a short while after `save.json` existed, so it is also taken in when a save has no `touch` section yet, then removed.
- A new section that defaults to empty (like `touch`) needs no version bump: older saves just get the default, and older builds ignore it.
