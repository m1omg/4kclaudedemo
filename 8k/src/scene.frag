#version 330
// ROZMERY - visuals. u = (time in seconds, width, height, 0).
// The bar B (125 BPM: 1.92 s) drives everything, in sync with the music:
//    0-30  a building assembles itself (ground, columns, slabs, stairs, facade)
//   30-34  dusk, the lights come on; the building's frame glows
//   34-36.5 the building takes itself apart (its clock T runs back, eased)
//   36.5-38 the frame collapses: depth, height, width; a point
//   38-62  the tesseract: point, line, square, cube, tesseract (one camera move
//          from the dusk shot); 4D rotation; 3D slices through it
//   62-70  it collapses; the Mandelbulb grows out of the point, breathes
//   70-78  the camera dives into the same bulb, over a ridge onto a causeway
//   78-95  a low flight off the causeway, winding through the bulb's formations:
//          a forest of buds, a valley, up over a giant formation into the sun
//   95-104 the camera climbs back out to the whole bulb; fade
uniform vec4 u;
out vec4 o;

float B, T, N, M, E, Q, Z;   // bar; the building's clock (runs back at bars 34-36.5); night;
                          // material and glow of the last map() (0 ground, 1 concrete, 2 steel, 3 glass);
                          // Q: while marching a ray downwards 1/-rd.y (distance along the ray to the ground), else 1;
                          // Z: the scale of the view (~ the camera's height above the bulb's surface in the flight)
vec3 L, U;       // direction to the sun; the camera's up

mat2 rot(float a)
{
	float c = cos(a), s = sin(a);
	return mat2(c, s, -s, c);
}

float box(vec3 p, vec3 b)
{
	p = abs(p) - b;
	return length(max(p, 0.)) + min(max(p.x, max(p.y, p.z)), 0.);
}

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5); }

// 0..1: an element that starts growing at bar t0 and takes d bars
float grow(float t0, float d) { return clamp((T - t0) / d, 0., 1.); }

// height of a column (or the core) that rises one floor per 4 bars from bar 5,
// each floor taking 1.5 bars; s delays it
float rise(float s)
{
	float x = (T - 5. - s) / 4.;
	return 3. * clamp(floor(x) + clamp(fract(x) * 2.67, 0., 1.), 0., 6.);
}

// keeps the closest surface: distance d, material m, glow e
float D;
void add(float d, float m, float e)
{
	if (d < D) {
		D = d;
		M = m;
		E = e;
	}
}

