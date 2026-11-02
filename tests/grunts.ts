// Attack grunts: only heavies grunt, and each fighter grunts at most once per GRUNT_GAP.
import { readFileSync } from 'node:fs';
import { GRUNT_GAP, gruntGate } from '../src/engine/gruntGate';

const fail: string[] = [];
const g = gruntGate();
if (!g.allow(0, 1000)) fail.push('first grunt should play');
if (g.allow(0, 1000 + GRUNT_GAP - 1)) fail.push('grunt inside the gap should be skipped');
if (!g.allow(1, 1200)) fail.push('the other fighter has its own gap');
if (!g.allow(0, 1000 + GRUNT_GAP)) fail.push('grunt after the gap should play');
g.reset();
if (!g.allow(0, 1001 + GRUNT_GAP)) fail.push('reset clears the gap');

// light attacks never ask for a grunt
const battle = readFileSync(new URL('../src/game/battle.ts', import.meta.url), 'utf8');
const basic = /basicAttack\([^)]*\): void \{([\s\S]*?)\n  \}/.exec(battle)?.[1] ?? '';
if (!/if \(kind === 'heavy'\) this\.voice\(f, 'grunt'\)/.test(basic)) fail.push('basicAttack should grunt on heavies only');

if (fail.length) { console.error(fail.join('\n')); process.exit(1); }
console.log('grunts: ok');
