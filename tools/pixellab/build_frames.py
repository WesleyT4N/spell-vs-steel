"""Build assets/fighters/<class>.png (every frame side by side), <class>-portrait.png and <class>.json (frame
layout, palette, feet column, team color) from PixelLab frames.

Inputs (art/pixellab in the project files, or --src):
  idle/<class>_idle_48.png   5-frame 48px idle strip (cleaned)
  anim/<class>_<move>_<i>.png 64x64 frames from animate_image (raw), move in hop/atk/cast/ko
Every frame is cleaned (clean.py), put on a 64x64 canvas (idle at x+8 like the animation bases), quantized to
one palette per class (index 0 = the outline ink), cropped so the feet sit on the bottom row, and written as
indexed PNGs (palette_png.py).
"""
import sys, os
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from clean import clean, OUT
from palette_png import save_rows, save_json

SRC = sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/art/pixellab'
DST = os.path.join(os.path.dirname(__file__), '../../assets/fighters')
ALPHA = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
# which generated frame plays each game frame: (move, index); idle frames are the idle strip
MAP = {
  'warrior': dict(hop=('hop', 3), land=('hop', 6), windup=('atk', 3), slash=('atk', 6), cast0=('cast', 3), cast1=('cast', 5),
                  hit=('ko', 2), stagger=('ko', 3), kneel=('ko', 5), slump=('ko', 6), fall1=('ko', 6), fall2=('ko', 7), down=('ko', 8)),
  'mage': dict(hop=('hop', 4), land=('hop', 6), windup=('atk', 1), slash=('atk', 6), cast0=('cast', 1), cast1=('cast', 6),
               hit=('ko', 1), stagger=('ko', 4), kneel=('ko', 7), slump=('ko', 7), fall1=('ko', 7), fall2=('ko', 8), down=('ko', 8)),
  'rogue': dict(hop=('hop', 3), land=('hop', 4), windup=('atk', 2), slash=('atk', 5), cast0=('cast', 3), cast1=('cast', 6),
                hit=('ko', 1), stagger=('ko', 5), kneel=('ko', 7), slump=('ko', 8), fall1=('ko', 7), fall2=('ko', 8), down=('ko', 8)),
  'ranger': dict(hop=('hop', 4), land=('hop', 6), windup=('atk', 3), slash=('atk', 6), cast0=('cast', 1), cast1=('cast', 5),
                 hit=('ko', 2), stagger=('ko', 4), kneel=('ko', 5), slump=('ko', 6), fall1=('ko', 6), fall2=('ko', 7), down=('ko', 8)),
  'priest': dict(hop=('hop', 4), land=('hop', 6), windup=('atk', 3), slash=('atk', 6), cast0=('cast', 3), cast1=('cast', 6),
                 hit=('ko', 2), stagger=('ko', 3), kneel=('ko', 7), slump=('ko', 7), fall1=('ko', 7), fall2=('ko', 8), down=('ko', 8)),
}
TEAM_HINT = {'warrior': (60, 100, 200), 'mage': (90, 70, 160), 'rogue': (150, 30, 40), 'ranger': (60, 140, 50), 'priest': (70, 120, 210)}

def load(cls):
  frames = {}
  idle = Image.open(f'{SRC}/idle/{cls}_idle_48.png').convert('RGBA')
  for i, k in enumerate([0, 1, 2, 3]):
    f = Image.new('RGBA', (64, 64)); f.alpha_composite(idle.crop((48 * k, 0, 48 * k + 48, 48)), (8, 16)); frames[f'idle{i}'] = f
  for fid, (mv, i) in MAP[cls].items():
    frames[fid] = clean(Image.open(f'{SRC}/anim/{cls}_{mv}_{i}.png'))
  return frames

def build(cls):
  frames = load(cls)
  ids = list(frames)
  sheet = Image.new('RGBA', (64 * len(ids), 64))
  for k, fid in enumerate(ids): sheet.alpha_composite(frames[fid], (64 * k, 0))
  rgb = Image.new('RGB', sheet.size, (0, 0, 0)); rgb.paste(sheet, mask=sheet.getchannel('A'))
  q = rgb.quantize(colors=len(ALPHA) - 1, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
  qpal = q.getpalette()[:3 * 256]
  used = sorted(set(q.getdata()))
  cols = [tuple(qpal[3 * u:3 * u + 3]) for u in used]
  # outline ink first
  d2 = lambda a, b: sum((x - y) ** 2 for x, y in zip(a, b))
  ink = min(range(len(cols)), key=lambda i: d2(cols[i], OUT[:3]))
  order = [ink] + [i for i in range(len(cols)) if i != ink]
  remap = {used[o]: n for n, o in enumerate(order)}
  pal = ['#%02x%02x%02x' % cols[o] for o in order]
  pal[0] = '#%02x%02x%02x' % OUT[:3]
  qd = list(q.getdata()); A = list(sheet.getchannel('A').getdata())
  W = sheet.width
  # feet on the bottom row: the lowest opaque row of idle0
  bottom = max(y for y in range(64) for x in range(64) if A[y * W + x])
  rows = {}
  for k, fid in enumerate(ids):
    rs = []
    for y in range(bottom + 1):
      rs.append(''.join(ALPHA[remap[qd[y * W + 64 * k + x]]] if A[y * W + 64 * k + x] else '.' for x in range(64)))
    rows[fid] = rs
  # feet column: middle of the opaque pixels on the bottom 3 rows of idle0
  xs = [x for y in range(bottom - 2, bottom + 1) for x in range(64) if A[y * W + x]]
  ax = (min(xs) + max(xs)) // 2
  # character select bust: 40x32 around the head of idle0, native pixels
  top = min(y for y in range(64) for x in range(64) if A[y * W + x])
  hx = [x for y in range(top, top + 12) for x in range(64) if A[y * W + x]]
  cx = sum(hx) // len(hx)
  px0, py0 = cx - 20, max(0, top - 2)
  portrait = [''.join((ALPHA[remap[qd[y * W + x]]] if 0 <= x < 64 and y < 64 and A[y * W + x] else '.') for x in range(px0, px0 + 40)) for y in range(py0, py0 + 32)]
  team = min(range(1, len(pal)), key=lambda i: d2(cols[order[i]], TEAM_HINT[cls]))
  save_rows([rows[fid] for fid in ids], pal, f'{DST}/{cls}.png')
  save_rows([portrait], pal, f'{DST}/{cls}-portrait.png')
  save_json({'frameWidth': 64, 'frameHeight': bottom + 1, 'frames': ids, 'ax': ax, 'team': pal[team], 'palette': pal}, f'{DST}/{cls}.json')
  print(cls, len(pal), 'colors, ax', ax, 'h', bottom + 1)

for cls in (sys.argv[2:] or MAP):
  build(cls)
