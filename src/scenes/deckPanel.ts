// Import / export panel for the deck builder: a plain DOM overlay (a canvas can't take a paste or open a
// file picker). It shows the current spell deck as YAML to copy or download, and imports pasted text or a
// .yaml file, refusing anything that breaks the deck rules.
import { exportYaml, importYaml, type SpellDeck } from '../game/deckYaml';

const CSS = `
.svs-yaml { position: fixed; inset: 0; z-index: 40; display: flex; align-items: center; justify-content: center; background: rgba(40,20,0,.6); }
.svs-yaml .box { width: min(560px, calc(100vw - 32px)); max-height: calc(100vh - 32px); display: flex; flex-direction: column; gap: 8px;
  background: #fcd8a8; color: #503000; border: 3px solid #503000; box-shadow: 0 0 0 3px #ac7c00; padding: 12px;
  font: 13px/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; box-sizing: border-box; }
.svs-yaml h2 { margin: 0; font-size: 14px; letter-spacing: .06em; color: #881400; }
.svs-yaml p { margin: 0; }
.svs-yaml textarea { flex: 1; min-height: 220px; width: 100%; box-sizing: border-box; resize: vertical; font: inherit; font-size: 12px;
  background: #fff4e0; color: #301800; border: 2px solid #ac7c00; padding: 6px; }
.svs-yaml .row { display: flex; flex-wrap: wrap; gap: 6px; }
.svs-yaml button { font: inherit; cursor: pointer; background: #fff4e0; color: #503000; border: 2px solid #503000; padding: 6px 10px; }
.svs-yaml button.main { background: #881400; color: #fcfcfc; border-color: #501000; }
.svs-yaml .msg { min-height: 18px; font-weight: bold; }
.svs-yaml .bad { color: #a81000; }
.svs-yaml .good { color: #007800; }
`;

export interface DeckPanelOpts {
  /** The spell deck to show for export. */
  current: SpellDeck;
  /** Called with a legal imported spell deck; the panel closes after. */
  onImport: (g: SpellDeck) => void;
  onClose: () => void;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...kids: Array<Node | string>): HTMLElementTagNameMap[K] => {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids);
  return e;
};

/** Opens the panel; returns a function that closes it. */
export function openDeckPanel(o: DeckPanelOpts): () => void {
  if (!document.getElementById('svs-yaml-css')) document.head.append(el('style', { id: 'svs-yaml-css', textContent: CSS }));
  const yaml = exportYaml(o.current);
  const text = el('textarea', { value: yaml, spellcheck: false });
  const msg = el('p', { className: 'msg' });
  const say = (s: string, good = false): void => { msg.textContent = s; msg.className = `msg ${good ? 'good' : 'bad'}`; };
  const file = el('input', { type: 'file', accept: '.yaml,.yml,.txt,text/yaml,text/plain' });
  file.style.display = 'none';

  const tryImport = (src: string): void => {
    const r = importYaml(src);
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

  const copy = el('button', { textContent: 'Copy' });
  copy.onclick = () => {
    text.value = yaml;
    const done = (): void => say('Copied to the clipboard.', true);
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(yaml).then(done, () => { text.select(); say('Select the text and copy it.', true); });
    else { text.select(); say('Select the text and copy it.', true); }
  };
  const download = el('button', { textContent: 'Download .yaml' });
  download.onclick = () => {
    const a = el('a', { href: URL.createObjectURL(new Blob([yaml], { type: 'text/yaml' })), download: `${(o.current.name ?? o.current.cls).toLowerCase().replace(/[^a-z0-9]+/g, '-')}.yaml` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const fromFile = el('button', { textContent: 'Import file...' });
  fromFile.onclick = () => file.click();
  const pasted = el('button', { textContent: 'Import pasted text', className: 'main' });
  pasted.onclick = () => tryImport(text.value);
  const cancel = el('button', { textContent: 'Close' });

  const root = el('div', { className: 'svs-yaml' },
    el('div', { className: 'box' },
      el('h2', { textContent: 'SPELL DECK AS YAML' }),
      el('p', { textContent: 'Copy or download this spell deck, or paste one (or pick a .yaml file) to import it. Importing replaces your saved spell deck for that class; imports that break a deck rule are refused.' }),
      text, msg,
      el('div', { className: 'row' }, copy, download, fromFile, pasted, cancel, file)));
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
  text.focus();
  return close;
}
