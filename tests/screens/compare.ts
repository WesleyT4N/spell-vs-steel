// Compares two runs of the screen checks (run.ts), usually the base branch and a PR, pixel by pixel.
// Screens are seeded and the clock is frozen, so a screen nobody touched comes out identical; anything
// that differs is listed for a human to look at. Visual changes are often the point of a PR, so this
// never fails the build: it writes report.html (base, PR and a diff image side by side) and summary.md.
// Usage: npx tsx tests/screens/compare.ts <baseDir> <headDir> <outDir>
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { Shot } from './run';

const [baseDir, headDir, outDir] = process.argv.slice(2).map(p => resolve(p));
if (!outDir) { console.error('usage: compare.ts <baseDir> <headDir> <outDir>'); process.exit(2); }

const load = (dir: string): Shot[] => existsSync(join(dir, 'shots.json')) ? (JSON.parse(readFileSync(join(dir, 'shots.json'), 'utf8')) as { shots: Shot[] }).shots : [];
const base = new Map(load(baseDir).map(s => [s.file, s]));
const head = load(headDir);
interface Row { file: string; status: 'changed' | 'new' | 'same' | 'gone'; changed?: number; problems: string[] }
const rows: Row[] = [];

const dataUrl = (p: string): string => `data:image/png;base64,${readFileSync(p).toString('base64')}`;
const copy = (from: string, to: string): void => { mkdirSync(dirname(to), { recursive: true }); copyFileSync(from, to); };

async function main(): Promise<void> {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  // tsx compiles named inner functions to __name(...) calls, which don't exist inside the page
  await page.evaluate('window.__name = f => f');
  for (const s of head) {
    const b = base.get(s.file);
    base.delete(s.file);
    const headPng = join(headDir, s.file), basePng = b && join(baseDir, b.file);
    if (!existsSync(headPng)) { rows.push({ file: s.file, status: 'new', problems: s.problems }); continue; }
    if (!basePng || !existsSync(basePng)) { rows.push({ file: s.file, status: 'new', problems: s.problems }); copy(headPng, join(outDir, 'head', s.file)); continue; }
    // decode both shots in the browser and paint every differing pixel red over a faded copy of the PR's shot
    const res = await page.evaluate(async ([x, y]) => {
      const img = async (u: string): Promise<ImageBitmap> => createImageBitmap(await (await fetch(u)).blob());
      const [a, b] = [await img(x), await img(y)];
      const w = Math.max(a.width, b.width), h = Math.max(a.height, b.height);
      const px = (bm: ImageBitmap): Uint8ClampedArray => { const c = new OffscreenCanvas(w, h).getContext('2d')!; c.drawImage(bm, 0, 0); return c.getImageData(0, 0, w, h).data; };
      const da = px(a), db = px(b);
      const out = new OffscreenCanvas(w, h), oc = out.getContext('2d')!;
      const od = oc.createImageData(w, h);
      let n = 0;
      for (let i = 0; i < da.length; i += 4) {
        const diff = Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 0;
        if (diff) { n++; od.data.set([255, 0, 64, 255], i); }
        else { const g = (db[i] + db[i + 1] + db[i + 2]) / 3; od.data.set([g, g, g, 60], i); }
      }
      if (!n) return { n, size: w * h, png: '' };
      oc.putImageData(od, 0, 0);
      const blob = await out.convertToBlob();
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = '';
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return { n, size: w * h, png: btoa(bin) };
    }, [dataUrl(basePng), dataUrl(headPng)] as const);
    if (!res.n) { rows.push({ file: s.file, status: 'same', problems: s.problems }); continue; }
    rows.push({ file: s.file, status: 'changed', changed: res.n / res.size, problems: s.problems });
    copy(basePng, join(outDir, 'base', s.file));
    copy(headPng, join(outDir, 'head', s.file));
    mkdirSync(dirname(join(outDir, 'diff', s.file)), { recursive: true });
    writeFileSync(join(outDir, 'diff', s.file), Buffer.from(res.png, 'base64'));
  }
  for (const b of base.values()) rows.push({ file: b.file, status: 'gone', problems: [] });
  await browser.close();
  write();
}

function write(): void {
  const changed = rows.filter(r => r.status === 'changed'), added = rows.filter(r => r.status === 'new'), gone = rows.filter(r => r.status === 'gone');
  const same = rows.length - changed.length - added.length - gone.length;
  const name = (f: string): string => f.replace(/\.png$/, '').replace('/', ' / ');
  const pct = (v = 0): string => v < 0.001 ? '<0.1%' : `${(v * 100).toFixed(1)}%`;
  // the summary groups by screen, since one change usually shows on every screen shape
  const byScreen = new Map<string, Row[]>();
  for (const r of changed) { const k = r.file.split('/')[1].replace(/\.png$/, ''); byScreen.set(k, [...(byScreen.get(k) ?? []), r]); }
  const md = [
    `### Screen diff vs base`,
    '',
    `${changed.length} changed, ${added.length} new, ${gone.length} removed, ${same} identical (${byScreen.size} screens changed).`,
    '',
    ...(byScreen.size ? ['| Screen | Shapes changed | Most pixels changed |', '| --- | --- | --- |',
      ...[...byScreen].map(([k, rs]) => `| ${k} | ${rs.length} | ${pct(Math.max(...rs.map(r => r.changed ?? 0)))} |`)] : []),
    ...(added.length ? ['', `New: ${added.map(r => name(r.file)).join(', ')}`] : []),
    ...(gone.length ? ['', `Removed: ${gone.map(r => name(r.file)).join(', ')}`] : []),
    '',
    byScreen.size ? 'Open the **screens-report** artifact (report.html) to see base, PR and diff side by side. Changes are expected when a PR touches visuals; anything else is worth a look.' : 'No pixel changed.',
  ].join('\n');
  const esc = (s: string): string => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
  const card = (r: Row): string => `<section><h2>${esc(name(r.file))} <small>${r.status === 'changed' ? `${pct(r.changed)} of pixels` : r.status}</small></h2>
    ${r.problems.map(p => `<p class="bad">${esc(p)}</p>`).join('')}
    <div class="row">${r.status === 'changed' ? `<figure><img src="base/${r.file}"><figcaption>base</figcaption></figure><figure><img src="head/${r.file}"><figcaption>PR</figcaption></figure><figure><img src="diff/${r.file}"><figcaption>diff</figcaption></figure>`
      : r.status === 'new' ? `<figure><img src="head/${r.file}"><figcaption>PR (new)</figcaption></figure>` : ''}</div></section>`;
  const html = `<!doctype html><meta charset="utf-8"><title>Screen diff</title>
<style>body{font:14px system-ui;background:#1d1b18;color:#eee;margin:16px}h1{font-size:20px}h2{font-size:15px;margin:24px 0 8px}small{color:#aaa;font-weight:normal}
.row{display:flex;gap:8px;flex-wrap:wrap}figure{margin:0;flex:1 1 300px;min-width:0}img{width:100%;image-rendering:pixelated;border:1px solid #444;background:#000}figcaption{color:#aaa;font-size:12px}.bad{color:#ff7a7a}</style>
<h1>Screen diff: ${changed.length} changed, ${added.length} new, ${gone.length} removed, ${same} identical</h1>
${[...changed, ...added].map(card).join('\n')}
${gone.length ? `<h2>Removed</h2><p>${gone.map(r => esc(name(r.file))).join(', ')}</p>` : ''}`;
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'report.html'), html);
  writeFileSync(join(outDir, 'summary.md'), md + '\n');
  console.log(md);
}
void main();
