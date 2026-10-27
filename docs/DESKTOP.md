# Desktop builds

The game ships to PCs as an Electron app wrapped around the player build (`dist-prod/index.html`).

| Command | What it does |
| --- | --- |
| `npm run desktop` | Player build, then opens it in an Electron window (try it locally) |
| `npm run dist:win` | Portable Windows `.exe` in `release/` (one file, no installer) |
| `npm run dist:linux` | Linux `.AppImage` in `release/` |

Both package commands work from Linux; no Wine is needed because nothing is signed.

## Sharing a build

Push a tag, and `.github/workflows/desktop.yml` builds both files and attaches them to a GitHub Release:

```
git tag v0.2.0 && git push origin v0.2.0
```

The tag sets the version in the file names. Running the workflow by hand (Actions > Desktop builds) gives the
same files as a workflow artifact without making a Release.

The `.exe` is unsigned, so Windows SmartScreen says "Windows protected your PC" the first time:
**More info > Run anyway**. Signing (and Steam) come later.

## What works in the app

- Everything offline: Arcade, Versus (keyboard and gamepads), Training, Tutorial, Deck Builder, Replays.
- Online **Create Room / Join Room**: PeerJS over WebRTC, using the public PeerJS signaling server (see
  `src/net/transport.ts`). The room screen copies the code, since a link can't open the app.
- Lobby, Ranked and Tournaments need the claude.ai page (room + db capabilities); elsewhere they say "not supported yet".

Saves live in Electron's storage for the app (localStorage under the user's app-data folder), so they
survive updating to a newer `.exe`. F11, Alt+Enter or Options > FULLSCREEN toggles fullscreen, and the title
screen has QUIT (it saves first).

## Files

- `electron/main.cjs`: the window (no menu bar, fullscreen keys, links open in the real browser,
  no background throttling so an alt-tabbed online match keeps stepping).
- `electron/preload.cjs`: gives the game its desktop platform (`window.svsNative`): QUIT and window
  fullscreen. See [PLATFORM.md](PLATFORM.md).
- `build/icon.png`: app icon (the Warrior sprite, 10x nearest-neighbour).
- `package.json` `build` key: electron-builder settings.
