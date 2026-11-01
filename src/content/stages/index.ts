// Built-in stages, registered in stage-select order. Online stage votes pick by index into this order,
// so new stages go at the end.
import { registerStage, registerExtraStage } from './registry';
import colosseum from './colosseum';
import courtyard from './courtyard';
import archive from './archive';
import frostpeak from './frostpeak';
import emberforge from './emberforge';
import elderwood from './elderwood';
import crypt from './crypt';
import { withBackdrop, type Backdrop } from './backdrop';
import type { StageModule } from './registry';

// PixelLab backdrops (assets/stages/<id>.png; sources in art/pixellab/stages-simple in the project files: raw/<id>.png
// panoramas grown into masters by tools/pixellab/extend_stage.py). `foot` is the master row where the far wall meets the floor;
// it lands just above the top panel row.
const ART: Record<string, { src: string; foot: number; fill: string }> = {
  colosseum: { src: 'stages/colosseum.png', foot: 436, fill: '#c8a070' },
  courtyard: { src: 'stages/courtyard.png', foot: 392, fill: '#a89c88' },
  archive: { src: 'stages/archive.png', foot: 408, fill: '#4a3470' },
  frostpeak: { src: 'stages/frostpeak.png', foot: 414, fill: '#c8d4ec' },
  emberforge: { src: 'stages/emberforge.png', foot: 421, fill: '#3a2420' },
  elderwood: { src: 'stages/elderwood.png', foot: 445, fill: '#8a6a30' },
  crypt: { src: 'stages/crypt.png', foot: 379, fill: '#2c2c3a' },
};
const painted = (m: StageModule): StageModule => {
  const a = ART[m.id];
  if (!a) return m;
  const b: Backdrop = { src: a.src, top: 100 - Math.round(a.foot / 2), fill: a.fill };
  return { ...m, create: () => withBackdrop(m.create(), b) };
};

for (const m of [colosseum, courtyard, archive, frostpeak, emberforge, elderwood]) registerStage(painted(m));
// mode-only stages (not in the stage select)
registerExtraStage(painted(crypt));

export { getStage, registerStage, registerExtraStage, stageMusic, STAGE_IDS, STAGES, type StageModule } from './registry';
