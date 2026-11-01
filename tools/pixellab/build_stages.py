"""Write assets/stages/<id>.png for each PixelLab backdrop in art/pixellab/stages/<id>.png.
Each image is re-saved as an optimized palette PNG (it is already pixel art with a few dozen colors)."""
import sys, os
from PIL import Image
SRC = sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/art/pixellab/stages'
DST = os.path.join(os.path.dirname(__file__), '../../assets/stages')
os.makedirs(DST, exist_ok=True)
for f in sorted(os.listdir(SRC)):
  if not f.endswith('.png'): continue
  sid = f[:-4]
  im = Image.open(os.path.join(SRC, f)).convert('RGB')
  n = len(im.getcolors(1 << 24) or [])
  q = im.quantize(colors=min(256, max(2, n)), method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE) if n <= 256 else im.quantize(256, dither=Image.Dither.NONE)
  out = os.path.join(DST, f'{sid}.png')
  q.save(out, 'PNG', optimize=True)
  print(sid, n, 'colors', os.path.getsize(out) // 1024, 'KB')
