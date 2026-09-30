#!/bin/sh
# Compresses $2 with xz using format options $1, trying a grid of LZMA
# parameters (only encoder-side options and lc/lp/pb, so any xz/liblzma can
# decode the result) and writes the smallest stream to stdout.
FMT=$1
IN=$2
best=
bestn=999999
for lc in 0 1 2 3; do
	for pb in 0 1 2; do
		for nice in 32 48 64 96 128 273; do
			for mf in bt2 bt3 bt4; do
				p="lc=$lc,lp=0,pb=$pb,nice=$nice,mf=$mf,depth=0"
				n=$(xz $FMT,$p -c "$IN" | wc -c)
				if [ "$n" -lt "$bestn" ]; then bestn=$n; best=$p; fi
			done
		done
	done
done
echo "xz: best $bestn bytes with $best" >&2
xz $FMT,$best -c "$IN"
