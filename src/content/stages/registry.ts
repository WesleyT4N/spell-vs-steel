// The stage registry. A stage module is an id plus a factory; most are Inked StageDefs (see inked.ts).
import type { Stage } from '../../art/arena';
import type { TrackId } from '../../engine/musicTracks';
import { Registry } from '../registry';

export interface StageModule {
  id: string;
  /** Builds the stage the first time it is shown (static layers are painted then). */
  create(): Stage;
  /** The battle theme (a built-in track id; stages without one use the Colosseum theme). */
  music?: TrackId;
}

export const STAGES = new Registry<StageModule>('stage');
export const registerStage = (m: StageModule): StageModule => STAGES.register(m);
/** Stage ids in registration order (the stage select's tile order). */
export const STAGE_IDS = STAGES.ids;

/** The battle theme for stage `id`. */
export const stageMusic = (id: string): TrackId => STAGES.get(id)?.music ?? 'stage_colosseum';

const built = new Map<string, Stage>();
/** The stage with this id, built on first use (falls back to the Colosseum). */
export function getStage(id: string): Stage {
  let s = built.get(id);
  if (!s) {
    s = (STAGES.get(id) ?? STAGES.get('colosseum')!).create();
    built.set(s.id, s);
  }
  return s;
}
