#!/usr/bin/env python3
"""Turn an ElevenLabs music take into a seamless game loop.

usage: loop.py IN.mp3 OUT.mp3 [--min-loop SECS] [--kbps 64] [--once]

Finds a loop start S (early, on a beat) and loop end E (late, on a beat, before any ending) whose
surroundings sound alike (chroma + timbre), then crossfades the audio just before E with the audio
just before S, so jumping E -> S is seamless. Masters like the old pipeline (highpass, -16 LUFS,
limiter) and prints {"loopStart": S, "loopEnd": E} for tracks.json. --once skips looping (loopEnd 0).
"""
import json, subprocess, sys, argparse
import numpy as np
import librosa

SR = 44100

def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy()

def encode(y, path, kbps):
    # two-pass loudnorm in linear mode: one fixed gain, so the loop seam stays continuous
    pcm = y.astype(np.float32).tobytes()
    base = ['ffmpeg', '-hide_banner', '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-i', '-']
    r = subprocess.run(base + ['-af', 'highpass=f=40,loudnorm=I=-16:TP=-1.5:LRA=20:print_format=json', '-f', 'null', '-'],
                       input=pcm, capture_output=True, check=True).stderr.decode()
    m = json.loads(r[r.rindex('{'):r.rindex('}') + 1])
    filt = ('highpass=f=40,loudnorm=I=-16:TP=-1.5:LRA=20:linear=true:'
            f"measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:"
            f"measured_thresh={m['input_thresh']}:offset={m['target_offset']},alimiter=limit=0.95")
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-i', '-',
                    '-af', filt, '-ar', str(SR), '-c:a', 'libmp3lame', '-b:a', f'{kbps}k', path],
                   input=pcm, check=True)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('inp'); ap.add_argument('out')
    ap.add_argument('--min-loop', type=float, default=0.0)
    ap.add_argument('--start-max', type=float, default=12.0)
    ap.add_argument('--kbps', type=int, default=64)
    ap.add_argument('--once', action='store_true')
    a = ap.parse_args()
    y = decode(a.inp)
    # drop leading silence (takes often open with up to ~0.8 s of nothing), keeping 20 ms
    loud = np.nonzero(np.abs(y).max(axis=1) > 10 ** (-40 / 20))[0]
    y = y[max(0, int(loud[0]) - int(0.02 * SR)):] if len(loud) else y
    dur = len(y) / SR
    if a.once:
        encode(y, a.out, a.kbps); print(json.dumps({'loopStart': 0, 'loopEnd': 0})); return
    mono = y.mean(axis=1)
    hop = 512
    _, beats = librosa.beat.beat_track(y=mono, sr=SR, hop_length=hop, units='frames')
    chroma = librosa.feature.chroma_stft(y=mono, sr=SR, hop_length=hop)
    mfcc = librosa.feature.mfcc(y=mono, sr=SR, hop_length=hop, n_mfcc=20)[1:]
    mfcc = (mfcc - mfcc.mean(axis=1, keepdims=True)) / (mfcc.std(axis=1, keepdims=True) + 1e-6)
    feat = np.vstack([chroma * 2.0, mfcc * 0.3])
    rms = librosa.feature.rms(y=mono, hop_length=hop)[0]
    fps = SR / hop
    W = int(2.0 * fps)  # compare 2 s either side of the cut
    def win(f):
        v = feat[:, f - W:f + W]
        return v / (np.linalg.norm(v) + 1e-9)
    med = np.median(rms)
    # the end must stay loud: skip the take's last seconds (endings, fades)
    tail_ok = lambda f: rms[f - W:f + W].mean() > 0.6 * med
    min_loop = a.min_loop or dur * 0.55
    best = None
    bt = [int(b) for b in beats]
    for s in bt:
        if s / fps < 2.1 or s / fps > a.start_max: continue
        ws = win(s)
        for e in bt:
            t = e / fps
            if t - s / fps < min_loop or e + W >= feat.shape[1] or t > dur - 2.5: continue
            if not tail_ok(e): continue
            # prefer a cut where both windows match, and a little bonus for a longer loop
            score = float((ws * win(e)).sum()) + 0.002 * (t - s / fps)
            if best is None or score > best[0]: best = (score, s, e)
    if best is None: sys.exit('no loop found')
    _, sf, ef = best
    S = int(round(sf * hop)); E = int(round(ef * hop))
    # fine-align E to S at sample level by cross-correlating a short window
    L = 2048; seg = mono[S - L:S + L]
    lo, hi = E - 1024, E + 1024
    cc = [float(np.dot(seg, mono[k - L:k + L])) for k in range(lo, hi, 4)]
    E = lo + 4 * int(np.argmax(cc))
    F = int(0.35 * SR)  # crossfade length
    t = np.linspace(0, 1, F, dtype=np.float32)[:, None]
    out = y[:E].copy()
    out[E - F:E] = out[E - F:E] * np.sqrt(1 - t) + y[S - F:S] * np.sqrt(t)
    # a short tail of the loop head after E, so the decoder never runs dry at the loop point
    out = np.vstack([out, y[S:S + int(0.25 * SR)]])
    encode(out, a.out, a.kbps)
    print(json.dumps({'loopStart': round(S / SR, 5), 'loopEnd': round(E / SR, 5), 'score': round(best[0], 3)}))

if __name__ == '__main__':
    main()
