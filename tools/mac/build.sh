#!/bin/sh
# Builds the Mac measuring tool tools/mac/macbench (macOS x86-64, cross-compiled
# on Linux without the Apple SDK, like the intro) and build/mac/macbench-linux,
# a Linux twin with freeglut for testing it on a PC. Not part of the intro.
set -e
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
OUT=$ROOT/build/mac
mkdir -p "$OUT"
python3 "$ROOT/tools/mac/variants.py" "$OUT"
LD64=${LD64:-$(command -v ld64.lld-18 || command -v ld64.lld)}
FLAGS="-O2 -fno-builtin -fno-stack-protector -fno-math-errno -fno-strict-aliasing -I $OUT"
clang -target x86_64-apple-macos10.13 -ffreestanding $FLAGS -c "$ROOT/tools/mac/macbench.c" -o "$OUT/macbench.o"
"$LD64" -arch x86_64 -platform_version macos 10.13 10.13 -o "$ROOT/tools/mac/macbench" "$OUT/macbench.o" \
	"$ROOT/tools/mac/libSystem.tbd"
gcc $FLAGS -o "$OUT/macbench-linux" "$ROOT/tools/mac/macbench.c" -ldl
ls -l "$ROOT/tools/mac/macbench" "$OUT/macbench-linux"
