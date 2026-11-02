"""Write the combat UI art (PixelLab picks in art/pixellab/combat-ui/picks/) into assets/:

  assets/ui/splash/<word>.png      READY / FIGHT! / K.O. / DOUBLE K.O. lettering, cropped to the letters
  assets/ui/fonts/<font>.png+json  glyph masks from PixelLab create_font (8 columns, one glyph per cell, row-major)
  assets/ui/queue-chip.png         the cast-queue card in 5 greys; the game recolors it to each spell's element
  assets/stages/panels/<id>.png    each arena's panel face, widened to the 68x34 face slot (2 px per world px)

Panels come back from PixelLab smaller than the slot, so they are widened by repeating a plain column or row from
the middle of the art (never stretched) and keep their own front lip. Run: python3 tools/pixellab/build_combat_ui.py
"""
import json, os, sys
from collections import deque
from PIL import Image

SRC = sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/art/pixellab/combat-ui/picks'
ROOT = os.path.join(os.path.dirname(__file__), '../../assets')
CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,!?:;'\"-+()0123456789/%*=_$"
FONTS = {'retro': 12, 'gold': 32}
FACE = (68, 34)  # the panel face inside the team rim, in backing pixels (world px x2)


def save(im, path):
  os.makedirs(os.path.dirname(path), exist_ok=True)
  im.save(path, 'PNG', optimize=True)
  print(os.path.relpath(path, ROOT), im.size)


def cutout(im):
  """Drop a flat background (transparent or one solid color touching the corners) and crop to the art."""
  im = im.convert('RGBA'); w, h = im.size; p = im.load()
  bg = p[0, 0]
  near = lambda c: c[3] == 0 or (bg[3] and sum(abs(a - b) for a, b in zip(c[:3], bg[:3])) < 30)
  seen, q = set(), deque([(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)])
  while q:
    x, y = q.popleft()
    if (x, y) in seen or not (0 <= x < w and 0 <= y < h): continue
    seen.add((x, y))
    if near(p[x, y]):
      p[x, y] = (0, 0, 0, 0); q.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
  return im.crop(im.getbbox())


def longest_run(lines):
  best, start = (0, 0, 0), 0
  for i in range(1, len(lines) + 1):
    if i == len(lines) or lines[i] != lines[i - 1]:
      if i - start > best[0]: best = (i - start, start, i)
      start = i
  return best


def grow(im, W, H):
  """Widen/heighten by repeating the middle of the longest run of identical columns/rows (the plain face)."""
  while im.size[0] < W:
    w, h = im.size; px = im.load()
    n, s, e = longest_run([tuple(px[x, y] for y in range(h)) for x in range(w)])
    x = (s + e) // 2 if n > 1 else w // 2
    o = Image.new('RGBA', (w + 1, h)); o.paste(im.crop((0, 0, x + 1, h)), (0, 0)); o.paste(im.crop((x, 0, w, h)), (x + 1, 0)); im = o
  while im.size[1] < H:
    w, h = im.size; px = im.load()
    n, s, e = longest_run([tuple(px[x, y] for x in range(w)) for y in range(h - 10)])  # keep the lip whole
    y = (s + e) // 2 if n > 1 else h // 3
    o = Image.new('RGBA', (w, h + 1)); o.paste(im.crop((0, 0, w, y + 1)), (0, 0)); o.paste(im.crop((0, y, w, h)), (0, y + 1)); im = o
  if im.size != (W, H):  # larger than the slot: trim evenly from the middle out
    l, t = (im.size[0] - W) // 2, (im.size[1] - H) // 2
    im = im.crop((l, t, l + W, t + H))
  return im


for word in ['ready', 'fight', 'ko', 'double-ko']:
  im = Image.open(os.path.join(SRC, f'{word}.png')).convert('RGBA')
  save(im.crop(im.getbbox()), os.path.join(ROOT, 'ui/splash', f'{word}.png'))

for name, g in FONTS.items():
  a = Image.open(os.path.join(SRC, f'font-{name}.png')).convert('RGBA').split()[3].point(lambda v: 255 if v >= 128 else 0)
  mask = Image.new('LA', a.size, (0, 0)); mask.putalpha(a)
  save(mask, os.path.join(ROOT, 'ui/fonts', f'{name}.png'))
  with open(os.path.join(ROOT, 'ui/fonts', f'{name}.json'), 'w') as f:
    json.dump({'glyph': g, 'columns': 8, 'chars': CHARS}, f)
    f.write('\n')

chip = Image.open(os.path.join(SRC, 'queue-chip.png')).convert('RGBA')
save(chip.crop(chip.getbbox()), os.path.join(ROOT, 'ui/queue-chip.png'))

for f in sorted(os.listdir(os.path.join(SRC, 'panels'))):
  if f.endswith('.png'):
    save(grow(cutout(Image.open(os.path.join(SRC, 'panels', f))), *FACE), os.path.join(ROOT, 'stages/panels', f))
