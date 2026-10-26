// Worker threads for the big balance runs (scripts/sweep.ts, scripts/tune.ts): every job carries its own
// number overrides, so one pool can run many candidate patches side by side.
import { Worker, isMainThread, parentPort } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
import { runJob, type GridJob, type GridJobResult } from '../src/dev/grid';
import { replaceOverrides, type Overrides } from '../src/dev/tuningEdit';
import { seeded } from '../src/game/rng';

/** `seed` replaces Math.random for the job, so two patches face the same dice (common random numbers). */
export interface PoolJob { job: GridJob; ov: Overrides; seed?: number }

// Workers start from plain JS that registers tsx, then load this same file.
const BOOT = `const { workerData } = require('node:worker_threads');
import('tsx/esm/api').then(m => { m.register(); return import(workerData.file); });`;

if (!isMainThread && parentPort) {
  let last = '';
  parentPort.on('message', (m: { id: number; pj: PoolJob }) => {
    const key = JSON.stringify(m.pj.ov);
    if (key !== last) { replaceOverrides(m.pj.ov); last = key; }
    if (m.pj.seed !== undefined) Math.random = seeded(m.pj.seed);
    parentPort!.postMessage({ id: m.id, r: runJob(m.pj.job) });
  });
}

/** A fixed set of worker threads; `run` takes any number of jobs and resolves with results in job order. */
export class SimPool {
  private workers: Worker[] = [];
  private idle: Worker[] = [];
  private queue: Array<{ id: number; pj: PoolJob }> = [];
  private waiting = new Map<number, (r: GridJobResult) => void>();
  private next = 0;
  done = 0;
  constructor(count = availableParallelism()) {
    for (let i = 0; i < count; i++) {
      const w = new Worker(BOOT, { eval: true, workerData: { file: import.meta.url } });
      w.on('message', (m: { id: number; r: GridJobResult }) => {
        this.done++;
        this.waiting.get(m.id)?.(m.r);
        this.waiting.delete(m.id);
        this.idle.push(w);
        this.pump();
      });
      w.on('error', e => { console.error(e); process.exit(1); });
      this.workers.push(w);
      this.idle.push(w);
    }
  }
  get size(): number { return this.workers.length; }
  run(jobs: PoolJob[]): Promise<GridJobResult[]> {
    const all = jobs.map(pj => new Promise<GridJobResult>(res => {
      const id = this.next++;
      this.waiting.set(id, res);
      this.queue.push({ id, pj });
    }));
    this.pump();
    return Promise.all(all);
  }
  private pump(): void {
    while (this.idle.length && this.queue.length) this.idle.pop()!.postMessage(this.queue.shift()!);
  }
  close(): void { for (const w of this.workers) void w.terminate(); }
}
