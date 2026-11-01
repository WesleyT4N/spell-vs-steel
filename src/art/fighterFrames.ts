// Fighter animation frame ids. Each class's frames are one PNG strip in assets/fighters/<class>.png, in the order
// its <class>.json lists them, feet on the bottom row; idle0 is the still sprite (see art/pl).
export type FrameId = 'idle0' | 'idle1' | 'idle2' | 'idle3' | 'hop' | 'land' | 'windup' | 'slash' | 'hit' | 'cast0' | 'cast1' | 'kneel' | 'down'
  | 'stagger' | 'slump' | 'fall1' | 'fall2';

/** Every frame id, in the order the art lists them. */
export const FRAME_IDS: readonly FrameId[] = ['idle0', 'idle1', 'idle2', 'idle3', 'hop', 'land', 'windup', 'slash', 'cast0', 'cast1', 'hit',
  'stagger', 'kneel', 'slump', 'fall1', 'fall2', 'down'];

export interface FrameSet { ax: number; frames: Partial<Record<FrameId, string[]>> }
