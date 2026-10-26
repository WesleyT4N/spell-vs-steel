import { W, H, UW, UH, P, view, setView, screenRect, spread, MIN_ASPECT, PORTRAIT_MIN_ASPECT } from './engine/gfx';
import { drawTextCentered } from './engine/font';
import { initInput, endFrame, wasPressed, page } from './engine/input';
import { toggleMute } from './engine/audio';
import { setScene, getScene, commitZones, hotZone, noteTouch, liveZones } from './scenes/scene';
import { TitleScene } from './scenes/title';
import { OnlineScene } from './scenes/online';
import { DEV_TOOLS } from './flags';
import { touchActive, onTouchChange, layout as layoutPad, syncPad, touchText, viewport } from './engine/touch';

// The game screen is the sharp UI resolution. The world draws at 240×160 offscreen and is scaled up 2×
// underneath, so the fight keeps its chunky pixels while menus and text get twice the room.
const canvas = document.getElementById('game') as HTMLCanvasElement;
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

// The screen takes the window's shape (between 4:3 and 21:9) and shows more of the stage instead of
// black bars. The canvas backing store matches the real screen pixels and every blit is
// nearest-neighbour, so the art stays crisp at any zoom.
function fit(): void {
  const [vw, vh] = touchActive() ? viewport() : [window.innerWidth, window.innerHeight];
  const portrait = touchActive() && vh > vw;
  // phones in portrait keep the bottom half for the touch pad; in landscape the pad sits over the margins
  // dev tools can dock a panel on the right and reserve its width
  const bw = vw - Number(document.body.dataset.reserveRight ?? 0);
  const bh = portrait ? vh * 0.5 : vh;
  if (setView(bw / bh, portrait ? PORTRAIT_MIN_ASPECT : MIN_ASPECT)) {
    world.canvas.width = view.w; world.canvas.height = view.h;
    ui.canvas.width = view.w * 2; ui.canvas.height = view.h * 2;
    world.imageSmoothingEnabled = ui.imageSmoothingEnabled = false; // resizing resets context state
  }
  // menus spread into the spare height in portrait, at most 1.5x and clear of the footer strip
  spread.portrait = portrait;
  spread.k = portrait ? Math.max(1, Math.min(1.5, (view.h * 2 - 28) / UH)) : 1;
  const s = Math.max(0.5, Math.min(bw / view.w, bh / view.h));
  document.body.classList.toggle('svs-portrait', portrait);
  const cw = Math.floor(view.w * s), ch = Math.floor(view.h * s);
  canvas.style.width = `${cw}px`;
  canvas.style.height = `${ch}px`;
  const dpr = window.devicePixelRatio || 1;
  const backW = Math.max(1, Math.round(cw * dpr)), backH = Math.max(1, Math.round(ch * dpr));
  if (canvas.width !== backW || canvas.height !== backH) {
    canvas.width = backW;
    canvas.height = backH;
    c.imageSmoothingEnabled = false;
  }
  layoutPad(canvas);
}
window.addEventListener('resize', fit);
window.visualViewport?.addEventListener('resize', fit);
onTouchChange(fit);
fit();

initInput(canvas);
// Inside an embedded frame, keys only arrive after the page gets focus.
let engaged = false;
const engage = (): void => { engaged = page.engaged = true; canvas.focus(); };
window.addEventListener('pointerdown', engage);
window.addEventListener('keydown', () => { engaged = page.engaged = true; });
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
  // scenes draw in W×H / UW×UH coordinates, centered on the screen; margins start black
  world.setTransform(1, 0, 0, 1, 0, 0);
  world.fillStyle = '#000000';
  world.fillRect(0, 0, view.w, view.h);
  ui.setTransform(1, 0, 0, 1, 0, 0);
  ui.clearRect(0, 0, view.w * 2, view.h * 2);
  world.setTransform(1, 0, 0, 1, view.ox, view.oy);
  ui.setTransform(1, 0, 0, 1, view.ox * 2, view.oy * 2);
  getScene()?.draw(world, tick, ui);
  if (!engaged) {
    const [sx, , sw] = screenRect(2);
    P(ui, '#000000', sx, 128, sw, 30);
    drawTextCentered(ui, touchText('CLICK HERE TO START'), UW / 2, 133, tick % 8 < 6 ? '#f8b800' : '#fcfcfc', 1, false);
    drawTextCentered(ui, touchActive() ? 'TAP MENUS, USE THE PAD TO FIGHT' : 'MOUSE FOR MENUS, KEYBOARD TO FIGHT  (M TO MUTE)', UW / 2, 145, '#bcbcbc', 1, false);
  }
  c.drawImage(world.canvas, 0, 0, canvas.width, canvas.height);
  c.drawImage(ui.canvas, 0, 0, canvas.width, canvas.height);
  commitZones();
  syncPad(getScene()?.pad?.() ?? 'back');
  canvas.style.cursor = hotZone() ? 'pointer' : 'default';
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Debug hook for automated playtests.
(window as unknown as { __svs: unknown }).__svs = { getScene, zones: liveZones, view };
