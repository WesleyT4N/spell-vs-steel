# Desktop and Android builds

The game ships to PCs as an Electron app, and to Android phones as a Capacitor app, both wrapped around
the player build (`dist-prod/index.html`).

| Command | What it does |
| --- | --- |
| `npm run desktop` | Player build, then opens it in an Electron window (try it locally) |
| `npm run dist:win` | Portable Windows `.exe` in `release/` (one file, no installer) |
| `npm run dist:linux` | Linux `.AppImage` in `release/` |

Both package commands work from Linux; no Wine is needed because nothing is signed.

`npm run android:sync` copies the player build into `android/`; then `cd android && ./gradlew assembleDebug`
(needs the Android SDK, or open `android/` in Android Studio).

## Sharing a build

Push a tag, and `.github/workflows/desktop.yml` (Play-test builds) builds the `.exe`, the AppImage and the APK and attaches them to a GitHub Release:

```
git tag v0.2.0 && git push origin v0.2.0
```

The tag sets the version in the file names. Running the workflow by hand (Actions > Desktop builds) gives the
same files as a workflow artifact without making a Release.

The `.exe` is unsigned, so Windows SmartScreen says "Windows protected your PC" the first time:
**More info > Run anyway**. Signing (and Steam) come later.

The APK installs by opening it on the phone and allowing installs from that app (browser or Files) when
Android asks. It is signed with the play-test key in `android/app/playtest.keystore` (kept in the repo on
purpose, never for the Play Store) and each CI run raises the version code, so a newer APK installs over the
old one and keeps saves.

## What works in the app

- Everything offline: Arcade, Versus (keyboard and gamepads), Training, Tutorial, Deck Builder, Replays.
- Online **Create Room / Join Room**: PeerJS over WebRTC, using the public PeerJS signaling server (see
  `src/net/transport.ts`). The room screen copies the code, since a link can't open the app.
- Lobby, Ranked and Tournaments need the claude.ai page (room + db capabilities); elsewhere they say "not supported yet".

Saves live in Electron's storage for the app (localStorage under the user's app-data folder), so they
survive updating to a newer `.exe`. F11, Alt+Enter or Options > FULLSCREEN toggles fullscreen, and the title
screen has QUIT (it saves first).

## Android app

- `capacitor.config.json` + `android/`: the Capacitor project (fullscreen, black splash with the logo, logo icon).
- `src/platform/capacitor.ts`: the hardware Back button acts like Esc (BACK in menus, pause in a fight),
  QUIT closes the app, and pause/resume drive the game's background handling.
- Saves are the web version (localStorage in the app's WebView), so they survive APK updates.
- Online works the same as the desktop app (room codes over PeerJS).

## Files

- `electron/main.cjs`: the window (no menu bar, fullscreen keys, links open in the real browser,
  no background throttling so an alt-tabbed online match keeps stepping).
- `electron/preload.cjs`: gives the game its desktop platform (`window.svsNative`): QUIT and window
  fullscreen. See [PLATFORM.md](PLATFORM.md).
- `build/icon.png`: app icon (the logo cut square: SPELL / VS shield / STEEL on blue | red). The Android icons in `android/app/src/main/res` use the same art.
- `package.json` `build` key: electron-builder settings.
