// Dev tool: play every music track, from the top or from just before its loop point to check the seam.
import { popScene, drawMenu, hint, listMouse, button, isHot, type Scene } from './scene';
import { getArena } from '../game/battleView';
import { drawStage } from '../art/arena';
import { UW, screenRect, spread, type Ctx } from '../engine/gfx';
import { drawTextCentered } from '../engine/font';
import { wasPressed, navPressed, k, mouse } from '../engine/input';
import { sfx, playMusic, stopMusic } from '../engine/audio';
import { TRACKS, type TrackId } from '../engine/musicTracks';

const LIST: [TrackId, string][] = [
  ['menu', 'TITLE THEME'],
  ['stage_colosseum', 'COLOSSEUM'],
  ['stage_courtyard', 'CASTLE COURTYARD'],
  ['stage_archive', 'ARCANE ARCHIVE'],
  ['stage_frostpeak', 'FROSTPEAK PASS'],
  ['stage_emberforge', 'EMBERFORGE'],
  ['stage_elderwood', 'ELDERWOOD RUINS'],
  ['victory', 'VICTORY'],
];
const sec = (s: number): string => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export class MusicTestScene implements Scene {
  sel = 0;
  playing = -1;
  constructor(private back: () => void = popScene) {}

  private play(seam: boolean): void {
    const [id] = LIST[this.sel];
    const t = TRACKS[id];
    playMusic(id, seam && t.loopEnd > t.loopStart ? t.loopEnd - 5 : 0);
    this.playing = this.sel;
  }

  update(dt: number): void {
    const n = LIST.length;
    if (navPressed('up', dt)) { this.sel = (this.sel + n - 1) % n; sfx('move'); }
    if (navPressed('down', dt)) { this.sel = (this.sel + 1) % n; sfx('move'); }
    const clicked = listMouse('menu', this.sel, i => { this.sel = i; sfx('move'); });
    if (clicked >= 0) this.sel = clicked;
    if (wasPressed('confirm') || clicked >= 0) { this.play(false); return; }
    if (wasPressed('custom') || (isHot('seam') && mouse.click)) { this.play(true); return; }
    if (wasPressed('back') || mouse.rclick) { sfx('back'); stopMusic(); playMusic('menu'); this.back(); }
  }

  draw(c: Ctx, tick: number, ui: Ctx): void {
    drawStage(c, getArena(), tick);
    c.fillStyle = 'rgba(0,0,24,0.75)';
    c.fillRect(...screenRect());
    drawTextCentered(ui, 'MUSIC TEST', UW / 2, 30, '#f8b800', 3);
    drawMenu(ui, LIST.map(([, name], i) => (i === this.playing ? '♪ ' : '') + name), this.sel, UW / 2, 70, tick, { width: 220, gap: 20 });
    const [id] = LIST[this.sel];
    const t = TRACKS[id];
    const y = 70 + LIST.length * Math.round(20 * spread.k) + 12;
    drawTextCentered(ui, t.loopEnd > t.loopStart ? `LOOPS ${sec(t.loopStart)} TO ${sec(t.loopEnd)}` : 'PLAYS ONCE', UW / 2, y, '#bcbcbc');
    button(ui, 'seam', 'HEAR THE LOOP POINT', UW / 2 - 80, y + 14, 160, 22, false);
    hint(ui, `${k('attack')}: PLAY   ${k('custom')}: HEAR THE LOOP POINT   ${k('cast')}: BACK`);
  }
}
