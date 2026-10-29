// Share / import panel for the deck builder: a plain DOM overlay (a canvas can't take a paste or open a file
// picker). It shows the spell deck's share code to copy (src/game/deckCode.ts), offers the deck as YAML to copy
// or download, and imports a pasted code, pasted YAML or a .yaml file, refusing anything that breaks the deck
// rules. A gamepad can't type, but A copies the code and B closes (the builder passes those presses on).
import { exportYaml, importYaml, type SpellDeck } from '../game/deckYaml';
import { decodeDeckCode, encodeDeckCode, hasDeckCode } from '../game/deckCode';

const CSS = `
.svs-yaml { position: fixed; inset: 0; z-index: 40; display: flex; align-items: center; justify-content: center; background: rgba(40,20,0,.6); }
.svs-yaml .box { width: min(560px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow-y: auto; display: flex; flex-direction: column; gap: 8px;
  background: #fcd8a8; color: #503000; border: 3px solid #503000; box-shadow: 0 0 0 3px #ac7c00; padding: 12px;
  font: 13px/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; box-sizing: border-box; }
.svs-yaml h2 { margin: 0; font-size: 14px; letter-spacing: .06em; color: #881400; }
.svs-yaml .sec { display: flex; flex-direction: column; gap: 8px; flex: 1 1 0; min-width: 0; }
.svs-yaml .sec + .sec { border-top: 2px solid #ac7c00; padding-top: 8px; }
.svs-yaml p { margin: 0; }
.svs-yaml .code { background: #fff4e0; color: #301800; border: 2px solid #ac7c00; padding: 8px; font-size: 14px; font-weight: bold;
  word-break: break-all; user-select: all; -webkit-user-select: all; }
.svs-yaml textarea { flex: 1 0 auto; min-height: 120px; width: 100%; box-sizing: border-box; resize: vertical; font: inherit; font-size: 12px;
  background: #fff4e0; color: #301800; border: 2px solid #ac7c00; padding: 6px; }
.svs-yaml.only textarea { min-height: 200px; }
.svs-yaml .row { display: flex; flex-wrap: wrap; gap: 6px; }
.svs-yaml button { font: inherit; cursor: pointer; background: #fff4e0; color: #503000; border: 2px solid #503000; padding: 6px 10px; min-height: 36px; }
.svs-yaml button.main { background: #881400; color: #fcfcfc; border-color: #501000; }
.svs-yaml .msg { min-height: 18px; font-weight: bold; }
.svs-yaml .bad { color: #a81000; }
.svs-yaml .good { color: #007800; }
.svs-yaml .pad { color: #7c5800; font-size: 12px; }
/* phones on their side: sharing and importing side by side */
@media (max-height: 480px) {
  .svs-yaml .box { max-height: calc(100vh - 12px); padding: 8px; gap: 6px; }
  .svs-yaml textarea, .svs-yaml.only textarea { min-height: 70px; }
  .svs-yaml:not(.only) .box { width: min(900px, calc(100vw - 24px)); flex-direction: row; gap: 12px; }
  .svs-yaml:not(.only) .sec + .sec { border-top: 0; padding-top: 0; border-left: 2px solid #ac7c00; padding-left: 12px; }
}
`;

export interface DeckPanelOpts {
  /** The spell deck to share; without one the panel only imports. */
  current?: SpellDeck;
  /** Called with a legal imported spell deck; the panel closes after. */
  onImport: (g: SpellDeck) => void;
  onClose: () => void;
  /** Opened from a gamepad: say what its buttons do. */
  pad?: boolean;
}

export interface DeckPanel { close: () => void; copyCode: () => void }

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...kids: Array<Node | string>): HTMLElementTagNameMap[K] => {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids);
  return e;
};

/** Puts text on the clipboard: the async API, else the old select-and-copy (some Android web views). */
function copyText(s: string, scratch: HTMLTextAreaElement): Promise<boolean> {
  const old = (): boolean => {
    const keep = scratch.value;
    scratch.value = s; scratch.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    if (ok) scratch.value = keep;
    return ok;
  };
  if (!navigator.clipboard?.writeText) return Promise.resolve(old());
  return navigator.clipboard.writeText(s).then(() => true, () => old());
}

