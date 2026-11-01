#!/usr/bin/env python3
"""Bake PixelLab VFX exports into sheet effects: assets/fx/<class>/<name>.png (the frames as one strip) and
assets/fx/<class>/<name>.json (frame size and count, speed, origin, and how the game shows it).

tools/pixellab/fx.json lists each effect:
  {"id": "mage/fireball-blast", "name": "...", "desc": "...", "url": "https://api.pixellab.ai/mcp/pixel-tools/<id>/<slug>",
   "ax": 24, "ay": 48, "loop": false, "panels": 1, "frames": [0, 1, 2], "fps": 16}
hollow (optional, k) clears everything more than k px inside the outline (auras over the fighter).
rows (optional, 3) plays the sheet on every row of the column.
frames (optional) picks and orders the export's frames (e.g. drop a wind-up so frame 0 is the hit frame);
fps (optional) overrides the export's speed.
url is the export's download folder plus file stem (the .png strip and .json frame list are fetched from it).
ax/ay: the effect's origin in a frame (a hit's panel feet, a shot's center), in sheet pixels (2 per world pixel).
Sources are cached in --cache (default art/pixellab/fx under the project files) so a rebuild needs no network.
Usage: python3 tools/pixellab/build_fx.py [--only <id>] [--cache DIR]
"""
import argparse, json, os, urllib.request
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ap = argparse.ArgumentParser()
ap.add_argument('--only')
ap.add_argument('--cache', default='/mnt/project-files/art/pixellab/fx')
a = ap.parse_args()
cfg = json.load(open(os.path.join(ROOT, 'tools/pixellab/fx.json')))
for e in cfg:
    if a.only and e['id'] != a.only: continue
    stem = os.path.join(a.cache, e['id'].replace('/', '__'))
    os.makedirs(a.cache, exist_ok=True)
    for ext in ('png', 'json'):
        if not os.path.exists(f'{stem}.{ext}'):
            urllib.request.urlretrieve(f"{e['url']}.{ext}", f'{stem}.{ext}')
    meta = json.load(open(f'{stem}.json'))
    frames = meta['frames']
    if 'frames' in e: frames = [frames[i] for i in e['frames']]
    fw, fh = frames[0]['sourceSize']['w'], frames[0]['sourceSize']['h']
    src = Image.open(f'{stem}.png').convert('RGBA')
    strip = Image.new('RGBA', (fw * len(frames), fh))
    for i, f in enumerate(frames):
        r = f['frame']; o = f['spriteSourceSize']
        strip.paste(src.crop((r['x'], r['y'], r['x'] + r['w'], r['y'] + r['h'])), (i * fw + o['x'], o['y']))
    # hard alpha: pixel art has no half-transparent edge pixels
    px = strip.load()
    for y in range(strip.height):
        for x in range(strip.width):
            c = px[x, y]
            if c[3] < 128: px[x, y] = (0, 0, 0, 0)
            elif c[3] < 255 and not e.get('soft'): px[x, y] = (c[0], c[1], c[2], 255)
    # hollow: auras keep only a band k px wide inside their outline, so the fighter shows through the middle
    k = e.get('hollow')
    if k:
        solid = [[px[x, y][3] > 0 for x in range(strip.width)] for y in range(strip.height)]
        for y in range(strip.height):
            for x in range(strip.width):
                if not solid[y][x]: continue
                fx0 = (x // fw) * fw
                inner = all(fx0 <= xx < fx0 + fw and 0 <= yy < strip.height and solid[yy][xx]
                            for yy in range(y - k, y + k + 1) for xx in range(x - k, x + k + 1))
                if inner: px[x, y] = (0, 0, 0, 0)
    fps = e.get('fps') or round(1000 / frames[0]['duration'], 3)
    out = os.path.join(ROOT, 'assets/fx', e['id'])
    os.makedirs(os.path.dirname(out), exist_ok=True)
    strip.save(out + '.png', 'PNG', optimize=True)
    meta = {'name': e['name'], 'desc': e['desc'], 'fw': fw, 'fh': fh, 'n': len(frames), 'fps': fps, 'ax': e['ax'], 'ay': e['ay']}
    if e.get('loop'): meta['loop'] = True
    meta['panels'] = e.get('panels', 1)
    meta['rows'] = e.get('rows', 1)
    with open(out + '.json', 'w') as fo:
        fo.write(json.dumps(meta, indent=2) + '\n')
    print(out, f'{fw}x{fh}x{len(frames)} @{fps}fps', os.path.getsize(out + '.png'), 'bytes')
