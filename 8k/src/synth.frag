#version 330
// ROZMERY - music. Rendered once on the GPU: every fragment of a 1024-wide
// RGBA32F target produces two consecutive stereo samples (44.1 kHz).
// 125 BPM (a 16th: 5292 samples, a bar: 84672 = 1.92 s), 100 bars, in sync
// with the visuals; a chord per 2 bars, phrases of 8 bars from bar 6:
//    0-34  the building: C major, Fmaj7 - G6 - Em7 - Am7; a marimba note per
//          beat climbs with the stairs (bars 6-30)
//   34-36  the building unbuilds itself: its music backwards, 16 times as fast
//   36-64  the tesseract: A minor, Am9 - Fmaj7#11 - Dm9 - E7sus4; notes per bar
//          of the arpeggio = vertices of the shape: point 1, line 2, square 4,
//          cube 8, tesseract 16
//   64-100 the Mandelbulb: born with a boom, a note per iteration; the first
//          theme returns with a melody
// All timing comes from the integer sample index, so note times stay exact
// even at the end of the song (no float phase noise).
out vec4 o;

// 0-15 chords of the first theme, 16-31 of the second (4 notes each), 32-39
// the bass roots, 40-64 the melody, 8 bars: (pitch - 60) * 8 + eighths - 1
const int D[65] = int[](53, 57, 60, 64, 55, 59, 62, 64, 52, 55, 59, 62, 57, 60, 64, 67,
	57, 60, 64, 71, 53, 57, 64, 71, 50, 57, 60, 64, 52, 57, 59, 62, 41, 43, 40, 45, 45, 41, 38, 40,
	97, 129, 154, 168, 153, 129, 99, 113, 153, 186, 168, 159, 129, 153, 186, 192, 185, 153, 131, 170, 152, 129, 97, 115, 99);

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

// the chord of the 2-bar unit u (bars 2u - 2, 2u - 1): index of its first note
int chord(int u) { return ((u > 18 && u < 33 ? 4 : 0) + (u & 3)) * 4; }

