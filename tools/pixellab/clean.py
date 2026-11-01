"""Border cleanup for PixelLab frames: one outline ink, no islands or crumbs, closed gaps, no doubled outline.
Usage: python3 clean.py strip.png ... (square frames side by side, cleaned in place)"""
from PIL import Image
N4=((1,0),(-1,0),(0,1),(0,-1)); N8=N4+((1,1),(-1,-1),(1,-1),(-1,1))
OUT=(10,8,16,255)
def lum(p): return 0.3*p[0]+0.59*p[1]+0.11*p[2]
def islands(p,op,W,H):
  seen=set()
  for y in range(H):
    for x in range(W):
      if not op(x,y) or (x,y) in seen: continue
      comp=[(x,y)]; st=[(x,y)]; seen.add((x,y))
      while st:
        a,b=st.pop()
        for dx,dy in N8:
          u,v=a+dx,b+dy
          if op(u,v) and (u,v) not in seen: seen.add((u,v)); st.append((u,v)); comp.append((u,v))
      if len(comp)<14:
        for a,b in comp: p[a,b]=(0,0,0,0)

def clean(im):
  im=im.convert('RGBA'); W,H=im.size; p=im.load()
  op=lambda x,y:0<=x<W and 0<=y<H and p[x,y][3]>0
  isout=lambda x,y: op(x,y) and p[x,y][:3]==OUT[:3]
  # 1 border dark band -> single outline colour (dark pixels reachable from outside via dark)
  from collections import deque
  q=deque((x,y) for y in range(H) for x in range(W) if not op(x,y)); seen=set(q)
  while q:
    x,y=q.popleft()
    for dx,dy in N4:
      a,b=x+dx,y+dy
      if 0<=a<W and 0<=b<H and (a,b) not in seen and op(a,b) and lum(p[a,b])<34:
        seen.add((a,b)); p[a,b]=OUT; q.append((a,b))
  islands(p,op,W,H)
  for it in range(1):
    # 3 spurs
    for y in range(H):
      for x in range(W):
        if isout(x,y) and sum(op(x+dx,y+dy) for dx,dy in N8)<=1: p[x,y]=(0,0,0,0)
    # 4 notches
    for y in range(H):
      for x in range(W):
        if not op(x,y) and sum(op(x+dx,y+dy) for dx,dy in N4)>=3: p[x,y]=OUT
    # 5 close outline gaps: colour pixel exposed to transparency gets outline outside
    mass=lambda x,y: op(x,y) and not isout(x,y) and sum(op(x+a,y+b) and not isout(x+a,y+b) for a,b in N4)>=2
    add=[(x,y) for y in range(H) for x in range(W) if not op(x,y) and any(mass(x+dx,y+dy) for dx,dy in N4)]
    for x,y in add: p[x,y]=OUT
    # 6 thin: drop a border outline pixel that touches no colour, when a neighbouring outline pixel already does (double outline)
    tc=lambda x,y: any(op(x+dx,y+dy) and not isout(x+dx,y+dy) for dx,dy in N8)
    rm=[(x,y) for y in range(H) for x in range(W) if isout(x,y) and any(not op(x+dx,y+dy) for dx,dy in N4) and not tc(x,y) and any(isout(x+dx,y+dy) and tc(x+dx,y+dy) for dx,dy in N4) and sum(isout(x+dx,y+dy) for dx,dy in N8)>=3]
    for x,y in rm: p[x,y]=(0,0,0,0)
  islands(p,op,W,H)
  # ground crumbs: small 4-connected bits in the feet zone that are not the body
  seen=set()
  for y in range(H):
    for x in range(W):
      if not op(x,y) or (x,y) in seen: continue
      comp=[(x,y)]; st=[(x,y)]; seen.add((x,y))
      while st:
        a,b=st.pop()
        for dx,dy in N4:
          u,v=a+dx,b+dy
          if op(u,v) and (u,v) not in seen: seen.add((u,v)); st.append((u,v)); comp.append((u,v))
      if len(comp)<12 and min(b for a,b in comp)>=H-12:
        for a,b in comp: p[a,b]=(0,0,0,0)
  return im
if __name__=='__main__':
  import sys
  for path in sys.argv[1:]:
    im=Image.open(path); W,H=im.size; out=Image.new('RGBA',(W,H))
    for k in range(W//H): out.alpha_composite(clean(im.crop((H*k,0,H*k+H,H))),(H*k,0))
    out.save(path)
