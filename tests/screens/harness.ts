// Boots the real game, then lets the screen tests open any screen directly: `__test.show(name)`.
// The screens themselves live in src/dev/screens.ts (the Art Lab opens them too); the runner (run.ts) shoots every
// entry at every screen shape.
import './frameClock';
import '../../src/main';
import { spread } from '../../src/engine/gfx';
import { screens } from '../../src/dev/screens';

declare global { interface Window { __test: unknown } }
window.__test = {
  names: Object.keys(screens),
  /** True when the screen shown uses its full-height phone layout (it fills the whole window, not the top half). */
  tall: (): boolean => spread.tall,
  show(name: string): void {
    const open = screens[name];
    if (!open) throw new Error(`no screen named ${name}`);
    open();
  },
};
