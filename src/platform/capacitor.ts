// The Android app (Capacitor). Its native bridge puts `window.Capacitor` on the page before any game code
// runs, so this needs no import of the Capacitor packages: it talks to the App plugin through the bridge.
// The hardware Back button acts like Esc (BACK in menus, pause in a fight), and QUIT closes the app.
import type { NativePlatform } from './index';

interface Listener { remove(): void }
interface AppPlugin {
  addListener(event: 'backButton' | 'pause' | 'resume', cb: () => void): Promise<Listener> | Listener;
  exitApp(): Promise<void>;
}
interface CapacitorGlobal { isNativePlatform?(): boolean; Plugins?: { App?: AppPlugin } }

export function capacitorPlatform(): NativePlatform | undefined {
  const cap = typeof window === 'undefined' ? undefined : (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  const app = cap?.isNativePlatform?.() ? cap.Plugins?.App : undefined;
  if (!app) return undefined;

  // a listener replaces Android's default (leave the app), so Back steps through the game's own screens
  void app.addListener('backButton', () => {
    for (const type of ['keydown', 'keyup'] as const) window.dispatchEvent(new KeyboardEvent(type, { code: 'Escape', key: 'Escape' }));
  });
  return {
    id: 'capacitor',
    lifecycle: {
      onHide: cb => { void app.addListener('pause', cb); },
      onShow: cb => { void app.addListener('resume', cb); },
      canQuit: true,
      quit: () => { void app.exitApp(); },
    },
  };
}
