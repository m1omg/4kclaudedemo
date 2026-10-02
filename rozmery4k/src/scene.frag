#version 330
// ROZMERY 4K - visuals. u = (time in seconds, width, height, 0).
// The bar B (125 BPM: 1.92 s) drives everything, in sync with the music:
//    0-30  a building assembles itself on its blueprint: columns and slabs
//          floor by floor, then the glass
//   30-38  dusk, the lights come on, its frame glows; the building takes itself
//          apart (its clock T runs back) and the frame collapses to a point
//   38-62  the point grows into a line, square, cube and tesseract, which turns in 4D
//   62-78  it collapses; the Mandelbulb grows out of the point; the camera dives in
//   78-95  a low flight over its hills and valleys, up over a formation into the sun
//   95-104 the camera climbs back out to the whole bulb; fade
uniform vec4 u;
out vec4 o;

float B, T, N, Z, F;   // bar; the building's clock; night; the scale of the view; the flight
vec3 L, U, P[16];   // direction to the sun; up; the tesseract's vertices
vec4 A, G;          // the tesseract's extrusions; the bulb's orbit trap
const vec3 C = vec3(0, 9.6, 0);   // the centre of the tesseract and the bulb

float box(vec3 p, vec3 b) { return length(max(abs(p) - b, 0.)); }

// (latitude, longitude, radius) -> around C
vec3 sph(vec3 s) { return vec3(sin(s.x) * cos(s.y), cos(s.x), sin(s.x) * sin(s.y)) * s.z; }

float map(vec3 p)
{
	float d = abs(B - 85.) > 12. ? p.y : 1e9,   // (no ground while the camera is near the bulb)
		 h = clamp(T * .75 - 3.75, 0., 18.), s = 5. * smoothstep(63.5, 65., B) + .001, r, k = 1., i;
	vec3 q = p;
	if (B < 63. && T > 4.) {   // the building: columns and slabs, a floor per 4 bars from bar 5; the
		// glass a floor behind
		q.xz -= clamp(round(q.xz / vec2(3.5, 5)), vec2(-2, -1), vec2(2, 1)) * vec2(3.5, 5);
		d = min(min(d, box(q - vec3(0, h * .5, 0), vec3(.22, h * .5, .22))),
			max(box(vec3(p.x, mod(p.y + 1.5, 3.) - 1.5, p.z), vec3(7, .15, 5)), p.y - h - .2));
		q.xz = abs(p.xz) - vec2(6.85, 4.85);
		d = min(d, max(max(q.x, q.z), p.y - h + 3.));   // (solid)
	}
	if (B > 63.) {   // the Mandelbulb (power 8): an iteration per beat
		q = p = (p - C) / s;
		r = length(q);
		G = vec4(9);
		for (i = 0.; i < min(floor((B - 64.) * 4.) + 1., 8.) && r < 2.; i++) {
			k = 8. * pow(r, 7.) * k + 1.;
			q = sph(vec3(acos(q.y / r) * 8., atan(q.z, q.x) * 8., pow(r, 8.))) + p;
			r = length(q);
			G = min(G, vec4(abs(q), r));
		}
		d = min(d, .5 * log(r) * r / k * s);
	}
	return d;
}

vec3 sky(vec3 r)
{
	return (mix(vec3(.95, .6, .35), vec3(.25, .42, .75), smoothstep(0., .4, abs(dot(r, U)))) + vec3(.95, .6, .35) * pow(max(dot(r, L), 0.), 300.) * 8.) * (1. - N * .9);
}

// the camera from bar 30 (around C, radius in units of 5): in from the dusk towards the
// collapsing frame, an orbit around the tesseract and the newborn bulb, a dive and a low
// flight (78-95) over a height profile fitted to the bulb's surface (tools/flypath.py),
// then back out
vec3 fly(float t)
{
	float c = 1. - smoothstep(95., 100., t), e = 1. - smoothstep(30., 40., t);
	F = smoothstep(70., 78., t) * c;
	return vec3(1.5708 + .12 * e + .06 * smoothstep(77., 83., t) * c, 1.727 - .0306 * t,
		.8 + exp(mix(.9 + 1.07 * e, -2.54 + .274 * cos(.72 * t + 1.006) + .351 * smoothstep(92.5, 94.5, t), F)));
}

