import { W, H } from '../src/engine/gfx';
import { Battle, NO_INTENT } from '../src/game/battle';
import { drawBattle } from '../src/game/battleView';
import { fxLab } from '../src/game/fxView';
import { sfxLab } from '../src/engine/sfxReal';
import { playBattleEvent } from '../src/engine/battleAudio';
import { unlockAudio } from '../src/engine/audio';
import { toList, starterDeck } from '../src/game/deck';

const LOOKS: Array<[string, string]> = [
  ['Current', 'Blue dart with a sparkle tail; pink wobbling beam.'],
  ['Arcane Orb', 'A glowing orb with two circling motes and a comet trail. Heavy: a rune disc at the hand and a twisting double-helix beam that bursts into an orb.'],
  ['Rune Missile', 'A diamond glyph that steps down the row with afterimages, and corner brackets that snap shut on the target. Heavy: a sigil plate and a thick banded beam with runes running down it.'],
  ['Arcane Crescent', 'A moon blade that sheds star glints and lands as a flare. Heavy: a white-hot lance with crackling edges and flares at both ends.'],
];
const SOUNDS: Array<[string, string]> = [
  ['Current', 'Airy whoosh plus high crystal pings. The "glass clinking".'],
  ['Deep Pulse', 'A round, falling low thrum with a soft push of air. Hits land as a low whomp.'],
  ['Void Rift', 'A detuned low drone that closes like a portal. Hits suck in, then thump.'],
  ['Ethereal Breath', 'An airy, voice-like "ooh" carried down the row. Softest of the four.'],
  ['Arcane Charge', 'A low electric buzz with crackle, like lightning in a bottle. Hits zap and thud.'],
];
let look = 1, sound = 1, auto = true, slow = false;
fxLab.mage = look; sfxLab.arcane = sound;

const CROP = { x: 0, y: 72, w: W, h: 90 };
function fresh(withSound: boolean): Battle {
  const b = new Battle({ cls: 'mage', deck: toList(starterDeck('mage')), name: 'A' }, { cls: 'warrior', deck: toList(starterDeck('warrior')), name: 'B' }, 7);
  b.phase = 'fight';
  b.sink = withSound ? playBattleEvent : null;
  return b;
}
// light, light, light, heavy, rest
const SCRIPT: Array<[number, 'light' | 'heavy']> = [[0.3, 'light'], [0.9, 'light'], [1.5, 'light'], [2.3, 'heavy']];
const LOOP = 3.4;
interface View { b: Battle; cv: HTMLCanvasElement; look: () => number; t: number; sound: boolean }
const off = document.createElement('canvas'); off.width = W; off.height = H;
const oc = off.getContext('2d')!; oc.imageSmoothingEnabled = false;
const main = document.getElementById('main') as HTMLCanvasElement;
main.width = CROP.w * 3; main.height = CROP.h * 3;
const views: View[] = [{ b: fresh(true), cv: main, look: () => look, t: 0, sound: true }];

function fire(v: View, kind: 'light' | 'heavy'): void {
  const f = v.b.f[0], foe = v.b.f[1];
  f.lock = 0; foe.hp = foe.maxHp; foe.row = f.row;
  fxLab.mage = v.look(); v.b.basicAttack(f, kind);
}

function pickRow(id: string, items: Array<[string, string]>, get: () => number, set: (i: number) => void): void {
  const root = document.getElementById(id)!;
  const btns = items.map(([name, desc], i) => {
    const bt = document.createElement('button'); bt.className = 'pick'; bt.id = `${id}-${i}`;
    bt.innerHTML = `<b>${i ? i + '. ' : ''}${name}</b><span>${desc}</span>`;
    bt.onclick = () => { unlockAudio(); set(i); sync(); if (!auto) fire(views[0], 'light'); };
    root.appendChild(bt); return bt;
  });
  const sync = (): void => btns.forEach((b, i) => b.setAttribute('aria-pressed', String(i === get())));
  sync();
}
pickRow('looks', LOOKS, () => look, i => { look = i; });
pickRow('sounds', SOUNDS, () => sound, i => { sound = i; sfxLab.arcane = i; });

const thumbs = document.getElementById('thumbs')!;
LOOKS.forEach(([name], i) => {
  const wrap = document.createElement('div'); wrap.className = 'thumb';
  wrap.innerHTML = `<label>${i ? i + '. ' : ''}${name}</label>`;
  const st = document.createElement('div'); st.className = 'stage';
  const cv = document.createElement('canvas'); cv.width = CROP.w * 2; cv.height = CROP.h * 2; st.appendChild(cv); wrap.appendChild(st); thumbs.appendChild(wrap);
  views.push({ b: fresh(false), cv, look: () => i, t: 0, sound: false });
});

const autoBtn = document.getElementById('auto')!, slowBtn = document.getElementById('slow')!;
autoBtn.onclick = () => { unlockAudio(); auto = !auto; autoBtn.setAttribute('aria-pressed', String(auto)); autoBtn.textContent = auto ? 'AUTOPLAY ON' : 'AUTOPLAY OFF'; };
slowBtn.onclick = () => { slow = !slow; slowBtn.setAttribute('aria-pressed', String(slow)); slowBtn.textContent = slow ? 'SLOW-MO ON' : 'SLOW-MO OFF'; };
document.getElementById('light')!.onclick = () => { unlockAudio(); fire(views[0], 'light'); };
document.getElementById('heavy')!.onclick = () => { unlockAudio(); fire(views[0], 'heavy'); };
addEventListener('pointerdown', () => unlockAudio(), { once: true });

let last = performance.now(), acc = 0;
function frame(now: number): void {
  acc += Math.min(0.1, (now - last) / 1000) * (slow ? 0.25 : 1); last = now;
  const dt = 1 / 60;
  while (acc >= dt) {
    acc -= dt;
    for (const v of views) {
      const t0 = v.t; v.t = (v.t + dt) % LOOP;
      if (auto || !v.sound) for (const [at, kind] of SCRIPT) if (at > t0 && at <= t0 + dt) fire(v, kind);
      fxLab.mage = v.look();
      v.b.update(dt, [NO_INTENT, NO_INTENT]);
    }
  }
  for (const v of views) {
    fxLab.mage = v.look();
    oc.clearRect(0, 0, W, H); drawBattle(oc, v.b, Math.floor(v.b.time * 30));
    const c = v.cv.getContext('2d')!; c.imageSmoothingEnabled = false;
    c.drawImage(off, CROP.x, CROP.y, CROP.w, CROP.h, 0, 0, v.cv.width, v.cv.height);
  }
  fxLab.mage = look;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
