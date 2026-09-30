// Diagnostic tool for the Linux version (NOT part of the 4k intro).
// Runs the intro's startup exactly like src/linux/main.asm does (X11 + GLX
// compatibility context, the music rendered on the GPU into an RGBA32F
// framebuffer and read back, ALSA "default" with the same parameters) and
// prints what happens at every step:
//   - X11 / GLX / OpenGL driver strings
//   - music shader compile and link log, framebuffer status, GL errors
//   - whether the rendered music matches the reference render
//   - ALSA return codes and the PCM setup, then plays 8 s of the music
// It also saves the first 60 s of the rendered music as brana-diag.wav.
//
// Build: gcc -O2 -o brana-diag tools/diag.c -ldl -lm   (after tools/minify.py)
#include "../src/shaders.h"
#include <dlfcn.h>
#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#define ROWS (SONG_SAMPLES / 2048 + 1)

// reference values from the llvmpipe render of src/music.frag
static const int ref_pos[] = {176400, 882000, 1587600, 2646000, 3704400, 4410000};
static const float ref_val[][16] = {
	{-0.03926f, -0.01700f, -0.04049f, -0.01726f, -0.04173f, -0.01769f, -0.04304f, -0.01825f, -0.04440f, -0.01903f, -0.04582f, -0.02003f, -0.04724f, -0.02117f, -0.04874f, -0.02253f},
	{-0.03953f, -0.01600f, -0.04068f, -0.01607f, -0.04167f, -0.01618f, -0.04259f, -0.01631f, -0.04344f, -0.01661f, -0.04427f, -0.01708f, -0.04504f, -0.01769f, -0.04587f, -0.01851f},
	{-0.04180f, 0.00610f, -0.04318f, 0.00866f, -0.04393f, 0.01109f, -0.04421f, 0.01342f, -0.04407f, 0.01526f, -0.04360f, 0.01669f, -0.04280f, 0.01772f, -0.04179f, 0.01835f},
	{-0.10603f, -0.01561f, -0.06061f, 0.03044f, -0.04208f, 0.04914f, -0.03964f, 0.05140f, -0.07209f, 0.01835f, -0.13278f, -0.04394f, -0.06249f, 0.02561f, -0.05516f, 0.03095f},
	{-0.00233f, -0.00907f, -0.00587f, -0.00493f, -0.01008f, 0.00209f, -0.01309f, 0.01377f, -0.01490f, 0.02771f, -0.01694f, 0.03886f, -0.02024f, 0.04359f, -0.02458f, 0.04283f},
	{0.02376f, 0.03779f, -0.05905f, -0.03244f, 0.00196f, 0.04267f, 0.01648f, 0.07293f, -0.01600f, 0.05625f, 0.01380f, 0.09829f, -0.12590f, -0.03475f, 0.05403f, 0.14706f},
};
static const float ref_rms[9] = {0.0620f, 0.1396f, 0.2216f, 0.2646f, 0.2630f, 0.1501f, 0.2721f, 0.2705f, 0.1912f};
static const float ref_zcr[9] = {339.f, 1685.f, 2736.f, 2136.f, 1834.f, 2349.f, 2125.f, 1851.f, 2023.f};

static float song[ROWS * 1024 * 4];

static void *lib(const char *name)
{
	void *h = dlopen(name, RTLD_LAZY);
	printf("dlopen(%s): %s\n", name, h ? "ok" : dlerror());
	if (!h) exit(1);
	return h;
}

static void *sym(void *h, const char *name)
{
	void *p = dlsym(h, name);
	if (!p) { printf("  dlsym(%s): NOT FOUND\n", name); exit(1); }
	return p;
}

static double now(void)
{
	struct timespec t;
	clock_gettime(CLOCK_MONOTONIC, &t);
	return t.tv_sec + t.tv_nsec * 1e-9;
}

typedef unsigned U;
typedef void *P;

// X11 (only what is needed; the Display is opaque except for the macros
// the intro also uses through the struct: screens, root, width, height)
static P (*XOpenDisplay)(const char *);
static P (*XCreateColormap)(P, unsigned long, P, int);
static unsigned long (*XCreateWindow)(P, unsigned long, int, int, U, U, U, int, U, P, unsigned long, P);

