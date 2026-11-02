#!/usr/bin/env python3
"""Put a skin's finished clips into its mod folder and point mod.json's "voice" map at them.

usage: skin.py OUT_DIR/<speaker> MOD_DIR SKIN_ID
Takes clips made by finish.py (<bank>-<n>.mp3), keeps at most 4 per line (the mod format's limit, spreading the
picks across the different lines before second takes), writes them as <skin>-<line>-<n>.mp3 and replaces the
skin's "voice" map. Old <skin>-*.mp3 clips in the folder are removed first.
"""
import json, os, re, shutil, sys

src, mod, skin = sys.argv[1], sys.argv[2], sys.argv[3]
MAX, CAP = 4, 64 * 1024
banks = {}
for f in sorted(os.listdir(src)):
    m = re.match(r'(.+)-(\d+)\.mp3$', f)
    if m: banks.setdefault(m.group(1), []).append((int(m.group(2)), f))
for f in os.listdir(mod):
    if f.startswith(f'{skin}-') and f.endswith('.mp3'): os.remove(os.path.join(mod, f))
voice = {}
for bank, items in sorted(banks.items()):
    items = [f for _, f in sorted(items)]
    # finish.py numbers takes line by line (line0 take1, line0 take2, line1 take1...): take 1 of each line first
    picks = (items[0::2] + items[1::2])[:MAX]
    names = []
    for n, f in enumerate(picks, 1):
        name = f'{skin}-{bank}-{n}.mp3'
        if os.path.getsize(os.path.join(src, f)) > CAP: sys.exit(f'{f} is over 64 KB')
        shutil.copy(os.path.join(src, f), os.path.join(mod, name))
        names.append(name)
    voice[bank] = names
mj = os.path.join(mod, 'mod.json')
data = json.load(open(mj))
for s in data['skins']:
    if s['id'] == skin: s['voice'] = voice
open(mj, 'w').write(json.dumps(data, indent=2) + '\n')
print(skin, {k: len(v) for k, v in voice.items()})
