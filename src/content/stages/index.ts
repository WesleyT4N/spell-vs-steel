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
import colosseumArt from './art/colosseum';
import courtyardArt from './art/courtyard';
import archiveArt from './art/archive';
import frostpeakArt from './art/frostpeak';
import emberforgeArt from './art/emberforge';
import elderwoodArt from './art/elderwood';
import cryptArt from './art/crypt';

// PixelLab backdrops (art/pixellab/stages in the project files). `foot` is the image row where the far
// wall meets the floor; it lands just above the top panel row.
const ART: Record<string, { src: string; foot: number; fill: string }> = {
  colosseum: { src: colosseumArt, foot: 262, fill: '#c8a070' },
  courtyard: { src: courtyardArt, foot: 252, fill: '#a89c88' },
  archive: { src: archiveArt, foot: 262, fill: '#4a3470' },
  frostpeak: { src: frostpeakArt, foot: 236, fill: '#c8d4ec' },
  emberforge: { src: emberforgeArt, foot: 286, fill: '#3a2420' },
  elderwood: { src: elderwoodArt, foot: 244, fill: '#8a6a30' },
  crypt: { src: cryptArt, foot: 262, fill: '#2c2c3a' },
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
