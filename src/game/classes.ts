// Per-class labels and resource colors, read live from the class registry (each class's index.ts).
import { CLASSES, type ClassId, type ClassInfo } from '../content/classes';

export type { ClassInfo };

/** Class ids in roster order (the registry's own array, so classes registered later show up). */
export const CLASS_IDS = CLASSES.ids;
/** Classes shown in menus, the deck builder and the dev tools. */
export const PLAYABLE: ClassId[] = CLASS_IDS;

/** A class's name, resource and colors, by id. */
export const CLASS_INFO = new Proxy({} as Record<ClassId, ClassInfo>, {
  get: (_t, id) => (typeof id === 'string' ? CLASSES.get(id)?.info : undefined),
});
