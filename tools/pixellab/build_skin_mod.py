"""Build a skin mod (mods/<id>/: mod.json and its PNGs) from PixelLab frames of a reskinned fighter.

The frames come from transfer_outfit run on the class's own game frames (rendered 64x64, feet on the bottom row), so
every pose lines up with the built-in art. Each frame is cleaned (clean.py), the set is quantized to one palette
(index 0 = the outline ink, at most 62 colours), cropped to the class's frame height and written in the mod format
(docs/MODDING.md), with a 40x32 portrait around the idle head.

Usage: python3 build_skin_mod.py <frames dir> <prefix> <class> <mod id> <mod name> <skin id> <skin name> [author]
  frames dir holds <prefix>_<frame>.png for every frame id; frames a class repeats can be left out (see SAME).
"""
import sys, os, json, re
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from clean import clean, OUT
from palette_png import save_rows, save_json

ALPHA = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
IDS = ['idle0', 'idle1', 'idle2', 'idle3', 'hop', 'land', 'windup', 'slash', 'cast0', 'cast1', 'hit', 'stagger', 'kneel', 'slump', 'fall1', 'fall2', 'down']
# frames the built-in art repeats: (frame, the frame it copies)
SAME = {'mage': {'slump': 'kneel', 'fall1': 'kneel', 'down': 'fall2'}, 'ranger': {'fall1': 'slump'}}
TEAM_HINT = {'mage': (70, 60, 140), 'ranger': (70, 120, 70)}
ROOT = os.path.join(os.path.dirname(__file__), '../..')

def class_height(cls):
  return json.load(open(f'{ROOT}/assets/fighters/{cls}.json'))['frameHeight']

def main(src, prefix, cls, mod_id, mod_name, skin_id, skin_name, author=''):
  H = class_height(cls)
  frames = {}
  for fid in IDS:
    path = f'{src}/{prefix}_{fid}.png'
    if os.path.exists(path): frames[fid] = clean(Image.open(path).convert('RGBA')).crop((0, 64 - H, 64, 64))
  for fid, of in SAME.get(cls, {}).items():
    if fid not in frames: frames[fid] = frames[of]
  ids = [f for f in IDS if f in frames]
  sheet = Image.new('RGBA', (64 * len(ids), H))
  for k, fid in enumerate(ids): sheet.alpha_composite(frames[fid], (64 * k, 0))
  rgb = Image.new('RGB', sheet.size, (0, 0, 0)); rgb.paste(sheet, mask=sheet.getchannel('A'))
  q = rgb.quantize(colors=len(ALPHA), method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
  qpal = q.getpalette()[:3 * 256]
  A = list(sheet.getchannel('A').getdata()); qd = list(q.getdata()); W = sheet.width
  used = sorted({qd[i] for i in range(len(qd)) if A[i]})
  cols = [tuple(qpal[3 * u:3 * u + 3]) for u in used]
  d2 = lambda a, b: sum((x - y) ** 2 for x, y in zip(a, b))
  ink = min(range(len(cols)), key=lambda i: d2(cols[i], OUT[:3]))
  order = [ink] + [i for i in range(len(cols)) if i != ink]
  remap = {used[o]: n for n, o in enumerate(order)}
  pal = ['#%02x%02x%02x' % cols[o] for o in order]
  pal[0] = '#%02x%02x%02x' % OUT[:3]
  px = lambda x, y: ALPHA[remap[qd[y * W + x]]] if A[y * W + x] else '.'
  out = {fid: [''.join(px(64 * k + x, y) for x in range(64)) for y in range(H)] for k, fid in enumerate(ids)}
  # portrait: 40x32 around the head of idle0 (as build_frames.py)
  top = min(y for y in range(H) for x in range(64) if A[y * W + x])
  hx = [x for y in range(top, top + 12) for x in range(64) if A[y * W + x]]
  cx = sum(hx) // len(hx)
  px0, py0 = cx - 20, max(0, top - 2)
  portrait = [''.join(px(x, y) if 0 <= x < 64 and y < H else '.' for x in range(px0, px0 + 40)) for y in range(py0, py0 + 32)]
  team = min(range(1, len(pal)), key=lambda i: d2(cols[order[i]], TEAM_HINT[cls]))
  # the mod is a folder: mod.json plus the frames side by side (class frame order) and the portrait, as indexed PNGs
  d = f'{ROOT}/mods/{mod_id}'
  order = json.load(open(f'{ROOT}/assets/fighters/{cls}.json'))['frames']
  n = max(order.index(f) for f in ids) + 1
  blank = ['.' * 64] * H
  save_rows([out.get(f, blank) for f in order[:n]], pal, f'{d}/{skin_id}.png')
  save_rows([portrait], pal, f'{d}/{skin_id}-portrait.png')
  mod = {'format': 'spell-vs-steel-mod/3', 'id': mod_id, 'name': mod_name, **({'author': author} if author else {}),
         'skins': [{'class': cls, 'id': skin_id, 'name': skin_name, 'sheet': f'{skin_id}.png', 'portrait': f'{skin_id}-portrait.png',
                    'team': pal[team], 'palette': pal}]}
  save_json(mod, f'{d}/mod.json')
  print(d, len(pal), 'colours,', len(ids), 'frames (zip the folder to share it)')

if __name__ == '__main__':
  main(*sys.argv[1:])
