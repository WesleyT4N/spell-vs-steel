// Ranked sanity checks: queue pairing is symmetric, deterministic and within the allowed gap, two
// players always get the same room code, and Elo moves the way it should. Usage: npx tsx scripts/ranked-check.ts
import { pairUp, matchCode, searchGap, type QueueEntry } from '../src/net/matchmaking';
import { applyResult, eloDelta, blankRating } from '../src/net/rating';

let bad = 0;
const check = (ok: boolean, what: string): void => { if (!ok) { bad++; console.log(`FAIL: ${what}`); } };

for (let trial = 0; trial < 500; trial++) {
  const now = 1_000_000;
  const list: QueueEntry[] = Array.from({ length: 1 + (trial % 12) }, (_, i) => ({
    v: 1, id: `p${trial}-${i}-${Math.random().toString(36).slice(2, 6)}`, rating: 700 + Math.round(Math.random() * 800), since: now - Math.round(Math.random() * 40000), want: null,
  }));
  const pairs = pairUp(list, now);
  // the same answer from any order: every searcher computes it from their own view
  const again = pairUp([...list].reverse(), now);
  check([...pairs].every(([a, b]) => again.get(a) === b), 'pairing depends on list order');
  for (const [a, b] of pairs) {
    check(pairs.get(b) === a, 'pairing not symmetric');
    const ea = list.find(e => e.id === a)!, eb = list.find(e => e.id === b)!;
    check(Math.abs(ea.rating - eb.rating) <= Math.max(searchGap(now - ea.since), searchGap(now - eb.since)), 'pair outside the gap');
    check(matchCode(a, b) === matchCode(b, a) && matchCode(a, b).length === 5, 'room codes disagree');
  }
}
const r = blankRating();
check(eloDelta(r, 1000, true) === 20 && eloDelta(r, 1000, false) === -20, 'even match should swing 20 for a new player');
check(eloDelta(r, 1400, true) > eloDelta(r, 600, true), 'beating a stronger player should be worth more');
const after = applyResult(r, 1000, true);
check(after.games === 1 && after.wins === 1 && after.rating === 1020, 'win not recorded');
const settled = { rating: 1000, games: 30, wins: 15, losses: 15 };
check(eloDelta(settled, 1000, true) === 12, 'settled players swing less');
console.log(bad ? `${bad} failure(s)` : 'ranked checks pass');
process.exit(bad ? 1 : 0);
