// Screen fuzzer: random keys, clicks and taps on every screen of a real browser build, hunting for
// thrown errors, frozen frame loops and soft locks (screens you can't back out of).
// Needs Playwright with Chromium. Build first without minifying so screens keep their names:
//   npx vite build --minify false --outDir dist-fuzz && node scripts/uifuzz.mjs [sessions] [secondsEach] [seed]
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Playwright may be installed globally rather than in this repo
const { chromium } = createRequire(import.meta.url)('playwright');

const SESSIONS = Number(process.argv[2] ?? 8);
const SECONDS = Number(process.argv[3] ?? 60);
const SEED = Number(process.argv[4] ?? 1);
const URL = 'file://' + resolve('dist-fuzz/index.html');
const OUT = resolve('fuzz-out');
mkdirSync(OUT, { recursive: true });

let s = SEED >>> 0;
const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = a => a[Math.floor(rnd() * a.length)];

const VIEWPORTS = [
  { name: 'desktop', width: 960, height: 640, touch: false },
  { name: 'ultrawide', width: 1400, height: 600, touch: false },
  { name: 'square', width: 800, height: 700, touch: false },
  { name: 'phone-portrait', width: 390, height: 844, touch: true },
  { name: 'phone-landscape', width: 844, height: 390, touch: true },
];
const KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyJ', 'KeyJ', 'KeyK', 'Space', 'Enter', 'Escape', 'Backspace', 'KeyQ', 'KeyE', 'KeyR', 'KeyJ', 'Enter'];
// menus wrap, so Up from the top lands on the last row (usually QUIT)
const BACK = ['Escape', 'Backspace', 'KeyK', 'Escape', 'ArrowUp', 'ArrowUp', 'ArrowDown', 'Enter', 'KeyJ'];
// online screens need a live peer server; the fuzzer backs straight out of them
const SKIP = new Set(['OnlineScene', 'OnlineBattleScene']);

const problems = [];
const visited = new Map();
function report(sess, what, extra = '') {
  const key = what.replace(/\d+/g, '#');
  if (problems.some(p => p.key === key)) return;
  problems.push({ key, sess, what, extra });
  console.log(`  [session ${sess}] ${what}${extra ? `\n      ${extra}` : ''}`);
}

const browser = await chromium.launch();
for (let sess = 0; sess < SESSIONS; sess++) {
  const vp = VIEWPORTS[sess % VIEWPORTS.length];
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, isMobile: vp.touch });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}\n      ${(e.stack ?? '').split('\n').slice(1, 4).join(' | ')}`));
  page.on('console', m => { if (m.type() === 'error' && !/peer|websocket|net::|Failed to load/i.test(m.text())) errors.push(`console.error: ${m.text()}`); });
  await page.addInitScript(() => {
    window.__frames = 0;
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = cb => raf(t => { window.__frames++; cb(t); });
  });
  await page.goto(URL);
  await page.waitForTimeout(300);
  const box = await page.locator('#game').boundingBox();
  if (vp.touch) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); else await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  const scene = () => page.evaluate(() => window.__svs.getScene()?.constructor?.name ?? 'none');
  const frames = () => page.evaluate(() => window.__frames);
  const zones = () => page.evaluate(() => {
    const c = document.getElementById('game').getBoundingClientRect(), v = window.__svs.view;
    const k = c.width / (v.w * 2);
    return window.__svs.zones().map(z => ({ id: z.id, x: c.left + (z.x + v.ox * 2 + z.w / 2) * k, y: c.top + (z.y + v.oy * 2 + z.h / 2) * k }));
  });
  const tap = async (x, y) => { if (vp.touch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y); };

  /** Try to get back to the title with only back/pause/menu keys. False means a soft lock. */
  async function escapeProbe() {
    for (let i = 0; i < 400; i++) {
      if ((await scene()) === 'TitleScene') return true;
      const k = pick(BACK);
      await page.keyboard.press(k);
      await page.waitForTimeout(40);
      // results screens and the like often want a confirm or a click on a zone
      if (i % 25 === 24) { const z = await zones(); if (z.length) { const t = pick(z); await tap(t.x, t.y); } }
    }
    return (await scene()) === 'TitleScene';
  }

  const t0 = Date.now();
  let lastProbe = Date.now(), lastScene = '', sceneSince = Date.now();
  console.log(`session ${sess} (${vp.name})`);
  while (Date.now() - t0 < SECONDS * 1000) {
    const name = await scene();
    visited.set(name, (visited.get(name) ?? 0) + 1);
    if (name !== lastScene) { lastScene = name; sceneSince = Date.now(); }
    if (SKIP.has(name)) { await page.keyboard.press('Escape'); await page.waitForTimeout(100); continue; }
    const roll = rnd();
    if (roll < 0.45) {
      const k = pick(KEYS);
      if (rnd() < 0.15) { await page.keyboard.down(k); await page.waitForTimeout(100 + rnd() * 700); await page.keyboard.up(k); }
      else await page.keyboard.press(k);
    } else if (roll < 0.85) {
      const z = (await zones()).filter(z => !/online/i.test(z.id));
      if (z.length) { const t = pick(z); await tap(t.x, t.y); }
    } else if (roll < 0.95) {
      await tap(box.x + rnd() * box.width, box.y + rnd() * box.height);
    } else {
      // drag (deck-builder scrolling, sliders)
      const x = box.x + rnd() * box.width, y = box.y + rnd() * box.height;
      await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + (rnd() - 0.5) * 200, y + (rnd() - 0.5) * 200, { steps: 5 }); await page.mouse.up();
    }
    await page.waitForTimeout(20 + rnd() * 60);

    for (const e of errors.splice(0)) report(sess, e.split('\n')[0], e.split('\n').slice(1).join(' ') + ` (on ${name})`);
    if (Date.now() - lastProbe > 20000 || Date.now() - sceneSince > 30000) {
      lastProbe = Date.now();
      const f0 = await frames();
      await page.waitForTimeout(500);
      if ((await frames()) === f0) { report(sess, `frame loop stopped on ${name}`); break; }
      const from = await scene();
      if (!(await escapeProbe())) {
        const at = await scene();
        await page.screenshot({ path: `${OUT}/softlock-${sess}-${at}.png` });
        report(sess, `soft lock: could not back out of ${at} (started from ${from})`);
        break;
      }
      sceneSince = Date.now();
    }
  }
  await ctx.close();
}
await browser.close();
console.log('\nscreens visited (samples):', [...visited.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));
console.log(problems.length ? `${problems.length} problem(s)` : 'no problems found');
writeFileSync(`${OUT}/uifuzz.json`, JSON.stringify({ problems, visited: Object.fromEntries(visited) }, null, 2));
process.exit(problems.length ? 1 : 0);
