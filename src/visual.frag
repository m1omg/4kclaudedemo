#version 330
// BRANA - visuals. u = (time in seconds, width, height, 0).
// Everything is a function of the bar position B (2 s per bar, as the music):
//   0-24  horizon: stars, mirror floor, monoliths rise, the gate; fly through it
//  24-40  drop 1: tunnel of square frames
//  40-48  breakdown: the core (rings of an armillary sphere)
//  48-64  drop 2: tunnel of segmented octagons
//  64-73  outro: back at the horizon, everything sinks, fade out
uniform vec4 u;
out vec4 o;

float B, S, V, G, M, Q;   // bar, scene, variation, distance to neon, material (0 floor, 1 solid, 2 neon), floor scale

mat2 rot(float a)
{
	return mat2(cos(a), sin(a), -sin(a), cos(a));
}

float box(vec3 p, vec3 b)
{
	p = abs(p) - b;
	return length(max(p, 0.)) + min(max(p.x, max(p.y, p.z)), 0.);
}

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9, 78.2))) * 43758.); }

float torus(vec3 p, float r, float t) { return length(vec2(length(p.xy) - r, p.z)) - t; }

float map(vec3 p)
{
	float d, g, f = 1e9;
	if (p.y > 13.) return G = 1e3;   // above everything: the ray only goes up from here
	if (S < 1.) {
		// horizon: monoliths rise (bars 8-14) and sink (66-72), the gate.
		// Only a limited field of them: in the distance their thin glowing caps
		// get smaller than a pixel and sparkle, so outer cells sink far below the floor.
		vec2 id = floor(p.xz / 7.);
		float h = hash(id);
		h = (1. + 6. * h) * smoothstep(8., 14., B - hash(id.yx) * 3.) * smoothstep(72., 66., B - h * 3.) * step(1.5, abs(id.x)) - 1e3 * step(7., length(id + vec2(0, 4)));
		vec3 c = p;
		c.xz = mod(c.xz, 7.) - 3.5;
		d = box(c, vec3(.7, h + .01, .7));   // an unrisen monolith must not lie exactly in the
		                                     // floor plane: rounding would pick a flickering winner
		// Only this cell's monolith is measured, so a step must not reach a
		// neighbour's (6.3 from this cell's centre): a ray above a lower monolith
		// would end inside a taller one next to it, and the AO would draw moving
		// dark streaks. Sunk cells skip this (-min(h, 0.) is about 1e3 there): the
		// camera is always inside the field, rays pass them only on the way out.
		d = min(d, 6.3 - max(abs(c.x), abs(c.z)) - min(h, 0.));
		c.y -= h;
		g = box(c, vec3(.6, .03, .6));  // glowing caps
		f = p.y * Q;   // while marching: distance along the ray to the floor plane
		p.y -= 6.5;
		d = min(d, torus(p, 6., .4));
		g = min(g, torus(p, 5.5, .05));
	} else if (S == 2.) {
		// the core: nested rotating rings
		d = f;
		g = length(p) - .5;
		for (int i = 0; i < 6; i++) {
			p.xy *= rot(B * .6 + i);
			p.yz *= rot(B * .4);
			d = min(d, torus(p, 1.5 + i * .5, .1));
			g = min(g, torus(p, 1.6 + i * .5, .015));
		}
	} else {
		// tunnels: closed polygons (drop 1) or segmented ones (drop 2), the
		// number of sides changes every 4 bars
		float n = S * 2. + 2. + V, l = 4.3 * tan(3.1416 / n) - (S - 1.) * .2;
		p.xy *= rot(floor(p.z / 4.) * (.1 + V * .1) + B * (S - 2.) * .8);
		p.z = mod(p.z, 4.) - 2.;
		p.xy *= rot(floor(atan(p.y, p.x) / 6.283 * n + .5) / n * 6.283);
		p.x -= 4.3;
		p.y = abs(p.y);
		d = box(p, vec3(.4, l + .4, .3));
		p.x += .45;
		g = box(p, vec3(.02, l, .2));
	}
	G = g;
	M = 1.;
	if (g < d) { d = g; M = 2.; }
	if (f < d) { d = f; M = 0.; }
	return d;
}

