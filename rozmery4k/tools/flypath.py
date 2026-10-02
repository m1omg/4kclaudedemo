#!/usr/bin/env python3
"""Development helper: the flight over the Mandelbulb.

    python3 tools/flypath.py            # check the camera path (needs numpy)
    python3 tools/flypath.py design     # fit the flight's height profile

Check: mirrors the bulb's distance estimate and the camera of src/scene.frag
(fly() and the `B > 30.` branch of main()) in float64. It prints, along the
bulb section, the distance from the camera to the fractal's surface in bulb
units (the shader scales them by 5), and how fast the view turns. The
distance must stay positive with a margin: in the flight the camera is only
~0.01-0.05 above the surface.

Design: the route is fixed by fly()'s latitude and longitude (LAT, LON
below): from the end of the dive on the causeway along the equator (bar 78,
longitude -0.66) a little south into a valley, over a hill and a second
valley, then up a giant formation (bar 94). The design maps the surface
radius around the route (takes about a minute), takes for each point the
highest surface within ~0.006 rad and 0.3 bar, adds a margin, and fits the
log-height profile log(r - 0.8) = a + b cos(0.72 t + p) + d smoothstep(92.5,
94.5, t) from below (as low as possible, never under the terrain). It prints
the coefficients for fly().
"""
import re
import sys

import numpy as np


def de(p, iters=8):
    """the shader's Mandelbulb in bulb units (power 8, trig form)"""
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


def shader_H():
    """fly()'s log-height profile coefficients (a, b, w, p, d) from src/scene.frag"""
    import os
    src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'scene.frag')).read()
    m = re.search(r'(-?[\d.]+) \+ ([\d.]+) \* cos\(([\d.]+) \* t \+ ([\d.]+)\) \+ ([\d.]+) \* smoothstep\(92\.5, 94\.5, t\)', src)
    return [float(x) for x in m.groups()]


def LAT(t, c):
    return 1.5708 + .12 * (1 - ss(30, 40, t)) + .06 * ss(77, 83, t) * (1 - c)


def LON(t):
    return 1.727 - .0306 * t


def fly(H, t):
    """the shader's fly(): latitude, longitude, radius; and F (the blend into the flight)"""
    a, b, w, p, d = H
    c, e = ss(95, 100, t), 1 - ss(30, 40, t)
    F = ss(70, 78, t) * (1 - c)
    h = a + b * np.cos(w * t + p) + d * ss(92.5, 94.5, t)
    lr = (.9 + 1.07 * e) * (1 - F) + h * F
    return np.stack([LAT(t, c), LON(t), .8 + np.exp(lr)], -1), F


def camera(H, B):
    """camera position (bulb units, from the bulb's centre), forward and up vectors for bars B (array)"""
    s, F = fly(H, B)
    F = F[..., None]
    v = sph(np.stack([s[..., 0], s[..., 1], np.ones_like(B)], -1))
    ro = v * s[..., 2:3]
    w = sph(fly(H, B + .35)[0]) - ro
    w = nrm(w - v * np.sum(w * v, -1, keepdims=True)) - v * .2
    w = nrm(nrm(-ro) * (1 - F) + w * F)
    up = nrm(np.array([0, 1., 0]) * (1 - F) + v * F)
    rt = nrm(np.cross(w, up))
    return ro, w, np.cross(rt, w)


def check():
    H = shader_H()
    B = np.arange(62, 104.0001, .002)
    ro, fw, up = camera(H, B)
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


def design(margin=.004, w=.72):
    # the map: the surface radius over directions, marching in from radius 1.3
    th, ph = np.arange(1.50, 1.75001, .0025), np.arange(-1.30, -.5999, .0025)
    T, P = np.meshgrid(th, ph, indexing='ij')
    u = sph(np.stack([T, P, np.ones_like(T)], -1))
    R = np.full(T.shape, 1.3)
    for _ in range(500):
        R -= np.maximum(de(u * R[..., None]), 1e-7)
    # the route every 0.05 bar; the highest surface within ~0.006 rad and 0.3 bar
    t = np.arange(78, 95.0001, .05)
    lat, lon = LAT(t, 0), LON(t)
    g = th[1] - th[0]
    need = np.array([R[max(a - 2, 0):a + 3, max(b - 2, 0):b + 3].max()
                     for a, b in zip(np.rint((lat - th[0]) / g).astype(int), np.rint((lon - ph[0]) / g).astype(int))]) + margin
    need = np.array([need[max(i - 6, 0):i + 7].max() for i in range(len(need))])
    y = np.log(need - .8)
    X = np.stack([np.ones_like(t), np.cos(w * t), np.sin(w * t), ss(92.5, 94.5, t)], -1)
    # a fit from below: least squares with a heavy weight on the points under the curve
    k = np.ones_like(y)
    for _ in range(200):
        q = np.sqrt(k)[:, None]
        c = np.linalg.lstsq(X * q, y * q[:, 0], rcond=None)[0]
        k = np.where(X @ c < y, 3000., 1.)
    c[0] += max((y - X @ c).max(), 0)
    amp, phase = np.hypot(c[1], c[2]), np.arctan2(-c[2], c[1])
    r = .8 + np.exp(X @ c)
    print('height above the terrain (with the margin %.3f): mean %.4f, max %.4f'
          % (margin, (r - need + margin).mean(), (r - need + margin).max()))
    print('fly(): %.3f + %.3f * cos(%.2f * t + %.3f) + %.3f * smoothstep(92.5, 94.5, t)' % (c[0], amp, w, phase % (2 * np.pi), c[3]))


if __name__ == '__main__':
    design() if sys.argv[1:] == ['design'] else check()
