#!/bin/sh
# Minifies the shaders and verifies that the minified versions are valid
# GLSL 3.30, render exactly the same music and frames as the sources (compat
# path, as on Windows/Linux) and compile in a 3.3 core context (macOS path).
# The core context's frames may differ in up to 2 % of the pixels (160x90): in
# the flight over the Mandelbulb, the fractal's colour boundaries move with the
# last bit of float precision (thin lines; at 640x360 about 0.3 %).
# Needs $S/preview (gcc -O2 -o $S/preview ../tools/preview.c -lGL -lX11 -lm)
# and python3 with numpy and Pillow (or PYTHON=...).
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
S=${S:-/tmp}
P=$S/preview
export DISPLAY=${DISPLAY:-:99}
cd "$ROOT"
. ./song.sh
SECS=$((SAMPLES / 44100 + 1))
python3 tools/minify.py --samples $SAMPLES src/synth.frag src/scene.frag -o src/shaders.h
glslangValidator -S frag src/shaders.h.synth.frag.min
glslangValidator -S frag src/shaders.h.scene.frag.min
$P music src/synth.frag $S/rz_a.wav $SECS 2>$S/rz_log || { cat $S/rz_log; exit 1; }
$P music src/shaders.h.synth.frag.min $S/rz_b.wav $SECS 2>/dev/null
cmp $S/rz_a.wav $S/rz_b.wav
$P -core music src/shaders.h.synth.frag.min $S/rz_c.wav $SECS 2>/dev/null
cmp $S/rz_a.wav $S/rz_c.wav
for t in ${TIMES:-5 30 60 70 80 100 110 125 140 150 165 180 195}; do
	$P frame src/scene.frag $t 160 90 $S/rz_a.ppm 2>/dev/null
	$P frame src/shaders.h.scene.frag.min $t 160 90 $S/rz_b.ppm 2>/dev/null
	$P -core frame src/shaders.h.scene.frag.min $t 160 90 $S/rz_c.ppm 2>/dev/null
	cmp $S/rz_a.ppm $S/rz_b.ppm
	${PYTHON:-python3} -c "
import sys, numpy as np
from PIL import Image
a = np.asarray(Image.open('$S/rz_a.ppm')).astype(int); c = np.asarray(Image.open('$S/rz_c.ppm')).astype(int)
d = np.abs(a - c)
bad = (d.max(2) > 8).mean()
print('t=$t core vs compat: max diff', d.max(), 'pixels off by >8:', round(100 * bad, 3), '%')
sys.exit(int(bad > .02))"
done
echo "shaders OK: $(wc -c < src/shaders.h.synth.frag.min) + $(wc -c < src/shaders.h.scene.frag.min) bytes minified"
