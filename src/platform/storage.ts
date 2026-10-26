// Where save files live. Each platform gives the game a handful of named files ("save.json",
// "replays.json"), which maps straight onto Steam Remote Storage, an Electron data folder or Capacitor's
// Filesystem. Only src/engine/save.ts talks to this; everything else reads and writes saves through it.

export interface PlatformStorage {
  read(name: string): Promise<string | null>;
  write(name: string, data: string): Promise<void>;
  remove(name: string): Promise<void>;
  /** Backends that can answer at once (the browser) offer this, so saves load before the first screen without an await. */
  readSync?(name: string): string | null;
}

const ls = (): Storage | null => { try { return globalThis.localStorage ?? null; } catch { return null; } };
const fileKey = (name: string): string => `svs:file:${name}`;

/** The browser: one localStorage entry per file. Blocked or full storage fails quietly (write rejects). */
export const webStorage: PlatformStorage = {
  readSync(name) { try { return ls()?.getItem(fileKey(name)) ?? null; } catch { return null; } },
  async read(name) { return this.readSync!(name); },
  async write(name, data) {
    const s = ls();
    if (!s) throw new Error('storage unavailable');
    s.setItem(fileKey(name), data);
  },
  async remove(name) { try { ls()?.removeItem(fileKey(name)); } catch { /* storage blocked */ } },
};

/** Files kept in memory only: Node scripts, tests, and browsers that block storage. */
export function memoryStorage(files: Record<string, string> = {}): PlatformStorage & { files: Record<string, string> } {
  return {
    files,
    readSync: name => files[name] ?? null,
    read: async name => files[name] ?? null,
    write: async (name, data) => { files[name] = data; },
    remove: async name => { delete files[name]; },
  };
}
