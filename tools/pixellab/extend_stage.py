"""Grow a PixelLab stage panorama (792x336) into the large master backdrop that every screen shape crops from.

PixelLab draws at most about a quarter megapixel per image, and the stage buffer (art/ink.ts BW x BH, at 2 image
pixels per world pixel) is about twice that, so the panorama is drawn for the wide shapes and this extends it:
TOP rows above, continuing each column's top colour (the stages are drawn with a plain sky or ceiling along the
top edge), and BOTTOM rows below in the floor's most common tone, flat so tall phones see no stripes.
Usage: python3 tools/pixellab/extend_stage.py in.png out.png
"""
import sys
from collections import Counter
from PIL import Image

TOP, BOTTOM, BAND, PEEK = 168, 168, 24, 6

def extend(src, dst):
  im = Image.open(src).convert('RGB'); W, H = im.size; p = im.load()
  out = Image.new('RGB', (W, TOP + H + BOTTOM)); out.paste(im, (0, TOP)); q = out.load()
  for x in range(W):
    col = Counter(p[x, y] for y in range(PEEK)).most_common(1)[0][0]
    for y in range(TOP): q[x, y] = col
  # the floor continues as one flat tone (its most common colour near the bottom edge): mirroring or
  # repeating a strip of it reads as stripes on tall phones
  floor = Counter(p[x, y] for x in range(W) for y in range(H - BAND, H)).most_common(1)[0][0]
  for y in range(TOP + H, out.height):
    for x in range(W): q[x, y] = floor
  out.save(dst)

if __name__ == '__main__':
  extend(sys.argv[1], sys.argv[2])
