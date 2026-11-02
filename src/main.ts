import './assetUrls';
import { W, H, UW, UH, HD, P, view, setView, screenRect, MIN_ASPECT } from './engine/gfx';
import { drawTextCentered } from './engine/font';
import { initInput, endFrame, wasPressed, page, pollInput, releaseAll } from './engine/input';
import { toggleMute, setAudioSuspended } from './engine/audio';
import { platform } from './platform';
import { setScene, setHome, goHome, getScene, commitZones, hotZone, noteTouch, liveZones } from './scenes/scene';
import { TitleScene } from './scenes/title';
import { OnlineScene } from './scenes/online';
import { DEV_TOOLS } from './flags';
import { modsReady } from './mods/boot';
import { endTextFields } from './engine/textField';
import { setDefaultSink } from './game/events';
import { playBattleEvent } from './engine/battleAudio';
import { loadImages } from './engine/assets';
import { touchActive, onTouchChange, layout as layoutPad, syncPad, touchText, viewport } from './engine/touch';
import { showRotate, tryLockLandscape } from './engine/rotate';

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
const world = offscreen(W * HD, H * HD);
const ui = offscreen(UW * HD, UH * HD);

// The screen takes the window's shape (between 4:3 and 21:9) and shows more of the stage instead of
// black bars. The canvas backing store matches the real screen pixels and every blit is
// nearest-neighbour, so the art stays crisp at any zoom.
function fit(): void {
  const [vw, vh] = touchActive() ? viewport() : [window.innerWidth, window.innerHeight];
  // phones play in landscape only: held upright, the game waits under a turn-your-phone card
  if (showRotate(touchActive() && vh > vw)) { releaseAll(); getScene()?.suspend?.(); }
  // dev tools can dock a panel on the right and reserve its width
  const bw = vw - Number(document.body.dataset.reserveRight ?? 0);
  const bh = vh;
  if (setView(bw / bh, MIN_ASPECT)) {
    world.canvas.width = view.w * HD; world.canvas.height = view.h * HD;
    ui.canvas.width = view.w * 2 * HD; ui.canvas.height = view.h * 2 * HD;
    world.imageSmoothingEnabled = ui.imageSmoothingEnabled = false; // resizing resets context state
  }
  const s = Math.max(0.5, Math.min(bw / view.w, bh / view.h));
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
// battles speak through events; the game plays them
setDefaultSink(playBattleEvent);
// Inside an embedded frame, keys only arrive after the page gets focus.
// (a gamepad press engages too: pads read without focus)
const engage = (): void => { page.engaged = true; canvas.focus(); if (touchActive()) tryLockLandscape(); };
window.addEventListener('pointerdown', engage);
window.addEventListener('keydown', () => { page.engaged = true; });
// in the background: let go of held keys, hush the audio and let the screen pause itself (single-player fights do)
platform.lifecycle.onHide(() => { releaseAll(); setAudioSuspended(true); getScene()?.suspend?.(); });
platform.lifecycle.onShow(() => setAudioSuspended(false));

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
    pollInput();
    if (wasPressed('mute')) toggleMute();
    noteTouch();
    getScene()?.update(STEP);
    endFrame();
    tickAcc += STEP;
    if (tickAcc >= 1 / 8) { tickAcc -= 1 / 8; tick++; }
  }
  // scenes draw in W×H / UW×UH coordinates, centered on the screen; margins start black
  world.setTransform(HD, 0, 0, HD, 0, 0);
  world.fillStyle = '#000000';
  world.fillRect(0, 0, view.w, view.h);
  ui.setTransform(HD, 0, 0, HD, 0, 0);
  ui.clearRect(0, 0, view.w * 2, view.h * 2);
  world.setTransform(HD, 0, 0, HD, view.ox * HD, view.oy * HD);
  ui.setTransform(HD, 0, 0, HD, view.ox * 2 * HD, view.oy * 2 * HD);
  const scene = getScene();
  scene?.draw(world, tick, ui);
  if (!page.engaged) {
    const [sx, , sw] = screenRect(2);
    P(ui, '#000000', sx, 128, sw, 30);
    drawTextCentered(ui, touchText('CLICK HERE TO START'), UW / 2, 133, tick % 8 < 6 ? '#f8b800' : '#fcfcfc', 1, false);
    drawTextCentered(ui, touchActive() ? 'TAP MENUS, USE THE PAD TO FIGHT' : 'MOUSE FOR MENUS, KEYBOARD TO FIGHT  (M TO MUTE)', UW / 2, 145, '#bcbcbc', 1, false);
  }
  c.drawImage(world.canvas, 0, 0, canvas.width, canvas.height);
  c.drawImage(ui.canvas, 0, 0, canvas.width, canvas.height);
  commitZones();
  syncPad(getScene()?.pad?.() ?? 'back');
  endTextFields();
  canvas.style.cursor = hotZone() ? 'pointer' : 'default';
  requestAnimationFrame(frame);
}
// The game starts once every image asset has decoded (see engine/assets.ts) and the mods are in, so no screen ever
// draws without its art or misses a mod skin.
/** Resolves when the first screen is up (the screen tests wait on it). */
export const ready: Promise<void> = Promise.all([loadImages(), modsReady]).then(() => {
  // a shared online link (?room=CODE) goes straight to joining that room
  const room = new URLSearchParams(location.search).get('room');
  // the title is always the bottom of the scene stack: BACK from the first screen lands there
  setHome(() => new TitleScene());
  if (room) setScene(new OnlineScene(room)); else goHome();
  // dev builds can open a dev tool straight from the URL (#cards, #sandbox, #lab, #art, #dev)
  if (DEV_TOOLS && !room && location.hash.length > 1) void import('./scenes/devMenu').then(m => m.devFromHash());
  requestAnimationFrame(frame);
});

// Debug hook for automated playtests.
(window as unknown as { __svs: unknown }).__svs = { getScene, zones: liveZones, view };
