// BRANA - 4k intro, Windows (32-bit, linked with Crinkler)
// Window + OpenGL via WGL, music rendered on the GPU into a float texture and
// played through waveOut; visuals are timed by the audio playback position.
// Needs OpenGL 3.3: programs are built with the OpenGL 2.0 calls (fragment
// shader only; the compatibility context's fixed-function vertex stage draws
// the rectangle), not glCreateShaderProgramv (4.1).
#include "../shaders.h"

#define WINAPI __stdcall
#define IMP __declspec(dllimport)
typedef void *H;
typedef unsigned U;

IMP H WINAPI CreateWindowExA(U, const char *, const char *, U, int, int, int, int, H, H, H, H);
IMP H WINAPI GetDC(H);
IMP int WINAPI ShowCursor(int);
IMP short WINAPI GetAsyncKeyState(int);
IMP int WINAPI PeekMessageA(void *, H, U, U, U);
IMP int WINAPI GetSystemMetrics(int);
IMP void WINAPI ExitProcess(U);
IMP int WINAPI ChoosePixelFormat(H, const void *);
IMP int WINAPI SetPixelFormat(H, int, const void *);
IMP int WINAPI SwapBuffers(H);
IMP H WINAPI wglCreateContext(H);
IMP int WINAPI wglMakeCurrent(H, H);
IMP void *WINAPI wglGetProcAddress(const char *);
IMP void WINAPI glRects(short, short, short, short);
IMP void WINAPI glViewport(int, int, int, int);
IMP void WINAPI glBindTexture(U, U);
IMP void WINAPI glTexImage2D(U, int, int, int, int, int, U, U, const void *);
IMP void WINAPI glReadPixels(int, int, int, int, U, U, void *);
IMP void WINAPI glFinish(void);
IMP U WINAPI waveOutOpen(H *, U, const void *, U, U, U);
IMP U WINAPI waveOutPrepareHeader(H, void *, U);
IMP U WINAPI waveOutWrite(H, void *, U);
IMP U WINAPI waveOutGetPosition(H, void *, U);

typedef U(WINAPI *Create0Fn)(void);   // stdcall: the callee pops the arguments,
typedef U(WINAPI *CreateFn)(U);       // so every call must use the exact signature
typedef void(WINAPI *SourceFn)(U, int, const char *const *, const int *);
typedef void(WINAPI *UintFn)(U);
typedef int(WINAPI *LocFn)(U, const char *);
typedef void(WINAPI *Uint2Fn)(U, U);
typedef void(WINAPI *GenFn)(int, U *);
typedef void(WINAPI *UniformFn)(int, int, const float *);
typedef void(WINAPI *FbTexFn)(U, U, U, U, int);

int _fltused;

#define ROWS (SONG_SAMPLES / 2048 + 1)
#define BAND ((ROWS + 15) / 16)   // the music is rendered in 16 bands: on a weak GPU one
                                  // draw of all of it could exceed the 2 s GPU watchdog

static const unsigned char pfd[40] = {0, 0, 0, 0, 0x25, 0, 0, 0, 0, 32};
static const unsigned short wfx[9] = {3, 2, 44100, 0, 44100 * 8 % 65536, 44100 * 8 / 65536, 8, 32, 0};
static float song[ROWS * 1024 * 4];
static U hdr[8] = {(U)song, SONG_SAMPLES * 8};
static U mmt[3] = {2};
static float uni[4];
static H wo;
static U msg[7];
static U fbo;

// compiles, links and uses a fragment-only program
static U program(const char *src)
{
	U p = ((Create0Fn)wglGetProcAddress("glCreateProgram"))(), s = ((CreateFn)wglGetProcAddress("glCreateShader"))(0x8B30);
	((SourceFn)wglGetProcAddress("glShaderSource"))(s, 1, &src, 0);
	((UintFn)wglGetProcAddress("glCompileShader"))(s);
	((Uint2Fn)wglGetProcAddress("glAttachShader"))(p, s);
	((UintFn)wglGetProcAddress("glLinkProgram"))(p);
	((UintFn)wglGetProcAddress("glUseProgram"))(p);
	return p;
}

void entrypoint(void)
{
	int w = GetSystemMetrics(0), h = GetSystemMetrics(1);
	H dc = GetDC(CreateWindowExA(0, "edit", 0, 0x90000000, 0, 0, w, h, 0, 0, 0, 0));
	SetPixelFormat(dc, ChoosePixelFormat(dc, pfd), pfd);
	wglMakeCurrent(dc, wglCreateContext(dc));
	ShowCursor(0);

	// Render the whole song in one pass into a 1024 x ROWS RGBA32F texture;
	// every texel holds two consecutive stereo samples.
	glBindTexture(0x0DE1, 1);
	glTexImage2D(0x0DE1, 0, 0x8814, 1024, ROWS, 0, 0x1908, 0x1406, 0);
	((GenFn)wglGetProcAddress("glGenFramebuffers"))(1, &fbo);
	Uint2Fn bindfb = (Uint2Fn)wglGetProcAddress("glBindFramebuffer");
	bindfb(0x8D40, fbo);
	((FbTexFn)wglGetProcAddress("glFramebufferTexture2D"))(0x8D40, 0x8CE0, 0x0DE1, 1, 0);
	program(music_frag);
	for (int y = 0; y < ROWS; y += BAND) {   // gl_FragCoord is window relative: same samples
		glViewport(0, y, 1024, BAND);
		glRects(-1, -1, 1, 1);
		glFinish();
	}
	glReadPixels(0, 0, 1024, ROWS, 0x1908, 0x1406, song);
	bindfb(0x8D40, 0);

	uni[1] = w;
	uni[2] = h;
	glViewport(0, 0, w, h);
	int loc = ((LocFn)wglGetProcAddress("glGetUniformLocation"))(program(visual_frag), "u");
	UniformFn uniform = (UniformFn)wglGetProcAddress("glUniform4fv");

	waveOutOpen(&wo, -1, wfx, 0, 0, 0);
	waveOutPrepareHeader(wo, hdr, 32);
	waveOutWrite(wo, hdr, 32);
	do {
		PeekMessageA(msg, 0, 0, 0, 1);
		waveOutGetPosition(wo, mmt, 12);
		uni[0] = (int)mmt[1] / 44100.0f;
		uniform(loc, 1, uni);
		glRects(-1, -1, 1, 1);
		SwapBuffers(dc);
	} while (!GetAsyncKeyState(27) && mmt[1] < SONG_SAMPLES);
	ExitProcess(0);
}
