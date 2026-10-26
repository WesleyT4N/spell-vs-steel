// Runs a grid plan in the browser: on web workers (one per core) when the page allows them,
// otherwise in slices on the main thread so the page stays responsive.
import SimWorker from './simWorker?worker&inline';
import { runJob, type GridJob, type GridJobResult, type GridPlan } from './grid';
import { overrides } from './tuningEdit';
import { withoutSfx } from '../engine/audio';

export interface GridRun {
  results: Array<GridJobResult | undefined>;
  done: number;
  total: number;
  /** 'workers (n)' or 'main thread'. */
  how: string;
  stop: () => void;
  finished: Promise<void>;
}

export function runGrid(plan: GridPlan, onProgress: () => void): GridRun {
  const ov = overrides();
  const queue = plan.jobs.slice();
  const run: GridRun = { results: [], done: 0, total: queue.length, how: '', stop: () => {}, finished: Promise.resolve() };
  let workers: Worker[] = [];
  try {
    const n = Math.max(1, Math.min(8, (navigator.hardwareConcurrency || 2) - 1));
    for (let i = 0; i < n; i++) workers.push(new SimWorker());
  } catch {
    for (const w of workers) w.terminate();
    workers = [];
  }
  run.finished = new Promise<void>(resolve => {
    const end = (): void => { for (const w of workers) w.terminate(); resolve(); };
    if (!queue.length) { end(); return; }
    let stopped = false;
    run.stop = () => { stopped = true; queue.length = 0; end(); };
    if (workers.length) {
      run.how = `${workers.length} workers`;
      let fellBack = false;
      const feed = (w: Worker): void => {
        const job = queue.shift();
        if (job) w.postMessage({ ov, job });
      };
      for (const w of workers) {
        w.onmessage = (e: MessageEvent<GridJobResult>) => {
          run.results[e.data.i] = e.data;
          run.done++;
          onProgress();
          if (run.done === run.total) end(); else feed(w);
        };
        // a page that blocks workers fails here; finish what is left on the main thread
        w.onerror = () => {
          if (fellBack || stopped) return;
          fellBack = true;
          for (const x of workers) x.terminate();
          queue.splice(0, queue.length, ...plan.jobs.filter(j => !run.results[j.i]));
          workers = [];
          run.how = 'main thread';
          mainThread(queue, run, onProgress, () => stopped, resolve);
        };
        feed(w);
      }
    } else {
      run.how = 'main thread';
      mainThread(queue, run, onProgress, () => stopped, resolve);
    }
  });
  return run;
}

function mainThread(queue: GridJob[], run: GridRun, onProgress: () => void, stopped: () => boolean, resolve: () => void): void {
  const step = (): void => {
    if (stopped()) return;
    const end = performance.now() + 14;
    withoutSfx(() => {
      while (queue.length && performance.now() < end) {
        const job = queue.shift()!;
        run.results[job.i] = runJob(job);
        run.done++;
      }
    });
    onProgress();
    if (queue.length) setTimeout(step, 0); else resolve();
  };
  step();
}