// GLX / GL
static P (*glXChooseVisual)(P, int, int *);
static P (*glXCreateContext)(P, P, P, int);
static int (*glXMakeCurrent)(P, unsigned long, P);
static const char *(*glGetString)(U);
static U (*glGetError)(void);
static void (*glBindTexture)(U, U);
static void (*glTexImage2D)(U, int, int, int, int, int, U, U, const void *);
static void (*glGenFramebuffers)(int, U *);
static void (*glBindFramebuffer)(U, U);
static void (*glFramebufferTexture2D)(U, U, U, U, int);
static U (*glCheckFramebufferStatus)(U);
static void (*glViewport)(int, int, int, int);
static U (*glCreateShaderProgramv)(U, int, const char *const *);
static void (*glGetProgramiv)(U, U, int *);
static void (*glGetProgramInfoLog)(U, int, int *, char *);
static void (*glUseProgram)(U);
static void (*glRects)(short, short, short, short);
static void (*glReadPixels)(int, int, int, int, U, U, void *);
static void (*glFinish)(void);
static void (*glGetIntegerv)(U, int *);
static void (*glGetTexLevelParameteriv)(U, int, U, int *);

// ALSA
static int (*snd_pcm_open)(P *, const char *, int, int);
static int (*snd_pcm_set_params)(P, int, int, U, U, int, U);
static long (*snd_pcm_writei)(P, const void *, unsigned long);
static int (*snd_pcm_drain)(P);
static const char *(*snd_strerror)(int);
static int (*snd_output_stdio_attach)(P *, FILE *, int);
static int (*snd_pcm_dump)(P, P);

static void glerr(const char *what)
{
	U e = glGetError();
	printf("  %-34s %s", what, e ? "GL ERROR " : "ok\n");
	if (e) printf("0x%04x\n", e);
}

static void save_wav(const char *fn, int frames)
{
	FILE *f = fopen(fn, "wb");
	if (!f) { perror(fn); return; }
	uint32_t n = frames * 4;
	uint8_t h[44] = "RIFF....WAVEfmt ";
	uint32_t v[] = {36 + n};
	memcpy(h + 4, v, 4);
	uint32_t fmt[4] = {16, 1 | 2 << 16, 44100, 44100 * 4};
	memcpy(h + 16, fmt, 16);
	uint16_t ba[2] = {4, 16};
	memcpy(h + 32, ba, 4);
	memcpy(h + 36, "data", 4);
	memcpy(h + 40, &n, 4);
	fwrite(h, 1, 44, f);
	for (int i = 0; i < frames * 2; i++) {
		float x = song[i];
		if (!(x == x)) x = 0;
		x = x > 1 ? 1 : x < -1 ? -1 : x;
		int16_t s = (int16_t)lrintf(x * 32767);
		fwrite(&s, 2, 1, f);
	}
	fclose(f);
	printf("saved the first %d s of the rendered music to %s\n", frames / 44100, fn);
}

