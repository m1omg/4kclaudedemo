#!/usr/bin/env python3
# Development helper: rays of a visual shader that end INSIDE a solid.
# Sphere tracing is only safe while map() never overestimates the distance;
# where it does, a ray overshoots into an object and stops inside it, and the
# ambient occlusion turns the depth error into dark streaks that move with the
# camera. This counts, at a few moments, the pixels whose primary ray or floor
# reflection ends more than 0.001 inside a solid (map() < 0 at the hit), and
# writes $S/inside_<t>.png (white = inside).
#
#   S=/scratch python3 tools/inside.py src/visual.frag [t1 t2 ...]
#
# Needs $S/preview and the lines "float B, S, V, G, M, Q;" and
# "\t\tp = ro + rd * t;" in main(), and main() ending with "o = vec4(...);".
# (The first frame of the tunnel, t = 48, has a few such pixels of its own:
# covered by the white flash of the drop.)
import os, re, subprocess, sys
import numpy as np
from PIL import Image

S = os.environ.get('S', '/tmp')
src = open(sys.argv[1]).read()
times = sys.argv[2:] or ['26', '30', '36', '40', '44', '132', '136', '140']
hit = '\t\tp = ro + rd * t;\n'
glob = 'float B, S, V, G, M, Q;'
if hit not in src or glob not in src:
	sys.exit('could not instrument the shader (see the comment at the top)')
src = src.replace(glob, 'float B, S, V, G, M, Q, IN = 0.;').replace(hit, hit + '\t\tif (t < 150.) IN = min(IN, d);\n')
src = re.sub(r'\n\to = vec4\(.*\);\n}\s*$', '\n\to = vec4(vec3(IN < -.001), 1);\n}\n', src)
fn, ppm = os.path.join(S, 'inside.frag'), os.path.join(S, 'inside.ppm')
open(fn, 'w').write(src)
tot = []
for t in times:
	subprocess.run([os.path.join(S, 'preview'), 'frame', fn, t, '1280', '720', ppm], capture_output=True, check=True)
	m = np.asarray(Image.open(ppm))[..., 0] > 127
	Image.fromarray((m * 255).astype(np.uint8)).save(os.path.join(S, f'inside_{t}.png'))
	tot.append(m.mean() * 100)
	print(f't={float(t):6.1f}: {tot[-1]:.3f}% of pixels end inside a solid', flush=True)
print(f'mean {np.mean(tot):.3f}%')
