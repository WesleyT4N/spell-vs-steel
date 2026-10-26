// What the battle tells the outside world as it runs: sounds, voice lines, hits, casts, K.O.s.
// The rules never call audio or views directly. They emit events, and whoever runs the battle
// listens (the game plays them; headless sims ignore them; rollback netcode drops the ones from
// replayed frames, so a correction never plays a sound twice).

/** Sound options, the same shape the audio engine takes. */
export interface SoundOpts {
  pan?: number;
  amt?: number;
  element?: string;
  basic?: 'light' | 'heavy';
  dur?: number;
  data?: Record<string, number | string>;
}

export type VoiceKind = 'grunt' | 'cast' | 'castBig' | 'hurt' | 'hurtBig' | 'death' | 'win';

export type BattleEvent =
  /** A sound effect by name (menu blips and combat recipes alike). */
  | { type: 'sound'; name: string; opts?: SoundOpts }
  /** The sound of a visual effect, by fx kind. */
  | { type: 'fxSound'; kind: string; opts?: SoundOpts }
  /** A class voice line. `chance` < 1: the listener plays it only that often (variety, not rules). */
  | { type: 'voice'; cls: string; kind: VoiceKind; pan: number; side: 0 | 1; element?: string; chance?: number }
  /** Damage landed on `side` (after shields; 0 when fully blocked). */
  | { type: 'hit'; side: 0 | 1; col: number; row: number; amt: number; element?: string; basic?: 'light' | 'heavy'; spell?: boolean; dot?: boolean; blocked: boolean }
  /** `side` cast spell `card`. */
  | { type: 'cast'; side: 0 | 1; card: string }
  /** `side` was knocked out. */
  | { type: 'ko'; side: 0 | 1 };

export type EventSink = (e: BattleEvent) => void;

let defaultSink: EventSink | null = null;
/** Where new battles send their events unless told otherwise (the game sets this to its audio). */
export function setDefaultSink(sink: EventSink | null): void { defaultSink = sink; }
export const getDefaultSink = (): EventSink | null => defaultSink;
