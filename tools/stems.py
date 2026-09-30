#!/usr/bin/env python3
# Development helper: renders single instruments ("stems") of music.frag by
# replacing the final mix expression, then checks pitch, level and clicks.
import os, re, subprocess, sys
import numpy as np

S = os.environ.get('S', '/tmp')
PREVIEW = os.path.join(S, 'preview')
src = open(sys.argv[1]).read()
stems = sys.argv[2].split(',') if len(sys.argv) > 2 else ['kick', 'hats', 'clap', 'roll', 'riser', 'crash', 'bass', 'pad', 'arp', 'lead']
secs = float(os.environ.get('SECS', '146'))

def render(expr, name):
    s2 = re.sub(r'vec2 m = [^;]*;', 'vec2 m = vec2(%s);' % expr, src, flags=re.S)
    s2 = s2.replace('return tanh(m * fade * 1.2);', 'return m;')
    fn = os.path.join(S, 'stem_%s.frag' % name)
    open(fn, 'w').write(s2)
    wav = os.path.join(S, 'stem_%s.wav' % name)
    subprocess.run([PREVIEW, 'music', fn, wav, str(secs)], check=True, env=dict(os.environ, DISPLAY=':99'),
                   stderr=subprocess.DEVNULL)
    d = open(wav, 'rb').read()
    return np.frombuffer(d[44:], dtype=np.float32).reshape(-1, 2).copy()

for st in stems:
    a = render(st, st)
    m = a.mean(1)
    bar = 88200
    rms = [float(np.sqrt((m[b * bar:(b + 1) * bar] ** 2).mean())) for b in range(len(m) // bar)]
    active = [b for b, r in enumerate(rms) if r > 1e-3]
    # click detector: second difference much larger than local level
    d2 = np.abs(np.diff(m, 2))
    loc = np.convolve(np.abs(m), np.ones(441) / 441, mode='same')[1:-1] + 1e-4
    ratio = d2 / loc
    worst = np.argsort(ratio)[-5:][::-1]
    print(f"== {st}: peak {np.abs(a).max():.3f}, active bars {active[:3]}..{active[-3:] if active else []}")
    print("   rms/bar:", ' '.join(f"{r:.2f}" for r in rms))
    print("   max d2/level:", [(int(w), round(float(ratio[w]), 1), round(float(m[w + 1]), 3)) for w in worst])
