// Contact sheets of battle effects on the real renderer: each row fires one attack or spell in a fresh battle and
// draws evenly spaced frames of it, zoomed, with the effect's box marked. tests/fx/run.ts drives it; the job comes
// in the URL hash as JSON (see Job).
import { W, H } from '../../src/engine/gfx';
import { Battle, NO_INTENT } from '../../src/game/battle';
import { drawBattle } from '../../src/game/battleView';
import { boxOf, pfxFor, registerPfx, unregisterPfx, shotPfxFor, registerShotPfx, unregisterShotPfx, type PfxModule } from '../../src/game/pfx';
import { EFFECTS } from '../../src/fx';
import { panelFoot, PW, X0, Y0, FACE, LIP } from '../../src/art/arena';
import { toList, starterDeck } from '../../src/game/deck';
import type { ClassId } from '../../src/art/sprites';

export interface Row {
  label?: string;
  cls: ClassId;
  /** 'light', 'heavy' or a card id. */
  attack: string;
  /** Play these effect ids for these fx kinds in this row: { cleave: 'warrior/cleave-b' }; "shot:<kind>" for a projectile kind. */
  use?: Record<string, string>;
  foe?: ClassId;
  /** The foe's column (3 to 5). */
  foeCol?: number;
  /** Seconds to show (default: until the attack's fx are gone). */
  span?: number;
}
export interface Job { rows: Row[]; frames?: number; zoom?: number; perLine?: number; boxes?: boolean; /** Show the whole grid, not just the attacker's row. */ full?: boolean }

const job: Job = JSON.parse(decodeURIComponent(location.hash.slice(1) || '{"rows":[]}'));
const N = job.frames ?? 8, Z = job.zoom ?? 4, PER = job.perLine ?? 4;
// the attacker's row (row 1), from just behind the attacker (column 1) to the foe's front column
const CROP = job.full
  ? { x: X0 - 2, y: Y0 - 26, w: PW * 6 + 4, h: (FACE + LIP) * 3 + 30 }
  : { x: X0 + PW - 8, y: Y0 + (FACE + LIP) - 14, w: PW * 3 + 16, h: FACE + 18 };
const LABEL = 18, GAP = 4;

const world = document.createElement('canvas'); world.width = W; world.height = H;
const wc = world.getContext('2d')!; wc.imageSmoothingEnabled = false;
const out = document.getElementById('out') as HTMLCanvasElement;
const LINES = Math.ceil(N / PER), ROW_H = LABEL + LINES * (CROP.h * Z + GAP);
out.width = Math.min(N, PER) * (CROP.w * Z + GAP) + GAP;
out.height = job.rows.length * ROW_H + GAP;
const oc = out.getContext('2d')!; oc.imageSmoothingEnabled = false;
oc.fillStyle = '#16121c'; oc.fillRect(0, 0, out.width, out.height);

function fire(b: Battle, attack: string): void {
  const f = b.f[0];
  if (attack === 'light' || attack === 'heavy') { b.basicAttack(f, attack); return; }
  f.queue = [attack]; f.res = 5; f.resMax = 5; f.castCd = 0; f.lock = 0;
  b.castTop(f, null);
}

job.rows.forEach((row, ri) => {
  const restore: Array<[string, PfxModule | undefined]> = [];
  for (const [kind, id] of Object.entries(row.use ?? {})) {
    if (!EFFECTS[id]) throw new Error(`no effect ${id}`);
    restore.push([kind, kind.startsWith('shot:') ? shotPfxFor(kind.slice(5)) : pfxFor(kind)]);
    if (kind.startsWith('shot:')) registerShotPfx(kind.slice(5), EFFECTS[id]); else registerPfx(kind, EFFECTS[id]);
  }
  const foe = row.foe ?? 'warrior';
  const b = new Battle({ cls: row.cls, deck: toList(starterDeck(row.cls)), name: 'A' }, { cls: foe, deck: toList(starterDeck(foe)), name: 'B' }, 7);
  b.phase = 'fight';
  b.f[0].col = 1; b.f[0].row = 1; b.f[1].col = row.foeCol ?? 3; b.f[1].row = 1;
  fire(b, row.attack);
  const mine = b.fx.slice();
  const span = row.span ?? Math.max(0.2, ...mine.map(e => e.dur)) + 0.05;
  const y0 = GAP + ri * ROW_H;
  oc.fillStyle = '#e8dcc0'; oc.font = '13px monospace';
  oc.fillText(`${row.label ?? `${row.cls} ${row.attack}`}  ${mine.map(e => e.kind).join(', ')}  (${span.toFixed(2)}s)`, GAP, y0 + 13);
  let t = 0;
  for (let i = 0; i < N; i++) {
    const at = (span * i) / (N - 1);
    while (t < at - 1e-9) { b.update(1 / 120, [NO_INTENT, NO_INTENT]); t += 1 / 120; }
    wc.clearRect(0, 0, W, H);
    drawBattle(wc, b, Math.floor(b.time * 30), 0, true);
    const x = GAP + (i % PER) * (CROP.w * Z + GAP), y = y0 + LABEL + Math.floor(i / PER) * (CROP.h * Z + GAP);
    oc.drawImage(world, CROP.x, CROP.y, CROP.w, CROP.h, x, y, CROP.w * Z, CROP.h * Z);
    if (job.boxes !== false) {
      // the box each live pixelfx effect must stay inside
      oc.strokeStyle = 'rgba(255,0,255,0.7)'; oc.lineWidth = 1;
      for (const e of b.fx) {
        const m = pfxFor(e.kind)?.meta;
        if (!m) continue;
        const bx = boxOf(m), foot = panelFoot(e.col, e.row), flip = e.side === 1;
        const wx = flip ? foot.x - bx.x1 : foot.x + bx.x0, wy = foot.y + bx.y0;
        oc.strokeRect(x + (Math.round(wx) - CROP.x) * Z + 0.5, y + (Math.round(wy) - CROP.y) * Z + 0.5, (bx.x1 - bx.x0) * Z - 1, (bx.y1 - bx.y0) * Z - 1);
      }
    }
    oc.fillStyle = '#e8dcc0'; oc.font = '11px monospace';
    oc.fillText(`${at.toFixed(2)}s`, x + 3, y + CROP.h * Z - 4);
  }
  for (const [kind, mod] of restore) {
    if (kind.startsWith('shot:')) { if (mod) registerShotPfx(kind.slice(5), mod); else unregisterShotPfx(kind.slice(5)); }
    else if (mod) registerPfx(kind, mod); else unregisterPfx(kind);
  }
});
(window as unknown as { done: string }).done = out.toDataURL();
