// Tournament bracket checks: every field size from 2 to 8 players fills in byes, hands out sets, and
// crowns exactly one champion. Usage: npx tsx scripts/bracket-check.ts
import { advanceByes, nextSet, champion, type Bracket, type Size } from '../src/net/tournament';

let bad = 0;
for (const size of [4, 8] as Size[]) for (let n = 2; n <= size; n++) for (let trial = 0; trial < 50; trial++) {
  const ids = Array.from({ length: n }, (_, i) => `p${i}`);
  // seat like Tournaments.start: real players on top slots first, then bottoms
  const seats: Array<string | null> = Array(size).fill(null);
  let i = 0;
  for (let j = 0; j < size / 2 && i < n; j++) seats[2 * j] = ids[i++];
  for (let j = 0; j < size / 2 && i < n; j++) seats[2 * j + 1] = ids[i++];
  const b: Bracket = { v: 1, tid: 't', host: 'p0', size, state: 'live', players: seats, won: Array(size - 1).fill(null) };
  advanceByes(b);
  let sets = 0;
  for (let guard = 0; guard < 20 && b.state === 'live'; guard++) {
    const open = ids.map(id => nextSet(b, id)).filter(Boolean);
    if (!open.length) { bad++; console.log(`stuck: size ${size}, ${n} players`, JSON.stringify(b)); break; }
    const s = open[0]!;
    const players = ids.filter(id => nextSet(b, id)?.k === s.k);
    if (players.length !== 2) { bad++; console.log('a set without two players'); break; }
    b.won[s.k] = players[Math.random() < 0.5 ? 0 : 1];
    advanceByes(b);
    sets++;
  }
  if (!champion(b) || sets !== n - 1) { bad++; console.log(`size ${size}, ${n} players: champion ${champion(b)}, ${sets} sets played (want ${n - 1})`); }
}
console.log(bad ? `${bad} failure(s)` : 'brackets pass');
process.exit(bad ? 1 : 0);
