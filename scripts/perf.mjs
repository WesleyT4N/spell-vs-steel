// Frame-time profiler on phone-sized, CPU-throttled builds. Runs a CPU vs CPU match on every stage and
// reports how long each frame's update + draw takes (the main-thread budget is 16.7ms at 60fps).
// Build the dev build first (it has the #bench hash):  npm run build && node scripts/perf.mjs [throttle] [seconds] [--profile]
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';

const { chromium } = createRequire(import.meta.url)('playwright');
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const THROTTLE = Number(args[0] ?? 6);
const SECONDS = Number(args[1] ?? 8);
const PROFILE = process.argv.includes('--profile');
const ONLY = process.argv.find(a => a.startsWith('--stage='))?.slice(8);
const URL = 'file://' + resolve(process.env.PERF_BUILD ?? 'dist/index.html');
const STAGES = (ONLY ? [ONLY] : ['colosseum', 'courtyard', 'archive', 'frostpeak', 'emberforge', 'elderwood']);
const VIEWPORTS = [
  { name: 'portrait', width: 390, height: 844, dpr: 3 },
  { name: 'landscape', width: 844, height: 390, dpr: 3 },
];
const MATCHUPS = ['mage,priest', 'ranger,warrior'];

const pct = (a, p) => a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))];
const browser = await chromium.launch();
const rows = [];
mkdirSync('fuzz-out', { recursive: true });
for (const vp of VIEWPORTS) for (const stage of STAGES) for (const mu of MATCHUPS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dpr, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__ft = [];
    // canvas calls per frame: each one is a trip through the browser's command buffer, the cost that
    // dominates 2D canvas on phones with GPU raster
    window.__calls = 0;
    const P2 = CanvasRenderingContext2D.prototype;
    for (const k of ['fillRect', 'drawImage', 'clearRect', 'fill', 'stroke', 'putImageData', 'fillText', 'getImageData']) {
      const f = P2[k];
      P2[k] = function (...a) { window.__calls++; return f.apply(this, a); };
    }
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = cb => raf(t => { const s = performance.now(); cb(t); window.__ft.push(performance.now() - s); });
  });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  await page.goto(`${URL}#bench=${stage},${mu}`);
  const box = await page.locator('#game').boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + 10);
  await page.waitForTimeout(1500);
  await page.evaluate(() => { window.__ft = []; window.__calls = 0; });
  await cdp.send('Performance.enable');
  const metric = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
  if (PROFILE) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.start'); }
  const m0 = await metric();
  await page.waitForTimeout(SECONDS * 1000);
  const m1 = await metric();
  const [ft, calls] = await page.evaluate(() => [window.__ft, window.__calls]);
  // all main-thread work (script, canvas raster, style, GC), per frame; the throttle scales this the same way
  const busy = (m1.TaskDuration - m0.TaskDuration) * 1000 / ft.length;
  if (PROFILE) {
    const { profile } = await cdp.send('Profiler.stop');
    writeFileSync(`fuzz-out/${vp.name}-${stage}-${mu.replace(',', '-')}.cpuprofile`, JSON.stringify(profile));
  }
  const mean = ft.reduce((a, b) => a + b, 0) / ft.length;
  const row = { vp: vp.name, stage, mu, frames: ft.length, fps: ft.length / SECONDS, busy, calls: calls / ft.length, mean, p50: pct(ft, 0.5), p95: pct(ft, 0.95), max: Math.max(...ft), over: ft.filter(x => x > 16.7).length / ft.length };
  rows.push(row);
  console.log(`${vp.name.padEnd(9)} ${stage.padEnd(10)} ${mu.padEnd(14)} fps ${row.fps.toFixed(1).padStart(5)}  canvas calls/frame ${Math.round(row.calls).toString().padStart(6)}  main thread/frame ${busy.toFixed(2).padStart(6)}ms  rAF ms mean ${mean.toFixed(2).padStart(6)} p50 ${row.p50.toFixed(2).padStart(6)} p95 ${row.p95.toFixed(2).padStart(6)} max ${row.max.toFixed(1).padStart(6)}  >16.7ms ${(row.over * 100).toFixed(0)}%`);
  await ctx.close();
}
await browser.close();
const avg = k => rows.reduce((a, r) => a + r[k], 0) / rows.length;
console.log(`\naverage at ${THROTTLE}x CPU throttle: ${avg('fps').toFixed(1)} fps, ${Math.round(avg('calls'))} canvas calls per frame, main thread ${avg('busy').toFixed(2)}ms per frame (rAF callback ${avg('mean').toFixed(2)}ms)`);
writeFileSync(`fuzz-out/perf-${THROTTLE}x.json`, JSON.stringify(rows, null, 2));
