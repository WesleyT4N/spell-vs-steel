// Game assets are real files under the repo's assets/ folder (PNG sheets, JSON metadata, MP3 audio); none are
// written into the code. The browser entry (src/assetUrls.ts) hands this module the URL of every file: real files
// next to index.html in the desktop and Android builds, data URLs packed into the page for the one-file web build.
// Images decode once at boot (loadImages) so drawing code can read them synchronously; audio is fetched and
// decoded the first time it plays. Paths are relative to assets/, e.g. "fx/mage/orb.png".
//
// In Node (sims and tests) nothing is registered: every lookup comes back empty and nothing draws.

const urls = new Map<string, string>();
const data = new Map<string, unknown>();
const images = new Map<string, HTMLImageElement>();
let loading: Promise<void> | null = null;

/** Register asset URLs by file path (anything up to and including "assets/" is dropped from the keys). */
export function registerAssets(map: Record<string, string>): void {
  for (const [path, url] of Object.entries(map)) urls.set(path.replace(/^.*?assets\//, ''), url);
}

/** Register parsed JSON asset files (sprite metadata and the like) by file path. */
export function registerAssetData(map: Record<string, unknown>): void {
  for (const [path, v] of Object.entries(map)) data.set(path.replace(/^.*?assets\//, ''), v);
}

/** A JSON asset file's contents ("monsters/wolf.json"), or undefined when there is none. */
export const assetData = <T>(path: string): T | undefined => data.get(path) as T | undefined;

/** Every registered JSON asset path under a folder ("monsters/"), sorted. */
export const assetDataPaths = (prefix: string): string[] => [...data.keys()].filter(k => k.startsWith(prefix)).sort();

/** The URL of an asset file, or undefined when there is none. */
export const assetUrl = (path: string): string | undefined => urls.get(path);

/** Every registered asset path under a folder ("audio/voice/"), sorted. */
export const assetPaths = (prefix: string): string[] => [...urls.keys()].filter(k => k.startsWith(prefix)).sort();

/** Decode every PNG asset. Resolves once all are ready (a file that fails to decode is left out). */
export function loadImages(): Promise<void> {
  if (loading) return loading;
  if (typeof Image === 'undefined') return (loading = Promise.resolve());
  const jobs: Array<Promise<void>> = [];
  for (const [path, url] of urls) {
    if (!path.endsWith('.png')) continue;
    const img = new Image();
    img.src = url;
    jobs.push(img.decode().then(() => { images.set(path, img); }, () => console.warn(`asset ${path} did not decode`)));
  }
  return (loading = Promise.all(jobs).then(() => undefined));
}

/** A decoded image asset (after loadImages), or null. */
export const assetImage = (path: string): HTMLImageElement | null => images.get(path) ?? null;

/** The bytes behind a URL. Data URLs (the one-file web build) are decoded in place rather than fetched, so a
 *  page whose sandbox blocks fetch still reads them; real files are fetched. Throws when it can't be read. */
export async function urlBytes(url: string): Promise<Uint8Array> {
  if (url.startsWith('data:')) {
    const comma = url.indexOf(',');
    const head = url.slice(0, comma), body = url.slice(comma + 1);
    if (head.endsWith(';base64')) return Uint8Array.from(atob(body), ch => ch.charCodeAt(0));
    return new TextEncoder().encode(decodeURIComponent(body));
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

/** An asset file's bytes (audio decodes these), or null when it is missing or can't be read. */
export async function assetBytes(path: string): Promise<ArrayBuffer | null> {
  const url = urls.get(path);
  if (!url) return null;
  try {
    const b = await urlBytes(url);
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
  } catch {
    return null;
  }
}
