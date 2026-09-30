#!/bin/sh
# Builds the Windows version: clang -> i386 COFF object -> Crinkler (run via Wine).
# Usage: tools/build_win.sh [FAST|SLOW|VERYSLOW]
# The two exports ask hybrid laptops (NVIDIA Optimus, AMD PowerXpress) for the
# fast GPU. On Wine 11 (WoW64, e.g. Arch) use crinkler30b/Win64/Crinkler.exe.
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
CRINKLER=${CRINKLER:-/home/user/runestubbe/crinkler/releases/crinkler30b/Win32/Crinkler.exe}
MODE=${1:-SLOW}
OUT=${OUT:-$ROOT/build/win}
mkdir -p "$OUT"
export WINEDEBUG=-all WINEPREFIX=${WINEPREFIX:-/root/.wine32}

clang -target i686-pc-windows-msvc -Os -ffreestanding -fno-builtin -fno-stack-protector \
	-mno-stack-arg-probe -ffunction-sections -fdata-sections -fno-addrsig \
	-fno-unwind-tables -fno-asynchronous-unwind-tables \
	-c "$ROOT/src/win/main.c" -o "$OUT/main.obj"
cp "$ROOT"/src/win/lib/*.lib "$OUT/"
cd "$OUT"
timeout 3600 wine "$CRINKLER" /OUT:brana.exe /ENTRY:entrypoint /SUBSYSTEM:WINDOWS \
	/COMPMODE:$MODE /ORDERTRIES:${ORDERTRIES:-4000} /UNSAFEIMPORT /REPORT:report.html \
	/EXPORT:NvOptimusEnablement=1 /EXPORT:AmdPowerXpressRequestHighPerformance=1 \
	/LIBPATH:. main.obj kernel32.lib user32.lib gdi32.lib opengl32.lib winmm.lib |
	grep -E "size|Final|error|warning" || true
ls -l brana.exe
