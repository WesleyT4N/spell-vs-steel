// Built-in stages, registered in stage-select order. Online stage votes pick by index into this order,
// so new stages go at the end.
import { registerStage } from './registry';
import colosseum from './colosseum';
import courtyard from './courtyard';
import archive from './archive';
import frostpeak from './frostpeak';
import emberforge from './emberforge';
import elderwood from './elderwood';

for (const m of [colosseum, courtyard, archive, frostpeak, emberforge, elderwood]) registerStage(m);

export { getStage, registerStage, STAGE_IDS, STAGES, type StageModule } from './registry';