void building(vec3 p)
{
	D = B < 70. ? p.y * Q : 1e9;   // the ground (it fades away at bars 66-70)
	M = 0.;
	E = 0.;
	float b = box(p - vec3(.75, 13, 0), vec3(8.75, 13.5, 6.5)), h = .3 * grow(4., 1.5);
	if (h == 0. || B > 63.)
		return;   // (nothing built)
	if (b > 1.) {
		add(b, 9., 0.);   // (only the bounding box, which encloses everything incl. the plinth and the
		                  // stairs: no penumbra for the soft shadows)
		return;
	}
	// plinth, rising out of the ground (bars 4-5.5); wider on the east, under the stairs
	add(box(p - vec3(.5, h - .31, 0), vec3(8.5, .3, 6)), 1., 0.);
	// columns on a 3 x 4 grid, rising floor by floor with a small stagger
	vec3 q = p;
	vec2 c = clamp(round(p.xz / vec2(3, 4)), vec2(-2, -1), vec2(2, 1));
	q.xz -= c * vec2(3, 4);
	h = c.x == 0. && c.y == 0. ? 0. : rise(hash(c) * .7);
	float g;
	if (h > 0.)
		add(box(q - vec3(0, h * .5, 0), vec3(.22, h * .5, .22)), 1., fract(h / 3. - .001) < .99 ? exp(-abs(q.y - h) * 25.) : 0.);
	// the core (lift and services), a little ahead of the columns
	h = rise(-.5);
	if (h > 0.)
		add(box(p - vec3(0, h * .5, 0), vec3(1.5, h * .5, 1)), 1., 0.);
	// floor slabs 1-6 slide out of the core (each 1.5 bars, from bar 6); the two nearest
	for (float k = 0.; k < 2.; k++) {
		float lv = clamp(floor(p.y / 3.) + k, 1., 6.);
		g = grow(2. + 4. * lv, 1.5);
		vec2 ex = mix(vec2(1.5, 1), vec2(7, 5), g);
		q = p - vec3(0, 3. * lv, 0);
		if (g > 0.)
			add(box(q, vec3(ex.x, .15, ex.y)), 1., g < 1. ? exp(max(abs(q.x) - ex.x, abs(q.z) - ex.y) * 30.) : 0.);
	}
	// facade of floor f: mullions rise (bars 7 + 4f), then glass (8 + 4f)
	float f = clamp(floor(p.y / 3.), 0., 5.), y = p.y - 3. * f - .15;
	vec2 e2 = abs(p.xz) - vec2(6.85, 4.85);
	float sh = max(e2.x, e2.y), sc = e2.x > e2.y ? p.z : p.x;
	h = 2.7 * grow(7. + 4. * f, 1.5);
	if (h > 0.)
		add(max(max(abs(sh) - .05, abs(mod(sc + .7, 1.4) - .7) - .04), abs(y - h * .5) - h * .5), 2., 0.);
	h = 2.7 * grow(8. + 4. * f, 1.5);
	if (h > 0.)
		add(max(abs(sh + .02) - .012, abs(y - h * .5) - h * .5), 3., h < 2.7 ? exp(-abs(y - h) * 30.) : 0.);
	// stairs on the east side: a zigzag of flights, one step per beat (of the two nearest
	// flights, the two steps nearest along the slope)
	for (float k = 0.; k < 4.; k++) {
		f = clamp(floor(p.y / 3. - .5) + floor(k * .5), 0., 5.);
		float z = p.z * (1. - 2. * mod(f, 2.)) + 3.375, y = p.y - 3. * f - .1475,
			m = clamp(floor((z * .45 + y * .1875) / .2377) + mod(k, 2.), 0., 15.), v = clamp(4. * (T - 6.) - f * 16. - m, 0., 1.);
		if (v > 0.)
			add(box(vec3(p.x - 8., y - m * .1875, z - .45 * m), vec3(.7 * v, .04, .22)), 2., (1. - v) * 3.);
	}
	// roof: parapet (bar 26), plant room and mast (bars 28-31)
	h = .6 * grow(26., 1.);
	q = p - vec3(0, 18.15 + h * .5, 0);
	if (h > 0.)
		add(max(box(q, vec3(7, h * .5, 5)), -box(q, vec3(6.8, 1, 4.8))), 1., 0.);
	h = 2.5 * grow(28., 1.5);
	if (h > 0.)
		add(box(p - vec3(-1.5, 18. + h * .5, 0), vec3(1.5, h * .5, 2)), 1., 0.);
	h = 6. * grow(29.5, 1.5);
	if (h > 0.)
		add(max(length(p.xz - vec2(-1.5, 0)) - .08, abs(p.y - 20.5 - h * .5) - h * .5), 2., h < 6. ? exp(-abs(p.y - 20.5 - h) * 20.) : 0.);
}

vec3 sky(vec3 rd)
{
	vec3 c = mix(mix(vec3(.95, .6, .35), vec3(.25, .42, .75), smoothstep(0., .5, abs(dot(rd, U)))),
		mix(vec3(.4, .22, .3), vec3(.015, .02, .06), smoothstep(0., .35, abs(dot(rd, U)))), N);
	return c + vec3(1, .6, .3) * (pow(max(dot(rd, L), 0.), 300.) * 8. + pow(max(dot(rd, L), 0.), 8.) * .3) * (1. - N) * smoothstep(-.05, .1, dot(rd, U));
}

// --- the tesseract ----------------------------------------------------------
// 16 vertices (+-A.x, +-A.y, +-A.z, +-A.w) turned by R in 4D and projected to
// 3D from w = 14.4, around C. A: the extrusion along each axis (a point, line,
// square, cube, tesseract); F: how far each axis is out (the copies along an
// axis fade in as they separate); V: the vertices' weights.
const vec3 C = vec3(0, 9.6, 0);
const mat4x3 X = mat4x3(1, .25, .03, .15, 1, .1, .05, .3, 1, 1, .05, .6);   // colours of the axes
vec4 A, F;
mat4 R;
vec3 P[16];
float V[16], W;   // W: w of the slicing hyperplane (99: none)

