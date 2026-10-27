// The browser versions of fullscreen and the app lifecycle (storage is in storage.ts).
import type { PlatformFullscreen, PlatformLifecycle } from './index';

const doc = (): Document | null => (typeof document === 'undefined' ? null : document);

export const webFullscreen: PlatformFullscreen = {
  // iPhone Safari has no element fullscreen; phones get the most room from "add to home screen" instead
  supported: () => !!doc()?.fullscreenEnabled,
  isOn: () => !!doc()?.fullscreenElement,
  async set(on) {
    const d = doc();
    if (!d || on === !!d.fullscreenElement) return;
    try {
      if (on) await d.documentElement.requestFullscreen({ navigationUI: 'hide' });
      else await d.exitFullscreen();
    } catch { /* refused: no recent click or key press, or blocked by the embedding frame */ }
  },
  onChange(cb) { doc()?.addEventListener('fullscreenchange', () => cb(!!doc()?.fullscreenElement)); },
};

export const webLifecycle: PlatformLifecycle = {
  onHide(cb) { doc()?.addEventListener('visibilitychange', () => { if (doc()?.visibilityState === 'hidden') cb(); }); },
  onShow(cb) { doc()?.addEventListener('visibilitychange', () => { if (doc()?.visibilityState === 'visible') cb(); }); },
  canQuit: false,
  quit() { /* a web page can't close itself */ },
};
