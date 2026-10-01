#!/usr/bin/env python3
"""Development helper: the camera's clearance over the Mandelbulb.

Mirrors the bulb's distance estimate and the camera path of src/scene.frag
(the `B > 62.` branch of camera()) in float64 and prints, along the whole
bulb section, the distance from the camera to the fractal's surface (bulb
units; the shader scales them by 5). Any change to the path must keep it
positive with a margin; in the low flight the camera is only ~0.001 above
the surface.

    python3 tools/flypath.py            # needs numpy

How the path was designed: a map of the surface radius over directions
showed a causeway along the equator (longitude -0.65 .. -1.15, radius
0.876-0.880, a ridge at each end). Its crest (the maximum over latitudes
pi/2 +- 0.006) fits r = 0.8792 - 0.1057 (phi + 0.898)^2 within +0.0008; the
shader flies at .88 - .106 (phi + .898)^2 + h, and at .955 + h over the ridges.
"""
import numpy as np


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


def camera(B):
    """camera position (bulb units, relative to the bulb's centre) for bars B (array)"""
    b = np.clip((B - 70) / 8, 0, 1)
    k, c = ss(70, 78, B), ss(93, 100, B)
    ph = -.1376 - .0306 * (B - 70) - .0694 * np.where(B < 70, B - 70, 8 * (b - b ** 3 + b ** 4 * .5))
    th = (1.39 + .1808 * k + .004 * np.sin(B * 1.571) * k) * (1 - c) + 1.39 * c
    h = np.exp((.8671 * (1 - k) + (-5.116 - .0866 * np.maximum(B - 78, 0)) * k) * (1 - c) + .8755 * c)
    crest = .88 - .106 * (ph + .898) ** 2
    e = ss(-.67, -.6, ph) + 1 - ss(-1.2, -1.13, ph)
    r = crest * (1 - e) + .955 * e + h
    v = np.stack([np.sin(th) * np.cos(ph), np.cos(th), np.sin(th) * np.sin(ph)], -1)
    return v * r[..., None], h


if __name__ == '__main__':
    B = np.arange(62, 104.0001, .005)
    pos, h = camera(B)
    d = de(pos)
    i = np.argmin(d)
    print('closest approach: %.5f at bar %.3f (h %.5f)' % (d[i], B[i], h[i]))
    for b in range(62, 105, 2):
        j = np.argmin(np.abs(B - b))
        print('bar %3d: distance to the surface %.5f, h %.5f' % (b, d[j], h[j]))
    if d.min() <= 0:
        raise SystemExit('the camera touches the surface')
