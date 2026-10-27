// The one place the game keeps anything between sessions. Two versioned files on the platform's storage:
//   save.json     settings, decks, progress (small, rewritten on every change)
//   replays.json  saved replays (large, so a settings change never rewrites them)
// Both are read into memory once at boot; reads are synchronous from there and writes go out at the end
// of the current tick. Older layouts are brought up to date by MIGRATIONS, and the very first load on a
// browser imports the old one-key-per-thing localStorage entries (svs:keys, svs:deck:<cls>, ...).
import { webStorage, memoryStorage, type PlatformStorage } from '../platform/storage';

/** Bump when SaveData changes shape, and add a MIGRATIONS entry that turns the previous version into this one. */
export const SAVE_VERSION = 1;

type Obj = Record<string, unknown>;

/** Everything kept between sessions. Each module owns its section and checks it on read (old saves, hand edits). */
export interface SaveData {
  /** Player 1 key bindings that differ from DEFAULT_KEYS (action -> KeyboardEvent.code). */
  keys: Record<string, string>;
  /** Player 2 key bindings that differ from DEFAULT_P2_KEYS. */
  p2keys: Record<string, string>;
  /** Gamepad button bindings. */
  pads: Obj | null;
  /** Volume settings (see AudioSettings). */
  audio: Obj;
  muted: boolean;
  /** Custom spell deck per class: card id -> copies. */
  decks: Record<string, Record<string, number>>;
  /** Last match setup (see MatchConfig). */
  match: Obj | null;
  /** Training mode dummy settings. */
  training: Obj | null;
  tutorialDone: boolean;
  /** Best arcade clear per class. */
  arcade: Record<string, { time: number; continues: number }>;
  /** Ranked rating, and a ranked match that was left before it finished. */
  rating: Obj | null;
  rankedPending: Obj | null;
  /** The balance lab's script box. */
  labScript: string | null;
}

/** A saved replay, as far as the save module cares: newest-first order and the kept flag. */
export interface StoredReplay { id: string; at: number; keep?: boolean }

/** Newest unkept replays kept, and the most that can be kept (starred) on top of those. */
export const RECENT_REPLAYS = 20;
export const MAX_KEPT_REPLAYS = 20;
/** Replays past this many characters drop their oldest unkept entries (browsers allow about 5 MB in all). */
export const REPLAY_BUDGET = 3_000_000;

const SAVE_FILE = 'save.json';
const REPLAY_FILE = 'replays.json';
const GAME = 'spell-vs-steel';

interface Envelope { game: string; v: number; data: unknown }

const defaults = (): SaveData => ({
  keys: {}, p2keys: {}, pads: null, audio: {}, muted: false, decks: {}, match: null, training: null,
  tutorialDone: false, arcade: {}, rating: null, rankedPending: null, labScript: null,
});

/** MIGRATIONS[n] turns a version n-1 save into version n. Never edit a shipped entry; add the next one. */
const MIGRATIONS: Record<number, (d: Obj) => Obj> = {
  // 1: the first versioned save. Nothing before it but the legacy keys, which importLegacy handles.
  1: d => d,
};

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
/** Own enumerable string keys only, minus prototype tricks, so a hand-edited save can't reach Object.prototype. */
function clean(v: unknown): Obj {
  if (!isObj(v)) return {};
  return Object.fromEntries(Object.entries(v).filter(([k]) => k !== '__proto__' && k !== 'constructor' && k !== 'prototype'));
}

/** Fill in missing sections and drop ones of the wrong type, so every reader gets the shape it expects. */
function normalize(raw: Obj): SaveData {
  const d = defaults(), r = clean(raw);
  const objOr = <T>(v: unknown, def: T): T => (isObj(v) ? clean(v) as T : def);
  const strMap = (v: unknown): Record<string, string> =>
    Object.fromEntries(Object.entries(clean(v)).filter(([, x]) => typeof x === 'string')) as Record<string, string>;
  return {
    keys: strMap(r.keys),
    p2keys: strMap(r.p2keys),
    pads: objOr(r.pads, d.pads),
    audio: objOr(r.audio, d.audio),
    muted: r.muted === true,
    decks: Object.fromEntries(Object.entries(clean(r.decks)).filter(([, x]) => isObj(x)).map(([c, x]) =>
      [c, Object.fromEntries(Object.entries(clean(x)).filter(([, n]) => Number.isInteger(n) && (n as number) > 0))])) as SaveData['decks'],
    match: objOr(r.match, d.match),
    training: objOr(r.training, d.training),
    tutorialDone: r.tutorialDone === true,
    arcade: Object.fromEntries(Object.entries(clean(r.arcade)).filter(([, x]) =>
      isObj(x) && typeof x.time === 'number' && typeof x.continues === 'number')) as SaveData['arcade'],
    rating: objOr(r.rating, d.rating),
    rankedPending: objOr(r.rankedPending, d.rankedPending),
    labScript: typeof r.labScript === 'string' ? r.labScript : null,
  };
}

