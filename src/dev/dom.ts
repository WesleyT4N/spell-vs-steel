// Tiny DOM toolkit for the dev tools (sandbox panel, balance lab). Plain elements, NES palette.

const CSS = `
.dev { font: 12px/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: #fcfcfc; }
.dev * { box-sizing: border-box; }
.dev h2 { font-size: 13px; margin: 14px 0 6px; color: #f8b800; letter-spacing: .06em; text-transform: uppercase; }
.dev h2:first-child { margin-top: 0; }
.dev h3 { font-size: 12px; margin: 10px 0 4px; color: #bcbcbc; text-transform: uppercase; }
.dev button, .dev select, .dev input { font: inherit; color: #fcfcfc; background: #000; border: 1px solid #7c7c7c; padding: 2px 6px; border-radius: 0; }
.dev button { cursor: pointer; }
.dev button:hover { border-color: #fcfcfc; background: #0000a8; }
.dev button.on { background: #0000a8; border-color: #f8b800; color: #f8b800; }
.dev button.primary { border-color: #f8b800; color: #f8b800; }
.dev button:disabled { opacity: .4; cursor: default; }
.dev input[type=number] { width: 72px; }
.dev input.mod, .dev select.mod { border-color: #f8b800; color: #f8b800; }
.dev .row { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; margin: 3px 0; }
.dev .muted { color: #7c7c7c; }
.dev .warn { color: #f8b800; }
.dev .bad { color: #f83800; }
.dev .good { color: #58d854; }
.dev table { border-collapse: collapse; width: 100%; }
.dev th, .dev td { padding: 2px 6px; text-align: right; border-bottom: 1px solid #222; white-space: nowrap; }
.dev th { color: #bcbcbc; font-weight: normal; position: sticky; top: 0; background: #000; cursor: pointer; }
.dev th:first-child, .dev td:first-child { text-align: left; }
.dev .bar { height: 10px; background: #3c3c3c; position: relative; }
.dev .bar > div { position: absolute; top: 0; bottom: 0; left: 0; }
.dev .chip { display: inline-block; padding: 0 4px; border: 1px solid currentColor; margin: 1px 2px 1px 0; }
.dev label { display: inline-flex; gap: 4px; align-items: center; cursor: pointer; }
.dev-badge { position: fixed; left: 8px; bottom: 8px; z-index: 30; padding: 3px 8px; background: #000; border: 1px solid #f8b800; color: #f8b800; font: 11px ui-monospace, monospace; pointer-events: none; }
`;

let styled = false;
function style(): void {
  if (styled) return;
  styled = true;
  const s = document.createElement('style');
  s.textContent = CSS;
  document.head.appendChild(s);
}

type Attrs = Record<string, string | number | boolean | ((e: Event) => void) | undefined>;
type Child = Node | string | number | null | undefined | false;

/** Create an element: h('div', { class: 'row', onclick: fn }, 'text', child). */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...kids: Child[]): HTMLElementTagNameMap[K] {
  style();
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (typeof v === 'function') el.addEventListener(k.replace(/^on/, ''), v);
    else if (k === 'class') el.className = String(v);
    else if (k === 'style') el.style.cssText = String(v);
    else if (k === 'value' && 'value' in el) (el as HTMLInputElement).value = String(v);
    else if (k === 'checked' && 'checked' in el) (el as HTMLInputElement).checked = !!v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of kids) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

/** A button that never takes keyboard focus, so Space and J keep going to the game. */
export function btn(label: string, onclick: () => void, cls = ''): HTMLButtonElement {
  const b = h('button', { class: cls, tabindex: -1, onmousedown: (e: Event) => e.preventDefault(), onclick: () => onclick() }, label);
  return b;
}

/** A row of mutually exclusive buttons. Returns a setter that relights the chosen one. */
export function choice<T extends string | number>(opts: Array<[T, string]>, value: T, onPick: (v: T) => void): { el: HTMLElement; set: (v: T) => void } {
  const el = h('div', { class: 'row' });
  const bs = opts.map(([v, label]) => {
    const b = btn(label, () => { set(v); onPick(v); });
    el.append(b);
    return [v, b] as const;
  });
  const set = (v: T): void => { for (const [k, b] of bs) b.classList.toggle('on', k === v); };
  set(value);
  return { el, set };
}

export function check(label: string, value: boolean, onChange: (v: boolean) => void): HTMLLabelElement {
  const box = h('input', { type: 'checkbox', tabindex: -1, checked: value });
  box.addEventListener('change', () => { onChange(box.checked); box.blur(); });
  return h('label', {}, box, label);
}

/** Space kept free on the right of the window (the canvas scales to the rest). */
export function reserveRight(px: number): void {
  document.body.style.paddingRight = px ? `${px}px` : '';
  document.body.dataset.reserveRight = String(px);
  window.dispatchEvent(new Event('resize'));
}

/** Corner badge shown while any tuning override is live. */
let badge: HTMLElement | null = null;
export function setBadge(text: string | null): void {
  if (!text) { badge?.remove(); badge = null; return; }
  style();
  if (!badge) { badge = h('div', { class: 'dev-badge' }); document.body.append(badge); }
  badge.textContent = text;
}
