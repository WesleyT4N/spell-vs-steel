// Records the README's clips and stills (tools/readme/clips.ts) into docs/media/.
// Usage: npm run readme:media [-- --only hero,draw]
// Each clip runs on a frozen clock: the runner steps it one frame at a time, grabs the canvas, and ffmpeg packs the
// frames into a GIF with one shared palette. Stills are saved as PNG. Needs ffmpeg on the PATH.
import { chromium } from 'playwright';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
const harness = resolve('dist-readme/tools/readme/clips.html');
const out = resolve('docs/media');
if (!existsSync(harness)) { console.error(`missing ${harness}: run npx vite build --config tools/readme/vite.config.ts`); process.exit(2); }

// the game's own resolution (UW x UH), so every game pixel lands on one GIF pixel
const W = 480, H = 320;

const seedRandom = (): void => {
  Object.assign(window, { AudioContext: undefined, webkitAudioContext: undefined });
  let s = 0x5eed;
  Math.random = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

interface Info { secs: number; fps: number; keys: [number, string][]; still: boolean }
type Api = { names: string[]; info(n: string): Info; show(n: string): void };

async function main(): Promise<void> {
  const browser = await chromium.launch();
  const probe = await browser.newPage();
  await probe.goto(pathToFileURL(harness).href);
  await probe.waitForFunction(() => 'names' in ((window as unknown as { __clips?: object }).__clips ?? {}));
  const names = (await probe.evaluate(() => (window as unknown as { __clips: Api }).__clips.names)).filter(n => !only || only.includes(n));
  await probe.close();
  mkdirSync(out, { recursive: true });
  for (const name of names) {
    const ctx = await browser.newContext({ viewport: { width: W, height: H } });
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log(`  ${name}: page error ${e.message}`));
    await page.addInitScript(seedRandom);
    await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
    await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
    await page.goto(pathToFileURL(harness).href);
    await page.waitForFunction(() => 'names' in ((window as unknown as { __clips?: object }).__clips ?? {}));
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'F24', key: 'F24' })));
    const info = await page.evaluate(n => (window as unknown as { __clips: Api }).__clips.info(n), name);
    await page.evaluate(n => (window as unknown as { __clips: Api }).__clips.show(n), name);
    await page.clock.runFor(100);
    const canvas = page.locator('#game');
    if (info.still) {
      await canvas.screenshot({ path: join(out, `${name}.png`) });
      console.log(`${name}.png`);
      await ctx.close();
      continue;
    }
    const dir = join(tmpdir(), `svs-clip-${name}`);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const n = Math.round(info.secs * info.fps), step = 1000 / info.fps;
    const keys = [...info.keys];
    for (let f = 0; f < n; f++) {
      const t = f / info.fps;
      while (keys.length && keys[0][0] <= t) {
        const code = keys.shift()![1];
        await page.evaluate(c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, key: c })), code);
        await page.clock.runFor(50);
        await page.evaluate(c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, key: c })), code);
      }
      await canvas.screenshot({ path: join(dir, `${String(f).padStart(4, '0')}.png`) });
      await page.clock.runFor(step);
    }
    await ctx.close();
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(info.fps), '-i', join(dir, '%04d.png'),
      '-vf', 'split[a][b];[a]palettegen=max_colors=192:stats_mode=full[p];[b][p]paletteuse=dither=none', '-loop', '0', join(out, `${name}.gif`)]);
    rmSync(dir, { recursive: true, force: true });
    console.log(`${name}.gif (${n} frames)`);
  }
  await browser.close();
}
void main();
