# Battle effects (pixelfx)

Spell and attack effects are drawn with the [pixelfx](https://github.com/patch-gg/pixelfx) method (MIT, Patch +
Hugo Duprez). Its core is vendored unchanged in `src/vendor/pixelfx/`.

- **Effects** are modules in `src/fx/<class>/<name>.ts`. Each exports `meta` (`name`, `desc`, `duration`, `panels`,
  `rows`, `ink`) and `create(o)` returning `{ update(dt), draw(p) }`.
- **`src/fx/index.ts`** maps battle fx kinds to effects (`PLAYS`). A kind with no entry keeps its hand-drawn case in
  `src/game/fxView.ts`.
- **Flying shots** (projectiles) can play an effect too: register it in `SHOT_PLAYS` by `Projectile.kind`. Its
  origin is the shot's center (x forward along the flight), its box 24x24 plus `panels - 1` panels behind for a trail,
  and its clock the shot's flight time.
- **`src/game/pfx.ts`** plays them. It is render-only: an effect is seeded from when and where its fx started, so a
  rollback resim draws the same picture. Never read or write battle state from an effect.
- **Our style** (overrides pixelfx defaults):
  - Every effect stays in its box: 24 px wide, 24 px above the panel's feet. `panels` stretches it down the row and
    `rows: 3` covers a whole column.
  - Solid pixels use NES colors only (`src/fx/palette.ts`), colored by element.
  - `ink` traces a 1 px outline, like the fighters and stages.
  - Glow is seasoning only.
  - Frame 0 is the hit frame for instant hits.
- **Shared recipes** live in `src/fx/lib.ts`: swings, sparks, chunks, dust, shock rings, ripples and power streaks.
- **Contact sheets**: run `npm run fx:sheet -- '<job JSON>' out.png` (see `tests/fx/sheet.ts`). It draws effects on
  the real battle renderer, frame by frame, with each box outlined.
