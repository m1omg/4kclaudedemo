#!/bin/sh
# Builds all three versions of BRANA into dist/ and checks the 4096 byte limit.
#
# Needs (Ubuntu): python3, glslang-tools, nasm, xz-utils, tar, clang, lld (ld64.lld),
# llvm (llvm-dlltool), wine + wine32 (for Crinkler), Crinkler 3.0
# (set CRINKLER=/path/to/Crinkler.exe) and, for the shader check, an X server
# with OpenGL (e.g. xvfb-run) plus tools/preview.c compiled to $S/preview.
set -e
ROOT=$(cd "$(dirname "$0")" && pwd)
cd "$ROOT"
if [ -n "$S" ] && [ -x "$S/preview" ]; then
	tools/check_shaders.sh
else
	python3 tools/minify.py src/music.frag src/visual.frag -o src/shaders.h
	glslangValidator -S frag src/shaders.h.music.frag.min
	glslangValidator -S frag src/shaders.h.visual.frag.min
fi
tools/build_win.sh ${MODE:-SLOW}
tools/build_linux.sh
tools/build_mac.sh
mkdir -p dist
cp build/win/brana.exe dist/brana-windows.exe
cp build/linux/brana dist/brana-linux
cp build/mac/brana-macos dist/brana-macos
chmod +x dist/brana-linux dist/brana-macos
echo
for f in dist/brana-windows.exe dist/brana-linux dist/brana-macos; do
	n=$(wc -c < "$f")
	printf '%-24s %5d bytes %s\n' "$f" "$n" "$([ "$n" -le 4096 ] && echo OK || echo 'TOO BIG')"
	[ "$n" -le 4096 ]
done