int main(void)
{
	printf("BRANA diagnostics\n");
	printf("session: XDG_SESSION_TYPE=%s WAYLAND_DISPLAY=%s DISPLAY=%s\n\n", getenv("XDG_SESSION_TYPE"),
		getenv("WAYLAND_DISPLAY"), getenv("DISPLAY"));

	void *x11 = lib("libX11.so.6"), *gl = lib("libGL.so.1"), *as = lib("libasound.so.2");
	XOpenDisplay = sym(x11, "XOpenDisplay");
	XCreateColormap = sym(x11, "XCreateColormap");
	XCreateWindow = sym(x11, "XCreateWindow");
	glXChooseVisual = sym(gl, "glXChooseVisual");
	glXCreateContext = sym(gl, "glXCreateContext");
	glXMakeCurrent = sym(gl, "glXMakeCurrent");
	glGetString = sym(gl, "glGetString");
	glGetError = sym(gl, "glGetError");
	glBindTexture = sym(gl, "glBindTexture");
	glTexImage2D = sym(gl, "glTexImage2D");
	glGenFramebuffers = sym(gl, "glGenFramebuffers");
	glBindFramebuffer = sym(gl, "glBindFramebuffer");
	glFramebufferTexture2D = sym(gl, "glFramebufferTexture2D");
	glCheckFramebufferStatus = sym(gl, "glCheckFramebufferStatus");
	glViewport = sym(gl, "glViewport");
	glCreateShaderProgramv = sym(gl, "glCreateShaderProgramv");
	glGetProgramiv = sym(gl, "glGetProgramiv");
	glGetProgramInfoLog = sym(gl, "glGetProgramInfoLog");
	glUseProgram = sym(gl, "glUseProgram");
	glRects = sym(gl, "glRects");
	glReadPixels = sym(gl, "glReadPixels");
	glFinish = sym(gl, "glFinish");
	glGetIntegerv = sym(gl, "glGetIntegerv");
	glGetTexLevelParameteriv = sym(gl, "glGetTexLevelParameteriv");
	snd_pcm_open = sym(as, "snd_pcm_open");
	snd_pcm_set_params = sym(as, "snd_pcm_set_params");
	snd_pcm_writei = sym(as, "snd_pcm_writei");
	snd_pcm_drain = sym(as, "snd_pcm_drain");
	snd_strerror = sym(as, "snd_strerror");
	snd_output_stdio_attach = sym(as, "snd_output_stdio_attach");
	snd_pcm_dump = sym(as, "snd_pcm_dump");

	// --- X11 + GLX, as in the intro (compatibility context, window not mapped yet)
	P d = XOpenDisplay(0);
	if (!d) { printf("XOpenDisplay failed\n"); return 1; }
	char *scr = *(char **)((char *)d + 0xe8);
	unsigned long root = *(unsigned long *)(scr + 16);
	int w = *(int *)(scr + 24), h = *(int *)(scr + 28);
	printf("\nX11: screen %dx%d\n", w, h);
	int attr[] = {4, 5, 0};   // GLX_RGBA, GLX_DOUBLEBUFFER
	P vi = glXChooseVisual(d, 0, attr);
	if (!vi) { printf("glXChooseVisual failed\n"); return 1; }
	P visual = *(P *)vi;
	int depth = *(int *)((char *)vi + 20);
	char swa[112] = {0};
	*(P *)(swa + 96) = XCreateColormap(d, root, visual, 0);
	unsigned long win = XCreateWindow(d, root, 0, 0, 256, 256, 0, depth, 1, visual, 0x2000, swa);
	P ctx = glXCreateContext(d, vi, 0, 1);
	printf("glXCreateContext: %s, glXMakeCurrent: %s\n", ctx ? "ok" : "FAILED", glXMakeCurrent(d, win, ctx) ? "ok" : "FAILED");
	printf("GL_VENDOR:   %s\nGL_RENDERER: %s\nGL_VERSION:  %s\nGLSL:        %s\n", glGetString(0x1F00),
		glGetString(0x1F01), glGetString(0x1F02), glGetString(0x8B8C));

	// --- the music, exactly like src/linux/main.asm
	printf("\nmusic render (1024 x %d RGBA32F):\n", ROWS);
	glBindTexture(0x0DE1, 1);
	glerr("glBindTexture");
	glTexImage2D(0x0DE1, 0, 0x8814, 1024, ROWS, 0, 0x1908, 0x1406, 0);
	glerr("glTexImage2D(RGBA32F)");
	int ifmt = 0, rtype = 0, rsize = 0;
	glGetTexLevelParameteriv(0x0DE1, 0, 0x1003, &ifmt);    // GL_TEXTURE_INTERNAL_FORMAT
	glGetTexLevelParameteriv(0x0DE1, 0, 0x8C10, &rtype);   // GL_TEXTURE_RED_TYPE
	glGetTexLevelParameteriv(0x0DE1, 0, 0x805C, &rsize);   // GL_TEXTURE_RED_SIZE
	printf("  texture: internal format 0x%04x, red type 0x%04x, red bits %d\n", ifmt, rtype, rsize);
	U fbo = 0;
	glGenFramebuffers(1, &fbo);
	printf("  glGenFramebuffers -> %u\n", fbo);
	glBindFramebuffer(0x8D40, fbo);
	glerr("glBindFramebuffer");
	glFramebufferTexture2D(0x8D40, 0x8CE0, 0x0DE1, 1, 0);
	glerr("glFramebufferTexture2D");
	U st = glCheckFramebufferStatus(0x8D40);
	printf("  framebuffer status                 0x%04x %s\n", st, st == 0x8CD5 ? "(complete)" : "(NOT COMPLETE)");
	glViewport(0, 0, 1024, ROWS);
	glerr("glViewport");
	double t0 = now();
	U prog = glCreateShaderProgramv(0x8B30, 1, &music_frag);
	int ok = 0, len = 0;
	glGetProgramiv(prog, 0x8B82, &ok);   // GL_LINK_STATUS
	char log[4096] = "";
	glGetProgramInfoLog(prog, sizeof log, &len, log);
	printf("  compile+link: %.2f s, program %u, link status %s\n", now() - t0, prog, ok ? "OK" : "FAILED");
	if (len) printf("  --- program log ---\n%s\n  -------------------\n", log);
	glUseProgram(prog);
	glerr("glUseProgram");
	int cur = -1;
	glGetIntegerv(0x8B8D, &cur);   // GL_CURRENT_PROGRAM
	printf("  current program: %d\n", cur);
	t0 = now();
	glRects(-1, -1, 1, 1);
	glFinish();
	printf("  draw: %.2f s\n", now() - t0);
	glerr("glRects");
	for (int i = 0; i < 1024 * ROWS * 4; i++) song[i] = 12345.f;   // detects pixels not written by glReadPixels
	glReadPixels(0, 0, 1024, ROWS, 0x1908, 0x1406, song);
	glerr("glReadPixels");

	// --- check the result
	long nan = 0, untouched = 0, outside01 = 0;
	for (long i = 0; i < (long)SONG_SAMPLES * 2; i++) {
		float x = song[i];
		if (!(x == x) || isinf(x)) nan++;
		else if (x == 12345.f) untouched++;
		else if (x < 0 || x > 1) outside01++;
	}
	printf("\nrendered music: %ld NaN/Inf, %ld samples not written by glReadPixels, %ld%% of samples outside [0,1]\n",
		nan, untouched, outside01 * 100 / ((long)SONG_SAMPLES * 2));
	printf("first samples: %.5f %.5f %.5f %.5f\n", song[0], song[1], song[2], song[3]);
	double worst = 0;
	for (int k = 0; k < 6; k++) {
		double e = 0;
		for (int j = 0; j < 16; j++) e = fmax(e, fabs(song[ref_pos[k] * 2 + j] - ref_val[k][j]));
		printf("  t=%3d s: max difference from reference %.5f\n", ref_pos[k] / 44100, e);
		worst = fmax(worst, e);
	}
	printf("  16 s window:  RMS (reference)   zero crossings/s (reference)\n");
	for (int k = 0; k < 9; k++) {
		double s2 = 0;
		long zc = 0;
		for (long i = k * 16L * 44100; i < (k + 1) * 16L * 44100 - 1; i++) {
			double a = song[i * 2], b = song[i * 2 + 2];
			s2 += a * a;
			zc += (a < 0) != (b < 0);
		}
		printf("  %3d-%3d s:   %.4f (%.4f)      %5ld (%5.0f)\n", k * 16, k * 16 + 16, sqrt(s2 / (16 * 44100)),
			ref_rms[k], zc / 32, ref_zcr[k]);
	}
	printf("MUSIC RENDER: %s\n", worst < .02 && !nan ? "OK (matches the reference)" : "DIFFERENT FROM THE REFERENCE");
	save_wav("brana-diag.wav", 60 * 44100);

	// --- ALSA, same parameters as the intro
	printf("\nALSA sound cards (/proc/asound/cards):\n");
	FILE *cf = fopen("/proc/asound/cards", "r");
	char line[256];
	while (cf && fgets(line, sizeof line, cf)) printf("  %s", line);
	if (cf) fclose(cf);
	printf("\nALSA:\n");
	P pcm = 0, out = 0;
	int r = snd_pcm_open(&pcm, "default", 0, 0);
	printf("  snd_pcm_open(\"default\") = %d %s\n", r, r < 0 ? snd_strerror(r) : "");
	if (r < 0) return 1;
	r = snd_pcm_set_params(pcm, 14, 3, 2, 44100, 1, 100000);
	printf("  snd_pcm_set_params(FLOAT_LE, 2 ch, 44100 Hz, 100 ms) = %d %s\n", r, r < 0 ? snd_strerror(r) : "");
	snd_output_stdio_attach(&out, stdout, 0);
	snd_pcm_dump(pcm, out);
	// A: one big write, like the intro; B: small blocks
	printf("\n  A) playing 0:16-0:24 of the music with ONE write call (like the intro) ...\n");
	fflush(stdout);
	double ta = now();
	long n = snd_pcm_writei(pcm, song + 16 * 44100 * 2, 8 * 44100);
	printf("     snd_pcm_writei = %ld %s, took %.1f s\n", n, n < 0 ? snd_strerror(n) : "", now() - ta);
	printf("  B) playing 0:32-0:40 in blocks of 0.1 s ...\n");
	fflush(stdout);
	long total = 0;
	ta = now();
	for (int k = 0; k < 80; k++) {
		n = snd_pcm_writei(pcm, song + (32 * 44100 + k * 4410) * 2, 4410);
		if (n < 0) { printf("     snd_pcm_writei = %ld %s (after %ld frames)\n", n, snd_strerror(n), total); break; }
		total += n;
	}
	snd_pcm_drain(pcm);
	printf("     written %ld frames, took %.1f s\n", total, now() - ta);
	printf("\nDid A and B sound like music (pad, arpeggio, hi-hats, bass; kick in B) or like a tone?\n");
	return 0;
}
