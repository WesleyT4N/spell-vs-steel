// Dev tool: audition every class voice line (grunts and hurt sounds too), every mod skin that brings its own voice,
// and every announcer call.
import { popScene, hint, zone, hot, type Scene } from './scene';
import { getArena } from '../game/battleView';
import { drawStage } from '../art/arena';
import { UW, screenRect, type Ctx } from '../engine/gfx';
import { drawText, drawTextCentered } from '../engine/font';
import { wasPressed, navPressed, k, mouse } from '../engine/input';
import { sfx, voiceLine, announce } from '../engine/audio';
import { CLASS_IDS, CLASS_INFO } from '../game/classes';
import { hasSkinVoice, type VoiceKind } from '../engine/voice';
import { SKINS, type ClassId } from '../art/sprites';
import type { Call } from '../engine/announcer';

const KINDS: VoiceKind[] = ['cast', 'castBig', 'death', 'win', 'grunt', 'hurt', 'hurtBig'];
const KIND_LABEL = ['CAST', 'BIG CAST', 'DEATH', 'WIN', 'GRUNT', 'HURT', 'BIG HURT'];
const ELEMENTS = ['fire', 'frost', 'arcane'];

/** One row of speakers: a class in its own voice, or a mod skin with a voice of its own. */
interface Speaker { cls: ClassId; skin?: string; name: string }
function speakers(): Speaker[] {
  const out: Speaker[] = CLASS_IDS.map(cls => ({ cls, name: CLASS_INFO[cls].name }));
  for (const cls of CLASS_IDS) for (const s of SKINS[cls]) if (hasSkinVoice(cls, s.id)) out.push({ cls, skin: s.id, name: s.name.toUpperCase().slice(0, 13) });
  return out;
}
const CALLS: Call[] = ['round', 'final', 'fight', 'ko', 'perfect', 'wins', 'match'];
const CALL_LABEL = ['ROUND 2', 'FINAL', 'FIGHT', 'K.O.', 'PERFECT', 'WINS', 'MATCH'];

const X0 = 96, COL = 52, Y0 = 70, RH = 24;

export class VoiceTestScene implements Scene {
  row = 0;
  col = 0;
  constructor(private back: () => void = popScene) {}

  private play(): void {
    const who = speakers();
    const sp = who[this.row];
    // a cast picks an element at random: classes with per-element lines (the Mage) say that one, the rest their plain cast
    if (sp) voiceLine(sp.cls, KINDS[this.col], 0, 0, KINDS[this.col] === 'cast' ? ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)] : undefined, sp.skin);
    else announce(CALLS[this.col], { n: 2, who: CLASS_INFO[CLASS_IDS[Math.floor(Math.random() * CLASS_IDS.length)]].name });
  }

  update(dt: number): void {
    const n = speakers().length, rows = n + 1;
    this.row = Math.min(this.row, rows - 1);
    if (navPressed('up', dt)) { this.row = (this.row + rows - 1) % rows; sfx('move'); }
    if (navPressed('down', dt)) { this.row = (this.row + 1) % rows; sfx('move'); }
    const cols = this.row < n ? KINDS.length : CALLS.length;
    if (navPressed('left', dt)) this.col = (this.col + cols - 1) % cols;
    if (navPressed('right', dt)) this.col = (this.col + 1) % cols;
    this.col = Math.min(this.col, cols - 1);
    const h = hot('cell');
    if (h >= 0 && mouse.click) { this.row = Math.floor(h / 10); this.col = h % 10; this.play(); return; }
    if (wasPressed('confirm')) this.play();
    if (wasPressed('back') || mouse.rclick) { sfx('back'); this.back(); }
  }

  draw(c: Ctx, tick: number, ui: Ctx): void {
    drawStage(c, getArena(), tick);
    c.fillStyle = 'rgba(0,0,24,0.75)';
    c.fillRect(...screenRect());
    drawTextCentered(ui, 'VOICE TEST', UW / 2, 30, '#f8b800', 3);
    const who = speakers(), n = who.length;
    const rows = [...who.map(s => s.name), 'ANNOUNCER'];
    rows.forEach((name, r) => {
      const y = Y0 + r * RH + (r >= CLASS_IDS.length ? 6 : 0) + (r === n ? 6 : 0);
      drawText(ui, name, 12, y + 6, r === this.row ? '#fcfcfc' : r >= CLASS_IDS.length && r < n ? '#88d8f8' : '#bcbcbc');
      const labels = r === n ? CALL_LABEL : KIND_LABEL;
      labels.forEach((l, i) => {
        const x = X0 + i * COL, on = r === this.row && i === this.col;
        zone(`cell:${r * 10 + i}`, x - 2, y, COL - 4, RH - 4);
        ui.fillStyle = on ? '#f8b800' : 'rgba(255,255,255,0.08)';
        ui.fillRect(x - 2, y, COL - 4, RH - 4);
        drawTextCentered(ui, l, x + COL / 2 - 4, y + 6, on ? '#000000' : '#fcfcfc', 1, false);
      });
    });
    hint(ui, `CLICK OR ARROWS + ${k('attack')}: PLAY   ${k('cast')}: BACK`);
  }
}
