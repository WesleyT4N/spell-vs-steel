// Expedition packs: only the last monster's K.O. slows the fight down; earlier kills do not.
import { newRun, makeFight } from '../src/game/expedition';
import { defaultSkin } from '../src/art/sprites';

let fails = 0;
const check = (ok: boolean, msg: string): void => { if (!ok) { fails++; console.log(`FAIL ${msg}`); } };

const run = newRun('warrior', defaultSkin('warrior'), 1);
const b = makeFight(run, ['wolf', 'wolf', 'stumpkin'], 7);
const [a, c, d] = b.mobs;
const kill = (m: typeof a): void => { b.slowmo = 0; b.damage(m, m.hp + 10, b.f[0], { spell: true }); };

kill(a);
check(b.slowmo === 0, `first of three monsters K.O.'d: slow-mo ${b.slowmo}, expected none`);
kill(c);
check(b.slowmo === 0, `second of three monsters K.O.'d: slow-mo ${b.slowmo}, expected none`);
kill(d);
check(b.slowmo > 0, 'last monster K.O.\'d: expected slow-mo');

// a single-monster fight (a boss) still gets it
const solo = makeFight(newRun('mage', defaultSkin('mage'), 2), ['wolf'], 3);
solo.damage(solo.mobs[0], solo.mobs[0].hp + 10, solo.f[0], { spell: true });
check(solo.slowmo > 0, 'lone monster K.O.\'d: expected slow-mo');

if (fails) { console.log(`${fails} pack K.O. checks failed`); process.exit(1); }
console.log('pack K.O. slow-mo: ok');
