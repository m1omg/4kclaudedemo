#!/usr/bin/env python3
"""Development helper: per-instrument stems of src/synth.frag.

Every stem is the full mix minus the mix with that instrument switched off
(both before the soft clip, so the difference is exact). Prints A-weighted RMS
levels per section of the song and flags clicks in the tonal instruments
(outside the rewind at bars 34-36, which is meant to be harsh).

    S=/scratch python3 tools/stems.py src/synth.frag [kick,bass,...]

Needs $S/preview (gcc -O2 -o $S/preview ../tools/preview.c -lGL -lX11 -lm), an
X display and numpy. If the synth's code changes, update OFF below: each entry
is (text that turns the instrument on, replacement that turns it off).
"""
import os, subprocess, sys
import numpy as np
S = os.environ.get('S', '/tmp')
src = open(sys.argv[1]).read()
OFF = {
 'kick': ('vec2 m = kick * vec2(sin(330. * tb - 40. * exp(-tb * 30.)))', 'vec2 m = vec2(0)'),
 'hats': ('float(0x1F8F0F8 >> sec & 1)', '0.'),
 'clap': ('float(0x1F0E0F0 >> sec & 1)', '0.'),
 'crash': ('float(0x1F0F0FC >> sec & 1) * hp * exp(-y * 1.2)', '0. * hp * exp(-y * 1.2)'),
 'roll': ('if (bar == 44 || bar == 45 || bar == 76 || bar == 77)', 'if (false)'),
 'boom': ('if (bar == 64 || bar == 65)', 'if (false)'),
 'riser': ('if (bar == 62 || bar == 63)', 'if (false)'),
 'bass': ('if ((0x1FEFCFC >> sec & 1) > 0', 'if (false && (0x1FEFCFC >> sec & 1) > 0'),
 'pad': ('for (int q = 0; q < 2; q++)', 'for (int q = 0; q < 0; q++)'),
 'marimba': ('if (bar > 5 && bar < 30)', 'if (false)'),
 'falls': ('if (bar == 36 || bar == 37)', 'if (false)'),
 'arp': ('for (int k = 0; k < 4; k++)', 'for (int k = 0; k < 0; k++)'),
 'melody': ('for (int k = 0; k < 3; k++)', 'for (int k = 0; k < 0; k++)'),
}
def lin(s):
    i = s.index('return tanh(')
    j = s.index(';', i)
    expr = s[i + len('return tanh('):j - 1]
    return s[:i] + 'return ' + expr + s[j:]
def render(s, name):
    os.makedirs(os.path.join(S, 'stems'), exist_ok=True)
    fn = os.path.join(S, 'stems', name + '.frag'); open(fn, 'w').write(s)
    wav = os.path.join(S, 'stems', name + '.wav')
    subprocess.run([S + '/preview', 'music', fn, wav, '193'], check=True, env=dict(os.environ, DISPLAY=os.environ.get('DISPLAY', ':99')), stderr=subprocess.DEVNULL)
    d = open(wav, 'rb').read()
    return np.frombuffer(d[44:], dtype=np.float32).reshape(-1, 2).astype(np.float64)
full = render(lin(src), 'full')
bar = 84672
secs = [(0, 6), (6, 14), (14, 30), (30, 34), (34, 36), (36, 38), (38, 46), (46, 54), (54, 62), (62, 64), (64, 66), (66, 70), (70, 78), (78, 86), (86, 98), (98, 100)]
def aw(x):
    # crude A-weighting via FFT per section
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / 44100)
    f2 = f * f
    ra = (12194 ** 2 * f2 * f2) / ((f2 + 20.6 ** 2) * np.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12194 ** 2) + 1e-30)
    return np.fft.irfft(X * ra * 1.2589, len(x))
names = sys.argv[2].split(',') if len(sys.argv) > 2 else list(OFF)
print('%-8s' % 'section', ' '.join('%7s' % ('%d-%d' % s) for s in secs))
def row(name, a):
    m = a.mean(1)
    vals = []
    for s0, s1 in secs:
        x = m[s0 * bar:s1 * bar]
        vals.append(np.sqrt((aw(x) ** 2).mean()))
    print('%-8s' % name, ' '.join('%7.3f' % v for v in vals))
row('FULL', full)
for nm in names:
    a, b = OFF[nm]
    assert a in src, nm
    st = full - render(lin(src.replace(a, b, 1)), nm)
    np.save(os.path.join(S, 'stems', nm + '.npy'), st.astype(np.float32))
    row(nm, st)
    if nm in ('hats', 'clap', 'crash', 'roll', 'riser', 'boom'):
        continue
    m = st.mean(1).copy()
    m[34 * bar:36 * bar] = 0   # (the rewind)
    d2 = np.abs(np.diff(m, 2))
    lvl = np.convolve(np.abs(m), np.ones(441) / 441, 'same')[1:-1]
    bad = np.where(d2 > 0.02 + lvl * 0.5)[0]
    if len(bad):
        print('   clicks? %d, first at bars %s' % (len(bad), ' '.join('%.3f' % (k / bar) for k in bad[:8])))
