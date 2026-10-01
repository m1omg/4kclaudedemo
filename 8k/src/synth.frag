#version 330
// ROZMERY - music: synthwave. Rendered once on the GPU: every fragment of a
// 1024-wide RGBA32F target produces two consecutive stereo samples (44.1 kHz).
// 125 BPM (a 16th: 5292 samples, a bar: 84672 = 1.92 s), 104 bars, in sync with
// the visuals; a chord per 2 bars, phrases of 8 bars from bar 6:
//    0-6   intro: pads, a sparse arpeggio, a riser
//    6-30  the building: F - G - Em - Am; four on the floor, an octave bass and
//          a bell per stair step, climbing each flight; then a gated snare,
//          16th hats and the arpeggio (14); the hook (22); tom fills
//   30-34  dusk: a breakdown
//   34-38  the building takes itself apart: the pad swells, a whoosh follows
//          the rewind, the arpeggio runs backwards; three hits as its frame
//          collapses, on E7sus4
//   38-62  the tesseract, A minor (Am9 - Fmaj7#11 - Dm9 - E7sus4): the
//          arpeggio has as many notes per bar as the shape has vertices (2, 4,
//          8, 16); the drop (46) with rolling 16th bass; a second melody over
//          the slices (54)
//   62-70  the collapse (snare roll, a beat of silence), the Mandelbulb is born
//          (boom; a note per iteration); half time
//   70-78  the dive: a build-up
//   78-94  the flight: the hook twice, the second time doubled an octave up,
//          over rolling bass
//   94-104 the pull-up; the outro, on Cmaj7; fade
// All timing comes from the integer sample index, so note times stay exact
// even at the end of the song (no float phase noise).
out vec4 o;

// 0-35 chords (4 notes): F G Em Am, Am9 Fmaj7#11 Dm9 E7sus4, Cmaj7; 36-44 their
// bass roots; melodies, (pitch - 60) * 8 + eighths - 1 (pitch 60: a rest):
// 45-70 the hook, 71-98 the second
const int D[99] = int[](53, 57, 60, 64, 55, 59, 62, 64, 52, 55, 59, 62, 57, 60, 64, 67,
	57, 60, 64, 71, 53, 57, 64, 71, 50, 57, 60, 64, 52, 57, 59, 62, 48, 55, 59, 64,
	41, 43, 40, 45, 45, 41, 38, 40, 36,
	170, 152, 169, 193, 155, 129, 1, 186, 168, 185, 209, 193, 185, 155, 154, 128, 153, 185, 171, 153, 129, 194, 184, 169, 153, 175,
	129, 169, 184, 192, 185, 171, 129, 153, 169, 193, 184, 168, 153, 133, 1, 137, 169, 193, 209, 194, 168, 139, 129, 169, 185, 209, 187, 3);

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

// discrete summation formula: sum a^k sin(kx), a band-limited-ish sawtooth;
// a: its brightness (a filter)
float saw(float x, float a) { return (1. - a) * a * sin(x) / (1. - 2. * a * cos(x) + a * a); }

// the chord of the 2-bar unit u (bars 2u - 2, 2u - 1): index of its first note
int chord(int u) { return u > 49 ? 32 : ((u > 18 && u < 33 ? 4 : 0) + (u & 3)) * 4; }

