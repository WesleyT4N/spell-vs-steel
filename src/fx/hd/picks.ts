// Sheet effects that pick a baked sheet per hit (see src/fx/sheet.ts).
import { pickFx, type SheetModule } from '../sheet';
import { EFFECTS } from '../index';

const sheetOf = (id: string) => (EFFECTS[`hd/${id}`] as SheetModule | undefined)?.sheet;

/** The hit spark every damaging hit plays: its element's color, small for light hits, big for big hits and KOs. */
export const impact = pickFx('Impact', 'The hit spark: element colored, small or big by hit tier.', d =>
  sheetOf(`impact/${d.el ?? 'steel'}-${Number(d.tier ?? 0) >= 2 ? 'l' : 's'}`) ?? sheetOf(`impact/steel-${Number(d.tier ?? 0) >= 2 ? 'l' : 's'}`));

/** Plays nothing: for a shot's own hit look when the element hit spark (impact) already covers it. */
export const none = pickFx('None', 'Nothing: the hit spark covers it.', () => ({ src: '', fw: 1, fh: 1, n: 1, fps: 1, ax: 0, ay: 0 }));