// distance between the ray (ro, rd) and segment a-b; t: the ray parameter there
float seg(vec3 ro, vec3 rd, vec3 a, vec3 b, out float t)
{
	vec3 ba = b - a, w = ro - a;
	float k = dot(ba, rd), s = clamp((dot(ba, w) - dot(rd, w) * k) / max(dot(ba, ba) - k * k, 1e-6), 0., 1.);
	t = max(s * k - dot(rd, w), 1e-3);
	return length(w + rd * t - ba * s) / t;   // (as an angle)
}

float glow(float a) { return exp(-a * a * 4e5) * 1.5 + 1e-6 / (a * a + 4e-6); }

// the tesseract's light along a ray (up to distance tm): translucent faces, edges, vertices
vec3 hyper(vec3 ro, vec3 rd, float tm)
{
	vec3 c = vec3(0);
	float t, d;
	for (int i = 0; i < 16; i++) {
		for (int k = 0; k < 4; k++)
			if ((i >> k & 1) == 0) {
				vec3 a = P[i], b = P[i | 1 << k];
				d = seg(ro, rd, a, b, t);
				if (t < tm)
					c += X[k] * V[i] * F[k] * glow(d);
				for (int j = k + 1; j < 4; j++)   // the face spanned by axes k and j
					if ((i >> j & 1) == 0 && V[i] * F[k] * F[j] > .01) {
						vec3 e = P[i | 1 << j], f = P[i | 1 << j | 1 << k], n = cross(b - a, e - a), h;
						t = dot(a - ro, n) / dot(rd, n);
						h = ro + rd * t;
						if (t > 0. && t < tm && dot(cross(b - a, h - a), n) > 0. && dot(cross(f - b, h - b), n) > 0.
							&& dot(cross(e - f, h - f), n) > 0. && dot(cross(a - e, h - e), n) > 0.)
							c += (X[k] + X[j]) * V[i] * F[k] * F[j] * (.02 + .1 * pow(1. - abs(dot(normalize(n), rd)), 2.));
					}
			}
		d = seg(ro, rd, P[i], P[i], t);
		if (t < tm)
			c += V[i] * glow(d * .6);
	}
	return c;
}

// --- the Mandelbulb (power 8), around C, scale 5 -----------------------------
float I, H;   // iterations; phase (it breathes)
vec4 G;       // orbit trap: min |x|, |y|, |z|, |z|^2
float bulb(vec3 p)
{
	float s = 5. * smoothstep(63.5, 65., B) + .001, r, d = 1., i;
	vec3 z = p = (p - C) / s;
	r = length(z);
	if (r > 1.5)
		return (r - 1.2) * s;   // (the bounding sphere)
	G = vec4(9);
	for (i = 0.; i < I && r < 2.; i++) {
		float a = acos(z.y / r) * 8. + H, b = atan(z.z, z.x) * 8.;
		d = 8. * pow(r, 7.) * d + 1.;
		z = pow(r, 8.) * vec3(sin(a) * cos(b), cos(a), sin(a) * sin(b)) + p;
		r = length(z);
		G = min(G, vec4(abs(z), dot(z, z)));
	}
	return .5 * log(r) * r / d * s;
}

float map(vec3 p)
{
	building(p);
	if (B > 63.)
		add(bulb(p), 4., 0.);
	return D;
}

// the flight over the Mandelbulb: latitude, longitude and radius (bulb units) for each bar from 77,
// designed over a map of its surface (tools/flypath.py); Catmull-Rom in between, then on along the orbit
const vec3 K[25] = vec3[](
	vec3(1.563, -.6284, .933), vec3(1.5708, -.66, .8845), vec3(1.5708, -.69, .8804), vec3(1.575, -.72, .8804),
	vec3(1.59, -.75, .88), vec3(1.61, -.775, .8683), vec3(1.628, -.8, .8702), vec3(1.64, -.83, .8782),
	vec3(1.645, -.865, .8803), vec3(1.642, -.9, .8803), vec3(1.65, -.935, .8769), vec3(1.668, -.965, .8568),
	vec3(1.685, -.995, .8416), vec3(1.692, -1.03, .8349), vec3(1.69, -1.065, .8352), vec3(1.68, -1.1, .8542),
	vec3(1.665, -1.135, .9308), vec3(1.645, -1.165, .959), vec3(1.625, -1.195, .961), vec3(1.61, -1.225, .961),
	vec3(1.595, -1.255, .961), vec3(1.58, -1.285, .961), vec3(1.565, -1.315, .961), vec3(1.55, -1.345, .961),
	vec3(1.535, -1.375, .961));

