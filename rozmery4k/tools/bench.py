#!/usr/bin/env python3
"""Development helper: the cost of src/scene.frag at moments of the demo.

For each moment: wall time per frame with the preview harness (on llvmpipe
the time follows the ALU work) and the number of map() evaluations per pixel.

    S=/scratch python3 tools/bench.py src/scene.frag [tag]

Needs $S/preview, an X display, numpy and Pillow. The instrumented copy
expects map() declared as "float map(vec3 p)\n{" and main() to end with the
"o = vec4(...);" line.
"""
import os, re, subprocess, sys, time
import numpy as np
from PIL import Image
S = os.environ.get('S', '/tmp')
src = open(sys.argv[1]).read(); tag = sys.argv[2] if len(sys.argv) > 2 else 'x'
env = dict(os.environ, DISPLAY=os.environ.get('DISPLAY', ':99'))
W, H = 480, 270
TIMES = [int(x * 1.92) for x in (3, 10, 20, 28, 33, 36, 42, 50, 58, 66, 74, 80, 84, 88, 92, 97)]   # (bars -> s)
# instrumented copy: count map() calls, output the count instead of the colour
cnt = src.replace('float map(vec3 p)\n{', 'float NC;\nfloat map(vec3 p)\n{\n\tNC += 1.;')
cnt = re.sub(r"\n\to = vec4\(.*\);[^\n]*\n}\s*$", '\n\to = vec4(floor(NC / 256.) / 255., mod(NC, 256.) / 255., 0, 1);\n}\n', cnt)
assert 'NC += 1.' in cnt and 'mod(NC, 256.)' in cnt
open(S + '/bench_cnt.frag', 'w').write(cnt)
open(S + '/bench_img.frag', 'w').write(src)
tot_ms, tot_calls = [], []
for t in TIMES:
    subprocess.run([S + '/preview', 'frame', S + '/bench_cnt.frag', str(t), str(W), str(H), S + '/bench_cnt.ppm'], env=env, capture_output=True)
    a = np.asarray(Image.open(S + '/bench_cnt.ppm')).astype(np.int64)
    calls = a[..., 0] * 256 + a[..., 1]
    # time: 6 frames around t
    def run(n):
        t0 = time.time()
        subprocess.run([S + '/preview', 'frames', S + '/bench_img.frag', str(t), str(t + n / 60.), '60', str(W), str(H)], env=env, capture_output=True)
        return time.time() - t0
    ms = (min(run(24) for _ in range(2)) - min(run(4) for _ in range(2))) * 1000 / 20
    tot_ms.append(ms); tot_calls.append(calls.mean())
    print(f't={t:4d}s  {ms:7.1f} ms/frame  map() calls per pixel: mean {calls.mean():6.1f}  p95 {np.percentile(calls, 95):6.0f}  max {calls.max():5d}', flush=True)
print(f'{tag}: mean {np.mean(tot_ms):.1f} ms/frame, {np.mean(tot_calls):.1f} map() calls per pixel')