void main()
{
	B = u.x / 1.92;
	T = B < 34. ? B : 34. - 31. * smoothstep(34., 36.5, B);   // (eased rewind)
	N = clamp((B - 30.) / 5., 0., 1.) - clamp((B - 63.) / 8., 0., .6);   // night; dawn from bar 63
	L = normalize(vec3(-.6, .35 - .3 * N, -.5));
	// the building's frame (glowing from bar 33) collapses to a point (36.5-38); the point
	// grows into a line, square, cube and tesseract (38-46), which turns in 4D
	A = max(vec4(7.5, 9.4, 5.5, 0) * smoothstep(0., 1., (vec4(38, 37.5, 37, 0) - B) * 2.), 3.6 * smoothstep(0., 1., B - vec4(38, 40, 42, 44))
		* (1. - smoothstep(62., 63.5, B)));
	// the camera: an orbit while the building rises, then fly()
	Z = 1.;
	vec3 ro = vec3(sin(2.2 + B * .07) * 20., max(30. - B * 2., 1.5), cos(2.2 + B * .07) * 20.), w = vec3(0, B * .4, 0) - ro, p, n, x, col;
	U = vec3(0, 1, 0);
	if (B > 30.) {
		w = sph(fly(B + .35));
		vec3 s = fly(B), v = sph(vec3(s.xy, 1));   // (and F for bar B)
		ro = C + v * s.z * 5.;
		w -= sph(s);   // ahead along the path, level, a little down
		w = mix(normalize(C - ro), normalize(w - v * dot(w, v)) - v * .2, F);
		U = mix(U, v, F);
		Z = pow(.007, F);
	}
	float t = 0., d, tm = 200. * Z, s = .05 * Z, sh = 1.;
	vec2 uv = (2. * gl_FragCoord.xy - u.yz) / u.z, q;
	w = normalize(w);
	x = normalize(cross(w, U));
	mat3 M = mat3(x, cross(x, w), w);
	vec3 rd = normalize(M * vec3(uv, 1.8));
	for (int i = 0; i < 16; i++) {
		vec4 v = sign(fract(i / vec4(2, 4, 8, 16)) - .4) * A;
		v.xw *= mat2(cos(max(B - 46., 0.) * .3 + vec4(0, 11, 33, 0)));
		p = (C + v.xyz * 14.4 / (14.4 - v.w) - ro) * M;
		P[i] = vec3(1.8 * p.xy / p.z, p.z);   // (on the screen; depth)
	}
	col = sky(rd);
	for (int i = 0; i < 128; i++) {
		d = map(ro + rd * t);
		if (d < .001 * t || t > tm)
			break;
		t += d;
	}
	if (t < tm) {
		// materials (G: the bulb's orbit trap at the hit): the ground with the blueprint grid,
		// glass (lit rooms behind it at dusk), concrete, the bulb's colours
		p = ro + rd * t;
		q = abs(p.xz) - vec2(6.85, 4.85);
		bool gl = B < 63. && p.y > .001 * t && abs(max(q.x, q.y)) < .05;
		x = p.y < .001 * t ? vec3(.3) : B > 63. ? .5 + .5 * cos(6.28 * (G.w * .9 + G.y * .5 + vec3(.1, .3, .5))) : gl ? vec3(.02) : vec3(.62, .6, .57);
		vec2 h = vec2(.001 * Z, 0);
		n = normalize(vec3(map(p + h.xyy), map(p + h.yxy), map(p + h.yyx)) - d);
		for (int i = 0; i < 28; i++) {   // soft shadow towards the sun
			d = map(p + n * .01 * Z + L * s);
			sh = min(sh, 12. * d / s);
			s += clamp(d, .05 * Z, 1.5 * Z);
		}
		q = abs(fract(p.xz) - .5);
		col = mix(x * (vec3(1.3, .95, .7) * (1. - N * .9) * max(dot(n, L), 0.) * max(sh, 0.) + sky(n) * .5) +
			vec3(.95, .6, .35) * step(.45, fract(sin(floor(p.x + p.z) * 7. + floor(p.y / 3.) * 3.) * 99.)) * clamp((T - 31. - p.y * .2) * 3., 0., 1.) * .6 * float(gl) +
			vec3(.3, .75, 1) * smoothstep(.45, .5, max(q.x, q.y)) * exp(-t * .05) * clamp((10. - T) / 4., 0., 1.) * float(p.y < .001 * t),
			col, 1. - exp(-t * t * .00003 / Z / Z));
	}
	// the tesseract's edges and vertices, glowing (the building's frame from bar 33): the
	// distance from the pixel to each projected edge (k = 4: the vertex itself)
	if (B > 33. && B < 64.)
		for (int i = 0; i < 16; i++)
			for (int k = 0; k < 5; k++)
				if ((i >> k & 1) < 1) {
					vec3 a = P[i];
					vec2 ba = P[i | 1 << k & 15].xy - a.xy, pa = uv - a.xy;
					pa -= ba * clamp(dot(pa, ba) / (dot(ba, ba) + 1e-9), 0., 1.);
					col += vec3(.3, .75, 1) * 3e-6 / (dot(pa, pa) + 1e-5) * float(a.z < t) * min(B - 33., 1.);
				}
	o = vec4(sqrt(1. - exp(-col * 1.4)) * clamp((104. - B) / 3., 0., 1.), 1);   // (tone map, gamma 2, fade out)
}
