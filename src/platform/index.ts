// The platform layer: everything that differs between the browser, the Steam build (Electron) and the
// mobile builds (Capacitor) sits behind this one interface: save storage, fullscreen and the app lifecycle.
// Game code only talks to `platform`; a native build swaps the implementation and nothing else.
//
// A native shell hands in its implementation before the game boots, as `window.svsNative` (an Electron
// preload via contextBridge, or a Capacitor plugin bootstrap). Anything it leaves out falls back to the web version.
import { webStorage, type PlatformStorage } from './storage';
import { webFullscreen, webLifecycle } from './web';

export type { PlatformStorage } from './storage';

export interface PlatformFullscreen {
  /** False where the game always fills the screen (or the browser can't), so menus hide the option. */
  supported(): boolean;
  isOn(): boolean;
  /** Browsers only allow this shortly after a click or key press. */
  set(on: boolean): Promise<void>;
  onChange(cb: (on: boolean) => void): void;
}

export interface PlatformLifecycle {
  /** The game went to the background (tab hidden, app minimised or switched away). */
  onHide(cb: () => void): void;
  /** The game is back in front. */
  onShow(cb: () => void): void;
  /** Whether the game can close itself (a desktop app can; a web page can't). Menus show QUIT only then. */
  canQuit: boolean;
  quit(): void;
}

export interface Platform {
  id: 'web' | 'electron' | 'capacitor';
  storage: PlatformStorage;
  fullscreen: PlatformFullscreen;
  lifecycle: PlatformLifecycle;
}

/** What a native shell provides; every part, and every function in a part, is optional. */
export interface NativePlatform {
  id: Platform['id'];
  storage?: Partial<PlatformStorage>;
  fullscreen?: Partial<PlatformFullscreen>;
  lifecycle?: Partial<PlatformLifecycle>;
}

function detect(): Platform {
  const web: Platform = { id: 'web', storage: webStorage, fullscreen: webFullscreen, lifecycle: webLifecycle };
  const native = typeof window === 'undefined' ? undefined : (window as unknown as { svsNative?: NativePlatform }).svsNative;
  if (!native) return web;
  // a shell may give only some functions of a part (say QUIT, but not the background events)
  return {
    id: native.id,
    storage: native.storage ? { ...web.storage, ...native.storage } : web.storage,
    fullscreen: { ...web.fullscreen, ...native.fullscreen },
    lifecycle: { ...web.lifecycle, ...native.lifecycle },
  };
}

export const platform: Platform = detect();
