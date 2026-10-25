import { W, H, UW, UH, P } from './engine/gfx';
import { drawTextCentered } from './engine/font';
import { initInput, endFrame, wasPressed } from './engine/input';
import { toggleMute } from './engine/audio';
import { setScene, getScene, commitZones, hotZone, noteTouch } from './scenes/scene';
import { TitleScene } from './scenes/title';
import { OnlineScene } from './scenes/online';
import { DEV_TOOLS } from './flags';
import { touchActive, onTouchChange, layout as layoutPad, padSide, syncPad, touchText, viewport } from './engine/touch';

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
  const [vw, vh] = touchActive() ? viewport() : [window.innerWidth, window.innerHeight];
  let s: number;
  const portrait = touchActive() && vh > vw;
  if (touchActive()) {
    // phones: fill the screen at any scale, leaving room for the touch pad
    // (underneath in portrait, a little on each side in landscape)
    s = portrait
      ? Math.min(vw / UW, (vh * 0.62) / UH)
      : Math.max(Math.min(vw / UW, vh / UH) * 0.8, Math.min(vh / UH, (vw - 2 * padSide(vh)) / UW));
  } else {
    // half steps of the screen are whole steps of the world, so the fight's pixels stay square
    // dev tools can dock a panel on the right and reserve its width
    const room = vw - Number(document.body.dataset.reserveRight ?? 0);
    s = Math.max(0.5, Math.floor(Math.min(room / UW, vh / UH) * 2) / 2);
  }
  document.body.classList.toggle('svs-portrait', portrait);
  canvas.style.width = `${UW * s}px`;
  canvas.style.height = `${UH * s}px`;
  layoutPad(canvas);
}
window.addEventListener('resize', fit);
window.visualViewport?.addEventListener('resize', fit);
onTouchChange(fit);
fit();

initInput(canvas);
// Inside an embedded frame, keys only arrive after the page gets focus.
let engaged = false;
const engage = (): void => { engaged = true; canvas.focus(); };
window.addEventListener('pointerdown', engage);
window.addEventListener('keydown', () => { engaged = true; });
// a shared online link (?room=CODE) goes straight to joining that room
const room = new URLSearchParams(location.search).get('room');
setScene(room ? new OnlineScene(room) : new TitleScene());
// dev builds can open a dev tool straight from the URL (#cards, #sandbox, #lab, #dev)
if (DEV_TOOLS && !room && location.hash.length > 1) void import('./scenes/devMenu').then(m => m.devFromHash(() => setScene(new TitleScene())));

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
    noteTouch();
    getScene()?.update(STEP);
    endFrame();
    tickAcc += STEP;
    if (tickAcc >= 1 / 8) { tickAcc -= 1 / 8; tick++; }
  }
  ui.clearRect(0, 0, UW, UH);
  getScene()?.draw(world, tick, ui);
  if (!engaged) {
    P(ui, '#000000', 0, 128, UW, 30);
    drawTextCentered(ui, touchText('CLICK HERE TO START'), UW / 2, 133, tick % 8 < 6 ? '#f8b800' : '#fcfcfc', 1, false);
    drawTextCentered(ui, touchActive() ? 'TAP MENUS, USE THE PAD TO FIGHT' : 'MOUSE FOR MENUS, KEYBOARD TO FIGHT  (M TO MUTE)', UW / 2, 145, '#bcbcbc', 1, false);
  }
  c.drawImage(world.canvas, 0, 0, UW, UH);
  c.drawImage(ui.canvas, 0, 0);
  commitZones();
  syncPad(getScene()?.pad?.() ?? 'back');
  canvas.style.cursor = hotZone() ? 'pointer' : 'default';
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Debug hook for automated playtests.
(window as unknown as { __svs: unknown }).__svs = { getScene };
