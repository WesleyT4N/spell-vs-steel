// Dev tools menu: card encyclopedia, debug sandbox and balance lab.
import { setScene, drawMenu, hint, listMouse, showSel, type Scene } from './scene';
import { getArena } from '../game/battleView';
import { drawStage } from '../art/arena';
import { UW, screenRect, spread, type Ctx } from '../engine/gfx';
import { drawTextCentered } from '../engine/font';
import { wasPressed, navPressed, k } from '../engine/input';
import { sfx } from '../engine/audio';
import { EncyclopediaScene } from './encyclopedia';
import { SandboxScene } from './sandbox';
import { LabScene } from './lab';
import { VoiceTestScene } from './voiceTest';
import { BattleScene } from './battle';
import { loadMatch } from '../game/match';
import { CLASS_IDS } from '../game/classes';
import type { ClassId } from '../art/sprites';

const ITEMS = ['CARD ENCYCLOPEDIA', 'SANDBOX', 'BALANCE LAB', 'VOICE TEST', 'BACK'];
const ABOUT = [
  'EVERY SPELL OF EVERY CLASS, WITH FILTERS',
  'DEBUG MODE: CAST ANY SPELL, DUMMIES, SLOW-MO, HIT LOG',
  'CPU VS CPU SIMS, PER-CARD STATS, LIVE TUNING',
  'EVERY CLASS VOICE LINE AND ANNOUNCER CALL',
  '',
];

export const openEncyclopedia = (back: () => void): void => {
  const enc: EncyclopediaScene = new EncyclopediaScene(back, card => setScene(new SandboxScene(() => setScene(enc), { you: card.cls, queue: [card.id] })));
  setScene(enc);
};

export class DevMenuScene implements Scene {
  sel = 0;

  constructor(private back: () => void) {}

  private open(i: number): void {
    const here = (): void => setScene(new DevMenuScene(this.back));
    if (i === 0) openEncyclopedia(here);
    if (i === 1) setScene(new SandboxScene(here));
    if (i === 2) setScene(new LabScene(here));
    if (i === 3) setScene(new VoiceTestScene(here));
    if (i === 4) { sfx('back'); this.back(); }
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

/** Open a dev tool straight from the URL hash (#cards, #sandbox, #lab), for local work. */
export function devFromHash(home: () => void): boolean {
  const tag = location.hash.slice(1);
  const menu = (): void => setScene(new DevMenuScene(home));
  if (tag === 'cards') openEncyclopedia(menu);
  else if (tag === 'sandbox') setScene(new SandboxScene(menu));
  else if (tag === 'lab') setScene(new LabScene(menu));
  else if (tag === 'voices') setScene(new VoiceTestScene(menu));
  else if (tag === 'dev') menu();
  else if (tag.startsWith('watch')) {
    // CPU vs CPU on the real battle screen: #watch, or #watch=warrior-mage
    const [a, b] = tag.split('=')[1]?.split('-') ?? [];
    const m = loadMatch();
    if (CLASS_IDS.includes(a as ClassId)) m.p1 = a as ClassId;
    if (CLASS_IDS.includes(b as ClassId)) m.cpu = b as ClassId;
    m.p1Deck = m.cpuDeck = 'starter';
    setScene(new BattleScene(m, [0, 0], undefined, [], ['cpu', 'cpu']));
  }
  else return false;
  return true;
}
