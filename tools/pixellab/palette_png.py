"""Write palette-letter rows ('.' clear, then a-z, A-Z, 0-9 for palette indices 0..61) as an indexed PNG.

The PNG's palette is the art's palette in order (index 0 = the outline ink), plus one clear entry at the end, so the
file opens in any pixel editor with its colors in game order. Several frames of one size go side by side in a strip.
"""
import json, os
from PIL import Image

ALPHA = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

def save_rows(frames, pal, path):
  """frames: a list of frames, each a list of equal-length rows; all frames the same size."""
  h, w = len(frames[0]), len(frames[0][0])
  clear = len(pal)
  im = Image.new('P', (w * len(frames), h), clear)
  flat = []
  for c in pal: flat += [int(c[i:i + 2], 16) for i in (1, 3, 5)]
  im.putpalette(flat + [0, 0, 0])
  px = im.load()
  for f, rows in enumerate(frames):
    assert len(rows) == h and all(len(r) == w for r in rows), f'{path}: frames differ in size'
    for y, r in enumerate(rows):
      for x, ch in enumerate(r):
        if ch != '.': px[f * w + x, y] = ALPHA.index(ch)
  os.makedirs(os.path.dirname(path), exist_ok=True)
  im.save(path, transparency=clear)

def save_json(obj, path):
  os.makedirs(os.path.dirname(path), exist_ok=True)
  with open(path, 'w') as f: f.write(json.dumps(obj, indent=2) + '\n')
