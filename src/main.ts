import { W, H, P } from './engine/gfx';
import { drawTextCentered } from './engine/font';
import { initInput, endFrame, wasPressed } from './engine/input';
import { toggleMute } from './engine/audio';
import { setScene, getScene } from './scenes/scene';
import { TitleScene } from './scenes/title';

const canvas = document.getElementById('game') as HTMLCanvasElement;
canvas.width = W;
canvas.height = H;
const c = canvas.getContext('2d')!;
c.imageSmoothingEnabled = false;

function fit(): void {
  // largest integer scale that fits, so pixels stay square
  const s = Math.max(1, Math.floor(Math.min(window.innerWidth / W, window.innerHeight / H)));
  canvas.style.width = `${W * s}px`;
  canvas.style.height = `${H * s}px`;
}
window.addEventListener('resize', fit);
fit();

initInput();
// Inside an embedded frame, keys only arrive after the page gets focus.
let engaged = false;
const engage = (): void => { engaged = true; canvas.focus(); };
window.addEventListener('pointerdown', engage);
window.addEventListener('keydown', () => { engaged = true; });
setScene(new TitleScene());

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
  getScene()?.draw(c, tick);
  if (!engaged) {
    P(c, '#000000', 0, 60, W, 22);
    drawTextCentered(c, 'CLICK HERE, THEN USE THE KEYBOARD', W / 2, 64, tick % 8 < 6 ? '#f8b800' : '#fcfcfc', 1, false);
    drawTextCentered(c, 'SOUND ON  (M TO MUTE)', W / 2, 73, '#bcbcbc', 1, false);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Debug hook for automated playtests.
(window as unknown as { __svs: unknown }).__svs = { getScene };