/** Opens the panel. */
export function openDeckPanel(o: DeckPanelOpts): DeckPanel {
  if (!document.getElementById('svs-yaml-css')) document.head.append(el('style', { id: 'svs-yaml-css', textContent: CSS }));
  const cur = o.current, code = cur ? encodeDeckCode(cur) : '', yaml = cur ? exportYaml(cur) : '';
  const text = el('textarea', { spellcheck: false, placeholder: 'Paste a spell deck code (SVS1-...) or YAML here' });
  text.setAttribute('autocapitalize', 'off'); text.setAttribute('autocorrect', 'off');
  const msg = el('p', { className: 'msg' });
  const say = (s: string, good = false): void => { msg.textContent = s; msg.className = `msg ${good ? 'good' : 'bad'}`; };
  const file = el('input', { type: 'file', accept: '.yaml,.yml,.txt,text/yaml,text/plain' });
  file.style.display = 'none';

  const tryImport = (src: string): void => {
    if (!src.trim()) { say('Paste a spell deck code or YAML first.'); return; }
    const r = hasDeckCode(src) ? decodeDeckCode(src) : importYaml(src);
    if (!r.ok) { say(`Not imported: ${r.error.toLowerCase()}.`); return; }
    close();
    o.onImport(r.spellDeck);
  };
  file.addEventListener('change', () => {
    const f = file.files?.[0];
    if (!f) return;
    if (f.size > 20000) { say('Not imported: that file is too big for a spell deck.'); return; }
    void f.text().then(t => { text.value = t; tryImport(t); });
  });

  const copyCode = (): void => {
    if (!code) return;
    void copyText(code, text).then(ok => say(ok ? 'Code copied. Paste it to a friend.' : 'Select the code above and copy it.', true));
  };
  const copyCodeBtn = el('button', { textContent: 'Copy code', className: 'main' });
  copyCodeBtn.onclick = copyCode;
  const copyYaml = el('button', { textContent: 'Copy YAML' });
  copyYaml.onclick = () => {
    void copyText(yaml, text).then(ok => { if (!ok) { text.value = yaml; text.select(); } say(ok ? 'YAML copied to the clipboard.' : 'Select the text and copy it.', true); });
  };
  const download = el('button', { textContent: 'Download .yaml' });
  download.onclick = () => {
    const a = el('a', { href: URL.createObjectURL(new Blob([yaml], { type: 'text/yaml' })), download: `${(cur?.name ?? cur?.cls ?? 'spell-deck').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.yaml` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const fromFile = el('button', { textContent: 'Import file...' });
  fromFile.onclick = () => file.click();
  // reading the clipboard needs permission some web views never give: then a long-press paste into the box works
  const paste = el('button', { textContent: 'Paste and import' });
  paste.onclick = () => {
    const no = (): void => { text.focus(); say('Long-press (or right-click) the box, paste, then press Import.'); };
    if (!navigator.clipboard?.readText) { no(); return; }
    navigator.clipboard.readText().then(t => { if (!t.trim()) { no(); return; } text.value = t; tryImport(t); }, no);
  };
  const pasted = el('button', { textContent: 'Import', className: cur ? '' : 'main' });
  pasted.onclick = () => tryImport(text.value);
  const cancel = el('button', { textContent: 'Close' });

  const share = cur ? [el('div', { className: 'sec' },
    el('h2', { textContent: `SHARE ${(cur.name ?? 'SPELL DECK').toUpperCase()}` }),
    el('p', { textContent: 'Send this code to a friend. They paste it under IMPORT to get their own copy.' }),
    el('div', { className: 'code', textContent: code }),
    el('div', { className: 'row' }, copyCodeBtn, copyYaml, download),
    ...(o.pad ? [el('p', { className: 'pad', textContent: 'Gamepad: A copies the code, B closes.' })] : []))] : [];
  const root = el('div', { className: `svs-yaml${cur ? '' : ' only'}` },
    el('div', { className: 'box' },
      ...share,
      el('div', { className: 'sec' },
        el('h2', { textContent: 'IMPORT A SPELL DECK' }),
        el('p', { textContent: 'Paste a friend\'s code or YAML, or pick a .yaml file. It comes in as a new spell deck; one that breaks a deck rule is refused.' }),
        text, msg,
        el('div', { className: 'row' }, paste, pasted, fromFile, cancel, file),
        ...(o.pad && !cur ? [el('p', { className: 'pad', textContent: 'Gamepad: B closes.' })] : []))));
  // keep game keys and clicks from reaching the game while the panel is open (releases still pass, so nothing sticks down)
  for (const ev of ['keydown', 'pointerdown', 'mousedown', 'click', 'wheel', 'touchstart', 'contextmenu'] as const) {
    root.addEventListener(ev, e => e.stopPropagation());
  }
  root.addEventListener('pointerdown', e => { if (e.target === root) close(); });
  const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  root.addEventListener('keydown', onKey);

  let open = true;
  function close(): void {
    if (!open) return;
    open = false;
    root.remove();
    o.onClose();
  }
  cancel.onclick = close;
  document.body.append(root);
  // a phone's keyboard would cover the panel, so only a desktop gets the cursor in the box (or on Copy code)
  if (!matchMedia('(pointer: coarse)').matches) (cur ? copyCodeBtn : text).focus();
  return { close, copyCode };
}
