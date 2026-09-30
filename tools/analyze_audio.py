#!/usr/bin/env python3
# Development helper: per-bar levels and a spectrogram of the rendered song.
import sys, wave, struct
import numpy as np
from PIL import Image

def load(fn):
    with open(fn, 'rb') as f:
        data = f.read()
    # float32 stereo WAV written by preview.c (44 byte header)
    a = np.frombuffer(data[44:], dtype=np.float32).reshape(-1, 2)
    return a

a = load(sys.argv[1])
sr = 44100
bar = 88200
nb = len(a) // bar
print("bar  rmsL   rmsR   peak  | corrLR")
for b in range(nb + 1):
    s = a[b * bar:(b + 1) * bar]
    if len(s) == 0: break
    rl, rr = np.sqrt((s ** 2).mean(0))
    c = np.corrcoef(s[:, 0], s[:, 1])[0, 1] if s.std() > 0 else 0
    print(f"{b:3d}  {rl:.3f}  {rr:.3f}  {np.abs(s).max():.3f} | {c:.2f}")

if len(sys.argv) > 2:
    # log-frequency spectrogram, 20 Hz .. 20 kHz, 4 px per beat
    m = a.mean(1)
    hop = sr // 8
    win = 4096
    w = np.hanning(win)
    cols = []
    for i in range(0, len(m) - win, hop):
        sp = np.abs(np.fft.rfft(m[i:i + win] * w))
        cols.append(sp)
    S = np.array(cols).T
    freqs = np.fft.rfftfreq(win, 1 / sr)
    H = 300
    lf = np.geomspace(20, 20000, H)
    idx = np.searchsorted(freqs, lf).clip(0, len(freqs) - 1)
    img = 20 * np.log10(S[idx] + 1e-6)
    img = img - img.max()
    img = ((img + 90) / 90).clip(0, 1)[::-1]
    Image.fromarray((img * 255).astype(np.uint8)).save(sys.argv[2])
