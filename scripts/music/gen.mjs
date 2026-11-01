// Render the soundtrack (songs.mjs) with the MuseScore General soundfont into assets/audio/music/ (<id>.mp3 plus the
// loop points in tracks.json).
// Setup (once): cd scripts/music && npm install    (needs ffmpeg with libmp3lame on PATH)
// Run: node gen.mjs [track ...]
import fs from 'node:fs';
import { renderLoop } from './lib.mjs';
import { STAGES, menu, victory } from './songs.mjs';

const here = new URL('.', import.meta.url).pathname;
const outDir = here + '../../assets/audio/music';
fs.mkdirSync(outDir, { recursive: true });
const songs = { menu, victory, ...Object.fromEntries(Object.entries(STAGES).map(([k, f]) => [`stage_${k}`, f])) };
const only = process.argv.slice(2);
const meta = {};
const tracksFile = `${outDir}/tracks.json`;
const old = fs.existsSync(tracksFile) ? JSON.parse(fs.readFileSync(tracksFile, 'utf8')) : {};
for (const [id, f] of Object.entries(songs)) {
  const file = `${outDir}/${id}.mp3`;
  if (only.length && !only.includes(id) && old[id] && fs.existsSync(file)) { meta[id] = old[id]; continue; }
  const r = await renderLoop(f(), file, { bitrate: '48k' });
  meta[id] = { loopStart: +r.loopStart.toFixed(5), loopEnd: +r.loopEnd.toFixed(5) };
  console.log(id.padEnd(18), `${(r.bytes / 1024).toFixed(0)} KB`, `${r.dur.toFixed(1)}s`, `loop ${r.loopStart.toFixed(2)}-${r.loopEnd.toFixed(2)}`);
}
fs.writeFileSync(tracksFile, JSON.stringify(meta, null, 2) + '\n');
