# Modding

Mods are plain data. A mod is a **zip** of a `mod.json` manifest, PNG images and (optionally) MP3 voice lines; nothing in it ever runs as code or
is put into a web page, and the loader refuses any key, file, color or size the format doesn't name (see
`src/mods/format.ts`, checked by `tests/mods.ts`). The game reads the zip and the PNGs with its own small decoders
(`src/mods/files.ts`), with every size capped before anything is unpacked. A mod that fails the checks is listed on
the MODS screen with the reason; the game still starts.

Today a mod can add **skins with their own drawn art** for the 48px HD fighters, and give a skin **its own voice**. More kinds of content (spells,
stages, classes) will use the same manifest and the same rules as they become data.

## Installing mods

- **In game:** title > **MODS** lists every installed mod. Each one can be switched **on or off** (kept in the
  save). **IMPORT** opens a file picker for the mod's `.zip`; an imported mod is checked like any other, switched
  on, and kept in the save until it is **deleted**. Up to 12 imported mods, about 750 KB of zips in all.
- **With the build:** each folder in the repo's `mods/` folder (`mod.json` and its PNGs) ships with the game. They
  can be switched off, not deleted.

A mod skin shows up on the fighter select under a SKINS tab next to COLORS (the tabs only appear for a class that has mod skins; Q/E or LB/RB switch them), and in the Art Lab.

## The shipped mods

`mods/wes-skin/` (Mage: Wes, a young wizard) and `mods/hazel-druid-skin/` (Ranger: Hazel Druid). Both were made with PixelLab: a 48px idle
sprite generated from the reference sheet (`/mnt/project-files/art/skin-mods-pl/ref/`), then `transfer_outfit` on
the class's own game frames so every pose lines up with the built-in art, then
`python3 tools/pixellab/build_skin_mod.py <frames dir> <prefix> <class> <mod id> <name> <skin id> <skin name> [author]`,
which writes the mod's folder. Zip that folder's files to share the mod.

Each also has its own voice: Hazel a young woman (Kokoro `af_bella`), Wes a younger wizard (`bm_fable`), saying their
class's lines. `scripts/voices/gen.py <model dir> skins` renders the `skins` entries of `scripts/voices/lines.json`
into the mod's folder (`<skin>-<line>-<n>.mp3`) and lists them under the skin's `voice` key in its `mod.json`.

## File format

A mod zip holds `mod.json` and the PNGs it names, at the top of the zip or all inside one folder (zipping the mod's
folder works). Any other file is refused. A zip is at most 512 KB.

```
wes-skin.zip
  mod.json
  wes.png            every animation frame, side by side
  wes-portrait.png   optional character select bust
```

```json
{
  "format": "spell-vs-steel-mod/3",
  "id": "wes-skin",
  "name": "Wes Skin",
  "author": "Wes",
  "skins": [
    {
      "class": "mage",
      "id": "wes",
      "name": "Wes",
      "sheet": "wes.png",
      "portrait": "wes-portrait.png",
      "team": "#42357f"
    }
  ]
}
```

| Key | Rule |
| --- | --- |
| `format` | Always `spell-vs-steel-mod/3`. |
| `id` | Lowercase letters, digits and `-`, up to 32. Unique among installed mods. |
| `name`, `author` | Short plain text (letters, digits, spaces, a little punctuation), up to 32. |
| `skins` | 1 to 16 skins. |
| `skins[].class` | A built-in class: `warrior`, `mage`, `rogue`, `ranger`, `priest`. |
| `skins[].id` | Lowercase id, unique within the class (a built-in color id is refused). |
| `skins[].name` | Up to 12 characters, shown in menus. |
| `skins[].sheet` | The PNG of the animation frames (see below). |
| `skins[].portrait` | Optional 40 by 32 PNG character select bust. Left out, the class's default portrait shows. |
| `skins[].team` | `#rrggbb` of the main cloth color, one the art uses: HUD ribbons and the fighter select use it. |
| `skins[].palette` | Optional list of every `#rrggbb` the art uses, outline first (up to 62). Left out, the game collects the art's colors itself and takes the color around the art's edge as the outline. |

Images are 8-bit PNGs (RGBA, RGB or indexed), not interlaced. Pixels under half opacity are clear; the rest must
be one solid palette color (no soft edges).

### Frames

The sheet is the class's frames side by side, each the class's own HD frame size: 64 wide (2 sprite pixels per
world pixel), as tall as the class's frames (`frameHeight` in `assets/fighters/<class>.json`), feet on the bottom
row at the same column. The order is the class's `frames` list there: `idle0`-`idle3`, `hop`, `land`, `windup`,
`slash`, `cast0`, `cast1`, `hit`, `stagger`, `kneel`, `slump`, `fall1`, `fall2`, `down`. A sheet may stop early, and
a frame left empty shows `idle0`; `idle0` itself is required. The class's own sheet (`assets/fighters/<class>.png`)
is the best template.

### Voice

A skin may bring its own voice lines: `"voice"` maps a line to 1 to 4 MP3 files in the zip (one is picked at random
each time). Lines: `cast`, `castBig` (Legendary, Mythic and big spells), `death`, `win`, `grunt`, `hurt`, `hurtBig`,
and per-element cast lines `cast_<element>` (`steel`, `fire`, `frost`, `arcane`, `shadow`, `poison`, `nature`,
`holy`). Each clip is at most 64 KB and must be an MP3 (short mono clips at about 40 kbps are around 10 KB).

```json
"voice": {
  "cast": ["hazel-cast-1.mp3", "hazel-cast-2.mp3"],
  "castBig": ["hazel-castBig-1.mp3"],
  "death": ["hazel-death-1.mp3"],
  "win": ["hazel-win-1.mp3"]
}
```

A skin with a voice says only its own clips, never the class's, so a fighter never changes speaker mid-match. A
line it has no clip for stays silent, except that a missing `cast_<element>` line falls back to its `cast` line.
Keep to spoken words: synthesized grunts and yells sound like words read aloud.

### Older mods

Mods from before zips (one `.json` file with the art as palette-letter rows, format `spell-vs-steel-mod/2`) still
import and load.

### Art rules

Skins follow the game's sprite rules: drawn frames rather than stretched or rotated copies, every frame on-model,
and the poses of the class's own frames so attacks and hits line up.

## Limits

- Mod skins are cosmetic. Online, an opponent who doesn't have the mod sees your default color and hears the
  class's default voice.
