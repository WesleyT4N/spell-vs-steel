// Reading a mod's files without trusting them: a small zip reader and PNG decoder in plain TypeScript. Nothing in
// a mod is handed to the browser's own image or archive code; every size is capped before anything is unpacked.
// Pure (Web streams only), so tests run it in Node too.

export class FileError extends Error {}
const fail = (msg: string): never => { throw new FileError(msg); };

/** Inflate raw deflate data ('deflate-raw', zip) or zlib-wrapped data ('deflate', PNG), stopping past `max` bytes. */
async function inflate(data: Uint8Array, format: 'deflate' | 'deflate-raw', max: number): Promise<Uint8Array> {
  const ds = new DecompressionStream(format);
  const w = ds.writable.getWriter();
  void w.write(data as Uint8Array<ArrayBuffer>).then(() => w.close()).catch(() => {});
  const r = ds.readable.getReader(), parts: Uint8Array[] = [];
  let n = 0;
  try {
    for (;;) {
      const { done, value } = await r.read();
      if (done) break;
      n += value.length;
      if (n > max) { void r.cancel(); fail('a file unpacks to more than allowed'); }
      parts.push(value);
    }
  } catch (e) {
    if (e instanceof FileError) throw e;
    fail('a file is damaged (it does not unpack)');
  }
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// ---------- zip ----------
export interface ZipLimits { maxFiles: number; maxFileSize: number; maxTotal: number }

/** The files of a zip archive by name. Only stored and deflated files with plain names, at most one folder deep, are read. */
export async function unzip(bytes: Uint8Array, lim: ZipLimits): Promise<Map<string, Uint8Array>> {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (o: number): number => (o + 2 <= bytes.length ? dv.getUint16(o, true) : fail('not a zip file'));
  const u32 = (o: number): number => (o + 4 <= bytes.length ? dv.getUint32(o, true) : fail('not a zip file'));
  // end of central directory: the last 22+ bytes
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) if (u32(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) fail('not a zip file');
  const count = u16(eocd + 10);
  if (count > lim.maxFiles) fail(`more than ${lim.maxFiles} files in the zip`);
  let p = u32(eocd + 16), total = 0;
  const files = new Map<string, Uint8Array>();
  for (let k = 0; k < count; k++) {
    if (u32(p) !== 0x02014b50) fail('the zip is damaged');
    const flags = u16(p + 8), method = u16(p + 10), csize = u32(p + 20), usize = u32(p + 24);
    const nlen = u16(p + 28), xlen = u16(p + 30), clen = u16(p + 32), local = u32(p + 42);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + xlen + clen;
    // folder entries, and what macOS's zipper adds on its own
    if (name.endsWith('/') || name.startsWith('__MACOSX/') || /(^|\/)\.DS_Store$/.test(name)) continue;
    if (!/^([A-Za-z0-9][A-Za-z0-9._ -]{0,63}\/)?[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(name)) fail(`"${name.slice(0, 40)}": mod files need plain names, at the top of the zip or in one folder`);
    if (files.has(name)) fail(`"${name}" twice in the zip`);
    if (flags & 1) fail('the zip is encrypted');
    if (usize > lim.maxFileSize) fail(`"${name}" is larger than ${lim.maxFileSize / 1024} KB`);
    total += usize;
    if (total > lim.maxTotal) fail(`the files add up to more than ${lim.maxTotal / 1024} KB`);
    if (u32(local) !== 0x04034b50) fail('the zip is damaged');
    const start = local + 30 + u16(local + 26) + u16(local + 28);
    if (start + csize > bytes.length) fail('the zip is cut short');
    const raw = bytes.subarray(start, start + csize);
    let data: Uint8Array;
    if (method === 0) data = raw.slice();
    else if (method === 8) data = await inflate(raw, 'deflate-raw', usize);
    else return fail(`"${name}" is packed in a way the game can't read (use plain zip)`);
    if (data.length !== usize) fail(`"${name}" is damaged`);
    files.set(name, data);
  }
  return files;
}

// ---------- PNG ----------
export interface Png { w: number; h: number; /** RGBA, 4 bytes per pixel */ px: Uint8Array }

/** Decode a PNG: 8-bit RGB / RGBA / gray / gray+alpha, or palette (1-8 bit), not interlaced; at most maxPixels. */
export async function decodePng(b: Uint8Array, maxPixels: number): Promise<Png> {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  if (b.length < 8 || sig.some((v, i) => b[i] !== v)) fail('not a PNG image');
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let p = 8, w = 0, h = 0, depth = 0, type = -1, plte: Uint8Array | null = null, trns: Uint8Array | null = null;
  const idat: Uint8Array[] = [];
  while (p + 8 <= b.length) {
    const len = dv.getUint32(p), kind = String.fromCharCode(b[p + 4], b[p + 5], b[p + 6], b[p + 7]);
    if (p + 12 + len > b.length) fail('the PNG is cut short');
    const d = b.subarray(p + 8, p + 8 + len);
    if (kind === 'IHDR') {
      w = dv.getUint32(p + 8); h = dv.getUint32(p + 12); depth = d[8]; type = d[9];
      if (d[12] !== 0) fail('interlaced PNGs are not supported (save it without interlacing)');
    } else if (kind === 'PLTE') plte = d;
    else if (kind === 'tRNS') trns = d;
    else if (kind === 'IDAT') idat.push(d);
    else if (kind === 'IEND') break;
    p += 12 + len;
  }
  if (!w || !h || w * h > maxPixels) fail(`the PNG must be 1 to ${maxPixels} pixels`);
  const ch = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[type];
  if (!ch || (type === 3 ? ![1, 2, 4, 8].includes(depth) : depth !== 8)) fail('PNG color type not supported (use 8-bit RGBA or indexed)');
  if (type === 3 && !plte) fail('the PNG has no palette');
  const bpp = Math.max(1, (ch * depth) >> 3), stride = Math.ceil((w * ch * depth) / 8);
  const all = new Uint8Array(idat.reduce((n, d) => n + d.length, 0));
  let o = 0;
  for (const d of idat) { all.set(d, o); o += d.length; }
  const raw = await inflate(all, 'deflate', (stride + 1) * h);
  if (raw.length !== (stride + 1) * h) fail('the PNG is damaged');
  // unfilter
  const rows = new Uint8Array(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = rows.subarray(y * stride, (y + 1) * stride), prev = y ? rows.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, up = prev ? prev[x] : 0, c = prev && x >= bpp ? prev[x - bpp] : 0;
      let v = src[x];
      if (f === 1) v += a;
      else if (f === 2) v += up;
      else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) { const q = a + up - c, pa = Math.abs(q - a), pb = Math.abs(q - up), pc = Math.abs(q - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c; }
      else if (f !== 0) fail('the PNG is damaged');
      cur[x] = v & 255;
    }
  }
  const px = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const r = rows.subarray(y * stride), q = (y * w + x) * 4;
    if (type === 3) {
      const bit = x * depth, i = (r[bit >> 3] >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
      if (i * 3 + 2 >= plte!.length) fail('the PNG uses a color its palette lacks');
      px[q] = plte![i * 3]; px[q + 1] = plte![i * 3 + 1]; px[q + 2] = plte![i * 3 + 2]; px[q + 3] = trns && i < trns.length ? trns[i] : 255;
    } else if (type === 6) { px.set(r.subarray(x * 4, x * 4 + 4), q); }
    else if (type === 2) { px[q] = r[x * 3]; px[q + 1] = r[x * 3 + 1]; px[q + 2] = r[x * 3 + 2]; px[q + 3] = 255; }
    else if (type === 0) { px[q] = px[q + 1] = px[q + 2] = r[x]; px[q + 3] = 255; }
    else { px[q] = px[q + 1] = px[q + 2] = r[x * 2]; px[q + 3] = r[x * 2 + 1]; }
  }
  return { w, h, px };
}
