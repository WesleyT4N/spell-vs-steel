# Game assets

Art and audio are real files under `assets/`, never written into the code. Tools and generators write them;
the game reads them through one registry, `src/engine/assets.ts`.

```
assets/
  audio/music/<track>.mp3       the soundtrack (scripts/music/gen.mjs)
  audio/music/tracks.json       loop points per track, in seconds
  audio/voice/<speaker>/<line>-<n>.mp3   voice lines, grunts and hurt sounds (ElevenLabs, scripts/voices); "ann" is the announcer
  stages/<stage>.png            painted stage backdrops (tools/pixellab/build_stages.py)
  fx/<class>/<effect>.png       effect frames as one horizontal strip (tools/pixellab/build_fx.py)
  fx/<class>/<effect>.json      frame size and count, speed, origin, and how the game shows the effect
  fighters/<class>.png          a fighter's 17 frames side by side, indexed to its palette (tools/pixellab/build_frames.py)
  fighters/<class>-portrait.png the select-screen portrait
  fighters/<class>.json         frame size and order, origin, team color and palette (index 0 = outline)
  monsters/<id>.png + .json     Expedition monsters, same palette scheme (tools/pixellab/build_mobs.py)
  cards/<spell>.png             40px spell icons; cards/small/<spell>.png the 20px ones (tools/pixellab/build_card_icons.py)
  sprites/<name>.png + .json    small hand-drawn sprites: Ranger pets, Warrior's hook, deck emblems
  ui/font.png + font.json       the pixel font, one 5x7 glyph per character
```

## Palette sprites

Fighters and monsters are recolored by palette index (skins, team colors, hit flashes), so their PNGs use only
the colors listed in the JSON beside them. At first use the game reads each image back into rows of palette
letters (`src/art/paletteImage.ts`); a pixel that is not a palette color takes the nearest one. Edit the PNG in any
pixel editor as long as you keep to the palette, or change the palette in the JSON to recolor the whole sprite.

## How a build ships them

```mermaid
flowchart LR
  files["assets/**/*.png, *.mp3"] --> glob["src/assetUrls.ts<br/>(Vite import.meta.glob ?url)"]
  meta["assets/**/*.json"] --> code["imported as data<br/>(fx, sprites, music loop points)"]
  glob --> reg["engine/assets.ts registry"]
  reg -->|"web: npm run build / build:prod"| one["one index.html,<br/>assets packed in as data URLs"]
  reg -->|"apps: npm run build:native"| many["dist-native/: index.html +<br/>assets/*.png, *.mp3 as files"]
```

- **Web links** (the claude.ai artifacts) must be a single self-contained page, so `vite-plugin-singlefile`
  packs every asset into it as a data URL at build time. Only the build output holds them that way.
- **Desktop and Android** (`build:native`, used by `npm run desktop`, `dist:*`, `android:sync` and the
  Play-test builds workflow) keep them as real files beside `index.html`, loaded by relative path.

## Loading

- `main.ts` waits for `loadImages()` before the first screen, so every PNG is decoded and drawing code reads
  them synchronously: `assetImage('stages/crypt.png')`.
- Audio is fetched and decoded the first time it plays: `assetBytes('audio/music/menu.mp3')`.
- In Node (sims, tests) nothing is registered: lookups come back empty and nothing draws, so the headless
  game never depends on art.

## Adding an asset

Drop the file in the right folder; `src/assetUrls.ts` picks up every `.png` and `.mp3` under `assets/` on the
next build. A new effect sheet needs both its `.png` and `.json`; it registers as effect `hd/<class>/<name>`.