void main()
{
	B = u.x * .5;
	vec2 uv = (2. * gl_FragCoord.xy - u.yz) / u.z;
	// kick pulse, with the same 4-bar arrangement mask as the music
	float K = exp(-fract(B * 2.) * 5.) * (0x1F3D0 >> int(B / 4.) & 1), r = 0., k, t, gl, d, m;
	vec3 ro, ta, nc = vec3(1, .4, .12), p, n, c, fog;
	if (B < 24.) {
		S = 0.;
		k = B / 24.;
		ro = vec3(sin(B * .4) * 3. * (1. - k), mix(1.2, 6.5, smoothstep(10., 24., B)), mix(-70., 1., k * k));
		ta = ro + vec3(-ro.x * .1, .15 - .15 * smoothstep(14., 24., B) + smoothstep(6., 0., B), 1);
	} else if (B < 40. || B > 48. && B < 64.) {
		S = B < 40. ? 1. : 3.;
		V = mod(floor(B / 4.), 3.);
		ro = vec3(sin(B * 1.4), cos(B), B * 18.);
		ta = ro + vec3(sin(B * .6) * .3, 0, 1);
		r = B * (V - 1.) * .4;
		nc = S > 1. ? vec3(.2, .8, 1) : nc;
		nc = mix(nc, nc.xzy, V * .5);
	} else if (B < 48.) {
		S = 2.;
		k = 7. - smoothstep(44., 48., B) * 4.;
		ro = vec3(sin(B * .4) * k, 2., cos(B * .4) * k);
		ta = vec3(0);
		nc = vec3(.3, .6, 1);
	} else {
		S = 0.;
		k = (B - 64.) / 9.;
		ro = vec3(0, mix(6.5, 2., k), mix(-8., -60., k));
		ta = vec3(0, 5, 0);
	}
	vec3 w = normalize(ta - ro), x = normalize(cross(w, vec3(sin(r), cos(r), 0))),
		rd = normalize(uv.x * x + uv.y * cross(x, w) + 1.6 * w), col = vec3(0), att = col + 1.;
	float glow = (S < 1. ? smoothstep(0., 16., B) * smoothstep(73., 66., B) : 1.) * (1. + K);
	for (int b = 0; b < 2; b++) {
		t = gl = 0.;
		Q = -1. / min(rd.y, -1e-6);   // reach the floor in one step instead of creeping down to it
		for (int i = 0; i < 120; i++) {
			d = map(ro + rd * t);
			gl += .002 / (.002 + G * G);
			if (d < .0005 * t || t > 150.) break;
			t += d;
		}
		p = ro + rd * t;
		m = M;
		Q = 1.;
		fog = vec3(.004, .006, .012) + nc * .04 * exp(-abs(rd.y) * 12.) * glow;
		c = rd * 300.;
		c = fog + (S < 1. ? smoothstep(.3, .1, length(fract(c) - .5)) * step(.97, hash(floor(c.xy) + floor(c.z) * 7.)) : 0.);
		if (t < 150.) {
			c = nc * 5. * glow;
			if (m < 2.) {   // not neon: needs the normal (analytic for the floor) and ambient occlusion
				vec2 e = vec2(.001, -.001);
				n = vec3(0, 1, 0);
				if (m > 0.) n = normalize(e.xyy * map(p + e.xyy) + e.yyx * map(p + e.yyx) + e.yxy * map(p + e.yxy) + e.xxx * map(p + e.xxx));
				d = G;
				vec3 l = vec3(0, S < 1. ? 6.5 : 0., 0) - p;
				float ao = 1.;
				for (int j = 1; j < 5; j++) if (m > 0.) ao -= (j * .2 - map(p + n * j * .2)) / j * .5;   // (none on the floor: invisible there)
				c = (nc * glow * (S < 1. ? max(dot(n, normalize(l)), 0.) * 50. / (1. + dot(l, l)) : 3. * exp(-d * 3.)) + fog * 4.) * .15 * clamp(ao, 0., 1.);
				rd = reflect(rd, n);
				ro = p + n * .01;
			}
			c = mix(c, fog, 1. - exp(-t * .015));
		}
		col += att * (c + gl * nc * .01 * glow);
		if (m > 0. || t > 150.) break;
		att *= .6;
	}
	col += exp(-abs(B - 24.) * 12.) + exp(-abs(B - 48.) * 12.);
	k = exp(-.12 * dot(uv, uv)) * smoothstep(0., 1.5, B) * smoothstep(73., 69., B) * min(1., abs(B - 40.) * 2.) * min(1., abs(B - 64.) * 2.);
	o = vec4(pow((1. - exp(-col * 1.5)) * k, vec3(.4545)) + hash(uv + B) * .02 * k, 1);
}
