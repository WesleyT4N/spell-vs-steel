// Web worker for the balance lab's grid: runs one deck pair at a time with the lab's current overrides.
import { runJob, type GridJob } from './grid';
import { replaceOverrides, type Overrides } from './tuningEdit';

self.onmessage = (e: MessageEvent<{ ov: Overrides; job: GridJob }>) => {
  replaceOverrides(e.data.ov);
  self.postMessage(runJob(e.data.job));
};
