#!/usr/bin/env python3
# Development helper: GPU cost of a visual shader, per scene.
# At a few moments of the intro it counts map() evaluations per pixel (mean,
# and the mean over 8x2 pixel blocks of the block's maximum - what a SIMD GPU
# pays, since a group of pixels runs as long as its slowest one) and times
# frames with the preview harness (on llvmpipe the time follows the ALU work;
# on a real GPU it shows real frame times).
#
#   S=/scratch python3 tools/bench.py src/visual.frag [width height]
#
# Needs $S/preview (gcc -O2 -o $S/preview tools/preview.c -lGL -lX11 -lm) and
# an X display. The instrumented shader expects map() to be declared as
# "float map(vec3 p)\n{" and main() to end with the "o = vec4(...);" line.
import os, re, subprocess, sys, time
import numpy as np
from PIL import Image

S = os.environ.get('S', '/tmp')
PREVIEW = os.path.join(S, 'preview')
src = open(sys.argv[1]).read()
W, H = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (480, 270)
TIMES = [12, 26, 40, 60, 88, 100, 116, 132]
DUR = [16, 16, 16, 32, 16, 16, 16, 18]   # seconds of the intro each sample stands for

cnt = src.replace('float map(vec3 p)\n{', 'float NC;\nfloat map(vec3 p)\n{\n\tNC += 1.;')
cnt = re.sub(r'\n\to = vec4\(.*\);\n}\s*$', '\n\to = vec4(floor(NC / 256.) / 255., mod(NC, 256.) / 255., 0, 1);\n}\n', cnt)
if 'NC += 1.' not in cnt or 'mod(NC, 256.)' not in cnt:
	sys.exit('could not instrument the shader (see the comment at the top)')
fc, fi, ppm = (os.path.join(S, n) for n in ('bench_cnt.frag', 'bench_img.frag', 'bench.ppm'))
open(fc, 'w').write(cnt)
open(fi, 'w').write(src)

def frames(t, n):
	t0 = time.time()
	subprocess.run([PREVIEW, 'frames', fi, str(t), str(t + n / 60.), '60', str(W), str(H)], capture_output=True)
	return time.time() - t0

print(f'{W}x{H}   time    ms/frame   map() calls/pixel: mean  8x2-block max    p95    max')
blk, ms_all = [], []
for t in TIMES:
	subprocess.run([PREVIEW, 'frame', fc, str(t), str(W), str(H), ppm], capture_output=True)
	a = np.asarray(Image.open(ppm)).astype(np.int64)
	c = a[..., 0] * 256 + a[..., 1]
	b = c[:H // 2 * 2, :W // 8 * 8].reshape(H // 2, 2, W // 8, 8).max(axis=(1, 3)).mean()
	# frame time without start-up and shader compilation: 24 frames minus 4 frames
	ms = (min(frames(t, 24) for _ in range(2)) - min(frames(t, 4) for _ in range(2))) * 1000 / 20
	blk.append(b)
	ms_all.append(ms)
	print(f'          t={t:4d}s  {ms:7.1f}          {c.mean():6.1f}  {b:13.1f}  {np.percentile(c, 95):5.0f}  {c.max():5d}', flush=True)
print(f'weighted by scene length: {np.average(ms_all, weights=DUR):.1f} ms/frame, '
	f'{np.average(blk, weights=DUR):.1f} block-max map() calls; worst {max(blk):.1f}')
