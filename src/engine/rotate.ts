// Phones play in landscape only: the fight's text is too small when the game gets half of an upright screen.
// The Android app is locked to landscape in its manifest. A phone browser can't be locked (iPhone Safari never
// allows it), so while a phone is held upright this covers the game with a "turn your phone" card.
let card: HTMLDivElement | null = null;
let shown = false;

function build(): HTMLDivElement {
  const d = document.createElement('div');
  d.id = 'svs-rotate';
  d.setAttribute('role', 'alert');
  d.style.cssText = 'position:fixed;inset:0;z-index:50;display:none;flex-direction:column;align-items:center;'
    + 'justify-content:center;gap:28px;background:#2a1a08;color:#fce0a8;text-align:center;padding:24px;'
    + 'font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-weight:bold;letter-spacing:0.08em;'
    + 'touch-action:none;user-select:none;-webkit-user-select:none';
  d.innerHTML = '<style>@keyframes svs-turn{0%,25%{transform:rotate(0)}55%,100%{transform:rotate(-90deg)}}</style>'
    + '<div style="width:58px;height:100px;border:6px solid #fce0a8;border-radius:12px;position:relative;'
    + 'animation:svs-turn 2.2s ease-in-out infinite alternate"><div style="position:absolute;left:50%;bottom:6px;'
    + 'width:12px;height:4px;margin-left:-6px;border-radius:2px;background:#fce0a8"></div></div>'
    + '<div style="font-size:22px;line-height:1.4">TURN YOUR PHONE<br>SIDEWAYS</div>'
    + '<div style="font-size:13px;color:#c8a878;letter-spacing:0.05em">SPELL VS STEEL PLAYS IN LANDSCAPE</div>';
  // swallow taps so nothing underneath reacts
  for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'click']) d.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); });
  document.body.appendChild(d);
  return d;
}

/** Show or hide the turn-your-phone card. Returns true when it just appeared. */
export function showRotate(on: boolean): boolean {
  if (on === shown) return false;
  shown = on;
  card ??= build();
  card.style.display = on ? 'flex' : 'none';
  return on;
}

/** Ask the browser to hold landscape (works on Android Chrome in fullscreen; ignored elsewhere). */
export function tryLockLandscape(): void {
  const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
  o?.lock?.('landscape').catch(() => {});
}
