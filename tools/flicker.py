#!/usr/bin/env python3
# Development helper: temporal flicker of a visual shader.
# Renders half a second at 60 fps around a few moments and averages
# |f(n-1) - 2 f(n) + f(n+1)| per pixel: smooth camera motion gives small
# values, aliasing sparkle and z-fighting give large ones. The film grain is
# removed first. Also writes $S/flicker_<tag>.png (the per-pixel map, x4).
#
#   S=/scratch python3 tools/flicker.py src/visual.frag [tag]
#   T0S="50 60" python3 tools/flicker.py ...      (other moments)
import os, subprocess, sys
import numpy as np
from PIL import Image

S = os.environ.get('S', '/tmp')
PREVIEW = os.path.join(S, 'preview')
src = open(sys.argv[1]).read()
tag = sys.argv[2] if len(sys.argv) > 2 else 'x'
grain = '+ hash(uv + B) * .02 * k'
if grain not in src:
	sys.exit('film grain expression not found')
frag = os.path.join(S, 'flicker_tmp.frag')
open(frag, 'w').write(src.replace(grain, ''))
W, H, FPS = 640, 360, 60
tot, maps = [], []
for t0 in [float(x) for x in os.environ.get('T0S', '12 20 26 132').split()]:
	raw = subprocess.run([PREVIEW, 'frames', frag, str(t0), str(t0 + .5), str(FPS), str(W), str(H)], capture_output=True).stdout
	f = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3).astype(np.float32)
	sd = np.abs(f[:-2] - 2 * f[1:-1] + f[2:]).mean(3)
	tot.append(sd.mean())
	maps.append(sd.mean(0))
	print(f't={t0:5.1f}: flicker {sd.mean():.3f}  pixels >30: {100 * (sd > 30).mean():.3f}%', flush=True)
print(f'{tag}: total flicker {np.mean(tot):.3f}')
Image.fromarray(np.clip(np.concatenate(maps, 0) * 4, 0, 255).astype(np.uint8)).save(os.path.join(S, f'flicker_{tag}.png'))
