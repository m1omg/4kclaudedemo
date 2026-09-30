#!/bin/sh
# macsim: runs the macOS version's machine code on Linux. The macOS assembly
# is assembled as ELF and fake GLUT/OpenGL/AudioToolbox "frameworks" are
# installed at the macOS framework paths (needs root for /System).
set -e
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
D=$(dirname "$0")
OUT=${OUT:-$ROOT/build/macsim}
mkdir -p "$OUT"
F=/System/Library/Frameworks
mkdir -p $F/GLUT.framework/Versions/A $F/OpenGL.framework/Versions/A $F/AudioToolbox.framework/Versions/A
gcc -shared -fPIC -o $F/GLUT.framework/Versions/A/GLUT "$D/glut.c" -lglut -ldl
gcc -shared -fPIC -o $F/OpenGL.framework/Versions/A/OpenGL "$D/gl.c" -Wl,--no-as-needed -lGL
gcc -shared -fPIC -o $F/AudioToolbox.framework/Versions/A/AudioToolbox "$D/audio.c" -lasound -lpthread
nasm -f elf64 -D_dlopen=dlopen -D_dlsym=dlsym -D_main=main -I "$ROOT/src/" "$ROOT/src/mac/main.asm" -o "$OUT/main.o"
gcc -o "$OUT/brana-macsim" "$OUT/main.o" -ldl -Wl,-z,noexecstack
echo "built $OUT/brana-macsim"
