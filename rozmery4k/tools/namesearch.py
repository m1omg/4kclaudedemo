#!/usr/bin/env python3
# Development helper: searches the short identifier names that make the packed
# Linux file smallest (LZMA packs some namings better than others; the
# default, most frequent first, is already good) and writes tools/names.json,
# which tools/minify.py then uses. Hill climbing: swap the names of two
# identifiers of the same scope, keep the swap if the payload shrinks.
# Run it again after changing a shader (new identifiers get default names).
# (Adapted from the 4k intro's tools/namesearch.py.)
#
#   tools/namesearch.py [seconds=600 [seed=1 [output file]]]   (needs nasm on PATH)
#
# Several searches with different seeds can run in parallel (separate output
# files); keep the smallest.
import json
import lzma
import os
import random
import subprocess
import sys
import tempfile
import time

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import minify   # noqa: E402

FILES = ['synth.frag', 'scene.frag']
SRC = {f: open(os.path.join(ROOT, 'src', f)).read() for f in FILES}
TMP = tempfile.mkdtemp()
# LZMA settings close to what xzbest.sh picks for the Linux payload
FILTER = [{'id': lzma.FILTER_LZMA1, 'preset': 9 | lzma.PRESET_EXTREME, 'lc': 2, 'lp': 0, 'pb': 0,
	'nice_len': 24, 'mf': lzma.MF_BT2, 'depth': 16}]


def payload(names):
	mins = [minify.minify_one(SRC[f], table=names[f]) for f in FILES]
	samples = 104 * 16 * 5292
	with open(os.path.join(TMP, 'shaders.inc'), 'w') as fh:
		fh.write('SONG_SAMPLES equ %d\n%%define SONG_SECONDS %r\n' % (samples, samples / 44100))
		fh.write('synth_frag: db %s\nscene_frag: db %s\n' % (minify.nasm_db(mins[0]), minify.nasm_db(mins[1])))
	elf = os.path.join(TMP, 'elf')
	subprocess.run(['nasm', '-f', 'bin', '-I', TMP + '/', os.path.join(ROOT, 'src', 'linux', 'main.asm'), '-o', elf], check=True)
	return len(lzma.compress(open(elf, 'rb').read(), format=lzma.FORMAT_ALONE, filters=FILTER))


seconds = float(sys.argv[1]) if len(sys.argv) > 1 else 600
seed = int(sys.argv[2]) if len(sys.argv) > 2 else 1
out = sys.argv[3] if len(sys.argv) > 3 else minify.NAMES
names = {f: minify.assign(SRC[f], minify.load_names(f))[0] for f in FILES}
groups = [(f, s) for f in FILES for s in names[f] if len(names[f][s]) > 1]
best = start = payload(names)
print('start: %d bytes' % start, flush=True)
rng = random.Random(seed)
t0, n = time.time(), 0
while time.time() - t0 < seconds:
	n += 1
	f, s = rng.choice(groups)
	a, b = rng.sample(sorted(names[f][s]), 2)
	trial = {g: {sc: dict(m) for sc, m in names[g].items()} for g in FILES}
	trial[f][s][a], trial[f][s][b] = names[f][s][b], names[f][s][a]
	size = payload(trial)
	if size < best:
		best, names = size, trial
		print('%6d: %d bytes' % (n, best), flush=True)
json.dump(names, open(out, 'w'), indent=1, sort_keys=True)
print('%d tries: %d -> %d bytes; wrote %s' % (n, start, best, out))
