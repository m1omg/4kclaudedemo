#!/usr/bin/env python3
# Shrinks the macOS executable after ld64.lld by removing load-command data
# that dyld does not need (the bytes freed at the end of the load commands and
# in __LINKEDIT become zeros, which compress to almost nothing; no offsets
# move). Every option is separate, so each one can be tested on a real Mac.
#
#   machopp.py in out [--no-data-in-code] [--drop-sections __got,__bss,...]
#                     [--zero-symtab]
#
#   --no-data-in-code  remove the (empty) LC_DATA_IN_CODE command
#   --drop-sections    remove these section headers from their segments; the
#                      segments keep their addresses, sizes and contents
#   --zero-symtab      zero the counts in LC_SYMTAB / LC_DYSYMTAB and the
#                      tables themselves (binding uses LC_DYLD_INFO opcodes)
import struct
import sys

args = sys.argv[1:]
src, dst = args[0], args[1]
opts = args[2:]
drop = set()
if '--drop-sections' in opts:
	drop = set(opts[opts.index('--drop-sections') + 1].split(','))
data = bytearray(open(src, 'rb').read())
magic, _, _, _, ncmds, sizeofcmds = struct.unpack_from('<IiiIII', data, 0)
if magic != 0xFEEDFACF:
	sys.exit('machopp.py: not a 64-bit Mach-O file')

cmds, off = [], 32
for _ in range(ncmds):
	cmd, size = struct.unpack_from('<II', data, off)
	cmds.append(bytearray(data[off:off + size]))
	off += size

out = []
for c in cmds:
	cmd = struct.unpack_from('<I', c, 0)[0]
	if cmd == 0x29 and '--no-data-in-code' in opts:           # LC_DATA_IN_CODE
		if struct.unpack_from('<I', c, 12)[0]:
			sys.exit('machopp.py: LC_DATA_IN_CODE is not empty')
		continue
	if cmd == 0x19 and drop:                                   # LC_SEGMENT_64
		nsects = struct.unpack_from('<I', c, 64)[0]
		keep = [c[72 + 80 * k:152 + 80 * k] for k in range(nsects)
			if c[72 + 80 * k:88 + 80 * k].rstrip(b'\0').decode() not in drop]
		c = c[:72] + b''.join(keep)
		struct.pack_into('<I', c, 4, len(c))
		struct.pack_into('<I', c, 64, len(keep))
	if cmd == 0x2 and '--zero-symtab' in opts:                 # LC_SYMTAB: symoff nsyms stroff strsize
		symoff, nsyms, stroff, strsize = struct.unpack_from('<IIII', c, 8)
		data[symoff:symoff + nsyms * 16] = bytes(nsyms * 16)
		data[stroff:stroff + strsize] = bytes(strsize)
		struct.pack_into('<II', c, 12, 0, 0)
		struct.pack_into('<I', c, 20, 0)
	if cmd == 0xB and '--zero-symtab' in opts:                 # LC_DYSYMTAB
		indoff, nind = struct.unpack_from('<II', c, 56)
		data[indoff:indoff + nind * 4] = bytes(nind * 4)
		c[8:] = bytes(len(c) - 8)
	out.append(c)

new = b''.join(out)
data[16:24] = struct.pack('<II', len(out), len(new))
data[32:32 + sizeofcmds] = new + bytes(sizeofcmds - len(new))
open(dst, 'wb').write(data)
print('machopp.py: %d -> %d load commands, %d -> %d bytes of commands' % (ncmds, len(out), sizeofcmds, len(new)),
	file=sys.stderr)
