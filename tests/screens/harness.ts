// Boots the real game, then lets the screen tests open any screen directly: `__test.show(name)`.
// The screens themselves live in src/dev/screens.ts (the Art Lab opens them too); the runner (run.ts) shoots every
// entry at every screen shape.
import './frameClock';
import * as game from '../../src/main';
import { screens } from '../../src/dev/screens';

declare global { interface Window { __test: unknown } }
// published once the game is up, so the runner's wait for __test also waits for the art to decode
// (a namespace import, so the base-branch comparison still builds against a main.ts from before `ready` existed)
const ready = (game as { ready?: Promise<void> }).ready ?? Promise.resolve();
void ready.then(() => { window.__test = {
  names: Object.keys(screens),
  show(name: string): void {
    const open = screens[name];
    if (!open) throw new Error(`no screen named ${name}`);
    open();
  },
}; });
