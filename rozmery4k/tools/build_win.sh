#!/bin/sh
# Builds the Windows version: clang -> i386 COFF object -> Crinkler (via Wine),
# with the 4k intro's import libraries (../src/win/lib).
# Usage: tools/build_win.sh [FAST|SLOW|VERYSLOW]
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
UP=$(cd "$ROOT/.." && pwd)
CRINKLER=${CRINKLER:-/home/user/runestubbe/crinkler/releases/crinkler30b/Win32/Crinkler.exe}
MODE=${1:-SLOW}
OUT=${OUT:-$ROOT/build/win}
mkdir -p "$OUT"
export WINEDEBUG=-all WINEPREFIX=${WINEPREFIX:-/root/.wine32}
clang -target i686-pc-windows-msvc -Os -ffreestanding -fno-builtin -fno-stack-protector \
	-mno-stack-arg-probe -ffunction-sections -fdata-sections -fno-addrsig \
	-fno-unwind-tables -fno-asynchronous-unwind-tables $CFLAGS \
	-c "$ROOT/src/win/main.c" -o "$OUT/main.obj"
cp "$UP"/src/win/lib/*.lib "$OUT/"
cd "$OUT"
timeout 3600 wine "$CRINKLER" /OUT:rozmery.exe /ENTRY:entrypoint /SUBSYSTEM:WINDOWS \
	/COMPMODE:$MODE /ORDERTRIES:${ORDERTRIES:-4000} /UNSAFEIMPORT /REPORT:report.html \
	/EXPORT:NvOptimusEnablement=1 /EXPORT:AmdPowerXpressRequestHighPerformance=1 \
	/LIBPATH:. main.obj kernel32.lib user32.lib gdi32.lib opengl32.lib winmm.lib |
	grep -E "Final|error|warning" || true
echo "windows: $(wc -c < rozmery.exe) bytes"
