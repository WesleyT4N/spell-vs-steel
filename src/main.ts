import { W, H, UW, UH, P } from './engine/gfx';
import { drawTextCentered } from './engine/font';
import { initInput, endFrame, wasPressed } from './engine/input';
import { toggleMute } from './engine/audio';
import { setScene, getScene, commitZones, hotZone } from './scenes/scene';
import { TitleScene } from './scenes/title';
import { devFromHash } from './scenes/devMenu';

// The screen is the sharp UI resolution. The world draws at 240×160 offscreen and is scaled up 2×
// underneath, so the fight keeps its chunky pixels while menus and text get twice the room.
const canvas = document.getElementById('game') as HTMLCanvasElement;
canvas.width = UW;
canvas.height = UH;
const c = canvas.getContext('2d')!;
c.imageSmoothingEnabled = false;

const offscreen = (w: number, h: number): CanvasRenderingContext2D => {
  const o = document.createElement('canvas');
  o.width = w; o.height = h;
  const x = o.getContext('2d')!;
  x.imageSmoothingEnabled = false;
  return x;
};
const world = offscreen(W, H);
const ui = offscreen(UW, UH);

function fit(): void {
  // half steps of the screen are whole steps of the world, so the fight's pixels stay square
  // dev tools can dock a panel on the right and reserve its width
  const room = window.innerWidth - Number(document.body.dataset.reserveRight ?? 0);
  const s = Math.max(0.5, Math.floor(Math.min(room / UW, window.innerHeight / UH) * 2) / 2);
  canvas.style.width = `${UW * s}px`;
  canvas.style.height = `${UH * s}px`;
}
window.addEventListener('resize', fit);
fit();

initInput(canvas);
// Inside an embedded frame, keys only arrive after the page gets focus.
let engaged = false;
const engage = (): void => { engaged = true; canvas.focus(); };
window.addEventListener('pointerdown', engage);
window.addEventListener('keydown', () => { engaged = true; });
if (!devFromHash(() => setScene(new TitleScene()))) setScene(new TitleScene());

const STEP = 1 / 60;
let acc = 0;
let last = performance.now();
let tick = 0;
let tickAcc = 0;

function frame(now: number): void {
  acc += Math.min(0.1, (now - last) / 1000);
  last = now;
  while (acc >= STEP) {
    acc -= STEP;
    if (wasPressed('mute')) toggleMute();
    getScene()?.update(STEP);
    endFrame();
    tickAcc += STEP;
    if (tickAcc >= 1 / 8) { tickAcc -= 1 / 8; tick++; }
  }
  ui.clearRect(0, 0, UW, UH);
  getScene()?.draw(world, tick, ui);
  if (!engaged) {
    P(ui, '#000000', 0, 128, UW, 30);
    drawTextCentered(ui, 'CLICK HERE TO START', UW / 2, 133, tick % 8 < 6 ? '#f8b800' : '#fcfcfc', 1, false);
    drawTextCentered(ui, 'MOUSE FOR MENUS, KEYBOARD TO FIGHT  (M TO MUTE)', UW / 2, 145, '#bcbcbc', 1, false);
  }
  c.drawImage(world.canvas, 0, 0, UW, UH);
  c.drawImage(ui.canvas, 0, 0);
  commitZones();
  canvas.style.cursor = hotZone() ? 'pointer' : 'default';
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Debug hook for automated playtests.
(window as unknown as { __svs: unknown }).__svs = { getScene };
