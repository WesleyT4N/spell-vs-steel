// Dev tools menu: card encyclopedia, debug sandbox, balance lab and art lab.
import { pushScene, popScene, drawMenu, hint, listMouse, showSel, type Scene } from './scene';
import { getArena, useStage } from '../game/battleView';
import { BattleScene } from './battle';
import { loadMatch } from '../game/match';
import { drawStage } from '../art/arena';
import { UW, screenRect, spread, type Ctx } from '../engine/gfx';
import { drawTextCentered } from '../engine/font';
import { wasPressed, navPressed, k } from '../engine/input';
import { sfx } from '../engine/audio';
import { EncyclopediaScene } from './encyclopedia';
import { SandboxScene } from './sandbox';
import { LabScene } from './lab';
import { VoiceTestScene } from './voiceTest';
import { ArtLabScene } from './artLab';

const ITEMS = ['CARD ENCYCLOPEDIA', 'SANDBOX', 'BALANCE LAB', 'ART LAB', 'VOICE TEST', 'BACK'];
const ABOUT = [
  'EVERY SPELL OF EVERY CLASS, WITH FILTERS',
  'DEBUG MODE: CAST ANY SPELL, DUMMIES, SLOW-MO, HIT LOG',
  'CPU VS CPU SIMS, PER-CARD STATS, LIVE TUNING',
  'EVERY ATTACK AND SPELL ON LOOP: SHIPPED, BEFORE AND DRAFT LOOKS',
  'EVERY CLASS VOICE LINE AND ANNOUNCER CALL',
  '',
];

/** The encyclopedia; TEST on a card opens the sandbox on top of it with that card queued. */
export const openEncyclopedia = (): void => {
  pushScene(new EncyclopediaScene(popScene, card => pushScene(new SandboxScene(popScene, { you: card.cls, queue: [card.id] }))));
};

export class DevMenuScene implements Scene {
  sel = 0;

  constructor(private back: () => void = popScene) {}

  private open(i: number): void {
    if (i === 0) openEncyclopedia();
    if (i === 1) pushScene(new SandboxScene());
    if (i === 2) pushScene(new LabScene());
    if (i === 3) pushScene(new ArtLabScene());
    if (i === 4) pushScene(new VoiceTestScene());
    if (i === 5) { sfx('back'); this.back(); }
  }

  update(dt: number): void {
    if (navPressed('up', dt)) { this.sel = (this.sel + ITEMS.length - 1) % ITEMS.length; sfx('move'); }
    if (navPressed('down', dt)) { this.sel = (this.sel + 1) % ITEMS.length; sfx('move'); }
    const clicked = listMouse('menu', this.sel, i => { this.sel = i; sfx('move'); });
    if (clicked >= 0) this.sel = clicked;
    if (wasPressed('confirm') || clicked >= 0) { sfx('select'); this.open(this.sel); return; }
    if (wasPressed('back')) { sfx('back'); this.back(); }
  }

  draw(c: Ctx, tick: number, ui: Ctx): void {
    drawStage(c, getArena(), tick);
    c.fillStyle = 'rgba(0,0,24,0.7)';
    c.fillRect(...screenRect());
    drawTextCentered(ui, 'DEV TOOLS', UW / 2, 48, '#f8b800', 3);
    drawMenu(ui, ITEMS, this.sel, UW / 2, 112, tick, { width: 240, gap: 24 });
    // under the menu, whose rows grow in phone portrait
    if (showSel()) drawTextCentered(ui, ABOUT[this.sel], UW / 2, 112 + ITEMS.length * Math.round(24 * spread.k) + 24, '#bcbcbc');
    hint(ui, `CLICK OR ${k('up')}/${k('down')} + ${k('attack')} TO SELECT   ${k('cast')}: BACK`);
  }
}

/** Open a dev tool straight from the URL hash (#cards, #sandbox, #lab, #art), for local work. BACK leads to the dev menu, then the title.
 *  #bench=stage[,classA,classB] starts a CPU vs CPU match to watch, for frame-rate profiling. */
export function devFromHash(): boolean {
  const tag = location.hash.slice(1);
  if (tag.startsWith('bench')) {
    const [stage = 'colosseum', a = 'mage', b = 'priest'] = tag.split('=')[1]?.split(',') ?? [];
    useStage(stage);
    pushScene(new BattleScene({ ...loadMatch(), p1: a, cpu: b, p1Deck: 'starter', cpuDeck: 'starter', stage, bestOf: 5 }, [0, 0], undefined, [], ['cpu', 'cpu']));
    return true;
  }
  if (!['cards', 'sandbox', 'lab', 'art', 'voices', 'dev'].includes(tag)) return false;
  pushScene(new DevMenuScene());
  if (tag === 'cards') openEncyclopedia();
  else if (tag === 'sandbox') pushScene(new SandboxScene());
  else if (tag === 'lab') pushScene(new LabScene());
  else if (tag === 'art') pushScene(new ArtLabScene());
  else if (tag === 'voices') pushScene(new VoiceTestScene());
  return true;
}
