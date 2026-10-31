// The mod file format. A mod is one JSON file of plain data: nothing in it ever runs as code, it is never
// put into HTML, and anything the format does not name is refused. Today a mod can add skins with their own
// drawn art; docs/MODDING.md describes the format.
//
// Pure: no DOM, no game state, so tests run it in Node and the loader decides what to register.
import { FRAMES, type FrameId } from '../art/fighterFrames';
import { PORTRAITS } from '../art/portraits';
import type { SkinArt } from '../art/sprites';

export const MOD_FORMAT = 'spell-vs-steel-mod/1';
/** Largest mod file read, in characters. */
export const MAX_MOD_SIZE = 256 * 1024;
const MAX_SKINS = 16;
/** Palette letters a mod may use: 'a' (the outline) through 'z'. */
const LETTERS = 'abcdefghijklmnopqrstuvwxyz';
const FRAME_IDS: readonly FrameId[] = ['idle0', 'idle1', 'hop', 'land', 'windup', 'slash', 'hit', 'cast0', 'cast1', 'kneel', 'down',
  'stagger', 'slump', 'fall1', 'fall2'];

export interface ModSkin { cls: string; id: string; name: string; art: SkinArt }
export interface Mod { id: string; name: string; author: string; skins: ModSkin[] }
export type ParseResult = { ok: true; mod: Mod } | { ok: false; error: string };

class ModError extends Error {}
const fail = (msg: string): never => { throw new ModError(msg); };

/** A plain JSON object with only the keys listed (`req` must be there). */
function obj(v: unknown, where: string, req: string[], opt: string[] = []): Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) fail(`${where}: expected an object`);
  const o = v as Record<string, unknown>;
  for (const k of Object.keys(o)) if (!req.includes(k) && !opt.includes(k)) fail(`${where}: unknown key "${k}"`);
  for (const k of req) if (!Object.prototype.hasOwnProperty.call(o, k)) fail(`${where}: missing "${k}"`);
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
  const own = Object.prototype.hasOwnProperty.call(FRAMES, cls) ? FRAMES[cls] : undefined;
  if (!own) return fail(`${where}.class: no class "${cls}"`);
  const id = str(o.id, `${where}.id`, /^[a-z][a-z0-9-]*$/, 24);
  const name = str(o.name, `${where}.name`, /^[A-Za-z0-9 '-]+$/, 12);
  // palette: letter -> #rrggbb, starting at 'a' with no gaps
  const palIn = obj(o.palette, `${where}.palette`, [], LETTERS.split(''));
  const pal: string[] = [];
  for (const ch of LETTERS) {
    if (!Object.prototype.hasOwnProperty.call(palIn, ch)) break;
    pal.push(str(palIn[ch], `${where}.palette.${ch}`, /^#[0-9a-fA-F]{6}$/, 7));
  }
  if (pal.length < 2 || pal.length !== Object.keys(palIn).length) fail(`${where}.palette: letters must run from "a" with no gaps`);
  const letters = LETTERS.slice(0, pal.length);
  const team = str(o.team, `${where}.team`, /^[a-z]$/, 1);
  if (!letters.includes(team)) fail(`${where}.team: "${team}" is not in the palette`);
  // frames: the class's own frame size, idle0 required
  const ref = own.frames.idle0!, w = ref[0].length, h = ref.length;
  const fIn = obj(o.frames, `${where}.frames`, ['idle0'], FRAME_IDS as string[]);
  const frames: SkinArt['frames'] = {};
  for (const f of FRAME_IDS) if (Object.prototype.hasOwnProperty.call(fIn, f)) frames[f] = rows(fIn[f], `${where}.frames.${f}`, w, h, letters);
  let portrait: string[] | undefined;
  if (o.portrait !== undefined) {
    const p = PORTRAITS[cls];
    portrait = rows(o.portrait, `${where}.portrait`, p[0].length, p.length, letters);
  }
  return { cls, id, name, art: { pal, team, ax: own.ax, frames, portrait } };
}

/** Read a mod file. Never throws: a bad file comes back as an error message. */
export function parseMod(text: string): ParseResult {
  try {
    if (text.length > MAX_MOD_SIZE) fail(`file is larger than ${MAX_MOD_SIZE / 1024} KB`);
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { return fail('not valid JSON'); }
    const o = obj(raw, 'mod', ['format', 'id', 'name', 'skins'], ['author']);
    if (o.format !== MOD_FORMAT) fail(`mod.format: expected "${MOD_FORMAT}"`);
    const id = str(o.id, 'mod.id', /^[a-z][a-z0-9-]*$/, 32);
    const name = str(o.name, 'mod.name', /^[A-Za-z0-9 '!.,-]+$/, 32);
    const author = o.author === undefined ? '' : str(o.author, 'mod.author', /^[A-Za-z0-9 '._-]+$/, 32);
    if (!Array.isArray(o.skins) || o.skins.length === 0 || o.skins.length > MAX_SKINS) fail(`mod.skins: 1 to ${MAX_SKINS} skins`);
    const skins = (o.skins as unknown[]).map((s, i) => skin(s, `mod.skins[${i}]`));
    const seen = new Set<string>();
    for (const s of skins) { const k = `${s.cls}:${s.id}`; if (seen.has(k)) fail(`mod.skins: "${k}" twice`); seen.add(k); }
    return { ok: true, mod: { id, name, author, skins } };
  } catch (e) {
    if (e instanceof ModError) return { ok: false, error: e.message };
    throw e;
  }
}
