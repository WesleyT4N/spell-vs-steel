// Renders effect contact sheets to PNG, so you can look at an effect frame by frame while drafting it.
// Usage: npm run fx:sheet -- <job.json | inline JSON> [out.png]
//   a job is { rows: [{ cls, attack, use?, foeCol?, span?, label? }], frames?, zoom?, boxes? } (see tests/fx/sheet.ts)
//   e.g. npm run fx:sheet -- '{"rows":[{"cls":"warrior","attack":"light","use":{"cleave":"warrior/cleave-a"}}]}'
import { chromium } from 'playwright';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [arg, outArg] = process.argv.slice(2);
if (!arg) { console.error('usage: npm run fx:sheet -- <job.json | JSON> [out.png]'); process.exit(2); }
const job = existsSync(arg) ? readFileSync(arg, 'utf8') : arg;
JSON.parse(job);
const page = resolve('dist-fx/tests/fx/sheet.html');
const out = resolve(outArg ?? 'test-results/fx/sheet.png');
const browser = await chromium.launch();
const pg = await browser.newPage();
const errors: string[] = [];
pg.on('pageerror', e => errors.push(e.message));
pg.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await pg.goto(pathToFileURL(page).href + '#' + encodeURIComponent(job));
await pg.waitForFunction(() => (window as unknown as { done?: string }).done || document.title === 'error', null, { timeout: 30000 }).catch(() => {});
const url = await pg.evaluate(() => (window as unknown as { done?: string }).done);
await browser.close();
if (!url) { console.error('sheet failed:', errors.join('\n') || 'timed out'); process.exit(1); }
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
if (errors.length) console.error(errors.join('\n'));
console.log(out);
