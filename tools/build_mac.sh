#!/bin/sh
# Builds the macOS (Intel x86-64) version on Linux: nasm -> Mach-O object,
# ld64.lld against a hand-written libSystem .tbd stub (no Apple SDK needed).
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
OUT=${OUT:-$ROOT/build/mac}
mkdir -p "$OUT"
nasm -f macho64 -I "$ROOT/src/" "$ROOT/src/mac/main.asm" -o "$OUT/main.o"
ld64.lld-18 -arch x86_64 -platform_version macos 10.13 10.13 -no_fixup_chains -no_uuid \
	-no_function_starts -headerpad 0 -x -o "$OUT/brana.macho" "$OUT/main.o" \
	"$ROOT/src/mac/tbd/libSystem.tbd"
ls -l "$OUT/brana.macho"
# pack: tiny shell header + tar compressed with LZMA ("lzma alone" format:
# 13 byte header, no xz container). bsdtar on macOS detects xz and lzma
# automatically when extracting, so no -J/--lzma option is needed.
T="$OUT/pack"
rm -rf "$T" && mkdir -p "$T"
cp "$OUT/brana.macho" "$T/a"
chmod 755 "$T/a"
(cd "$T" && tar --format=v7 --owner=0 --group=0 --numeric-owner --mtime=@0 -cf a.tar a)
"$ROOT/tools/xzbest.sh" "--format=lzma --lzma1=preset=9e,dict=64KiB" "$T/a.tar" > "$T/a.tar.lzma"
HDR='tail -c+NN "$0"|tar -xf - -C /tmp;exec /tmp/a'
LEN=$(printf '#!/bin/sh\n%s\n' "$HDR" | wc -c)   # the offset has two digits
HDR=$(echo "$HDR" | sed "s/NN/$((LEN + 1))/")
printf '#!/bin/sh\n%s\n' "$HDR" > "$OUT/brana-macos"
cat "$T/a.tar.lzma" >> "$OUT/brana-macos"
chmod +x "$OUT/brana-macos"
echo "header $LEN + tar.lzma $(wc -c < "$T/a.tar.lzma") = $(wc -c < "$OUT/brana-macos") bytes"