vec2 song(int i)
{
	float v = .8;   // volume
	if (i >= 2878848 && i < 3048192) {   // bars 34-36: bars 34 back to 2
		i = 2878848 - (i - 2878848) * 16;
		v = .2;
	}
	int st = i / 5292, bar = st >> 4, sb = st & 15, sec = bar + 2 >> 2, u = bar + 2 >> 1,   // 16th; bar; 4-bar section; chord
		dim = bar < 36 ? 4 : bar < 46 ? (bar - 36) / 2 : bar < 64 ? 4 : bar < 66 ? 2 : 4, l = 16 >> dim;   // arpeggio: 16ths per note
	float ts = float(i % 5292) / 44100.,   // time in the 16th
		tb = ts + float(sb & 3) * .12,       // in the beat
		B = float(i) / 84672.,
		n = noise(i), hp = n - noise(i - 1), x, y,
		// sections (bit k: bars 4k - 2 .. 4k + 1): four on the floor; half time
		kick = float((0x1F0F0FC >> sec & 1) + (0xC0000 >> sec & 1) * (~sb >> 2 & 1)) * exp(-tb * 6.) * min(tb * 300., 1.) * min((.48 - tb) * 30., 1.);
	vec2 m = kick * vec2(sin(330. * tb - 40. * exp(-tb * 30.))), s = vec2(0);

	// hats: open on the off-beats, closed 16ths; clap on 2 and 4; a crash on each phrase
	y = (B - float(bar - (bar + 2) % 8)) * 1.92;
	m += float(0x1F8F0F8 >> sec & 1) * hp * (sb % 4 == 2 ? exp(-ts * 18.) * .25 : exp(-ts * 70.) * .1) * vec2(.8, 1) +
		float(0x1F0E0F0 >> sec & 1) * float(sb >> 2 & 1) * ((n * .7 + hp * .3) * exp(-tb * 18.) + sin(1162. * tb) * exp(-tb * 25.) * .3) * .35 +
		float(0x1F0F0FC >> sec & 1) * hp * exp(-y * 1.2) * .2;
	// build-ups into the drops at bars 46 and 78: a snare roll (eighths, then 16ths) and a noise riser
	if (bar == 44 || bar == 45 || bar == 76 || bar == 77) {
		y = B - float(bar & ~1);
		m += (n * .7 + hp * .3) * exp(-((bar & 1) > 0 ? ts : mod(tb, .24)) * 25.) * y * y * .12 + n * y * y * y * .02;
	}
	// the birth of the Mandelbulb (bar 64): a boom and a crash
	if (bar == 64 || bar == 65) {
		y = (B - 64.) * 1.92;
		m += sin(200. * y - 60. * exp(-y * 6.)) * exp(-y * 1.2) * .9 + hp * exp(-y * 2.) * .3;
	}
	// the tesseract collapses (bars 62-64): a riser
	if (bar == 62 || bar == 63)
		m += n * pow((B - 62.) / 2., 3.) * .25;

	// bass: on the off-beats; rolling 16ths in the second theme
	if ((0x1FEFCFC >> sec & 1) > 0 && ((bar > 35 && bar < 64 ? 0xEEEE : 0x4444) >> sb & 1) > 0) {
		x = freq(float(D[32 + chord(u) / 4] + (sb & 3) / 3 * 12), ts);
		s += sin(x + 2. * exp(-ts * 20.) * sin(x)) * exp(-ts * 8.) * min(ts * 300., 1.) * min((.12 - ts) * 60., 1.) * .45;
	}

	// pad: the current chord and the release of the previous one
	for (int q = 0; q < 2; q++) {
		x = float(i % 169344) / 44100. + float(q) * 3.84;   // time since that chord began
		for (int k = 0; k < 12; k++)
			s += saw(freq(float(D[chord(u - q) + k / 3]) + float(k % 3 - 1) * .08, x) + float(k), dim < 4 ? .3 : .45) *
				smoothstep(0., 1.5, x) * (1. - smoothstep(3.84, 4.6, x)) * vec2(1. - float(k % 3) * .4, .2 + float(k % 3) * .4) * .2;
	}

	// marimba: a note per beat climbing with each flight of stairs (C major pentatonic)
	if (bar > 5 && bar < 30) {
		int k = (st >> 2) + 8 & 15;
		x = freq(48. + float(k / 5 * 12) + round(float(k % 5) * 2.2), tb);
		s += (sin(x) * exp(-tb * 10.) + sin(4. * x) * exp(-tb * 30.) * .3) * min(tb * 400., 1.) * min((.48 - tb) * 30., 1.) * .25;
	}

	// the frame collapses (bars 36-38): a falling tone per lost dimension
	if (bar == 36 || bar == 37) {
		y = mod(B - 36., .6667) * 1.92;
		s += sin(1570. * (1. - exp(-y * 4.))) * exp(-y * 2.) * min(y * 300., 1.) * min((1.28 - y) * 10., 1.) * .18;
	}

	// arpeggio (FM bell) with a dotted-eighth ping-pong echo; sparse, random notes
	// in the intro and at dusk
	for (int k = 0; k < 4; k++) {
		int s2 = max(st - 3 * k, 0), q = s2 / l & 7;
		y = ts + float(s2 % l) * .12;   // time since the note began
		x = freq(float(D[chord(s2 + 32 >> 5) + (q & 3)] + 12 + q / 4 * 12), y);
		s += sin(x + exp(-y * 8.) * sin(2. * x)) * exp(-y * 16. / float(l)) * min(y * 300., 1.) * min((float(l) * .12 - y) * 30., 1.) *
			(bar < 2 || bar > 5 && bar < 14 ? 0. : bar < 6 || bar > 29 && bar < 34 ? step(.4, noise(s2 / l)) : 1.) *
			pow(.45, float(k)) * (.65 + vec2(.35, -.35) * (k < 1 ? 0. : float(k % 2 * 2 - 1))) * .12;
	}

	// melody (bars 70-98) with an echo
	for (int k = 0; k < 3; k++) {
		int e = st - 3 * k - 1120, acc = 0;   // 16th since bar 70
		if (e < 0 || e > 447)
			continue;
		y = ts + float(e & 1) * .12;
		e = e / 2 % 64;   // eighth in the 8 bars
		for (int j = 40; j < 65; j++) {
			int d = D[j] % 8 + 1;
			if (e < acc + d) {
				y += float(e - acc) * .24;   // time since the note began
				x = y + sin(y * 35.) * smoothstep(.15, .5, y) * .0002;   // vibrato
				s += (saw(freq(float(D[j] / 8 + 60), x), .6) + saw(freq(float(D[j] / 8) + 60.1, x) + 1., .6)) * min(y * 50., 1.) *
					(1. - smoothstep(float(d) * .24 - .05, float(d) * .24, y)) * (.6 + .4 * exp(-y * 3.)) *
					pow(.4, float(k)) * (.65 + vec2(.35, -.35) * (k < 1 ? 0. : float(k % 2 * 2 - 1))) * .45;
				break;
			}
			acc += d;
		}
	}
	return tanh((m + s * (1. - kick * .6)) * (B > 63.75 && B < 64. ? 0. : v) * clamp(min(100. - B, B * 6.) / 3., 0., 1.));   // (fade in, fade out)
}

void main()
{
	int i = (int(gl_FragCoord.y) * 1024 + int(gl_FragCoord.x)) * 2;
	o = vec4(song(i), song(i + 1));
}
