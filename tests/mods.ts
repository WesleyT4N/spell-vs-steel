// The mod format refuses anything it does not name: the test fixture and every shipped mod read, and broken or
// hostile files (bad zips, bad PNGs, unknown keys, art that breaks the rules) come back as errors instead of loading.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { parseMod, readMod, readModFiles, MAX_MOD_SIZE } from '../src/mods/format';
import { loadMods, importMod, setModOn, removeMod, MODS, type BuiltInMod } from '../src/mods';
import { SKINS } from '../src/art/sprites';
import { resetSaveForTests, getSave } from '../src/engine/save';
import { hasSkinVoice } from '../src/engine/voice';

let failed = 0;
const check = (ok: boolean, what: string): void => { if (!ok) { failed++; console.error(`FAIL ${what}`); } };

/** A mod folder's files by name. */
const folder = (url: URL): Map<string, Uint8Array> =>
  new Map(readdirSync(url).map(f => [f, new Uint8Array(readFileSync(new URL(f, url)))] as const));
/** A zip of these files: stored, or deflated (the two ways zip tools pack files). */
async function zip(files: Map<string, Uint8Array>, deflate = false, prefix = ''): Promise<Uint8Array> {
  const parts: Uint8Array[] = [], central: Uint8Array[] = [];
  let off = 0;
  for (const [n, raw] of files) {
    const name = new TextEncoder().encode(prefix + n);
    const data = deflate ? new Uint8Array(await new Response(new Blob([raw as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()) : raw;
    const loc = new Uint8Array(30 + name.length), lv = new DataView(loc.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(8, deflate ? 8 : 0, true); lv.setUint32(18, data.length, true); lv.setUint32(22, raw.length, true);
    lv.setUint16(26, name.length, true); loc.set(name, 30);
    const cen = new Uint8Array(46 + name.length), cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(10, deflate ? 8 : 0, true); cv.setUint32(20, data.length, true); cv.setUint32(24, raw.length, true);
    cv.setUint16(28, name.length, true); cv.setUint32(42, off, true); cen.set(name, 46);
    parts.push(loc, data); central.push(cen); off += loc.length + data.length;
  }
  const cenLen = central.reduce((n, c) => n + c.length, 0), end = new Uint8Array(22), ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.size, true); ev.setUint16(10, files.size, true); ev.setUint32(12, cenLen, true); ev.setUint32(16, off, true);
  const all = [...parts, ...central, end], out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of all) { out.set(p, o); o += p.length; }
  return out;
}

const fixture = new URL('./fixtures/skin-mod/', import.meta.url);
const modsDir = new URL('../mods/', import.meta.url);
const shipped = readdirSync(modsDir).filter(f => statSync(new URL(f, modsDir)).isDirectory()).map(f => new URL(`${f}/`, modsDir));
for (const dir of [fixture, ...shipped]) {
  const r = await readModFiles(folder(dir));
  check(r.ok, `${dir.pathname} reads${r.ok ? '' : `: ${r.error}`}`);
}
const good = folder(fixture);
for (const [how, z] of [['stored', await zip(good)], ['deflated', await zip(good, true)], ['in a folder', await zip(good, true, 'wes-skin/')]] as const) {
  const r = await readMod(z);
  check(r.ok && r.mod.skins[0].art.frames.idle0?.length === 62 && !!r.mod.skins[0].art.portrait, `a ${how} zip reads${r.ok ? '' : `: ${r.error}`}`);
}
// the old one-file JSON mods (format 2) still read, and draw the same as the zip
const legacy = readFileSync(new URL('./fixtures/skin-mod.json', import.meta.url), 'utf8');
const old = parseMod(legacy), now = await readModFiles(good);
const same = (a: object, b: object): boolean => JSON.stringify(a, Object.keys(a).sort()) === JSON.stringify(b, Object.keys(a).sort());
check(old.ok && now.ok && (['pal', 'team', 'ax', 'res', 'portrait'] as const).every(k => JSON.stringify(old.mod.skins[0].art[k]) === JSON.stringify(now.mod.skins[0].art[k]))
  && same(old.mod.skins[0].art.frames, now.mod.skins[0].art.frames), 'the zip mod draws exactly like the old JSON one');

const manifest = JSON.parse(new TextDecoder().decode(good.get('mod.json')));
const bad = async (what: string, edit: (m: any, files: Map<string, Uint8Array>) => void): Promise<void> => {
  const m = structuredClone(manifest), files = new Map(good);
  edit(m, files);
  if (!files.has('mod.json!')) files.set('mod.json', new TextEncoder().encode(JSON.stringify(m)));
  else { files.set('mod.json', files.get('mod.json!')!); files.delete('mod.json!'); }
  const r = await readModFiles(files);
  check(!r.ok, `refuses ${what}`);
};
const text = (s: string): Uint8Array => new TextEncoder().encode(s);
await bad('not JSON', (_, f) => f.set('mod.json!', text('{nope')));
await bad('no manifest', (_, f) => { f.delete('mod.json'); f.set('mod.json!', new Uint8Array()); f.delete('mod.json!'); f.set('x.json', text('{}')); });
await bad('a wrong format tag', m => { m.format = 'other/1'; });
await bad('an unknown top-level key', m => { m.script = 'alert(1)'; });
await bad('a __proto__ key', (m, f) => f.set('mod.json!', text(JSON.stringify(m).replace('{', '{"__proto__":{"x":1},'))));
await bad('a __proto__ key in a skin', (m, f) => f.set('mod.json!', text(JSON.stringify(m).replace('"class"', '"__proto__":{},"class"'))));
await bad('an unknown class', m => { m.skins[0].class = 'bard'; });
await bad('a class from the prototype', m => { m.skins[0].class = 'constructor'; });
await bad('a sheet that is not in the zip', m => { m.skins[0].sheet = 'nope.png'; });
await bad('a sheet path outside the zip', m => { m.skins[0].sheet = '../wes.png'; });
await bad('a sheet that is not a PNG', (_, f) => f.set('wes.png', text('GIF89a')));
await bad('a damaged PNG', (_, f) => f.set('wes.png', good.get('wes.png')!.slice(0, 200)));
await bad('a wrong-size sheet', (_, f) => f.set('wes.png', good.get('wes-portrait.png')!));
await bad('a wrong-size portrait', (_, f) => f.set('wes-portrait.png', good.get('wes.png')!));
await bad('a file the manifest does not use', (_, f) => f.set('extra.png', good.get('wes.png')!));
await bad('a non-hex color', m => { m.skins[0].palette[1] = 'url(x)'; });
await bad('art in a color the palette lacks', m => { m.skins[0].palette = m.skins[0].palette.slice(0, 4); });
await bad('a team color the art does not use', m => { m.skins[0].team = '#123456'; });
await bad('HTML in a name', m => { m.skins[0].name = '<b>x</b>'; });
await bad('a long name', m => { m.skins[0].name = 'A'.repeat(13); });
await bad('the same skin twice', m => { m.skins.push(m.skins[0]); });
// a skin's own voice: named MP3s in the zip, only for lines the game says
const mp3 = readFileSync(new URL('../mods/wes-skin/wes-win-1.mp3', import.meta.url));
const voiced = (m: any, f: Map<string, Uint8Array>): void => { m.skins[0].voice = { win: ['w-win.mp3'] }; f.set('w-win.mp3', new Uint8Array(mp3)); };
await (async () => {
  const m = structuredClone(manifest), f = new Map(good);
  voiced(m, f); f.set('mod.json', text(JSON.stringify(m)));
  const r = await readModFiles(f);
  check(r.ok && r.mod.skins[0].voice?.win?.length === 1, `a skin with its own voice reads${r.ok ? '' : `: ${r.error}`}`);
})();
await bad('an unknown voice line', (m, f) => { voiced(m, f); m.skins[0].voice = { taunt: ['w-win.mp3'] }; });
await bad('a voice line from the prototype', (m, f) => { voiced(m, f); m.skins[0].voice = JSON.parse('{"__proto__":["w-win.mp3"]}'); });
await bad('an empty voice', (m, f) => { voiced(m, f); m.skins[0].voice = {}; f.delete('w-win.mp3'); });
await bad('a voice clip that is not in the zip', (m, f) => { voiced(m, f); m.skins[0].voice.win = ['nope.mp3']; f.delete('w-win.mp3'); });
await bad('a voice clip that is not an MP3', (m, f) => { voiced(m, f); f.set('w-win.mp3', text('<script>')); });
await bad('a voice clip named as a PNG', (m, f) => { voiced(m, f); m.skins[0].voice.win = ['wes.png']; });
await bad('too many takes of a line', (m, f) => { voiced(m, f); m.skins[0].voice.win = Array(5).fill('w-win.mp3'); });
await bad('a voice clip that is too big', (m, f) => { voiced(m, f); f.set('w-win.mp3', new Uint8Array(65 * 1024).fill(0xff)); });
for (const [dir, cls, id] of [['wes-skin', 'mage', 'wes'], ['hazel-druid-skin', 'ranger', 'hazel']] as const) {
  const r = await readModFiles(folder(new URL(`${dir}/`, modsDir)));
  check(r.ok && ['cast', 'castBig', 'death', 'win'].every(k => !!r.mod.skins.find(s => s.cls === cls && s.id === id)?.voice?.[k]?.length), `${dir} ships its own voice`);
}
check(!(await readMod(new Uint8Array(MAX_MOD_SIZE + 1))).ok, 'refuses a file that is too big');
check(!(await readMod(text('PK not really a zip'))).ok, 'refuses a broken zip');
check(!(await readMod(await zip(new Map([['../mod.json', good.get('mod.json')!]])))).ok, 'refuses a zip path that climbs out');
// without its palette the art's own colors are used, darkest as the outline; the drawing is the same
await (async () => {
  const m = structuredClone(manifest);
  delete m.skins[0].palette;
  const r = await readModFiles(new Map([...good, ['mod.json', text(JSON.stringify(m))]]));
  const a = r.ok ? r.mod.skins[0].art : null, b = now.ok ? now.mod.skins[0].art : null;
  const paint = (art: typeof a): string => JSON.stringify(art && art.frames.idle0!.map(row => [...row].map(ch => ch === '.' ? '.' : art.pal['abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.indexOf(ch)]).join()));
  check(!!a && !!b && paint(a) === paint(b) && a.pal[0] === '#0a0810', 'a mod without a palette takes its colors from the art');
})();

// ---- installing: built-in and imported mods, switched on and off, kept in the save ----
const wesDir = new URL('wes-skin/', modsDir), hazelDir = new URL('hazel-druid-skin/', modsDir);
const builtIn = (): BuiltInMod[] => [{ folder: 'wes-skin', files: folder(wesDir) }];
const has = (cls: string, id: string): boolean => SKINS[cls].some(s => s.id === id);
resetSaveForTests();
await loadMods(builtIn());
check(MODS.length === 1 && MODS[0].on && has('mage', 'wes') && hasSkinVoice('mage', 'wes'), 'a built-in mod loads switched on, voice and all');
setModOn('wes-skin', false);
check(!has('mage', 'wes') && !hasSkinVoice('mage', 'wes') && getSave('mods')?.off.includes('wes-skin') === true, 'switching a mod off takes its skins away and is kept');
check(!(await importMod(await zip(folder(wesDir)))).ok, 'a mod with a built-in mod\'s id is refused');
check(!(await importMod(text('{"format":"spell-vs-steel-mod/2"}'))).ok, 'a broken import is refused');
const imp = await importMod(await zip(folder(hazelDir), true));
check(imp.ok && has('ranger', 'hazel') && typeof getSave('mods')?.imported[0]?.zip === 'string', 'an imported zip is switched on and kept');
// start again from the save: the switched-off mod stays off, the import comes back
await loadMods(builtIn());
check(MODS.length === 2 && !MODS[0].on && MODS[1].on && !has('mage', 'wes') && has('ranger', 'hazel'), 'the next start keeps both choices');
setModOn('wes-skin', true);
check(has('mage', 'wes'), 'switching a mod back on adds its skins');
check(removeMod('hazel-druid-skin') && !has('ranger', 'hazel') && getSave('mods')?.imported.length === 0, 'deleting an imported mod');
check(!removeMod('wes-skin'), 'a built-in mod can only be switched off');
// an old JSON mod imported before zips still comes back from the save
const oldJson = JSON.parse(legacy);
check((await importMod(text(JSON.stringify({ ...oldJson, id: 'old-wes', skins: oldJson.skins.map((s: object) => ({ ...s, id: 'oldwes' })) })))).ok, 'an old JSON mod still imports');
await loadMods(builtIn());
check(has('mage', 'oldwes'), 'an old JSON mod in the save still loads');
await loadMods([...builtIn(), { folder: 'zz', files: new Map([['mod.json', text('{nope')]]) }]);
check(MODS.some(e => e.id === 'zz' && !!e.error && !e.on), 'a bad shipped mod is listed with its error');

if (failed) { console.error(`${failed} mod check(s) failed`); process.exit(1); }
console.log(`mods: ${shipped.length + 1} mod(s) read, zips and old JSON mods load, hostile files refused`);
