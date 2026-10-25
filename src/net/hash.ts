// A checksum of everything the rules care about, compared between the two machines to catch desyncs.
import type { Battle } from '../game/battle';

export function battleHash(b: Battle): number {
  const parts: Array<string | number> = [b.phase, b.turn, b.gauge, b.rand.state(), b.winner ?? -1];
  for (const f of b.f) {
    parts.push(f.hp, f.col, f.row, f.res, f.resMax, f.lock, f.moveCd, f.charge, f.charging ? 1 : 0, f.deck.join(), f.queue.join(), f.discard.length);
    for (const v of Object.values(f.st)) parts.push(v);
    for (const s of f.shields) parts.push(s.kind, s.hp, s.t);
  }
  for (const col of b.panels) for (const p of col) parts.push(p.owner, p.ownerT, p.burn, p.hole, p.cracked ? 1 : 0);
  for (const w of b.walls) parts.push(w.col, w.row, w.hp, w.t);
  for (const p of b.projectiles) parts.push(p.kind, p.row, p.x);
  parts.push(b.timers.length);
  // FNV-1a over the text
  const s = parts.join('|');
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