vec2 song(int i)
{
	int st = i / 5292, bar = st >> 4, sb = st & 15, sec = bar + 2 >> 2, u = bar + 2 >> 1, c = chord(u);   // 16th; bar; 4-bar section; chord
	float ts = float(i % 5292) / 44100.,   // time in the 16th
		tb = ts + float(sb & 3) * .12,       // in the beat
		tc = float(i % 169344) / 44100.,     // in the chord
		B = float(i) / 84672.,
		n = noise(i), hp = n - noise(i - 1), x, y,
		// sections (bit k: bars 4k - 2 .. 4k + 1): half time; the full groove; four on the floor
		h = float(0x60800 >> sec & 1),
		g = float(0x1F0F0F0 >> sec & 1),
		kick = (float(0x1F8F0FC >> sec & 1) + h * float(sb < 4)) * exp(-tb * 6.) * min(tb * 300., 1.) * min((.48 - tb) * 30., 1.);
	vec2 m = kick * vec2(sin(330. * tb - 40. * exp(-tb * 30.))), s = vec2(0);

	// snare with a gated reverb on 2 and 4 (in half time on 3); hats: 16ths with open
	// off-beats, or 8ths; a crash on each phrase
	y = (B - float(bar - (bar + 2) % 8)) * 1.92;
	m += (g * float(sb >> 2 & 1) + h * float(sb >> 2 == 2)) * ((n * .5 + noise(i / 4) * .5) * (exp(-tb * 16.) * .8 + .3) * clamp((.3 - tb) * 50., 0., 1.) +
		sin(1162. * tb) * exp(-tb * 25.) * .5) * .3 +
		hp * (g * (sb % 4 == 2 ? exp(-ts * 14.) * .18 : exp(-ts * 60.) * .07) + float(0xE080C >> sec & 1) * float(sb % 2 == 0) * exp(-ts * 35.) * .1) * vec2(.8, 1) +
		float(0x1F8F0FC >> sec & 1) * hp * exp(-y * 1.2) * .2;
	// tom fills at the ends of phrases: a falling run of 16ths, panned across
	if (bar % 8 == 5 && sb > 7)
		m += g * sin(6.2832 * ((240. - float(sb) * 12.) * ts + 3. * (1. - exp(-ts * 25.)))) * exp(-ts * 10.) * min(ts * 400., 1.) *
			vec2(1. - float(sb - 8) * .1, .3 + float(sb - 8) * .1) * .45;
	// build-ups: a noise riser into bars 6, 46, 64 and 78, a snare roll (eighths, then 16ths) into the last three
	if (bar == 4 || bar == 5 || bar == 44 || bar == 45 || bar == 62 || bar == 63 || bar == 76 || bar == 77) {
		y = (B - float(bar & ~1)) * .5;
		m += mix(n, hp, y) * y * y * y * .25 + float(bar > 6) * (n * .7 + hp * .3) * exp(-((bar & 1) > 0 ? ts : mod(tb, .24)) * 25.) * y * y * .5;
	}
	// the building takes itself apart (34-36.5): a whoosh that follows its clock; its frame
	// collapses (36.5-38): three hits, deeper and deeper
	y = (B - 34.) / 2.5;
	x = B - 37.;
	if (y > 0. && y < 1.)
		m += (n * .6 + hp * .4) * y * (1. - y) * .5;
	if (x > 0. && x < 1.5) {
		y = fract(x * 2.) * .96;   // time since the hit
		m += (sin(6.2832 * ((70. - 15. * floor(x * 2.)) * y + 5. * (1. - exp(-y * 20.)))) + hp * exp(-y * 30.) * .4) * exp(-y * 2.5) * .7;
	}
	// the birth of the Mandelbulb (bar 64): a boom and a crash
	if (bar == 64 || bar == 65) {
		y = (B - 64.) * 1.92;
		m += sin(200. * y - 60. * exp(-y * 6.)) * exp(-y * 1.2) * .9 + hp * exp(-y * 2.) * .3;
	}

	// bass, saw and sub: 8ths with the octave on the "and", rolling 16ths (the drops),
	// long notes (the breakdowns)
	if ((0x3FEF9FC >> sec & 1) > 0) {
		int r = 0xC0F000 >> sec & 1, q = 0x13808FC >> sec & 1;
		y = r > 0 ? ts : q > 0 ? ts + float(sb & 1) * .12 : tc;   // time since the note began
		x = freq(float(D[36 + c / 4] + (r > 0 ? ((sb & 3) == 2 ? 12 : 0) : q * (sb & 2) * 6)), y);
		s += (saw(x, .25 + .5 * exp(-y * 12.)) + sin(x) * .7) * exp(-y * (r + q > 0 ? 4. : .4)) * min(y * 300., 1.) *
			clamp(((r > 0 ? .12 : q > 0 ? .24 : 3.84) - y) * 60., 0., 1.) * .3;
	}

	// pad: the current chord and the release of the previous one; it swells while the
	// building takes itself apart and breaks off as its frame starts to collapse
	y = clamp((B - 34.) / 2.5, 0., 1.) * clamp((36.53 - B) * 33., 0., 1.);
	for (int q = 0; q < 2; q++) {
		x = tc + float(q) * 3.84;   // time since that chord began
		for (int k = 0; k < 12; k++)
			s += saw(freq(float(D[chord(u - q) + k / 3]) + float(k % 3 - 1) * .08, x) + float(k), .35 + .3 * y) *
				smoothstep(0., 1.5, x) * (1. - smoothstep(3.84, 4.6, x)) * vec2(1. - float(k % 3) * .4, .2 + float(k % 3) * .4) * .18 * (1. + 2. * y * y * y);
	}

	// a bell per stair step, climbing each flight (C major pentatonic)
	if (bar > 5 && bar < 30) {
		int k = (st >> 2) + 8 & 15;
		x = freq(48. + float(k / 5 * 12) + round(float(k % 5) * 2.2), tb);
		s += (sin(x) * exp(-tb * 10.) + sin(4. * x) * exp(-tb * 30.) * .3) * min(tb * 400., 1.) * min((.48 - tb) * 30., 1.) * .25;
	}

	// arpeggio, a saw pluck with a dotted-eighth ping-pong echo; running backwards while
	// the building takes itself apart; sparse, random notes in the quiet parts
	for (int k = 0; k < 4; k++) {
		int s2 = max(st - 3 * k, 0), b2 = s2 >> 4, sc = b2 + 2 >> 2,   // (the echoed note's bar and section)
			l = 16 >> (b2 > 37 && b2 < 46 ? (b2 - 36) / 2 : b2 > 63 && b2 < 66 ? 2 : 4),   // 16ths per note
			q = s2 / l & 7;
		if (b2 > 33 && b2 < 37)
			q = 7 - q;
		y = ts + float(s2 % l) * .12;   // time since the note began
		x = freq(float(D[chord(s2 + 32 >> 5) + (q & 3)] + 12 + q / 4 * 12), y);
		s += saw(x, .2 + .6 * exp(-y * 20. / float(l))) * exp(-y * 12. / float(l)) * min(y * 300., 1.) * clamp((float(l) * .12 - y) * 30., 0., 1.) *
			float(0x7FFFFF2 >> sc & 1) * ((0x6060102 >> sc & 1) > 0 ? step(.4, noise(s2 / l)) : 1.) * float(s2 < 584 || s2 > 607) *
			pow(.45, float(k)) * (.65 + vec2(.35, -.35) * (k < 1 ? 0. : float(k % 2 * 2 - 1))) * .25;
	}

	// lead, two detuned saws with vibrato, and an echo: the hook (22-30, 78-94, the second
	// time doubled an octave up), the second melody over the tesseract's slices (54-62)
	for (int k = 0; k < 3; k++) {
		int s2 = st - 3 * k, b2 = s2 >> 4, ls = b2 > 85 ? 86 : b2 > 77 ? 78 : b2 > 53 ? 54 : 22, e = s2 - ls * 16, acc = 0;
		if (e < 0 || e > 127)
			continue;
		y = ts + float(e & 1) * .12;
		e /= 2;   // eighth in the 8 bars
		for (int j = 0; j < 28; j++) {
			int dd = D[(ls == 54 ? 71 : 45) + j], d = dd % 8 + 1;
			if (e < acc + d) {
				y += float(e - acc) * .24;   // time since the note began
				x = y + sin(y * 35.) * smoothstep(.15, .5, y) * .0002;   // vibrato
				float f = freq(float(dd / 8 + 60), x);
				s += (saw(f, .6) + saw(freq(float(dd / 8) + 60.1, x) + 1., .6) + saw(2. * f, .6) * float(ls == 86) * .7) * float(dd > 7) * min(y * 50., 1.) *
					(1. - smoothstep(float(d) * .24 - .05, float(d) * .24, y)) * (.6 + .4 * exp(-y * 3.)) *
					pow(.4, float(k)) * (.65 + vec2(.35, -.35) * (k < 1 ? 0. : float(k % 2 * 2 - 1))) * .4;
				break;
			}
			acc += d;
		}
	}
	return tanh((m + s * (1. - kick * .6)) * smoothstep(.115, .125, abs(B - 63.875)) * .8 * clamp(min(104. - B, B * 6.) / 3., 0., 1.));   // (fade in, fade out)
}

void main()
{
	int i = (int(gl_FragCoord.y) * 1024 + int(gl_FragCoord.x)) * 2;
	o = vec4(song(i), song(i + 1));
}
