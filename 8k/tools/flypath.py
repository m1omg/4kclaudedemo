#!/usr/bin/env python3
"""Development helper: the flight over the Mandelbulb.

    python3 tools/flypath.py            # check the camera path (needs numpy)
    python3 tools/flypath.py design     # recompute the flight's control points

Check: mirrors the bulb's distance estimate and the camera of src/scene.frag
(the `B > 62.` branch of camera(), with the control points K read from the
shader) in float64. It prints, along the whole bulb section, the distance
from the camera to the fractal's surface in bulb units (the shader scales
them by 5), and how fast the view turns. The distance must stay positive
with a margin: in the flight the camera is only ~0.001-0.01 above the
surface. A sudden jump in the turn rates shows up as a jerk on screen.

Design: the route is the list of waypoints ROUTE below (bar, latitude,
longitude), chosen by eye on a map of the surface radius over directions:
off the causeway along the equator where the dive ends, south into a forest
of buds, down a valley and up a giant formation. The design maps the surface
radius around the route (takes about a minute), takes for each point of the
route the highest surface within ~0.005 rad, smooths it (a running maximum
from 0.5 bar back to 1.5 bars ahead, then a 1.3-bar moving average, never
below the running maximum) and adds the flight height 0.0035. It prints the
control points for the shader, one per bar: bars 77 and 78 on the dive's
path (so that the flight continues it), the route's bars 79-96 and 97-101
extrapolated (the camera climbs out by then).
"""
import os
import re
import sys

import numpy as np

# (bar, latitude, longitude) - the latitude grows to the south
ROUTE = [(78, 1.5708, -.66), (79, 1.5708, -.69), (80, 1.575, -.72), (81, 1.59, -.75), (82, 1.61, -.775), (83, 1.628, -.8),
         (84, 1.64, -.83), (85, 1.645, -.865), (86, 1.642, -.9), (87, 1.65, -.935), (88, 1.668, -.965), (89, 1.685, -.995),
         (90, 1.692, -1.03), (91, 1.69, -1.065), (92, 1.68, -1.1), (93, 1.665, -1.135), (94, 1.645, -1.165), (95, 1.625, -1.195),
         (96, 1.61, -1.225)]


def de(p, iters=8):
    """the shader's bulb() in bulb units (power 8, trig form, phase H = 0)"""
    z = p.copy()
    r = np.linalg.norm(z, axis=-1)
    d = np.ones_like(r)
    alive = r < 2
    for _ in range(iters):
        rr = np.where(r > 0, r, 1e-30)
        a = np.arccos(np.clip(z[..., 1] / rr, -1, 1)) * 8
        b = np.arctan2(z[..., 2], z[..., 0]) * 8
        dn = 8 * rr ** 7 * d + 1
        zn = (rr ** 8)[..., None] * np.stack([np.sin(a) * np.cos(b), np.cos(a), np.sin(a) * np.sin(b)], -1) + p
        z = np.where(alive[..., None], zn, z)
        d = np.where(alive, dn, d)
        r = np.linalg.norm(z, axis=-1)
        alive &= r < 2
    return .5 * np.log(r) * r / d


def ss(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def nrm(x):
    return x / np.linalg.norm(x, axis=-1, keepdims=True)


def sph(s):
    """(latitude, longitude, radius) -> bulb space"""
    return np.stack([np.sin(s[..., 0]) * np.cos(s[..., 1]), np.cos(s[..., 0]), np.sin(s[..., 0]) * np.sin(s[..., 1])], -1) * s[..., 2:3]


def shader_K():
    src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'scene.frag')).read()
    body = re.search(r'const vec3 K\[\d+\] = vec3\[\]\((.*?)\);', src, re.S).group(1)
    return np.array([[float(x) for x in v.split(',')] for v in re.findall(r'vec3\(([^)]*)\)', body)])


def fly(K, t):
    """the shader's fly(): Catmull-Rom through K (bars 77, 78, ...), then on along the orbit"""
    g = np.clip(t, 78, 99.9) - 78
    i = np.floor(g).astype(int)
    g = (g - i)[..., None]
    a, b, c, d = K[i], K[i + 1], K[i + 2], K[i + 3]
    s = .5 * (2 * b + (c - a) * g + (2 * a - 5 * b + 4 * c - d) * g * g + (3 * (b - c) + d - a) * g ** 3)
    s[..., 1] -= .03 * np.maximum(t - 99.9, 0)
    return s


def dive(B):
    """the dive onto the causeway (bars 62-78): latitude, longitude, radius"""
    b, k = np.clip((B - 70) / 8, 0, 1), ss(70, 78, B)
    ph = -.1376 - .0306 * (B - 70) - .0694 * np.where(B < 70, B - 70, 8 * (b - b ** 3 + b ** 4 * .5))
    crest = .88 - .106 * (ph + .898) ** 2
    return np.stack([1.39 + .1808 * k, ph, crest + (.955 - crest) * ss(-.67, -.6, ph) + np.exp(.8671 * (1 - k) - 5.116 * k)], -1)


