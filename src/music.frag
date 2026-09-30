#version 330
// BRANA - music. Rendered once on the GPU: every fragment of a 1024-wide
// RGBA32F target produces two consecutive stereo samples (44.1 kHz).
// 120 BPM, D minor: Dm9 - Bbmaj9 - Gm9 - A7, two bars per chord.
// All timing is derived from the integer sample index, so local note times
// stay exact even at the end of the song (no float phase noise).
out vec4 o;

// 0-15 pad voicings (4 notes per chord), 16-19 bass roots,
// 20-47 lead melody, 8 bars: (pitch - 69) * 8 + length in eighths
const int D[48] = int[](53,57,60,64, 53,57,60,62, 53,57,58,62, 55,57,61,64, 38,34,31,33,
	67,57,42,2,27,41,60,67,57,42,26,44,66,98,107,97,82,66,43,65,84,99,81,58,42,36,58,2);

// phase (radians) of MIDI note n at time t, reduced to one period: sin() and
// cos() of large arguments are inaccurate on some GPUs
float freq(float n, float t) { return fract(8.1758 * exp2(n / 12.) * t) * 6.2832; }

float noise(int i)
{
	uint x = uint(i) * 2654435769u;
	x ^= x >> 15;
	x *= 2246822519u;
	x ^= x >> 13;
	return float(x) / 2.1e9 - 1.;
}

// discrete summation formula: sum a^k sin(kx), a band-limited-ish sawtooth
float saw(float x, float a) { return (1. - a) * a * sin(x) / (1. - 2. * a * cos(x) + a * a); }

vec2 song(int i)
{
	int st = i * 2 / 11025,                            // 16th step
		bar = st >> 4, sb = st & 15, sec = 1 << (bar >> 2), bb = bar % 24;
	float ts = (i * 2 - st * 11025) / 88200.,           // time in step
		tb = ts + (sb & 3) * .125,                        // time in beat
		tc = tb + (sb >> 2) * .5 + (bar & 1) * 2.,        // time in chord
		bars = i / 88200.,
		n = noise(i), hp = n - noise(i - 1), x, y,
		// arrangement in 4-bar sections: bit k = bars 4k..4k+3
		kick = float(sec & 0x1F3D0) / sec * exp(-tb * 4.) * min(tb * 200., 1.) * smoothstep(.5, .45, tb),
		drop = float(sec & 0xF3C0) / sec;

	// drums: hats, clap, kick
	vec2 m = vec2(float(sec & 0x3F3FC) / sec * hp * ((tb > .25 ? exp((.25 - tb) * 14.) * .24 : 0.) + drop * exp(-ts * 60.) * ((sb & 1) + 1) * .064) +
		drop * (sb >> 2 & 1) * ((n * .6 + hp * .3) * (exp(-tb * 20.) + exp(-mod(tb, .011) * 300.) * step(tb, .033)) + sin(1162. * tb) * exp(-tb * 25.) * .3) * .4 +
		kick * sin(300. * tb - 37.7 * exp(-tb * 25.)) * .9 +
		// build-up: snare roll and noise riser; crash on the drops
		(bb > 19 && bar < 48 ? (n * .7 + hp * .3) * exp(-(bb > 22 ? ts : mod(tb, .25)) * 25.) * (bb * 16 + sb - 351) / 64. * step(22., bb) +
			n * pow((tc + (bar >> 1 & 1) * 4.) / 8., 3.) * .3 : 0.) +
		((bar >> 1) % 12 == 0 && (bar >> 1) % 36 > 0 ? hp * exp(-tc * 1.3) * .25 : 0.)),
		s = vec2(0);

	// rolling bass: the three 16ths after each kick
	x = freq(D[16 + (bar >> 1 & 3)] + (sb & 3) / 3 * 12, ts);
	s += float(sec & 0x1F3FC) / sec * sign(sb & 3) * sin(x + 2. * exp(-ts * 20.) * sin(x)) * exp(-ts * 8.) * min(ts * 300., 1.) * smoothstep(.125, .11, ts) * .45;

	// pad: current chord plus the release of the previous one
	for (int c = 0; c < 2; c++) {
		x = tc + c * 4.;
		for (int k = 0; k < 12; k++)
			s += saw(freq(D[((bar >> 1) - c & 3) * 4 + k / 3] + (k % 3 - 1) * .07, x) + k, .3 + .3 * smoothstep(8., 24., bars) + .15 * drop) *
				smoothstep(0., 1.5, x) * smoothstep(4.8, 4., x) * vec2(1. - k % 3 * .4, .2 + k % 3 * .4) * .22;
	}

	// arpeggio with dotted-eighth ping-pong echo
	for (int k = 0; k < 4; k++) {
		int s2 = max(st - 3 * k, 0), q = s2 & 7;
		if ((s2 & 16) > 0) q = 7 - q;
		x = freq(D[(s2 >> 5 & 3) * 4 + (q & 3)] + 12 + q / 4 * 12, ts);
		s += sin(x + (.5 + 1.5 * smoothstep(4., 24., bars)) * exp(-ts * 12.) * sin(2. * x)) * exp(-ts * 10.) * smoothstep(.125, .11, ts) *
			min(ts * 300., 1.) * pow(.45, k) * (.65 + vec2(.35, -.35) * (k < 1 ? 0. : k % 2 * 2. - 1.)) *
			float(sec & 0x3FFFE) / sec * (.4 + .6 * smoothstep(16., 24., bars)) * .2;
	}

	// lead melody (bars 40-64) with echo
	for (int k = 0; k < 3; k++) {
		int ms = st - 640 - 3 * k, acc = 0;
		if (ms < 0 || ms > 383) continue;
		ms %= 128;
		for (int j = 20; j < 48; j++) {
			int d = D[j] & 7;
			if (ms < acc + d * 2) {
				y = (ms - acc) * .125 + ts;
				x = y + sin(y * 35.) * smoothstep(.15, .5, y) * .0002;   // vibrato
				s += (saw(freq(D[j] / 8 + 69, x), .7) + saw(freq(D[j] / 8 + 69.1, x) + 1., .7)) * min(y * 50., 1.) * smoothstep(d * .25, d * .25 - .04, y) *
					(.6 + .4 * exp(-y * 3.)) * pow(.4, k) * (.65 + vec2(.35, -.35) * (k < 1 ? 0. : k % 2 * 2. - 1.)) * .7;
				break;
			}
			acc += d * 2;
		}
	}
	return tanh((m + s * (1. - kick * .7)) * smoothstep(73., 68., bars) * .8);
}

void main()
{
	int i = (int(gl_FragCoord.y) * 1024 + int(gl_FragCoord.x)) * 2;
	o = vec4(song(i), song(i + 1));
}
