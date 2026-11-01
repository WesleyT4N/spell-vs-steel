"""Build assets/monsters/<id>.png and <id>.json (palette, feet column) from the picked PixelLab monster sprites.

Input: <src>/mobs/<id>.png, one picked create_image_pro candidate per monster, facing right (art/pixellab/mobs in
the project files). Regulars are 48px, elites 56px and bosses 80px, all at 2 sprite pixels per world pixel like
the fighters. Each sprite is cleaned (clean.py), cropped to its opaque box with the feet on the bottom row,
quantized to its own palette (index 0 = the outline ink) and written as an indexed PNG (palette_png.py).
Usage: python3 tools/pixellab/build_mobs.py [src]
"""
import sys, os
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from clean import clean, OUT
from palette_png import save_rows, save_json

SRC = sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/art/pixellab'
DST = os.path.join(os.path.dirname(__file__), '../../assets/monsters')
ALPHA = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
IDS = ['stumpkin', 'wolf', 'alpha', 'webspinner', 'wisp', 'barkguard', 'thornmother', 'oakheart',
       'skelarcher', 'rattler', 'ghoul', 'banshee', 'gravebell', 'deathknight', 'colossus', 'boneking',
       'imp', 'salamander', 'golem', 'emberbat', 'shaman', 'drakerider', 'titan', 'emberwyrm']
d2 = lambda a, b: sum((x - y) ** 2 for x, y in zip(a, b))

def build(mid):
  im = clean(Image.open(f'{SRC}/mobs/{mid}.png'))
  box = im.getchannel('A').getbbox()
  im = im.crop((box[0] - 1, box[1] - 1, box[2] + 1, box[3]))  # 1px air at the sides and top, feet on the last row
  rgb = Image.new('RGB', im.size, (0, 0, 0)); rgb.paste(im, mask=im.getchannel('A'))
  q = rgb.quantize(colors=len(ALPHA) - 1, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
  qpal = q.getpalette()
  A = list(im.getchannel('A').get_flattened_data()); qd = list(q.get_flattened_data()); W, H = im.size
  used = sorted({qd[i] for i in range(len(qd)) if A[i]})
  cols = [tuple(qpal[3 * u:3 * u + 3]) for u in used]
  ink = min(range(len(cols)), key=lambda i: d2(cols[i], OUT[:3]))
  order = [ink] + [i for i in range(len(cols)) if i != ink]
  remap = {used[o]: n for n, o in enumerate(order)}
  pal = ['#%02x%02x%02x' % cols[o] for o in order]
  pal[0] = '#%02x%02x%02x' % OUT[:3]
  rows = [''.join(ALPHA[remap[qd[y * W + x]]] if A[y * W + x] else '.' for x in range(W)) for y in range(H)]
  xs = [x for y in range(H - 3, H) for x in range(W) if A[y * W + x]]
  ax = (min(xs) + max(xs)) // 2
  return pal, ax, rows

for mid in IDS:
  pal, ax, rows = build(mid)
  save_rows([rows], pal, f'{DST}/{mid}.png')
  save_json({'ax': ax, 'palette': pal}, f'{DST}/{mid}.json')
  print(mid, len(pal), 'colors', len(rows[0]), 'x', len(rows), 'ax', ax)