def camera(K, B):
    """camera position (bulb units, from the bulb's centre), forward and up vectors for bars B (array)"""
    k, c, e = ss(70, 78, B), ss(95, 100, B), ss(78, 79, B)
    f = (k * (1 - c))[..., None]
    s = np.where((B > 78)[..., None], fly(K, B), dive(B))
    s = np.stack([s[..., 0] * (1 - c) + 1.39 * c, s[..., 1], np.exp(np.log(s[..., 2] - .8) * (1 - c) + .9339 * c) + .8], -1)
    v = sph(np.stack([s[..., 0], s[..., 1], np.ones_like(B)], -1))
    ro = v * s[..., 2:3]
    p = sph(fly(K, B))
    w = sph(fly(K, B + .35)) - p - v * .0015
    w = nrm(w - v * np.sum(w * v, -1, keepdims=True) * .7)
    ph = dive(B)[..., 1]
    w0 = np.stack([np.sin(ph), 0 * ph, -np.cos(ph)], -1) - v * .12
    w = w0 + (w - w0) * e[..., None]
    o = ro * 5   # (world units)
    ta = np.where((B < 78)[..., None], (o + w) * f, o + nrm(-o) + (w - nrm(-o)) * f)
    a = sph(fly(K, B + 1)) - 2 * p + sph(fly(K, B - 1))
    x = nrm(np.cross(w, v))
    up = np.array([0, 1., 0])
    up = nrm(up + (v + x * (np.sum(a * x, -1) * 30 * e)[..., None] - up) * f)
    fw = nrm(ta - o)
    rt = nrm(np.cross(fw, up))
    return ro, fw, np.cross(rt, fw)


def check():
    K = shader_K()
    B = np.arange(62, 104.0001, .002)
    ro, fw, up = camera(K, B)
    d = de(ro)
    i = np.argmin(d)
    print('closest approach: %.5f at bar %.3f' % (d[i], B[i]))
    for b in range(62, 105, 2):
        j = np.argmin(np.abs(B - b))
        print('bar %3d: distance to the surface %.5f' % (b, d[j]))
    turn = np.degrees(np.arccos(np.clip(np.sum(fw[1:] * fw[:-1], -1), -1, 1))) / .002
    roll = np.degrees(np.arccos(np.clip(np.sum(up[1:] * up[:-1], -1), -1, 1))) / .002
    print('the view turns at most %.0f deg/bar (bar %.2f), its up vector %.0f deg/bar (bar %.2f)'
          % (turn.max(), B[np.argmax(turn)], roll.max(), B[np.argmax(roll)]))
    if d.min() <= 0:
        raise SystemExit('the camera touches the surface')


def catmull(P, t):
    """Catmull-Rom through the rows of P at t (0 .. len(P) - 1), the end points doubled"""
    t = np.clip(t, 0, len(P) - 1.000001)
    i = np.floor(t).astype(int)
    u = (t - i)[:, None]
    a, b, c, d = (P[np.clip(i + j, 0, len(P) - 1)] for j in (-1, 0, 1, 2))
    return .5 * (2 * b + (c - a) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (3 * (b - c) + d - a) * u ** 3)


def design():
    W = np.array(ROUTE, float)
    # the map: the surface radius over directions, marching in from radius 1.25
    th, ph = np.arange(1.54, 1.80001, .0012), np.arange(-1.26, -.6399, .0012)
    T, P = np.meshgrid(th, ph, indexing='ij')
    u = sph(np.stack([T, P, np.ones_like(T)], -1))
    R = np.full(T.shape, 1.25)
    for _ in range(400):
        R -= np.maximum(de(u * R[..., None]), 1e-7)
    # the route every 0.01 bar; the highest surface within 4 map cells
    t = np.linspace(0, len(W) - 1, (len(W) - 1) * 100 + 1)
    B = W[0, 0] + t
    P = catmull(W[:, 1:], t)
    g = th[1] - th[0]
    e = np.array([R[max(a - 4, 0):a + 5, max(b - 4, 0):b + 5].max()
                  for a, b in zip(np.rint((P[:, 0] - th[0]) / g).astype(int), np.rint((P[:, 1] - ph[0]) / g).astype(int))])
    # running maximum (0.5 bar back, 1.5 ahead), moving average (1.3 bars), + flight height
    dt = B[1] - B[0]
    nb, na, nv = int(.5 / dt), int(1.5 / dt), int(1.3 / dt)
    m = np.array([e[max(i - nb, 0):i + na + 1].max() for i in range(len(e))])
    r = np.maximum(np.convolve(np.pad(m, nv, mode='edge'), np.ones(2 * nv + 1) / (2 * nv + 1), mode='valid'), m) + .0035
    K = [dive(np.array(77.)), dive(np.array(78.))]
    K += [np.array([np.interp(b, B, P[:, 0]), np.interp(b, B, P[:, 1]), np.interp(b, B, r)]) for b in W[1:, 0]]
    K += [K[-1] + (K[-1] - K[-2]) * j for j in range(1, 6)]

    def n(x):
        return re.sub(r'^(-?)0\.', r'\1.', ('%.4f' % x).rstrip('0').rstrip('.'))
    print('const vec3 K[%d] = vec3[](%s);' % (len(K), ', '.join('vec3(%s, %s, %s)' % tuple(n(x) for x in k) for k in K)))


if __name__ == '__main__':
    design() if sys.argv[1:] == ['design'] else check()
