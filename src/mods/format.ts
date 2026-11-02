// The mod format. A mod is a zip of plain data: a mod.json manifest plus PNG images. Nothing in it ever runs as code,
// it is never put into HTML, and anything the format does not name is refused. Today a mod can add skins with their
// own drawn art at the fighters' 48px HD size; docs/MODDING.md describes the format. The older one-file JSON format
// (format 2, art as palette-letter rows) is still read, so mods imported before zips keep working.
//
// Pure: no DOM, no game state, so tests run it in Node and the loader decides what to register.
import type { FrameId } from '../art/fighterFrames';
import { PL, PL_RES, PL_FILES } from '../art/pl';
import type { SkinArt } from '../art/sprites';
import { rowsFromPixels } from '../art/paletteImage';
import { unzip, decodePng, FileError, type Png } from './files';

export const MOD_FORMAT = 'spell-vs-steel-mod/3';
/** The one-file JSON format before zips (art as palette-letter rows), still read. */
export const LEGACY_FORMAT = 'spell-vs-steel-mod/2';
/** Largest mod file read, in bytes (a zip, or an old JSON mod). */
export const MAX_MOD_SIZE = 512 * 1024;
/** What a mod zip may unpack to. */
const ZIP_LIMITS = { maxFiles: 40, maxFileSize: 1024 * 1024, maxTotal: 4 * 1024 * 1024 };
/** Largest image in a mod, in pixels (a class's 17 frames side by side is about 70,000). */
const MAX_PIXELS = 256 * 1024;
const MAX_SKINS = 16;
/** Palette letters a mod may use, in order: 'a' (the outline) to 'z', then 'A' to 'Z', then '0' to '9'. */
export const LETTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export const FRAME_IDS: readonly FrameId[] = ['idle0', 'idle1', 'idle2', 'idle3', 'hop', 'land', 'windup', 'slash', 'hit', 'cast0', 'cast1',
  'kneel', 'down', 'stagger', 'slump', 'fall1', 'fall2'];
export const MOD_ID = /^[a-z][a-z0-9-]*$/;

/** A skin's own voice: clip banks by line ("cast", "castBig", "death", "win", "cast_fire", ...), each a list of MP3 files' bytes. */
export type ModVoice = Record<string, Uint8Array[]>;
export interface ModSkin { cls: string; id: string; name: string; art: SkinArt; voice?: ModVoice }
export interface Mod { id: string; name: string; author: string; skins: ModSkin[] }
export type ParseResult = { ok: true; mod: Mod } | { ok: false; error: string };

class ModError extends Error {}
const fail = (msg: string): never => { throw new ModError(msg); };
const errorOf = (e: unknown): string | null => (e instanceof ModError || e instanceof FileError ? e.message : null);
const own = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

/** A plain JSON object with only the keys listed (`req` must be there). */
function obj(v: unknown, where: string, req: string[], opt: string[] = []): Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) fail(`${where}: expected an object`);
  const o = v as Record<string, unknown>;
  for (const k of Object.keys(o)) if (!req.includes(k) && !opt.includes(k)) fail(`${where}: unknown key "${k}"`);
  for (const k of req) if (!own(o, k)) fail(`${where}: missing "${k}"`);
  return o;
}
function str(v: unknown, where: string, re: RegExp, max: number): string {
  if (typeof v !== 'string' || v.length > max || !re.test(v)) fail(`${where}: not allowed (${re.source}, at most ${max} characters)`);
  return v as string;
}
/** Pixel rows: same-length strings of '.' (clear) and palette letters, exactly w by h. */
function rows(v: unknown, where: string, w: number, h: number, letters: string): string[] {
  if (!Array.isArray(v) || v.length !== h) fail(`${where}: expected ${h} rows`);
  return (v as unknown[]).map((r, y) => {
    if (typeof r !== 'string' || r.length !== w) fail(`${where} row ${y}: expected ${w} characters`);
    for (const ch of r as string) if (ch !== '.' && !letters.includes(ch)) fail(`${where} row ${y}: "${ch}" is not in the palette`);
    return r as string;
  });
}

