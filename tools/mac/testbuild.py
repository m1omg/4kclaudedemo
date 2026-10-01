#!/usr/bin/env python3
# Development helper (NOT part of the intro): builds variants of the macOS
# intro, each with one more byte-saving change, into tools/mac/test/, for
# tools/mac/test.sh to try on a real Mac. The release build is
# tools/build_mac.sh; this repeats its steps with options.
import os
import shutil
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
OUT = os.path.join(ROOT, 'build', 'mactest')
DEST = os.path.join(ROOT, 'tools', 'mac', 'test')
LD64 = os.environ.get('LD64') or shutil.which('ld64.lld-18') or shutil.which('ld64.lld')
ASM = open(os.path.join(ROOT, 'src', 'mac', 'main.asm')).read()


def sub(s, old, new):
	if s.count(old) != 1:
		sys.exit('testbuild.py: pattern not found once: %r' % old[:50])
	return s.replace(old, new)


def loc0(s):   # uniform location 0 instead of glGetUniformLocation (loc stays 0 in .bss)
	s = sub(s, 'F glGetUniformLocation\n', '')
	call = '\tmov edi, eax\n\tlea rsi, [uname]\n\tcall [rbx + glGetUniformLocation]\n\tmov [loc], eax\n'
	if s.count(call) not in (1, 2):   # (twice: with and without SCALE)
		sys.exit('testbuild.py: glGetUniformLocation call not found')
	s = s.replace(call, '')
	s = sub(s, 'uname:  db "u", 0\n', '')
	return sub(s, '"glGetUniformLocation", 0, ', '')


def short(s):  # /System/Library/Frameworks/X.framework/X (also the macsim path)
	if s.count('".framework/Versions/A/", x, 0') != 2:
		sys.exit('testbuild.py: framework path pattern changed')
	return s.replace('".framework/Versions/A/", x, 0', '".framework/", x, 0')


def scale(s):  # automatic render resolution (src/mac/main.asm -DSCALE)
	return '%define SCALE\n' + s


HDR0 = 'tail -c+NN "$0"|tar -xf - -C /tmp;exec /tmp/a'   # the release header
HDR1 = 'tail -n+3 "$0"|tar -xf - -C/tmp;exec /tmp/a'
HDR2 = 'tail -n+3 "$0"|tar x -C/tmp;/tmp/a'
CONTAINER = ['--no-data-in-code', '--drop-sections', '__got,__bss']
VARIANTS = [   # name, asm change, extra ld64 flags, machopp.py options, cut the tar trailer, header
	('base', None, [], [], False, HDR0),
	('noexp', None, ['-no_exported_symbols'], [], False, HDR0),
	('notrail', None, ['-no_exported_symbols'], [], True, HDR0),
	('nodic', None, ['-no_exported_symbols'], CONTAINER, True, HDR0),
	('nosym', None, ['-no_exported_symbols'], CONTAINER + ['--zero-symtab'], True, HDR0),
	('notext', None, ['-no_exported_symbols'], ['--no-data-in-code', '--drop-sections', '__got,__bss,__text', '--zero-symtab'], True, HDR0),
	('loc0', loc0, [], [], False, HDR0),
	('short', short, [], [], False, HDR0),
	('hdr1', None, [], [], False, HDR1),
	('hdr2', None, [], [], False, HDR2),
	('scale', scale, [], [], False, HDR0),
	('all', lambda s: scale(short(loc0(s))), ['-no_exported_symbols'],
		['--no-data-in-code', '--drop-sections', '__got,__bss,__text', '--zero-symtab'], True, HDR2),
]


def run(*a, **k):
	return subprocess.run(a, check=True, **k)


os.makedirs(DEST, exist_ok=True)
names = []
for name, asm, ldf, pp, notrail, hdr in VARIANTS:
	d = os.path.join(OUT, name)
	shutil.rmtree(d, ignore_errors=True)
	os.makedirs(os.path.join(d, 'pack'))
	open(os.path.join(d, 'main.asm'), 'w').write(asm(ASM) if asm else ASM)
	run('nasm', '-f', 'macho64', '-I', os.path.join(ROOT, 'src') + '/', os.path.join(d, 'main.asm'), '-o', os.path.join(d, 'main.o'))
	run(LD64, '-arch', 'x86_64', '-platform_version', 'macos', '10.13', '10.13', '-no_fixup_chains', '-no_uuid',
		'-no_function_starts', '-headerpad', '0', '-x', *ldf, '-o', os.path.join(d, 'lld.macho'), os.path.join(d, 'main.o'),
		os.path.join(ROOT, 'src', 'mac', 'tbd', 'libSystem.tbd'))
	a = os.path.join(d, 'pack', 'a')
	run(sys.executable, os.path.join(ROOT, 'tools', 'mac', 'machopp.py'), os.path.join(d, 'lld.macho'), a, *pp, stderr=subprocess.DEVNULL)
	os.chmod(a, 0o755)
	run('tar', '--format=v7', '--owner=0', '--group=0', '--numeric-owner', '--mtime=@0', '-cf', 'a.tar', 'a', cwd=os.path.join(d, 'pack'))
	tarf = os.path.join(d, 'pack', 'a.tar')
	if notrail:   # end right after the file's last (padded) 512-byte block
		n = 512 + (os.path.getsize(a) + 511) // 512 * 512
		t = open(tarf, 'rb').read()
		open(tarf, 'wb').write(t[:n])
	lz = run(os.path.join(ROOT, 'tools', 'xzbest.sh'), '--format=lzma --lzma1=preset=9e,dict=64KiB', tarf,
		stdout=subprocess.PIPE, stderr=subprocess.DEVNULL).stdout
	head = '#!/bin/sh\n%s\n' % hdr
	if 'NN' in head:   # tail -c+N starts at byte N (1-based); the offset has two digits
		head = head.replace('NN', str(len(head) + 1))
	blob = head.encode() + lz
	open(os.path.join(DEST, name), 'wb').write(blob)
	os.chmod(os.path.join(DEST, name), 0o755)
	# check: the header's own command, with bsdtar (libarchive, like the macOS
	# tar), extracts exactly the processed Mach-O
	cmd = hdr.replace('NN', head.split('-c+')[1][:2] if 'NN' in hdr else '').split('|')[0].replace('"$0"', os.path.join(DEST, name))
	out = subprocess.run(cmd + ' | bsdtar -xOf - a', shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
	ok = out.returncode == 0 and out.stdout == open(a, 'rb').read()
	print('%-8s %5d bytes  bsdtar: %s%s' % (name, len(blob), 'ok' if ok else 'FAILED ', out.stderr.decode().strip()))
	names.append(name)
open(os.path.join(DEST, 'list'), 'w').write(' '.join(names) + '\n')
