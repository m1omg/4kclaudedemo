#!/bin/sh
# Builds all three versions of ROZMERY into dist/ and checks the 8192 byte limit.
# Tools as for the 4k intro in the parent directory (see ../README.md):
# python3, glslang, nasm, xz, tar, clang, lld, wine + Crinkler 3.0
# (CRINKLER=/path/to/Crinkler.exe); for the shader check an X server with
# OpenGL and ../tools/preview.c compiled to $S/preview.
set -e
ROOT=$(cd "$(dirname "$0")" && pwd)
cd "$ROOT"
. ./song.sh                     # SAMPLES: the song length
if [ -n "$S" ] && [ -x "$S/preview" ]; then
	tools/check_shaders.sh
else
	python3 tools/minify.py --samples $SAMPLES src/synth.frag src/scene.frag -o src/shaders.h
	glslangValidator -S frag src/shaders.h.synth.frag.min
	glslangValidator -S frag src/shaders.h.scene.frag.min
fi
tools/build_win.sh ${MODE:-SLOW}
tools/build_linux.sh
tools/build_mac.sh
mkdir -p dist
cp build/win/rozmery.exe dist/rozmery-windows.exe
cp build/linux/rozmery dist/rozmery-linux
cp build/mac/rozmery-macos dist/rozmery-macos
chmod +x dist/rozmery-linux dist/rozmery-macos
echo
for f in dist/rozmery-windows.exe dist/rozmery-linux dist/rozmery-macos; do
	n=$(wc -c < "$f")
	printf '%-26s %5d bytes %s\n' "$f" "$n" "$([ "$n" -le 8192 ] && echo OK || echo 'TOO BIG')"
	[ "$n" -le 8192 ]
done
