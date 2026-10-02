#!/bin/sh
# Builds the macOS (Intel x86-64) version on Linux: nasm -> Mach-O object,
# ld64.lld against the 4k intro's libSystem .tbd stub (no Apple SDK), packed
# as a shell header + tar compressed with LZMA ("lzma alone"; bsdtar on macOS
# detects it when extracting).
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
UP=$(cd "$ROOT/.." && pwd)
OUT=${OUT:-$ROOT/build/mac}
mkdir -p "$OUT"
LD64=${LD64:-$(command -v ld64.lld-18 || command -v ld64.lld)}
nasm -f macho64 $NASMFLAGS -I "$ROOT/src/" "$ROOT/src/mac/main.asm" -o "$OUT/main.o"
"$LD64" -arch x86_64 -platform_version macos 10.13 10.13 -no_fixup_chains -no_uuid \
	-no_function_starts -headerpad 0 -x -o "$OUT/rozmery.macho" "$OUT/main.o" \
	"$UP/src/mac/tbd/libSystem.tbd"
T="$OUT/pack"
rm -rf "$T" && mkdir -p "$T"
cp "$OUT/rozmery.macho" "$T/a"
chmod 755 "$T/a"
(cd "$T" && tar --format=v7 --owner=0 --group=0 --numeric-owner --mtime=@0 -cf a.tar a)
"$UP/tools/xzbest.sh" "--format=lzma --lzma1=preset=9e,dict=64KiB" "$T/a.tar" > "$T/a.tar.lzma"
HDR='tail -c+NN "$0"|tar -xf - -C /tmp;exec /tmp/a'
LEN=$(printf '#!/bin/sh\n%s\n' "$HDR" | wc -c)   # the offset has two digits
HDR=$(echo "$HDR" | sed "s/NN/$((LEN + 1))/")
printf '#!/bin/sh\n%s\n' "$HDR" > "$OUT/rozmery-macos"
cat "$T/a.tar.lzma" >> "$OUT/rozmery-macos"
chmod +x "$OUT/rozmery-macos"
echo "mac: macho $(wc -c < "$OUT/rozmery.macho"), header $LEN + tar.lzma $(wc -c < "$T/a.tar.lzma") = $(wc -c < "$OUT/rozmery-macos") bytes"
