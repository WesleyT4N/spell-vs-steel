# Modding

Mods are plain data. A mod is one JSON file in the `mods/` folder; the game reads every file there when it
starts. Nothing in a mod ever runs as code or is put into a web page, and the loader refuses any key, color,
letter or size the format doesn't name (see `src/mods/format.ts`, checked by `tests/mods.ts`). A file that fails
the checks is skipped with a console warning; the game still starts.

Today a mod can add **skins with their own drawn art**. More kinds of content (spells, stages, classes) will use
the same file and the same rules as they become data.

## Example mods

| File | Adds |
| --- | --- |
| `mods/wizard.json` | Mage skin **Wizard**: brown hair, glasses, blue robe, orb staff |
| `mods/sylvan-ranger.json` | Ranger skin **Sylvan**: long dark hair, leaf headband, green cloak |

Both show up as an extra color swatch after the built-in ones on the character select, and in the Art Lab
(DEV TOOLS > ART LAB, the class tab's Animations or Sprites section; left and right, or the skin picker, switch skins).

## File format

```json
{
  "format": "spell-vs-steel-mod/1",
  "id": "wizard-skin",
  "name": "Wizard",
  "author": "Wes",
  "skins": [
    {
      "class": "mage",
      "id": "wizard",
      "name": "Wizard",
      "palette": { "a": "#000000", "b": "#5c78e8", "c": "#2c34a4" },
      "team": "c",
      "frames": { "idle0": ["....", "..."], "idle1": ["..."] },
      "portrait": ["..."]
    }
  ]
}
```

| Key | Rule |
| --- | --- |
| `format` | Always `spell-vs-steel-mod/1`. |
| `id` | Lowercase letters, digits and `-`, up to 32. |
| `name`, `author` | Short plain text (letters, digits, spaces, a little punctuation), up to 32. |
| `skins` | 1 to 16 skins. |
| `skins[].class` | A built-in class: `warrior`, `mage`, `rogue`, `ranger`, `priest`. |
| `skins[].id` | Lowercase id, unique within the class (a built-in color id is refused). |
| `skins[].name` | Up to 12 characters, shown in menus. |
| `skins[].palette` | Letter to `#rrggbb`, starting at `a` with no gaps (up to `z`). `a` is the outline. |
| `skins[].team` | The palette letter of the main cloth color: HUD ribbons and the color swatch use it. |
| `skins[].frames` | Pixel rows per animation frame. `idle0` is required; any frame left out shows `idle0`. |
| `skins[].portrait` | Optional character select bust. Left out, the class's default portrait shows. |

Pixel rows are strings: `.` is clear, any other character is a palette letter.

### Frame ids and sizes

Frames must be exactly the class's own frame size (36 wide by 24 tall for every class today, feet on the bottom
row, standing at the same column as the class's frames). The ids are the class's own: `idle0`, `idle1`, `hop`,
`land`, `windup`, `slash`, `hit`, `cast0`, `cast1`, `kneel`, `stagger`, plus `slump` (Mage, Rogue, Priest) or
`fall1`, `fall2`, `down` (Warrior, Ranger). The still sprite used in menus is `idle0` trimmed to its pixels.
Portraits are 40 by 32.

### Art rules

Skins follow the game's sprite rules: the 24x24 NES look, fighters fit a 24 by 24 box, drawn frames rather than
stretched or rotated copies, and every frame on-model. The easiest start is the class's own frames
(`src/art/fighterFrames.ts`): keep the poses and redraw the head, clothes and colors.

## Limits

- Mod skins are cosmetic. Online, an opponent who doesn't have the mod sees your default color.
- Mods ship with the build for now (the `mods/` folder). Loading a mod file at runtime from a MODS screen is
  the next step; it will use the same `parseMod` checks.
