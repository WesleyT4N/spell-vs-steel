// Turns the single-file Vite build into a page for a claude.ai artifact (which supplies its own <html>/<head>/<body>).
import { readFileSync, writeFileSync } from 'node:fs';

// usage: node scripts/artifact.mjs [outDir]   (dist by default, dist-prod for the prod build)
const dir = process.argv[2] ?? 'dist';

const html = readFileSync(`${dir}/index.html`, 'utf8');
const scripts = [...html.matchAll(/<script[^>]*>[\s\S]*?<\/script>/g)].map(m => m[0]).join('\n');
const page = `<title>Spell VS Steel</title>
<style>
  :root { color-scheme: dark; height: 100%; background: #000; }
  html, body { height: 100%; margin: 0; background: #000; color: #fcfcfc; }
  body { display: flex; align-items: center; justify-content: center; overflow: hidden; }
  canvas { image-rendering: pixelated; image-rendering: crisp-edges; display: block; outline: none; max-width: 100%; }
</style>
<canvas id="game" tabindex="0" aria-label="Spell VS Steel game screen"></canvas>
${scripts}
`;
writeFileSync(`${dir}/artifact.html`, page);
console.log(`${dir}/artifact.html ${(page.length / 1024).toFixed(1)} KB`);
