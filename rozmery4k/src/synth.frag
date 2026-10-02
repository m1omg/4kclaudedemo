#version 330
// ROZMERY 4K - music: synthwave. Rendered once on the GPU: every fragment of a
// 1024-wide RGBA32F target produces two consecutive stereo samples (44.1 kHz).
// 125 BPM (a 16th: 5292 samples, a bar: 84672 = 1.92 s), 104 bars, in sync with
// the visuals; a chord per 2 bars; 8-bar phrases from bar 6, each with a level:
// 0 pad and arpeggio, 1 + kick, bass, hats, 2 + snare, 16th hats, 3 + the hook.
//    0-6   intro (0), a riser
//    6-30  the building: Fmaj7 - G7 - Em7 - Am7 (1, 2, 3)
//   30-38  dusk (0); three hits as the building's frame collapses (37)
//   38-62  the tesseract, A minor (Am7 - Fmaj7 - Dm7 - Em7): the arpeggio
//          has as many notes per bar as the shape has vertices (2, 4, 8, 16)
//          (1); the drop (46, 2); the hook (54, 3)
//   62-78  the Mandelbulb is born (0, a boom); the dive (1)
//   78-94  the flight: the hook twice (3)
//   94-104 the outro, on Cmaj7 (1, 0); fade
// All timing comes from the integer sample index (no float phase noise).
out vec4 o;

// the hook, 8 bars: (pitch - 75) * 8 + eighths - 1
const int D[25] = int[](50, 32, 49, 73, 35, 11, 66, 48, 65, 89, 73, 65, 35, 34, 8, 33, 65, 51, 33, 9, 74, 64, 49, 33, 55);

float noise(int i)
{
	uint x = uint(i) * 2654435769u;
	x ^= x >> 15;
	return float(x * 2246822519u) / 2.1e9 - 1.;
}

// a saw voice (discrete summation formula, a band-limited-ish sawtooth): MIDI
// note n, t since it began, l its length, k its decay, a its brightness; the
// phase is reduced to one period (sin, cos of large arguments are inaccurate on
// some GPUs)
float voice(float n, float t, float l, float k, float a)
{
	n = fract(8.1758 * exp2(n / 12.) * t) * 6.2832;
	return (1. - a) * a * sin(n) / (1. - 2. * a * cos(n) + a * a) * exp(-t * k) * min(t * 300., 1.) * clamp((l - t) * 40., 0., 1.);
}

// chord tone k (stacked thirds in C major) of the 2-bar unit u (bars 2u - 2, 2u - 1):
// Fmaj7 G7 Em7 Am7, Am7 Fmaj7 Dm7 Em7 (bars 36-64), Cmaj7 (from bar 98)
int note(int u, int k) { return ((u > 49 ? 0 : 0x21355243 >> ((u > 18 && u < 33 ? 4 : 0) + (u & 3)) * 4 & 15) * 12 + k * 24 + 5) / 7 + 48; }

vec2 song(int i)
{
	int st = i / 5292, bar = st >> 4, sb = st & 15, p = bar + 2 >> 3, lv = 0x1F4E4E4 >> p * 2 & 3, u = bar + 2 >> 1;   // 16th; bar; phrase, its level; chord
	float ts = i % 5292 / 44100.,   // time in the 16th
		tb = ts + (sb & 3) * .12,     // in the beat
		B = i / 84672.,
		n = noise(i), hp = n - noise(i - 1), x = B > 64. ? 3. : min(floor((B - 37.) * 2.), 2.), y = B - (x > 2. ? 64. : 37. + x * .5),
		kick = sign(lv) * exp(-tb * 6.) * min(tb * 300., 1.) * min((.48 - tb) * 30., 1.);
	// kick; snare with a gated reverb on 2 and 4; hats (16ths, or 8ths); booms: three,
	// deeper and deeper, as the building's frame collapses (37-38.5), one as the
	// Mandelbulb is born (64)
	vec2 m = vec2(kick * sin(330. * tb - 40. * exp(-tb * 30.)) + float(lv > 1) * (sb >> 2 & 1) * (n * clamp((.3 - tb) * 50., 0., 1.) + sin(1162. * tb) * exp(-tb * 25.)) * .125 +
		hp * sign(lv) * exp(-ts * 40.) * (lv > 1 ? 1. : 1. - (sb & 1)) * .1 +
		float(x >= 0. && y < 2.) * (sin(6.2832 * (y * (70. - 15. * x) + 5. * (1. - exp(-y * 20.))))) * exp(-y * 2.5) * .7), s = vec2(0);
	// a noise riser into bars 6, 46 and 78
	if ((0x221 >> p & 1) > 0 && (bar + 2) % 8 > 5)
		m += hp * pow(fract(B * .5), 3.) * .25;
	// bass: 8ths with the octave on the "and"
	y = ts + (sb & 1) * .12;
	s += voice(note(u, 0) - 12 + (sb & 2) * 6, y, .24, 4., .25 + .5 * exp(-y * 12.)) * .75 * sign(lv);
	// pad: the chord (detuned, spread), faded in and out in 0.11 s
	x = i % 169344 / 44100.;   // time since the chord began
	for (int k = 0; k < 12; k++)
		s += voice(note(u, k / 3) + (k % 3 - 1) * .08, x + k, 99., 0., .35) * min(x * 9., 1.) * min((3.84 - x) * 9., 1.) *
			vec2(1. - k % 3 * .4, .2 + k % 3 * .4) * .18;
	// arpeggio (a saw pluck) and the hook, each with a dotted-eighth echo
	for (int k = 0; k < 4; k++) {
		int s2 = max(st - 3 * k, 0), b2 = s2 >> 4,   // the echoed note's 16th and bar
			l = 16 >> (b2 > 37 && b2 < 46 ? (b2 - 36) / 2 : 4),   // 16ths per arpeggio note
			q = s2 / l & 7, e = s2 - 96 & 127, acc = 0;
		y = ts + s2 % l * .12;   // time since the note began
		x = k > 0 ? x * .45 : 1.;
		s += voice(note(s2 + 32 >> 5, q & 3) + 12 + q / 4 * 12, y, l * .12, 12. / l, .2 + .6 * exp(-y * 20. / l)) * x * .18;
		if (lv > 2) {
			y = ts + (e & 1) * .12;
			e /= 2;   // eighth in the 8 bars
			for (int j = 0; j < 25; j++) {
				int d = D[j] % 8 + 1;
				if (e < acc + d) {
					s += voice(D[j] / 8 + 75, y + (e - acc) * .24, d * .24, .5, .6) * x * .32;
					break;
				}
				acc += d;
			}
		}
	}
	return tanh((m + s * (1. - kick * .6)) * .8 * clamp((104. - B) / 3., 0., 1.));   // (fade out)
}

void main()
{
	int i = int(dot(gl_FragCoord.xy - .5, vec2(2, 2048)));
	o = vec4(song(i), song(i + 1));
}
