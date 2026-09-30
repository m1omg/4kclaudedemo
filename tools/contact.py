#!/usr/bin/env python3
# Development helper: renders frames of visual.frag at the given times and
# assembles them into one labelled contact sheet.
#   contact.py visual.frag out.png t1 t2 ... [--size 384x216] [--cols 4]
import os, subprocess, sys
from PIL import Image, ImageDraw

S = os.environ.get('S', '/tmp')
args = sys.argv[1:]
size, cols = (384, 216), 4
if '--size' in args:
    i = args.index('--size'); size = tuple(map(int, args[i + 1].split('x'))); del args[i:i + 2]
if '--cols' in args:
    i = args.index('--cols'); cols = int(args[i + 1]); del args[i:i + 2]
frag, out, times = args[0], args[1], [float(t) for t in args[2:]]
w, h = size
rows = (len(times) + cols - 1) // cols
sheet = Image.new('RGB', (cols * w, rows * h))
env = dict(os.environ, DISPLAY=os.environ.get('DISPLAY', ':99'))
for k, t in enumerate(times):
    ppm = os.path.join(S, 'frame_%d.ppm' % k)
    r = subprocess.run([os.path.join(S, 'preview'), 'frame', frag, str(t), str(w), str(h), ppm], env=env,
                       capture_output=True, text=True)
    if r.returncode:
        print(r.stderr); sys.exit(1)
    im = Image.open(ppm)
    ImageDraw.Draw(im).text((4, 4), '%.1fs' % t, fill=(255, 255, 0))
    sheet.paste(im, ((k % cols) * w, (k // cols) * h))
sheet.save(out)
print(out)
