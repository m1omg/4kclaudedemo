#!/bin/sh
# Builds the Linux version: the whole ELF is assembled by nasm (-f bin).
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
OUT=${OUT:-$ROOT/build/linux}
mkdir -p "$OUT"
nasm -f bin -I "$ROOT/src/" "$ROOT/src/linux/main.asm" -o "$OUT/brana.elf"
chmod +x "$OUT/brana.elf"
ls -l "$OUT/brana.elf"
# pack: ELF stub + lzma stream (xzcat at runtime)
nasm -f bin "$ROOT/src/linux/stub.asm" -o "$OUT/stub"
"$ROOT/tools/xzbest.sh" "--format=lzma --lzma1=preset=9e" "$OUT/brana.elf" > "$OUT/payload.lzma"
cat "$OUT/stub" "$OUT/payload.lzma" > "$OUT/brana"
chmod +x "$OUT/brana"
echo "stub $(wc -c < "$OUT/stub") + payload $(wc -c < "$OUT/payload.lzma") = $(wc -c < "$OUT/brana") bytes"
