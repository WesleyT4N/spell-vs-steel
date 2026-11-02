// Import panel for the MODS screen: a plain DOM overlay (a canvas can't open a file picker). The player picks a mod
// file (a .zip of mod.json and its PNGs, or an older .json mod); it goes through the same checks as every mod
// (src/mods/format.ts) and a file that fails them is refused with the reason. A gamepad can't pick a file, so B closes it.
import { importMod, type ModEntry } from '../mods';
import { MAX_MOD_SIZE } from '../mods/format';

const CSS = `
.svs-mod { position: fixed; inset: 0; z-index: 40; display: flex; align-items: center; justify-content: center; background: rgba(40,20,0,.6); }
.svs-mod .box { width: min(520px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow-y: auto; display: flex; flex-direction: column; gap: 8px;
  background: #fcd8a8; color: #503000; border: 3px solid #503000; box-shadow: 0 0 0 3px #ac7c00; padding: 12px;
  font: 13px/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; box-sizing: border-box; }
.svs-mod h2 { margin: 0; font-size: 14px; letter-spacing: .06em; color: #881400; }
.svs-mod p { margin: 0; }
.svs-mod .row { display: flex; flex-wrap: wrap; gap: 6px; }
.svs-mod button { font: inherit; cursor: pointer; background: #fff4e0; color: #503000; border: 2px solid #503000; padding: 6px 10px; min-height: 36px; }
.svs-mod button.main { background: #881400; color: #fcfcfc; border-color: #501000; }
.svs-mod .msg { min-height: 18px; font-weight: bold; }
.svs-mod .bad { color: #a81000; }
.svs-mod .pad { color: #7c5800; font-size: 12px; }
@media (max-height: 480px) { .svs-mod .box { max-height: calc(100vh - 12px); padding: 8px; gap: 6px; } }
`;

export interface ModPanelOpts {
  /** Called with the mod that came in; the panel closes after. */
  onImport: (e: ModEntry) => void;
  onClose: () => void;
  /** Opened from a gamepad: say what its buttons do. */
  pad?: boolean;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...kids: Array<Node | string>): HTMLElementTagNameMap[K] => {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids);
  return e;
};

/** Opens the panel. Returns its close function. */
export function openModPanel(o: ModPanelOpts): () => void {
  if (!document.getElementById('svs-mod-css')) document.head.append(el('style', { id: 'svs-mod-css', textContent: CSS }));
  const msg = el('p', { className: 'msg bad' });
  const say = (s: string): void => { msg.textContent = s; };

  const tryImport = async (bytes: Uint8Array): Promise<void> => {
    say('Checking the mod...');
    const r = await importMod(bytes);
    if (!open) return;
    if (!r.ok) { say(`Not imported: ${r.error}.`); return; }
    close();
    o.onImport(r.entry);
  };

  // the file picker: the browser's own, which the desktop and Android builds also open
  const file = el('input', { type: 'file', accept: '.zip,application/zip,.json,application/json' });
  file.style.display = 'none';
  file.onchange = () => {
    const f = file.files?.[0];
    file.value = '';
    if (!f) return;
    if (f.size > MAX_MOD_SIZE) { say(`Not imported: the file is larger than ${MAX_MOD_SIZE / 1024} KB.`); return; }
    void f.arrayBuffer().then(b => tryImport(new Uint8Array(b)), () => say('That file could not be read.'));
  };
  const pick = el('button', { textContent: 'Choose a mod file', className: 'main' });
  pick.onclick = () => file.click();
  const cancel = el('button', { textContent: 'Close' });

  const root = el('div', { className: 'svs-mod' },
    el('div', { className: 'box' },
      el('h2', { textContent: 'IMPORT A MOD' }),
      el('p', { textContent: 'A mod is a .zip of plain data (a mod.json, PNG images and MP3 voice lines): it adds skins and their voices and never runs code. A file that breaks the mod rules is refused.' }),
      el('div', { className: 'row' }, pick, cancel), file,
      msg,
      ...(o.pad ? [el('p', { className: 'pad', textContent: 'Gamepad: picking a file needs a mouse or touch. B closes.' })] : [])));
  // keep game keys and clicks from reaching the game while the panel is open
  for (const ev of ['keydown', 'pointerdown', 'mousedown', 'click', 'wheel', 'touchstart', 'contextmenu'] as const) {
    root.addEventListener(ev, e => e.stopPropagation());
  }
  root.addEventListener('pointerdown', e => { if (e.target === root) close(); });
  root.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });

  let open = true;
  function close(): void {
    if (!open) return;
    open = false;
    root.remove();
    o.onClose();
  }
  cancel.onclick = close;
  document.body.append(root);
  if (!matchMedia('(pointer: coarse)').matches) pick.focus();
  return close;
}