function skin(v: unknown, where: string): ModSkin {
  const o = obj(v, where, ['class', 'id', 'name', 'palette', 'team', 'frames'], ['portrait']);
  const cls = str(o.class, `${where}.class`, /^[a-z][a-z0-9-]*$/, 24);
  const base = own(PL, cls) ? PL[cls] : undefined;
  if (!base) return fail(`${where}.class: no class "${cls}"`);
  const id = str(o.id, `${where}.id`, MOD_ID, 24);
  const name = str(o.name, `${where}.name`, /^[A-Za-z0-9 '-]+$/, 12);
  // palette: letter -> #rrggbb, starting at 'a' with no gaps
  const palIn = obj(o.palette, `${where}.palette`, [], LETTERS.split(''));
  const pal: string[] = [];
  for (const ch of LETTERS) {
    if (!own(palIn, ch)) break;
    pal.push(str(palIn[ch], `${where}.palette.${ch}`, /^#[0-9a-fA-F]{6}$/, 7));
  }
  if (pal.length < 2 || pal.length !== Object.keys(palIn).length) fail(`${where}.palette: letters must run from "a" with no gaps`);
  const letters = LETTERS.slice(0, pal.length);
  const team = str(o.team, `${where}.team`, /^[a-zA-Z0-9]$/, 1);
  if (!letters.includes(team)) fail(`${where}.team: "${team}" is not in the palette`);
  // frames: the class's own HD frame size, idle0 required
  const w = base.w, h = base.h;
  const fIn = obj(o.frames, `${where}.frames`, ['idle0'], FRAME_IDS as string[]);
  const frames: SkinArt['frames'] = {};
  for (const f of FRAME_IDS) if (own(fIn, f)) frames[f] = rows(fIn[f], `${where}.frames.${f}`, w, h, letters);
  let portrait: string[] | undefined;
  if (o.portrait !== undefined) portrait = rows(o.portrait, `${where}.portrait`, base.portraitW, base.portraitH, letters);
  return { cls, id, name, art: { pal, team, ax: base.ax, res: PL_RES, frames, portrait } };
}

/** Read an old one-file JSON mod (format 2). Never throws: a bad file comes back as an error message. */
export function parseMod(text: string): ParseResult {
  try {
    if (typeof text !== 'string') fail('not a text file');
    if (text.length > MAX_MOD_SIZE) fail(`file is larger than ${MAX_MOD_SIZE / 1024} KB`);
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { return fail('not valid JSON'); }
    const o = obj(raw, 'mod', ['format', 'id', 'name', 'skins'], ['author']);
    if (o.format === 'spell-vs-steel-mod/1') fail('made for the old 24px fighters; mods now draw the 48px HD fighters');
    if (o.format === MOD_FORMAT) fail('a mod.json on its own: import the mod\'s zip (mod.json and its images)');
    if (o.format !== LEGACY_FORMAT) fail(`mod.format: expected "${MOD_FORMAT}"`);
    const { id, name, author } = head(o);
    const skins = list(o.skins, (s, w) => skin(s, w));
    return { ok: true, mod: { id, name, author, skins } };
  } catch (e) {
    const msg = errorOf(e);
    if (msg !== null) return { ok: false, error: msg };
    throw e;
  }
}

function head(o: Record<string, unknown>): { id: string; name: string; author: string } {
  return {
    id: str(o.id, 'mod.id', MOD_ID, 32),
    name: str(o.name, 'mod.name', /^[A-Za-z0-9 '!.,-]+$/, 32),
    author: o.author === undefined ? '' : str(o.author, 'mod.author', /^[A-Za-z0-9 '._-]+$/, 32),
  };
}
function list(v: unknown, each: (s: unknown, where: string) => ModSkin): ModSkin[] {
  if (!Array.isArray(v) || v.length === 0 || v.length > MAX_SKINS) fail(`mod.skins: 1 to ${MAX_SKINS} skins`);
  const skins = (v as unknown[]).map((s, i) => each(s, `mod.skins[${i}]`));
  const seen = new Set<string>();
  for (const s of skins) { const k = `${s.cls}:${s.id}`; if (seen.has(k)) fail(`mod.skins: "${k}" twice`); seen.add(k); }
  return skins;
}

// ---------- format 3: a zip of mod.json + PNGs ----------
const HEX = /^#[0-9a-fA-F]{6}$/;
const FILE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}\.png$/;
const MP3 = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}\.mp3$/;
/** The voice lines a skin can replace (see src/engine/voice.ts); "cast_<element>" banks are per-element cast lines. */
export const VOICE_LINES = ['cast', 'castBig', 'death', 'win', 'grunt', 'hurt', 'hurtBig'] as const;
const ELEMENTS = ['steel', 'fire', 'frost', 'arcane', 'shadow', 'poison', 'nature', 'holy'];
const VOICE_KEYS = [...VOICE_LINES, ...ELEMENTS.map(e => `cast_${e}`)];
/** Clips per voice line, and the most a voice clip may weigh (a short spoken line at 40 kbps is about 10 KB). */
const MAX_TAKES = 4, MAX_CLIP = 64 * 1024;
/** An MP3 file: an ID3 tag or an MPEG audio frame sync at the start. */
const isMp3 = (b: Uint8Array): boolean => (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0);
const hex = (px: Uint8Array, i: number): string => '#' + [0, 1, 2].map(k => px[i + k].toString(16).padStart(2, '0')).join('');
/** The art's outline ink: the color found most often on its edge (opaque pixels next to clear ones). */
function edgeColor(img: Png): string | undefined {
  const n = new Map<string, number>(), on = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < img.w && y < img.h && img.px[(y * img.w + x) * 4 + 3] >= 128;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    if (on(x, y) && (!on(x - 1, y) || !on(x + 1, y) || !on(x, y - 1) || !on(x, y + 1))) { const c = hex(img.px, (y * img.w + x) * 4); n.set(c, (n.get(c) ?? 0) + 1); }
  }
  return [...n].sort((a, b) => b[1] - a[1])[0]?.[0];
}

/** One skin of a zip mod: its sheet (and portrait) PNGs read into palette rows. */
async function zipSkin(v: unknown, where: string, files: Map<string, Uint8Array>, used: Set<string>): Promise<ModSkin> {
  const o = obj(v, where, ['class', 'id', 'name', 'sheet', 'team'], ['portrait', 'palette', 'voice']);
  const cls = str(o.class, `${where}.class`, /^[a-z][a-z0-9-]*$/, 24);
  const base = own(PL_FILES, cls) ? PL_FILES[cls] : undefined;
  if (!base) return fail(`${where}.class: no class "${cls}"`);
  const id = str(o.id, `${where}.id`, MOD_ID, 24);
  const name = str(o.name, `${where}.name`, /^[A-Za-z0-9 '-]+$/, 12);
  const png = async (key: string): Promise<Png> => {
    const f = str(o[key], `${where}.${key}`, FILE, 68);
    const bytes = files.get(f);
    if (!bytes) return fail(`${where}.${key}: no "${f}" in the zip`);
    used.add(f);
    try { return await decodePng(bytes, MAX_PIXELS); } catch (e) { return fail(`${f}: ${errorOf(e) ?? 'not a PNG image'}`); }
  };
  const fw = base.frameWidth, fh = base.frameHeight, order = base.frames;
  const sheet = await png('sheet');
  if (sheet.h !== fh || sheet.w % fw || sheet.w / fw > order.length) fail(`${where}.sheet: frames are ${fw}x${fh}, side by side (1 to ${order.length} of them)`);
  const portrait = o.portrait === undefined ? null : await png('portrait');
  if (portrait && (portrait.w !== PL[cls].portraitW || portrait.h !== PL[cls].portraitH)) fail(`${where}.portrait: must be ${PL[cls].portraitW}x${PL[cls].portraitH}`);
  // the palette: given (outline first), or every color the images use, the outline (the color around the edge) first
  let pal: string[];
  if (o.palette !== undefined) {
    if (!Array.isArray(o.palette) || o.palette.length < 2 || o.palette.length > LETTERS.length) fail(`${where}.palette: 2 to ${LETTERS.length} colors`);
    pal = (o.palette as unknown[]).map((c, i) => str(c, `${where}.palette[${i}]`, HEX, 7).toLowerCase());
    if (new Set(pal).size !== pal.length) fail(`${where}.palette: a color twice`);
  } else {
    const seen: string[] = [];
    for (const img of portrait ? [sheet, portrait] : [sheet]) {
      for (let i = 0; i < img.px.length; i += 4) if (img.px[i + 3] >= 128 && !seen.includes(hex(img.px, i))) seen.push(hex(img.px, i));
    }
    if (seen.length < 2) fail(`${where}.sheet: the art needs an outline and at least one more color`);
    const ink = edgeColor(sheet)!;
    pal = [ink, ...seen.filter(c => c !== ink)];
  }
  if (pal.length > LETTERS.length) fail(`${where}: at most ${LETTERS.length} colors`);
  const known = new Set(pal);
  for (const img of portrait ? [sheet, portrait] : [sheet]) {
    for (let i = 0; i < img.px.length; i += 4) if (img.px[i + 3] >= 128 && !known.has(hex(img.px, i))) fail(`${where}: ${hex(img.px, i)} is used but not in the palette`);
  }
  const team = str(o.team, `${where}.team`, HEX, 7).toLowerCase();
  if (!known.has(team)) fail(`${where}.team: ${team} is not one of the art's colors`);
  // frames in the class's order; a frame left out (or left empty) shows idle0
  const frames: SkinArt['frames'] = {};
  for (let k = 0; k < sheet.w / fw; k++) {
    const cell = new Uint8Array(fw * fh * 4);
    for (let y = 0; y < fh; y++) cell.set(sheet.px.subarray((y * sheet.w + k * fw) * 4, (y * sheet.w + k * fw + fw) * 4), y * fw * 4);
    const rows = rowsFromPixels(cell, fw, fh, pal);
    if (rows.some(r => /[^.]/.test(r))) frames[order[k]] = rows;
  }
  if (!frames.idle0) fail(`${where}.sheet: the first frame (idle0) is empty`);
  const art: SkinArt = { pal, team: LETTERS[pal.indexOf(team)], ax: base.ax, res: PL_RES, frames };
  if (portrait) art.portrait = rowsFromPixels(portrait.px, portrait.w, portrait.h, pal);
  const skin: ModSkin = { cls, id, name, art };
  if (o.voice !== undefined) skin.voice = voice(o.voice, `${where}.voice`, files, used);
  return skin;
}

/** A skin's voice: line -> MP3 files in the zip. Only the listed lines, 1 to MAX_TAKES clips each. */
function voice(v: unknown, where: string, files: Map<string, Uint8Array>, used: Set<string>): ModVoice {
  const o = obj(v, where, [], VOICE_KEYS);
  if (!Object.keys(o).length) fail(`${where}: name at least one line (${VOICE_LINES.join(', ')})`);
  const out: ModVoice = {};
  for (const k of VOICE_KEYS) {
    if (!own(o, k)) continue;
    const list = o[k];
    if (!Array.isArray(list) || list.length === 0 || list.length > MAX_TAKES) fail(`${where}.${k}: 1 to ${MAX_TAKES} MP3 files`);
    out[k] = (list as unknown[]).map((f, i) => {
      const name = str(f, `${where}.${k}[${i}]`, MP3, 68);
      const bytes = files.get(name);
      if (!bytes) return fail(`${where}.${k}: no "${name}" in the zip`);
      if (bytes.length > MAX_CLIP) fail(`${name}: a voice clip is at most ${MAX_CLIP / 1024} KB`);
      if (!isMp3(bytes)) fail(`${name}: not an MP3 file`);
      used.add(name);
      return bytes;
    });
  }
  return out;
}

/** Read a mod from its files by name (mod.json and the PNGs it names). Never throws. */
export async function readModFiles(files: Map<string, Uint8Array>): Promise<ParseResult> {
  try {
    const manifest = files.get('mod.json');
    if (!manifest) fail('no mod.json in the mod');
    let raw: unknown;
    try { raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(manifest)); } catch { return fail('mod.json is not valid JSON'); }
    const o = obj(raw, 'mod', ['format', 'id', 'name', 'skins'], ['author']);
    if (o.format !== MOD_FORMAT) fail(`mod.format: expected "${MOD_FORMAT}"`);
    const { id, name, author } = head(o);
    if (!Array.isArray(o.skins) || o.skins.length === 0 || o.skins.length > MAX_SKINS) fail(`mod.skins: 1 to ${MAX_SKINS} skins`);
    const used = new Set(['mod.json']), out: ModSkin[] = [];
    for (const [i, s] of (o.skins as unknown[]).entries()) out.push(await zipSkin(s, `mod.skins[${i}]`, files, used));
    const skins = list(out, s => s as ModSkin);
    for (const f of files.keys()) if (!used.has(f)) fail(`"${f}" is in the mod but mod.json doesn't use it`);
    return { ok: true, mod: { id, name, author, skins } };
  } catch (e) {
    const msg = errorOf(e);
    if (msg !== null) return { ok: false, error: msg };
    throw e;
  }
}

/** Read a mod file as the player picked it: a zip (format 3) or an old JSON mod (format 2). Never throws. */
export async function readMod(bytes: Uint8Array): Promise<ParseResult> {
  if (bytes.length > MAX_MOD_SIZE) return { ok: false, error: `file is larger than ${MAX_MOD_SIZE / 1024} KB` };
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    let text: string;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return { ok: false, error: 'not a mod zip' }; }
    return /^\s*\{/.test(text) ? parseMod(text) : { ok: false, error: 'not a mod zip' };
  }
  let files: Map<string, Uint8Array>;
  try { files = await unzip(bytes, ZIP_LIMITS); } catch (e) { return { ok: false, error: errorOf(e) ?? 'not a zip file' }; }
  // a zip of the mod's folder (folder/mod.json, folder/...) reads like a zip of its files
  const dirs = new Set([...files.keys()].map(n => n.includes('/') ? n.slice(0, n.indexOf('/') + 1) : ''));
  if (dirs.size === 1 && !dirs.has('')) files = new Map([...files].map(([n, b]) => [n.slice([...dirs][0].length), b]));
  return readModFiles(files);
}
