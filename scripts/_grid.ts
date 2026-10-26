import { runSeries, starterSpec } from '../src/dev/simulate';
import { TUNING } from '../src/game/tuning';
import type { ClassId } from '../src/art/sprites';
import { CARDS } from '../src/game/cards';
const scale = (cls: string, k: number) => { for (const c of Object.values(CARDS)) if (c.cls === cls && c.damaging) { const o = c.cast; c.cast = x => o({ ...x, mult: x.mult * k }); } };
const [a, b, nS, ...set] = process.argv.slice(2);
for (const kv of set) { if (kv.startsWith('card.')) { const [k, v] = kv.slice(5).split('='); const c = CARDS[k], o = c.cast; c.cast = x => o({ ...x, mult: x.mult * Number(v) }); continue; } if (kv.startsWith('spell.')) { const [k, v] = kv.slice(6).split('='); scale(k, Number(v)); continue; } const [k, v] = kv.split('='); const path = k.split('.'); let o: any = TUNING; for (const p of path.slice(0, -1)) o = o[p]; o[path[path.length - 1]] = Number(v); }
const N = Number(nS);
const x = runSeries(starterSpec(a as ClassId), starterSpec(b as ClassId), N / 2), y = runSeries(starterSpec(b as ClassId), starterSpec(a as ClassId), N / 2);
console.log(JSON.stringify({ cfg: set.join(' '), a, b, p: Math.round(100 * (x.wins[0] + y.wins[1]) / (x.n + y.n - x.draws - y.draws)) }));
