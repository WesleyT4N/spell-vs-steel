// Balance scripts: plain-text edits to class and card numbers for the dev tools, one per line.
//   hp.mage = 7000             any TUNING number, by its dotted path (see the Tuning list in the lab)
//   warrior.heavyDamage *= 1.1 also +=, -= and *= (relative to the shipped number)
//   fireball.power = 110%      a card's damage multiplier (110% or 1.1)
//   fireball.cost = 2          a card's resource cost
//   mage.power = 90%           every card of a class
//   # comment
// A script always starts from the shipped numbers, so running it twice gives the same result.
import { CARDS, ALL_CARDS } from '../game/cards';
import { defaultCost, defaultTuning, tuningPaths, type Overrides } from './tuningEdit';

export interface ScriptResult { overrides: Overrides; errors: string[]; lines: number }

const OPS = ['+=', '-=', '*=', '='] as const;

export function parseScript(text: string): ScriptResult {
  const o: Overrides = { tuning: {}, cardPower: {}, cardCost: {} };
  const errors: string[] = [];
  const paths = new Set(tuningPaths());
  const classes = new Set(ALL_CARDS.map(c => c.cls as string));
  let lines = 0;
  text.split('\n').forEach((raw, i) => {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) return;
    const err = (m: string): void => { errors.push(`line ${i + 1}: ${m}`); };
    const op = OPS.find(x => line.includes(x));
    if (!op) return err('expected "name = value"');
    const [lhs, rhs] = [line.slice(0, line.indexOf(op)).trim(), line.slice(line.indexOf(op) + op.length).trim()];
    const pctVal = rhs.endsWith('%');
    const v = Number(pctVal ? rhs.slice(0, -1) : rhs) / (pctVal ? 100 : 1);
    if (!Number.isFinite(v)) return err(`"${rhs}" is not a number`);
    const apply = (base: number): number => (op === '=' ? v : op === '+=' ? base + v : op === '-=' ? base - v : base * v);
    lines++;
    if (paths.has(lhs)) { o.tuning[lhs] = apply(defaultTuning(lhs)); return; }
    const dot = lhs.lastIndexOf('.');
    const [who, field] = [lhs.slice(0, dot), lhs.slice(dot + 1)];
    const ids = CARDS[who] ? [who] : classes.has(who) ? ALL_CARDS.filter(c => c.cls === who).map(c => c.id) : [];
    if (!ids.length) { lines--; return err(`unknown name "${lhs}" (not a tuning path, card id or class)`); }
    if (field === 'power') { for (const id of ids) o.cardPower[id] = apply(o.cardPower[id] ?? 1); return; }
    if (field === 'cost') {
      for (const id of ids) {
        const base = defaultCost(id);
        if (base === 'all') { err(`${id} spends all its resource, its cost cannot change`); continue; }
        o.cardCost![id] = Math.max(0, Math.round(apply(o.cardCost![id] ?? base)));
      }
      return;
    }
    lines--;
    err(`"${field}" is not a card field (use power or cost)`);
  });
  return { overrides: o, errors, lines };
}

/** The script that reproduces a set of overrides. */
export function toScript(o: Overrides): string {
  const out: string[] = [];
  for (const [p, v] of Object.entries(o.tuning)) out.push(`${p} = ${v}`);
  for (const [id, v] of Object.entries(o.cardPower)) out.push(`${id}.power = ${Math.round(v * 1000) / 10}%`);
  for (const [id, v] of Object.entries(o.cardCost ?? {})) out.push(`${id}.cost = ${v}`);
  return out.join('\n');
}