/** Newest first; unkept replays past RECENT_REPLAYS go, then more of the oldest unkept ones until it fits the budget. */
export function capReplays<T extends StoredReplay>(list: T[], budget = REPLAY_BUDGET): T[] {
  const sorted = list.filter(r => isObj(r) && typeof r.id === 'string').sort((a, b) => b.at - a.at);
  let recent = 0;
  let kept = 0;
  let out = sorted.filter(r => (r.keep ? kept++ < MAX_KEPT_REPLAYS : recent++ < RECENT_REPLAYS));
  while (out.length > 1 && JSON.stringify(out).length > budget) {
    const drop = out.map(r => !r.keep).lastIndexOf(true);
    if (drop < 0) break;
    out = out.filter((_, i) => i !== drop);
  }
  return out;
}

// ---------- legacy import (the old one-key-per-thing layout) ----------

/** Every localStorage key the game used before the save module. */
export const LEGACY_KEYS = ['svs:keys', 'svs:p2keys', 'svs:pads', 'svs:audio', 'svs:muted', 'svs:match', 'svs:training',
  'svs:tutorial', 'svs:arcade', 'svs:replays', 'svs:rating', 'svs:ranked-pending', 'svs:lab:script'] as const;
const LEGACY_DECK = 'svs:deck:';

export interface Legacy { get(key: string): string | null; set(key: string, v: string): void; keys(): string[]; remove(key: string): void }
function browserLegacy(): Legacy | null {
  let s: Storage | null = null;
  try { s = globalThis.localStorage ?? null; } catch { /* blocked */ }
  if (!s) return null;
  const st = s;
  return {
    get: k => { try { return st.getItem(k); } catch { return null; } },
    set: (k, v) => { try { st.setItem(k, v); } catch { /* blocked */ } },
    keys: () => { try { return Array.from({ length: st.length }, (_, i) => st.key(i) ?? ''); } catch { return []; } },
    remove: k => { try { st.removeItem(k); } catch { /* blocked */ } },
  };
}

/** Read the old keys (all but replays) into a save. Returns null when there are none. */
export function importLegacy(l: Legacy): { data: SaveData; found: string[] } | null {
  const found: string[] = [];
  const json = (k: string): unknown => {
    const raw = l.get(k);
    if (raw === null) return undefined;
    found.push(k);
    try { return JSON.parse(raw) as unknown; } catch { return undefined; }
  };
  const raw: Obj = {
    keys: json('svs:keys'), p2keys: json('svs:p2keys'), pads: json('svs:pads'), audio: json('svs:audio'),
    match: json('svs:match'), training: json('svs:training'), arcade: json('svs:arcade'),
    rating: json('svs:rating'), rankedPending: json('svs:ranked-pending'),
  };
  const flag = (k: string): string | null => { const v = l.get(k); if (v !== null) found.push(k); return v; };
  raw.muted = flag('svs:muted') === '1';
  raw.tutorialDone = flag('svs:tutorial') === '1';
  raw.labScript = flag('svs:lab:script');
  const decks: Obj = {};
  for (const k of l.keys()) if (k.startsWith(LEGACY_DECK)) decks[k.slice(LEGACY_DECK.length)] = json(k);
  raw.decks = decks;
  if (!found.length) return null;
  return { data: normalize(raw), found };
}

// ---------- the live save ----------

let backend: PlatformStorage = webStorage;
let data: SaveData | null = null;
let replays: StoredReplay[] = [];
/** Set when the save on disk is from a newer build: it is left untouched and nothing is written back. */
let readOnly = false;
let dirty = { save: false, replays: false };
let flushing: Promise<void> | null = null;

/** Parse one file. 'bad' means unreadable, and the file is kept aside as <name>.bad. */
function parse(text: string | null, file: string): Envelope | 'bad' | null {
  if (text === null) return null;
  try {
    const e = JSON.parse(text) as Envelope;
    if (!isObj(e) || e.game !== GAME || !Number.isInteger(e.v)) throw new Error('not a save');
    return e;
  } catch {
    void backend.write(`${file}.bad`, text).catch(() => { /* best effort */ });
    return 'bad';
  }
}

function migrate(e: Envelope): Obj {
  let d = clean(e.data);
  for (let v = e.v + 1; v <= SAVE_VERSION; v++) d = MIGRATIONS[v](d);
  return d;
}

function adopt(saveText: string | null, replayText: string | null, legacy: Legacy | null): void {
  readOnly = false;
  dirty = { save: false, replays: false };
  const s = parse(saveText, SAVE_FILE), r = parse(replayText, REPLAY_FILE);
  const env = (e: Envelope | 'bad' | null): Envelope | null => (typeof e === 'object' ? e : null);
  const se = env(s), re = env(r);
  if ((se?.v ?? 0) > SAVE_VERSION || (re?.v ?? 0) > SAVE_VERSION) {
    // a newer build's save: play with it as far as this build understands it, but never write over it
    readOnly = true;
    console.warn('[save] this save is from a newer version of the game; changes will not be kept');
  }
  data = se ? normalize(migrate(se)) : defaults();
  // replays have kept one layout so far ({ list }); give them their own migrations when that changes
  const list = re ? clean(re.data).list : undefined;
  replays = capReplays(Array.isArray(list) ? list as StoredReplay[] : []);
  if (s === 'bad' && !readOnly) dirty.save = true;
  if (!readOnly && legacy) importLegacyInto(legacy, s === null, r === null);
}

