#!/usr/bin/env python3
# Development helper: compares a recording of what the intro played (or any
# render of the music) with the reference render of src/music.frag.
#
#   python3 tools/audiocmp.py reference.wav recording.wav
#
# reference.wav: preview music src/music.frag reference.wav 146   (llvmpipe is
#   the reference: LIBGL_ALWAYS_SOFTWARE=1 __GLX_VENDOR_LIBRARY_NAME=mesa)
# recording.wav: e.g. parec -d @DEFAULT_MONITOR@ --format=float32le --rate=44100
#   --channels=2 --file-format=wav rec.wav   while the intro runs
#
# Reports where the recording starts in the song, whether it is a bit-exact
# copy (a float32 path through PipeWire/PulseAudio is), silent gaps
# (underruns), and otherwise how similar the spectra are per 0.1 s.
import sys
import numpy as np

def load(fn):
	b = open(fn, 'rb').read()
	if b[:4] != b'RIFF' or b[8:12] != b'WAVE':
		sys.exit(f'{fn}: not a WAV file')
	i, fmt, data = 12, None, None
	while i + 8 <= len(b):
		cid, n = b[i:i + 4], int.from_bytes(b[i + 4:i + 8], 'little')
		body = b[i + 8:i + 8 + n] if n != 0xFFFFFFFF and n else b[i + 8:]
		if cid == b'fmt ':
			fmt = body
		elif cid == b'data':
			data = body
			break
		i += 8 + n + (n & 1)
	tag, ch, rate, bits = (int.from_bytes(fmt[0:2], 'little'), int.from_bytes(fmt[2:4], 'little'),
		int.from_bytes(fmt[4:8], 'little'), int.from_bytes(fmt[14:16], 'little'))
	if tag == 0xFFFE:
		tag = int.from_bytes(fmt[24:26], 'little')
	if tag == 3 and bits == 32:
		a = np.frombuffer(data[:len(data) // 4 * 4], np.float32).astype(np.float64)
	elif tag == 1 and bits in (16, 32):
		dt = np.int16 if bits == 16 else np.int32
		a = np.frombuffer(data[:len(data) // (bits // 8) * (bits // 8)], dt).astype(np.float64) / (2 ** (bits - 1))
	else:
		sys.exit(f'{fn}: unsupported WAV format {tag}/{bits} bit')
	if rate != 44100:
		print(f'warning: {fn} is {rate} Hz, not 44100 Hz: only the spectral comparison is meaningful')
	a = a[:len(a) // ch * ch].reshape(-1, ch)
	return a if ch == 2 else np.repeat(a[:, :1], 2, 1), bits

ref, _ = load(sys.argv[1])
rec, bits = load(sys.argv[2])
nz = np.nonzero(np.abs(rec).max(1) > 1e-6)[0]
if not len(nz):
	sys.exit('the recording is silent')
rec = rec[nz[0]:nz[-1] + 1]
print(f'recording: {len(rec) / 44100:.2f} s of sound ({bits} bit)')

# where in the song does the recording start? (exact match of the first samples)
start = None
q = 1.5 / 32768 if bits == 16 else 1e-6
for off in range(0, min(len(ref) - 4096, 30 * 44100)):
	if abs(ref[off, 0] - rec[0, 0]) <= q and np.abs(ref[off:off + 256] - rec[:256]).max() <= q:
		start = off
		break
if start is not None:
	print(f'starts at {start / 44100:.3f} s of the song')
	pos, rpos, gaps = 0, start, 0
	while pos < len(rec):
		z = np.abs(rec[pos:]).max(1) == 0
		end = len(rec)
		run = np.convolve(z, np.ones(64, int), 'valid') == 64 if len(z) >= 64 else np.zeros(0, bool)
		if run.any():
			end = pos + int(np.argmax(run))
		seg = rec[pos:end]
		d = np.abs(seg - ref[rpos:rpos + len(seg)]).max() if len(seg) and rpos + len(seg) <= len(ref) else np.inf
		print(f'  recording {pos / 44100:7.3f}-{end / 44100:7.3f} s = song {rpos / 44100:7.3f}-{(rpos + len(seg)) / 44100:7.3f} s, max difference {d:.2e}')
		rpos += len(seg)
		if end >= len(rec):
			break
		g = end
		while g < len(rec) and np.abs(rec[g]).max() == 0:
			g += 1
		print(f'  gap of {g - end} silent frames')
		gaps += 1
		pos = g
	if d <= q:
		sys.exit('verdict: BIT-EXACT copy of the reference' + (f' with {gaps} gap(s)' if gaps else ''))
	print('verdict: starts like the reference but differs later (see above); comparing spectra too')
else:
	print('no exact match with the reference: comparing spectra')

# compare spectra: 0.1 s frames of the recording against 10 ms steps of the song
F, w = 4096, np.hanning(4096)
def spec(x, hop):
	return np.array([np.log10(np.abs(np.fft.rfft(x[i:i + F] * w))[:930] + 1e-5) for i in range(0, len(x) - F, hop)])
A = spec(rec[:min(len(rec), 30 * 44100), 0], 4410)
R = spec(ref[:min(len(ref), 75 * 44100), 0], 441)
ks = range(0, len(A), max(1, len(A) // 16))
best = max(range(0, len(R) - 10 * len(A)), key=lambda s: np.mean([np.corrcoef(A[k], R[s + 10 * k])[0, 1] for k in ks]))
cc = np.array([np.corrcoef(A[k], R[best + 10 * k])[0, 1] for k in range(len(A)) if best + 10 * k < len(R)])
print(f'best alignment: song {best * 441 / 44100:.2f} s; spectrum correlation mean {cc.mean():.3f}, 10th percentile {np.percentile(cc, 10):.3f}')
print('(the same music resampled, 16-bit or with small skips gives > 0.9; a different sound gives much less)')
n = min(len(rec), 5 * 44100)
pk = np.argsort(-np.abs(np.fft.rfft(rec[:n, 0])))[:5] * 44100 / n
print('strongest frequencies in the first 5 s of the recording (Hz):', ', '.join(f'{f:.0f}' for f in pk))
