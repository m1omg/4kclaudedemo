#!/bin/sh
# Minifies the shaders and verifies that the minified versions are valid
# GLSL 3.30 and render exactly the same audio and frames as the sources
# (compat path) and also compile in a 3.3 core context (macOS path).
# Needs $S/preview (tools/preview.c) and python3 with numpy and Pillow
# (or set PYTHON=/path/to/python).
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
S=${S:-/tmp}
P=$S/preview
export DISPLAY=${DISPLAY:-:99}
cd "$ROOT"
python3 tools/minify.py src/music.frag src/visual.frag -o src/shaders.h
glslangValidator -S frag src/shaders.h.music.frag.min
glslangValidator -S frag src/shaders.h.visual.frag.min
$P music src/music.frag $S/chk_a.wav 146 2>/dev/null
$P music src/shaders.h.music.frag.min $S/chk_b.wav 146 2>/dev/null
cmp $S/chk_a.wav $S/chk_b.wav
$P -core music src/shaders.h.music.frag.min $S/chk_c.wav 146 2>/dev/null
cmp $S/chk_a.wav $S/chk_c.wav
for t in 5 30 47.9 62 88 112 130; do
	$P frame src/visual.frag $t 160 90 $S/chk_a.ppm 2>/dev/null
	$P frame src/shaders.h.visual.frag.min $t 160 90 $S/chk_b.ppm 2>/dev/null
	$P -core frame src/shaders.h.visual.frag.min $t 160 90 $S/chk_c.ppm 2>/dev/null
	cmp $S/chk_a.ppm $S/chk_b.ppm
	${PYTHON:-python3} -c "
import sys, numpy as np
from PIL import Image
a = np.asarray(Image.open('$S/chk_a.ppm')).astype(int); c = np.asarray(Image.open('$S/chk_c.ppm')).astype(int)
d = np.abs(a - c)
bad = (d.max(2) > 8).mean()
print('t=$t core vs compat: max diff', d.max(), 'pixels off by >8:', round(100 * bad, 3), '%')
sys.exit(int(bad > .005))"
done
echo "shaders OK: $(wc -c < src/shaders.h.music.frag.min) + $(wc -c < src/shaders.h.visual.frag.min) bytes minified"
