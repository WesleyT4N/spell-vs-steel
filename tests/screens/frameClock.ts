// Imported before the game, so the main loop reads time from here. Playwright's fake clock keeps Date and
// setTimeout exact, but performance.now and requestAnimationFrame timestamps still carry a few real
// milliseconds from page load, which shifts animations by a frame from run to run. Driving both from Date
// makes every frame land on the same game time in every run.
const t0 = Date.now();
performance.now = (): number => Date.now() - t0;
window.requestAnimationFrame = (cb: FrameRequestCallback): number => window.setTimeout(() => cb(performance.now()), 16);
export {};
