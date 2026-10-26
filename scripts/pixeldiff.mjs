// Golden-frame check for rendering optimizations: plays two builds on a fake clock with a seeded
// Math.random, steps them frame by frame through the same scenes and compares every pixel on screen.
// Usage: node scripts/pixeldiff.mjs <baseline index.html> <candidate index.html> [frames]
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';

const { chromium } = createRequire(import.meta.url)('playwright');
const [A, B] = process.argv.slice(2, 4).map(p => 'file://' + resolve(p));
const FRAMES = Number(process.argv[4] ?? 600);
const STAGES = ['colosseum', 'courtyard', 'archive', 'frostpeak', 'emberforge', 'elderwood'];
const SCENES = [
  { name: 'title', hash: '' },
  ...STAGES.map(s => ({ name: `battle-${s}`, hash: `#bench=${s},mage,priest` })),
  { name: 'battle-ranger-warrior', hash: '#bench=frostpeak,ranger,warrior' },
  { name: 'battle-rogue-warrior', hash: '#bench=colosseum,rogue,warrior' },
];
const VIEWPORTS = [
  { name: 'portrait', width: 390, height: 844, dpr: 2, touch: true },
  { name: 'wide', width: 1280, height: 560, dpr: 1, touch: false },
  { name: 'landscape', width: 844, height: 390, dpr: 3, touch: true },
  { name: 'laptop', width: 1366, height: 768, dpr: 1.5, touch: false },
];

const fakeClock = () => {
  let s = 12345;
  Math.random = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let now = 0, cb = null;
  performance.now = () => now;
  Date.now = () => 1700000000000 + now;
  window.requestAnimationFrame = f => { cb = f; return 1; };
  window.__step = n => { for (let i = 0; i < n; i++) { now += 1000 / 60; const f = cb; cb = null; f?.(now); } };
};

const browser = await chromium.launch();
async function frames(url, vp, hash) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dpr, hasTouch: vp.touch, isMobile: vp.touch });
  const page = await ctx.newPage();
  await page.addInitScript(fakeClock);
  await page.goto(url + hash);
  const shots = [];
  for (let f = 0; f < FRAMES; f += 30) {
    await page.evaluate(() => window.__step(30));
    shots.push(await page.evaluate(() => {
      const c = document.getElementById('game');
      const x = document.createElement('canvas'); x.width = c.width; x.height = c.height;
      const g = x.getContext('2d'); g.drawImage(c, 0, 0);
      const d = g.getImageData(0, 0, x.width, x.height).data;
      let h = 0x811c9dc5; for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 0x01000193); }
      return { h: h >>> 0, png: x.toDataURL() };
    }));
  }
  await ctx.close();
  return shots;
}

let bad = 0;
for (const vp of VIEWPORTS) for (const sc of SCENES) {
  const [a, b] = [await frames(A, vp, sc.hash), await frames(B, vp, sc.hash)];
  const at = a.findIndex((s, i) => s.h !== b[i].h);
  if (at >= 0) {
    bad++;
    // keep both frames so the difference can be looked at
    mkdirSync('fuzz-out', { recursive: true });
    for (const [tag, shots] of [['a', a], ['b', b]]) writeFileSync(`fuzz-out/diff-${vp.name}-${sc.name}-${tag}.png`, Buffer.from(shots[at].png.split(',')[1], 'base64'));
  }
  console.log(`${vp.name.padEnd(9)} ${sc.name.padEnd(22)} ${at < 0 ? `identical (${a.length} frames checked)` : `DIFFERS from frame ${at * 30 + 30}`}`);
}
await browser.close();
console.log(bad ? `${bad} scene(s) differ` : 'all frames pixel-identical');
process.exit(bad ? 1 : 0);
