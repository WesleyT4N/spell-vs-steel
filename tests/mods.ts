// The mod format refuses anything it does not name: the test fixture and every shipped mod parse, and broken or hostile files
// come back as errors instead of loading.
import { readFileSync, readdirSync } from 'node:fs';
import { parseMod, MAX_MOD_SIZE } from '../src/mods/format';
import { loadMods, importMod, setModOn, removeMod, MODS } from '../src/mods';
import { SKINS } from '../src/art/sprites';
import { resetSaveForTests, getSave } from '../src/engine/save';

let failed = 0;
const check = (ok: boolean, what: string): void => { if (!ok) { failed++; console.error(`FAIL ${what}`); } };

// mods/ may be empty; a known-good skin mod lives in tests/fixtures so the checks below always have one.
const fixture = new URL('./fixtures/skin-mod.json', import.meta.url);
const dir = new URL('../mods/', import.meta.url);
const files = [fixture, ...readdirSync(dir).filter(f => f.endsWith('.json')).map(f => new URL(f, dir))];
for (const f of files) {
  const r = parseMod(readFileSync(f, 'utf8'));
  check(r.ok, `${f.pathname} parses${r.ok ? '' : `: ${r.error}`}`);
}

const good = JSON.parse(readFileSync(fixture, 'utf8'));
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

// ---- installing: built-in and imported mods, switched on and off, kept in the save ----
const wizard = readFileSync(new URL('../mods/wes-skin.json', dir), 'utf8');
const druid = readFileSync(new URL('../mods/hazel-druid-skin.json', dir), 'utf8');
const has = (cls: string, id: string): boolean => SKINS[cls].some(s => s.id === id);
resetSaveForTests();
loadMods({ '../../mods/wes-skin.json': wizard });
check(MODS.length === 1 && MODS[0].on && has('mage', 'wes'), 'a built-in mod loads switched on');
setModOn('wes-skin', false);
check(!has('mage', 'wes') && getSave('mods')?.off.includes('wes-skin') === true, 'switching a mod off takes its skins away and is kept');
check(!importMod(wizard).ok, 'a mod with a built-in mod\'s id is refused');
check(!importMod('{"format":"spell-vs-steel-mod/2"}').ok, 'a broken import is refused');
const imp = importMod(druid);
check(imp.ok && has('ranger', 'hazel') && getSave('mods')?.imported.length === 1, 'an imported mod is switched on and kept');
// start again from the save: the switched-off mod stays off, the import comes back
loadMods({ '../../mods/wes-skin.json': wizard });
check(MODS.length === 2 && !MODS[0].on && MODS[1].on && !has('mage', 'wes') && has('ranger', 'hazel'), 'the next start keeps both choices');
setModOn('wes-skin', true);
check(has('mage', 'wes'), 'switching a mod back on adds its skins');
check(removeMod('hazel-druid-skin') && !has('ranger', 'hazel') && getSave('mods')?.imported.length === 0, 'deleting an imported mod');
check(!removeMod('wes-skin'), 'a built-in mod can only be switched off');
loadMods({ '../../mods/wes-skin.json': wizard, '../../mods/zz.json': '{nope' });
check(MODS.length === 2 && !!MODS[1].error && !MODS[1].on, 'a bad shipped file is listed with its error');

if (failed) { console.error(`${failed} mod check(s) failed`); process.exit(1); }
console.log(`mods: ${files.length} file(s) parse, hostile files refused`);