/** First load on a browser that ran the old layout: copy the old keys in, then drop them once the new files are written. */
function importLegacyInto(legacy: Legacy, wantSave: boolean, wantReplays: boolean): void {
  const old = wantSave ? importLegacy(legacy) : null;
  const oldReplays = wantReplays ? legacy.get('svs:replays') : null;
  if (!old && oldReplays === null) return;
  if (old) { data = old.data; dirty.save = true; }
  if (oldReplays !== null) {
    let v: unknown = [];
    try { v = JSON.parse(oldReplays); } catch { /* unreadable: start empty */ }
    replays = capReplays(Array.isArray(v) ? v as StoredReplay[] : []);
    dirty.replays = true;
    // the old copy can be most of the browser's quota: take it out first, and put it back if the new file fails
    legacy.remove('svs:replays');
  }
  void flushSave().then(async () => {
    const [s, r] = await Promise.all([backend.read(SAVE_FILE), backend.read(REPLAY_FILE)]);
    if (old && s !== null) for (const k of old.found) legacy.remove(k);
    if (oldReplays !== null && r === null) legacy.set('svs:replays', oldReplays);
  });
}

/**
 * Load the saves from `storage` (the platform's; the browser by default). Native builds await this before the
 * game starts; the browser loads on first use without it. Also used by tests to swap in memoryStorage.
 */
export async function initSave(storage: PlatformStorage = webStorage, legacy: Legacy | null = storage === webStorage ? browserLegacy() : null): Promise<void> {
  backend = storage;
  const [s, r] = await Promise.all([storage.read(SAVE_FILE), storage.read(REPLAY_FILE)]);
  adopt(s, r, legacy);
}

function live(): SaveData {
  if (data) return data;
  if (backend.readSync) adopt(backend.readSync(SAVE_FILE), backend.readSync(REPLAY_FILE), backend === webStorage ? browserLegacy() : null);
  else { console.warn('[save] read before initSave(); using a blank save'); data = defaults(); }
  return data!;
}

/** Write out whatever changed. Runs on its own at the end of each tick; await it before quitting. */
export function flushSave(): Promise<void> {
  if (flushing) return flushing.then(() => flushSave());
  if (readOnly || !data || (!dirty.save && !dirty.replays)) return Promise.resolve();
  const jobs: Array<Promise<void>> = [];
  if (dirty.save) jobs.push(backend.write(SAVE_FILE, JSON.stringify({ game: GAME, v: SAVE_VERSION, data } satisfies Envelope)));
  if (dirty.replays) jobs.push(backend.write(REPLAY_FILE, JSON.stringify({ game: GAME, v: SAVE_VERSION, data: { list: replays } } satisfies Envelope)));
  dirty = { save: false, replays: false };
  flushing = Promise.all(jobs).then(() => undefined, (err: unknown) => { console.warn('[save] write failed', err); })
    .finally(() => { flushing = null; });
  return flushing;
}

let queued = false;
function schedule(which: 'save' | 'replays'): void {
  dirty[which] = true;
  if (queued) return;
  queued = true;
  queueMicrotask(() => { queued = false; void flushSave(); });
}

/** One section of the save. Treat the result as read-only; change it with setSave/updateSave. */
export function getSave<K extends keyof SaveData>(k: K): SaveData[K] {
  return live()[k];
}
export function setSave<K extends keyof SaveData>(k: K, v: SaveData[K]): void {
  live()[k] = v;
  schedule('save');
}
/** Change one section in place (copy-on-write is not needed: the section object belongs to the save). */
export function updateSave<K extends keyof SaveData>(k: K, f: (v: SaveData[K]) => SaveData[K]): void {
  setSave(k, f(live()[k]));
}

/** Saved replays, newest first. */
export function getReplays<T extends StoredReplay>(): T[] {
  live();
  return replays as T[];
}
/** Replace the saved replays; the caps (20 recent + 20 kept, and the size budget) apply here. */
export function setReplays<T extends StoredReplay>(list: T[]): T[] {
  live();
  replays = capReplays(list);
  schedule('replays');
  return replays as T[];
}

/** The whole save, for export (Steam Cloud conflict screens, bug reports). */
export const exportSave = (): { save: SaveData; replays: StoredReplay[] } => ({ save: live(), replays });
/** True when the save came from a newer build and nothing will be written. */
export const saveIsReadOnly = (): boolean => { live(); return readOnly; };

/** Tests: start over on in-memory files (and optionally old-layout keys). */
export function resetSaveForTests(files: Record<string, string> = {}, legacy: Legacy | null = null): ReturnType<typeof memoryStorage> {
  const m = memoryStorage(files);
  backend = m;
  data = null;
  adopt(m.readSync!(SAVE_FILE), m.readSync!(REPLAY_FILE), legacy);
  return m;
}
