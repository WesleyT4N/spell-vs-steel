// The mod format refuses anything it does not name: every shipped mod parses, and broken or hostile files
// come back as errors instead of loading.
import { readFileSync, readdirSync } from 'node:fs';
import { parseMod, MAX_MOD_SIZE } from '../src/mods/format';

let failed = 0;
const check = (ok: boolean, what: string): void => { if (!ok) { failed++; console.error(`FAIL ${what}`); } };

const dir = new URL('../mods/', import.meta.url);
const files = readdirSync(dir).filter(f => f.endsWith('.json'));
check(files.length > 0, 'mods/ has at least one mod');
for (const f of files) {
  const r = parseMod(readFileSync(new URL(f, dir), 'utf8'));
  check(r.ok, `${f} parses${r.ok ? '' : `: ${r.error}`}`);
}

const good = JSON.parse(readFileSync(new URL(files[0], dir), 'utf8'));
const bad = (what: string, edit: (m: any) => unknown): void => {
  const m = structuredClone(good);
  const out = edit(m), text = typeof out === 'string' ? out : JSON.stringify(m);
  const r = parseMod(text);
  check(!r.ok, `refuses ${what}`);
};
bad('not JSON', () => '{nope');
bad('too big', () => ' '.repeat(MAX_MOD_SIZE + 1));
bad('a wrong format tag', m => { m.format = 'other/1'; });
bad('an unknown top-level key', m => { m.script = 'alert(1)'; });
bad('a __proto__ key', m => JSON.stringify(m).replace('{', '{"__proto__":{"x":1},'));
bad('a __proto__ key in a skin', m => JSON.stringify(m).replace('"class"', '"__proto__":{},"class"'));
bad('an unknown class', m => { m.skins[0].class = 'bard'; });
bad('a class from the prototype', m => { m.skins[0].class = 'constructor'; });
bad('a non-hex color', m => { m.skins[0].palette.b = 'url(x)'; });
bad('a palette gap', m => { delete m.skins[0].palette.c; });
bad('a letter outside the palette', m => { const f = m.skins[0].frames.idle0; f[0] = 'z' + f[0].slice(1); });
bad('a short row', m => { m.skins[0].frames.idle0[3] = '..'; });
bad('a missing idle frame', m => { delete m.skins[0].frames.idle0; });
bad('an unknown frame', m => { m.skins[0].frames.dance = m.skins[0].frames.idle0; });
bad('a wrong-size portrait', m => { m.skins[0].portrait = m.skins[0].portrait.slice(1); });
bad('HTML in a name', m => { m.skins[0].name = '<b>x</b>'; });
bad('a long name', m => { m.skins[0].name = 'A'.repeat(13); });
bad('the same skin twice', m => { m.skins.push(m.skins[0]); });
bad('a team letter outside the palette', m => { m.skins[0].team = 'z'; });

if (failed) { console.error(`${failed} mod check(s) failed`); process.exit(1); }
console.log(`mods: ${files.length} file(s) parse, hostile files refused`);