vec3 fly(float t)
{
	float g = clamp(t, 78., 99.9) - 78.;
	int i = int(g);
	vec3 a = K[i], b = K[i + 1], c = K[i + 2], d = K[i + 3];
	g -= float(i);
	return .5 * (2. * b + (c - a) * g + (2. * a - 5. * b + 4. * c - d) * g * g + (3. * (b - c) + d - a) * g * g * g) - vec3(0, .03, 0) * max(t - 99.9, 0.);
}

// (latitude, longitude, radius) -> bulb space
vec3 sph(vec3 s)
{
	return vec3(sin(s.x) * cos(s.y), cos(s.x), sin(s.x) * sin(s.y)) * s.z;
}

// camera for bar B: a shot per musical phrase
void camera(out vec3 ro, out vec3 ta)
{
	float b = B;
	ta = C;
	if (B < 6.) {   // the blueprint from above
		ro = vec3(sin(2.2 + b * .04) * 18., 30. - b * 1.5, cos(2.2 + b * .04) * 18.);
		ta = vec3(0);
	} else if (B < 14.) {   // orbit while the first floors rise
		b = (B - 6.) * .07 + .5;
		ro = vec3(sin(b) * 24., 5. + (B - 6.) * .6, cos(b) * 24.);
		ta = vec3(0, 2. + (B - 6.) * .5, 0);
	} else if (B < 22.) {   // along the stairs, with the newest step
		b = .75 * (B - 6.);
		ro = vec3(17., b + 1.5, -7. + (B - 14.) * .8);
		ta = vec3(8, b - 1., 0);
	} else if (B < 30.) {   // looking up at the facade
		ro = vec3(-20. + (B - 22.) * .6, 1.2, 17.);
		ta = vec3(0, 9. + (B - 22.) * .4, 0);
	} else if (B < 46.) {   // dusk; the building takes itself apart, its frame collapses to a point
		// that grows into the tesseract: one move, in towards the point and out again
		b = smoothstep(36., 40., B);
		float a = 2.29 + (B - 30.) * .04;
		ro = C + vec3(sin(a), 0, cos(a)) * mix(40. - (B - 30.) * 2.5, 13. + (B - 38.) * .6, b) + vec3(0, mix((B - 30.) * .3 - 4.6, 2., b), 0);
	} else if (B > 62.) {   // the Mandelbulb (bulb units: x 5): an orbit that dives over a ridge onto a causeway
		// along its equator; the flight winds off it through a forest of buds, down a valley and up over
		// a giant formation into the sun, banking into the turns, then climbs back out to the orbit
		b = clamp((B - 70.) / 8., 0., 1.);
		float k = smoothstep(70., 78., B), c = smoothstep(95., 100., B), f = k * (1. - c), e = smoothstep(78., 79., B),
			ph = -.1376 - .0306 * (B - 70.) - .0694 * (B < 70. ? B - 70. : 8. * (b - b * b * b + b * b * b * b * .5));
		vec3 s = B > 78. ? fly(B) : vec3(1.39 + .1808 * k, ph, mix(.88 - .106 * (ph + .898) * (ph + .898), .955, smoothstep(-.67, -.6, ph))
			+ exp(mix(.8671, -5.116, k))), p = sph(fly(B)), v, w;
		s = vec3(mix(s.x, 1.39, c), s.y, exp(mix(log(s.z - .8), .9339, c)) + .8);   // (back out to radius 3.345)
		v = sph(vec3(s.xy, 1));
		ro = C + v * s.z * 5.;
		w = sph(fly(B + .35)) - p - v * .0015;   // ahead along the flight, nearly level
		w = mix(vec3(sin(ph), 0, -cos(ph)) - v * .12, normalize(w - v * dot(w, v) * .7), e);
		ta = B < 78. ? mix(C, ro + w, f) : ro + mix(normalize(C - ro), w, f);
		vec3 a = sph(fly(B + 1.)) - 2. * p + sph(fly(B - 1.)), x = normalize(cross(w, v));
		U = normalize(mix(U, v + x * dot(a, x) * 30. * e, f));   // (banking into the turns)
		Z = min(.5 * exp(mix(mix(.8671, -4.3, k), .87, c)), 1.);   // the scale of the view
		b = -2.26 - .01 * max(B - 78., 0.);
		L = normalize(mix(vec3(sin(1.284) * cos(ph - .6), cos(1.284), sin(1.284) * sin(ph - .6)), vec3(cos(b), 0, sin(b)), f));
	} else {   // around the tesseract: from below while it turns, from above while it is sliced
		b = floor((B - 38.) / 8.);
		ro = C + vec3(sin(B * .07 + b * 2.) * (20. - b * 2.), b * 10. - 12., cos(B * .07 + b * 2.) * (20. - b * 2.));
	}
}

