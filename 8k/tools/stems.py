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
 'snare': ('m += (g * float(sb >> 2 & 1) + h * float(sb >> 2 == 2)) *', 'm += 0. *'),
 'hats': ('hp * (g * (sb % 4 == 2', '0. * hp * (g * (sb % 4 == 2'),
 'crash': ('float(0x1F8F0FC >> sec & 1) * hp * exp(-y * 1.2) * .2', '0. * hp'),
 'toms': ('if (bar % 8 == 5 && sb > 7)', 'if (false)'),
 'risers': ('if (bar == 4 || bar == 5 || bar == 44 || bar == 45 || bar == 62 || bar == 63 || bar == 76 || bar == 77)', 'if (false)'),
 'whoosh': ('if (y > 0. && y < 1.)\n\t\tm += (n * .6', 'if (false)\n\t\tm += (n * .6'),
 'hits': ('if (x > 0. && x < 1.5) {', 'if (false) {'),
 'boom': ('if (bar == 64 || bar == 65) {', 'if (false) {'),
 'bass': ('if ((0x3FEF9FC >> sec & 1) > 0) {', 'if (false) {'),
 'pad': ('for (int q = 0; q < 2; q++) {\n\t\tx = tc', 'for (int q = 0; q < 0; q++) {\n\t\tx = tc'),
 'bells': ('if (bar > 5 && bar < 30) {', 'if (false) {'),
 'arp': ('for (int k = 0; k < 4; k++) {\n\t\tint s2 = max', 'for (int k = 0; k < 0; k++) {\n\t\tint s2 = max'),
 'lead': ('for (int k = 0; k < 3; k++) {\n\t\tint s2 = st - 3 * k, b2', 'for (int k = 0; k < 0; k++) {\n\t\tint s2 = st - 3 * k, b2'),
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
    subprocess.run([S + '/preview', 'music', fn, wav, '200'], check=True, env=dict(os.environ, DISPLAY=os.environ.get('DISPLAY', ':99')), stderr=subprocess.DEVNULL)
    d = open(wav, 'rb').read()
    return np.frombuffer(d[44:], dtype=np.float32).reshape(-1, 2).astype(np.float64)
full = render(lin(src), 'full')
bar = 84672
secs = [(0, 6), (6, 14), (14, 22), (22, 30), (30, 34), (34, 37), (37, 38), (38, 46), (46, 54), (54, 62), (62, 64), (64, 66), (66, 70), (70, 78), (78, 86), (86, 94), (94, 98), (98, 104)]
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
    if nm in ('kick', 'snare', 'hats', 'crash', 'toms', 'risers', 'whoosh', 'hits', 'boom'):
        continue
    m = st.mean(1).copy()
    d2 = np.abs(np.diff(m, 2))
    lvl = np.convolve(np.abs(m), np.ones(441) / 441, 'same')[1:-1]
    bad = np.where(d2 > 0.02 + lvl * 0.5)[0]
    if len(bad):
        print('   clicks? %d, first at bars %s' % (len(bad), ' '.join('%.3f' % (k / bar) for k in bad[:8])))
