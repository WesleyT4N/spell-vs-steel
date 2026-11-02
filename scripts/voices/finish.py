#!/usr/bin/env python3
"""Turn raw ElevenLabs takes into game clips.

usage: finish.py RAW_DIR OUT_DIR
RAW_DIR holds <speaker>/<bank>-<line>-<take>.mp3 (as rendered by the ElevenLabs MCP, see README.md).
Each take is trimmed of leading/trailing silence, loudness-normalised (voices and grunts sit at the same level),
downmixed to mono 32 kHz and written as OUT_DIR/<speaker>/<bank>-<n>.mp3, numbered from 1 per bank.
"""
import os, re, subprocess, sys
from collections import defaultdict

raw, out = sys.argv[1], sys.argv[2]

def trim(end_db):
    return ('silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02,'
            f'areverse,silenceremove=start_periods=1:start_threshold={end_db}dB:start_silence=0.06,areverse')

# Grunt and hurt takes often hold more than one burst (the grunt, then a breath or a second grunt).
# Keep only the first burst, capped in length, so they stay snappy.
SHORT = {'grunt': 0.6, 'hurt': 0.7, 'hurtBig': 1.2}

def first_burst(src):
    log = subprocess.run(['ffmpeg', '-hide_banner', '-i', src, '-af', 'silencedetect=n=-32dB:d=0.05', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    ev = [(k, float(v)) for k, v in re.findall(r'silence_(start|end): ([0-9.]+)', log)]
    start = 0.0
    if ev and ev[0] == ('start', 0.0):
        start = next((t for k, t in ev if k == 'end'), 0.0)
    end = next((t for k, t in ev if k == 'start' and t > start), None)
    return max(0.0, start - 0.01), end

def chain(bank, src):
    norm = 'loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=in:d=0.005'
    if bank in SHORT:
        a, b = first_burst(src)
        b = min(b + 0.08 if b else a + SHORT[bank], a + SHORT[bank])
        return f'atrim={a:.3f}:{b:.3f},asetpts=PTS-STARTPTS,afade=t=out:st={max(0, b - a - 0.06):.3f}:d=0.06,{norm}'
    return f'{trim(-45)},{norm}'
for spk in sorted(os.listdir(raw)):
    d = os.path.join(raw, spk)
    if not os.path.isdir(d): continue
    banks = defaultdict(list)
    for f in sorted(os.listdir(d)):
        m = re.match(r'(.+)-(\d+)-(\d+)\.mp3$', f)
        if m: banks[m.group(1)].append((int(m.group(2)), int(m.group(3)), f))
    od = os.path.join(out, spk); os.makedirs(od, exist_ok=True)
    for bank, items in banks.items():
        for n, (_, _, f) in enumerate(sorted(items), 1):
            dst = os.path.join(od, f'{bank}-{n}.mp3')
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(d, f), '-af', chain(bank, os.path.join(d, f)),
                            '-ac', '1', '-ar', '32000', '-b:a', '48k', dst], check=True)
            dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', dst],
                                       capture_output=True, text=True).stdout)
            print(f'{spk}/{bank}-{n} {dur:.2f}s  <- {f}')