void main()
{
	B = u.x / 1.92;
	T = B < 34. ? B : B < 63. ? 34. - 31. * smoothstep(34., 36.5, B) : 3. + (B - 63.) * 4.;   // (eased rewind; the grid fades at 64-65)
	N = clamp((B - 30.) / 5., 0., 1.) - clamp((B - 63.) / 8., 0., .6);   // night; dawn from bar 63
	I = clamp(floor((B - 64.) * 4.) + 1., 1., 8.);   // the bulb gains an iteration per beat
	H = B > 66. && B < 70. ? sin((B - 66.) * .785) * .7 : 0.;
	Z = 1.;
	vec2 uv = (2. * gl_FragCoord.xy - u.yz) / u.z;
	L = normalize(vec3(-.6, .35 - .3 * N, -.5));
	// the building's frame collapses to a point (bars 36.5-38); the point grows
	// into a line, square, cube and tesseract (38-46), which turns in 4D and
	// is sliced (54-62)
	A = max(vec4(7.5, 9.4, 5.5, 0) * smoothstep(0., 1., (vec4(38, 37.5, 37, 0) - B) * 2.), 3.6 * smoothstep(0., 1., B - vec4(38, 40, 42, 44))
		* (1. - smoothstep(62., 63.5, B)));
	F = smoothstep(0., .5, A);
	R = mat4(1);
	for (int i = 0; i < 4; i++) {
		vec4 v = R[i];
		v.yz *= rot(max(B - 42., 0.) * .15);
		v.xw *= rot(max(B - 46., 0.) * .3);
		v.zw *= rot(max(B - 50., 0.) * .25);
		R[i] = v;
	}
	for (int i = 0; i < 16; i++) {
		vec4 b = vec4(i & 1, i >> 1 & 1, i >> 2 & 1, i >> 3 & 1), f = 1. - b * (1. - F), v = R * ((b * 2. - 1.) * A);
		P[i] = C + v.xyz * 14.4 / (14.4 - v.w);
		V[i] = f.x * f.y * f.z * f.w;
	}
	W = B > 54. && B < 62. ? -9. * cos((B - 54.) * .785) : 99.;
	vec3 ro, ta;
	U = vec3(0, 1, 0);
	camera(ro, ta);
	vec3 w = normalize(ta - ro), x = normalize(cross(w, U)), rd = normalize(uv.x * x + uv.y * cross(x, w) + 1.8 * w);
	float t = 0., d;
	Q = -1. / min(rd.y, -1e-6);
	float tm = min(200., 600. * Z);   // (beyond: only haze)
	for (int i = 0; i < 128; i++) {
		d = map(ro + rd * t);
		if (d < .001 * t || t > tm)
			break;
		t += d;
	}
	vec3 col = sky(rd), p = ro + rd * t;
	Q = 1.;
	if (t < tm) {
		float m = M, e = E;
		vec4 g = G;
		vec2 h = vec2(.001, -.001) * Z;
		vec3 n = normalize(h.xyy * map(p + h.xyy) + h.yyx * map(p + h.yyx) + h.yxy * map(p + h.yxy) + h.xxx * map(p + h.xxx));
		// soft shadow towards the sun
		float sh = 1., s = .05 * Z;
		for (int i = 0; i < (B < 62. ? 40 : 24); i++) {   // (the building's thin parts need 40 steps)
			d = map(p + n * .01 * Z + L * s);
			if (M < 9.)
				sh = min(sh, 12. * d / s);
			s += clamp(d, .05 * Z, 1.5 * Z);
			if (sh < .01 || s > 40. * Z)
				break;
		}
		sh = clamp(sh, 0., 1.);
		float ao = 1.;
		for (float k = 1.; k < 4.; k++)
			ao -= (k * .15 - map(p + n * k * .15 * Z) / Z) / k;
		ao = clamp(ao, 0., 1.);
		vec3 alb = m < 1. ? vec3(.3, .3, .32) : m < 2. ? vec3(.62, .6, .57) : m < 3. ? vec3(.12, .13, .15) : m < 4. ? vec3(.02, .025, .03)
			: .5 + .5 * cos(6.28 * (g.w * .9 + g.y * .5 + vec3(.1, .3, .5)));
		if (m < 1.) {   // ground: plaza with joints, the blueprint grid at the start
			float fw = .02 + t / u.z / abs(rd.y), bp = 1. - grow(6., 4.);   // joint width (a pixel's footprint); blueprint fade
			vec2 g = abs(fract(p.xz / 2.) - .5);
			alb *= mix(abs(p.x) < 14. && abs(p.z) < 11. ? 1.6 - .5 * smoothstep(.5 - fw, .5, max(g.x, g.y)) * exp(-fw * 8.) : .6, .25, bp);
			g = abs(fract(p.xz) - .5);
			e = (smoothstep(.5 - fw, .5, max(g.x, g.y)) * .25 * exp(-fw * 8.) + (1. - smoothstep(0., .06 + fw, abs(max(abs(p.x) - 7., abs(p.z) - 5.))))
				* step(atan(p.z, p.x), T * 2.1 - 3.14)) * bp * smoothstep(0., 1., T);
		}
		vec3 sun = vec3(1.3, .95, .7) * (1. - N * .9);
		col = alb * (sun * max(dot(n, L), 0.) * sh + sky(n) * .5 * ao);
		if (m == 3.) {   // glass: dark rooms behind it, lit at dusk, and the sky reflected
			float f = floor(p.y / 3.), c = floor((abs(p.x) > 6.8 ? p.z : p.x) / 1.4 + .5);
			vec3 room = vec3(1, .65, .35) * step(.45, hash(vec2(f, c))) * grow(31. + f * .5 + hash(vec2(c, f)) * .5, .3) * (.15 + .6 * hash(vec2(c, f + 9.)));
			float fr = .04 + .96 * pow(1. - abs(dot(n, rd)), 5.);
			col = mix(room + alb, sky(reflect(rd, n)), fr) + sun * pow(max(dot(reflect(rd, n), L), 0.), 60.) * sh;
		}
		if (m < 1.)
			col = mix(col, sky(rd), smoothstep(66., 70., B));
		if (m < 1. && B > 33. && B < 64.)   // the tesseract mirrored in the plaza
			col += hyper(p, reflect(rd, n), 1e3) * .15;
		col += vec3(.3, .75, 1) * e * 2.;
		col = mix(col, sky(rd), 1. - exp(-t * t * .00003 / Z / Z));
	}
	if (B > 33. && B < 64.)
		col += hyper(ro, rd, t) * smoothstep(33., 34.5, B) * (W < 99. ? .4 : 1.);
	if (W < 99.) {   // the slice by the hyperplane w = W: a convex polytope (the ray against 4 slabs),
		// glass tinted by the cells it cuts, with bright edges
		float k = (14.4 - W) / 14.4;
		vec4 y = transpose(R) * vec4((ro - C) * k, W), z = transpose(R) * vec4(rd * k, 0), a = (-A - y) / z, b = (A - y) / z, f = min(a, b), g = max(a, b);
		float t0 = max(max(f.x, f.y), max(f.z, f.w)), t1 = min(min(g.x, g.y), min(g.z, g.w));
		if (t0 < t1 && t0 > 0. && t0 < t) {
			a = step(t0, f);   // the cells where the ray enters and leaves
			b = step(g, vec4(t1));
			f = t0 - f + a * 1e9;   // (an edge: another cell close)
			g = g - t1 + b * 1e9;
			col = col * .5 + X * (a * .25 + b * .1) * (.4 + .6 * (1. - exp(-(t1 - t0) * .3)))
				+ exp(-min(min(f.x, f.y), min(f.z, f.w)) / t0 * 400.) + exp(-min(min(g.x, g.y), min(g.z, g.w)) / t1 * 400.) * .5;
		}
	}
	col = 1. - exp(-col * 1.4);
	o = vec4(pow(col, vec3(.4545)) * (1. - .15 * dot(uv, uv)) * clamp((104. - B) / 3., 0., 1.), 1);   // (the end: fade out)
}
