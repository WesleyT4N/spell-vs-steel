// Screen checks: opens every screen in tests/screens/harness.ts at every screen shape the game supports
// (4:3 to 21:9, wider than 21:9, phones in portrait and landscape) and saves a screenshot of each.
// A shot fails when the page throws or logs an error, the game screen doesn't fill the window the way
// fit() in src/main.ts promises, or the screen is blank. Pixels are compared separately (compare.ts),
// against the base branch, since visual changes are often on purpose.
// Usage: npx tsx tests/screens/run.ts [outDir] [--only title,battle-draw] [--profiles desktop-16x9] [--harness path/to/harness.html]
// Needs the harness build first: npx vite build --config tests/screens/vite.config.ts
import { chromium, type Browser } from 'playwright';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const flag = (name: string): string[] | undefined => { const i = args.indexOf(name); return i >= 0 ? args[i + 1].split(',') : undefined; };
const outDir = resolve(args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--')) ?? 'test-results/screens');
const onlyScreens = flag('--only');
const onlyProfiles = flag('--profiles');
const harness = resolve(flag('--harness')?.[0] ?? 'dist-test/tests/screens/harness.html');
if (!existsSync(harness)) { console.error(`missing ${harness}: run npx vite build --config tests/screens/vite.config.ts`); process.exit(2); }

interface Profile { name: string; w: number; h: number; touch: boolean; portrait?: boolean }
export const PROFILES: Profile[] = [
  { name: 'desktop-4x3', w: 1024, h: 768, touch: false },
  { name: 'desktop-3x2', w: 960, h: 640, touch: false },
  { name: 'desktop-16x9', w: 1280, h: 720, touch: false },
  { name: 'desktop-21x9', w: 1680, h: 720, touch: false },
  // wider than 21:9 letterboxes at the sides
  { name: 'desktop-32x9', w: 1920, h: 540, touch: false },
  { name: 'phone-portrait', w: 390, h: 844, touch: true, portrait: true },
  { name: 'phone-landscape', w: 844, h: 390, touch: true },
];
/** Screens that dock DOM panels over or beside the canvas, so the canvas doesn't fill the window. */
const DOM_PANELS = new Set(['balance-lab']);

export interface Shot { screen: string; profile: string; file: string; problems: string[] }

/**
 * Math.random is seeded before the game loads, so every run of a screen draws the same picture. Web Audio is
 * switched off: sound effects also roll Math.random, at moments that depend on when audio buffers finish loading.
 */
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

async function shoot(browser: Browser, p: Profile, screen: string): Promise<Shot> {
  const file = `${p.name}/${screen}.png`;
  const shot: Shot = { screen, profile: p.name, file, problems: [] };
  const ctx = await browser.newContext({ viewport: { width: p.w, height: p.h }, deviceScaleFactor: p.touch ? 2 : 1, hasTouch: p.touch, isMobile: p.touch });
  const page = await ctx.newPage();
  page.on('pageerror', e => shot.problems.push(`page error: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') shot.problems.push(`console error: ${m.text()}`); });
  try {
    await page.addInitScript(seedRandom);
    // a frozen clock: the game only moves when the test says so, so animations land on the same frame every run
    await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
    await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
    await page.goto(`${pathToFileURL(harness).href}?touch=${p.touch ? 1 : 0}`);
    await page.waitForFunction(() => 'names' in ((window as unknown as { __test?: object }).__test ?? {}));
    // any key counts as the first click, which clears the CLICK HERE TO START overlay
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'F24', key: 'F24' })));
    await page.evaluate(n => (window as unknown as { __test: { show(n: string): void } }).__test.show(n), screen);
    await page.clock.runFor(250);
    mkdirSync(join(outDir, p.name), { recursive: true });
    await page.screenshot({ path: join(outDir, file) });
    const facts = await page.evaluate(() => {
      const cv = document.getElementById('game') as HTMLCanvasElement;
      const r = cv.getBoundingClientRect();
      const g = cv.getContext('2d')!;
      // sample a grid of the canvas: a working screen has many colors and isn't all black
      const colors = new Set<number>();
      let lit = 0, n = 0;
      for (let y = 0; y < 24; y++) for (let x = 0; x < 32; x++) {
        const d = g.getImageData(Math.floor((x + 0.5) * cv.width / 32), Math.floor((y + 0.5) * cv.height / 24), 1, 1).data;
        colors.add((d[0] << 16) | (d[1] << 8) | d[2]);
        if (d[0] + d[1] + d[2] > 24) lit++;
        n++;
      }
      const tall = (window as unknown as { __test: { tall(): boolean } }).__test.tall();
      return { x: r.x, y: r.y, w: r.width, h: r.height, colors: colors.size, lit: lit / n, vw: innerWidth, vh: innerHeight, tall };
    });
    if (facts.colors < 6) shot.problems.push(`screen looks blank (${facts.colors} colors in a 32x24 sample)`);
    if (facts.lit < 0.1) shot.problems.push(`screen is ${Math.round((1 - facts.lit) * 100)}% black`);
    if (!DOM_PANELS.has(screen)) shot.problems.push(...layoutProblems(p, facts));
  } catch (e) {
    shot.problems.push(`crashed: ${(e as Error).message.split('\n')[0]}`);
  } finally {
    await ctx.close();
  }
  return shot;
}

/**
 * The promise of fit() in src/main.ts: the screen fills the window between 4:3 and 21:9 and letterboxes past them;
 * phones in portrait fill the top half, or the whole screen on screens with a full-height layout (Scene.tall).
 */
function layoutProblems(p: Profile, r: { x: number; y: number; w: number; h: number; tall: boolean }): string[] {
  const out: string[] = [];
  if (r.tall && !p.portrait) out.push('full-height layout is only for phones in portrait');
  const tall = p.portrait && r.tall;
  const bh = p.portrait && !tall ? p.h / 2 : p.h;
  const aspect = p.w / bh;
  const min = tall ? 9 / 22 : p.portrait ? 3 / 4 : 4 / 3, max = 7 / 3;
  if (r.x < -0.5 || r.y < -0.5 || r.x + r.w > p.w + 0.5 || r.y + r.h > p.h + 0.5) out.push(`screen spills out of the window (${fmt(r)})`);
  // the view keeps whole world pixels, so it can come up a little short of the window (under 2%)
  const fillsW = r.w >= p.w * 0.98, fillsH = r.h >= bh * 0.98;
  if (aspect >= min && aspect <= max && !(fillsW && fillsH)) out.push(`screen should fill the ${p.w}x${Math.round(bh)} area but is ${fmt(r)}`);
  if (aspect > max && !(fillsH && !fillsW)) out.push(`wider than 21:9 should letterbox at the sides, got ${fmt(r)}`);
  if (Math.abs(r.x + r.w / 2 - p.w / 2) > 1.5) out.push(`screen is off center (${fmt(r)})`);
  if (p.portrait && r.y > 1) out.push(`portrait screen should sit at the top, got ${fmt(r)}`);
  return out;
}
const fmt = (r: { x: number; y: number; w: number; h: number }): string => `${Math.round(r.w)}x${Math.round(r.h)} at ${Math.round(r.x)},${Math.round(r.y)}`;

async function main(): Promise<void> {
  const browser = await chromium.launch();
  // read the screen list from the harness itself
  const probe = await browser.newPage();
  await probe.goto(pathToFileURL(harness).href);
  const names = (await probe.evaluate(() => (window as unknown as { __test: { names: string[] } }).__test.names)).filter(n => !onlyScreens || onlyScreens.includes(n));
  await probe.close();
  const profiles = PROFILES.filter(p => !onlyProfiles || onlyProfiles.includes(p.name));
  const jobs = profiles.flatMap(p => names.map(n => [p, n] as const));
  const shots: Shot[] = [];
  const t0 = Date.now();
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < jobs.length) {
      const [p, n] = jobs[next++];
      const s = await shoot(browser, p, n);
      shots.push(s);
      if (s.problems.length) console.log(`FAIL ${p.name} ${n}: ${s.problems.join(' | ')}`);
    }
  };
  await Promise.all(Array.from({ length: Number(process.env.SHOT_WORKERS ?? 4) }, worker));
  await browser.close();
  shots.sort((a, b) => a.file.localeCompare(b.file));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'shots.json'), JSON.stringify({ profiles, screens: names, shots }, null, 2));
  const bad = shots.filter(s => s.problems.length);
  console.log(`${shots.length - bad.length}/${shots.length} shots ok (${names.length} screens x ${profiles.length} shapes) in ${((Date.now() - t0) / 1000).toFixed(1)}s -> ${outDir}`);
  process.exit(bad.length ? 1 : 0);
}
void main();
