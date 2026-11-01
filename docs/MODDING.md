# Modding

Mods are plain data. A mod is one JSON file; nothing in it ever runs as code or is put into a web page, and the
loader refuses any key, color, letter or size the format doesn't name (see `src/mods/format.ts`, checked by
`tests/mods.ts`). A file that fails the checks is listed on the MODS screen with the reason; the game still starts.

Today a mod can add **skins with their own drawn art** for the 48px HD fighters. More kinds of content (spells,
stages, classes) will use the same file and the same rules as they become data.

## Installing mods

- **In game:** title > **MODS** lists every installed mod. Each one can be switched **on or off** (kept in the
  save). **IMPORT** opens a file picker (or a box to paste the file's text); an imported mod is checked like any
  other, switched on, and kept in the save until it is **deleted**. Up to 12 imported mods, about 1 MB in all.
- **With the build:** files in the repo's `mods/` folder ship with the game. They can be switched off, not deleted.

A mod skin shows up as an extra color swatch after the built-in ones on the fighter select, and in the Art Lab.

## The shipped mods

`mods/wizard.json` (Mage: Wizard) and `mods/druid.json` (Ranger: Druid). Both were made with PixelLab: a 48px idle
sprite generated from the reference sheet (`/mnt/project-files/art/skin-mods-pl/ref/`), then `transfer_outfit` on
the class's own game frames so every pose lines up with the built-in art, then
`python3 tools/pixellab/build_skin_mod.py <frames dir> <prefix> <class> <mod id> <name> <skin id> <skin name> [author]`.

## File format

```json
{
  "format": "spell-vs-steel-mod/2",
  "id": "wizard",
  "name": "Wizard",
  "author": "Wes",
  "skins": [
    {
      "class": "mage",
      "id": "wizard",
      "name": "Wizard",
      "palette": { "a": "#0a0810", "b": "#42357f", "c": "#211854" },
      "team": "b",
      "frames": { "idle0": ["....", "..."], "idle1": ["..."] },
      "portrait": ["..."]
    }
  ]
}
```

| Key | Rule |
| --- | --- |
| `format` | Always `spell-vs-steel-mod/2`. (Format 1 drew the old 24px fighters and is refused.) |
| `id` | Lowercase letters, digits and `-`, up to 32. Unique among installed mods. |
| `name`, `author` | Short plain text (letters, digits, spaces, a little punctuation), up to 32. |
| `skins` | 1 to 16 skins. |
| `skins[].class` | A built-in class: `warrior`, `mage`, `rogue`, `ranger`, `priest`. |
| `skins[].id` | Lowercase id, unique within the class (a built-in color id is refused). |
| `skins[].name` | Up to 12 characters, shown in menus. |
| `skins[].palette` | Letter to `#rrggbb`, in the order `a`-`z`, `A`-`Z`, `0`-`9` with no gaps (up to 62). `a` is the outline. |
| `skins[].team` | The palette letter of the main cloth color: HUD ribbons and the color swatch use it. |
| `skins[].frames` | Pixel rows per animation frame. `idle0` is required; any frame left out shows `idle0`. |
| `skins[].portrait` | Optional character select bust (40 by 32). Left out, the class's default portrait shows. |

Pixel rows are strings: `.` is clear, any other character is a palette letter. A file is at most 512 KB.

### Frame ids and sizes

Frames are the class's own HD frame size: 64 wide (2 sprite pixels per world pixel), as tall as the class's frames
in `src/art/pl/<class>.ts`, feet on the bottom row at the same column. The ids are `idle0`-`idle3`, `hop`, `land`,
`windup`, `slash`, `cast0`, `cast1`, `hit`, `stagger`, `kneel`, `slump`, `fall1`, `fall2`, `down`.

### Art rules

Skins follow the game's sprite rules: drawn frames rather than stretched or rotated copies, every frame on-model,
and the poses of the class's own frames so attacks and hits line up.

## Limits

- Mod skins are cosmetic. Online, an opponent who doesn't have the mod sees your default color.
