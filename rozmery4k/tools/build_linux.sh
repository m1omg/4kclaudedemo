#!/bin/sh
# Builds the Linux version: the whole ELF is assembled by nasm (-f bin) and
# packed behind the self-extracting stub of the 4k intro (../src/linux/stub.asm).
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
UP=$(cd "$ROOT/.." && pwd)
OUT=${OUT:-$ROOT/build/linux}
mkdir -p "$OUT"
nasm -f bin $NASMFLAGS -I "$ROOT/src/" "$ROOT/src/linux/main.asm" -o "$OUT/rozmery.elf"
chmod +x "$OUT/rozmery.elf"
nasm -f bin "$UP/src/linux/stub.asm" -o "$OUT/stub"
"$UP/tools/xzbest.sh" "--format=lzma --lzma1=preset=9e" "$OUT/rozmery.elf" > "$OUT/payload.lzma"
cat "$OUT/stub" "$OUT/payload.lzma" > "$OUT/rozmery"
chmod +x "$OUT/rozmery"
echo "linux: elf $(wc -c < "$OUT/rozmery.elf"), stub $(wc -c < "$OUT/stub") + payload $(wc -c < "$OUT/payload.lzma") = $(wc -c < "$OUT/rozmery") bytes"
