// Development harness (NOT part of the 4k intro).
// Renders the intro's music to a WAV file and its frames to PPM images or a
// raw RGB stream, using the same shaders and GL code paths as the intro:
//   compat mode: glCreateShaderProgramv + glRects        (Windows, Linux)
//   core mode:   3.3 core context, VAO + vertex shader   (macOS)
//
//   preview [-core] music  music.frag out.wav seconds
//   preview [-core] frame  visual.frag t w h out.ppm
//   preview [-core] frames visual.frag t0 t1 fps w h  > raw_rgb24_stream
#define GL_GLEXT_PROTOTYPES
#include <GL/gl.h>
#include <GL/glext.h>
#include <GL/glx.h>
#include <X11/Xlib.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static int core;
static GLuint vao;

static char *readfile(const char *fn)
{
	FILE *f = fopen(fn, "rb");
	if (!f) { perror(fn); exit(1); }
	fseek(f, 0, SEEK_END);
	long n = ftell(f);
	fseek(f, 0, SEEK_SET);
	char *s = malloc(n + 1);
	if (fread(s, 1, n, f) != (size_t)n) { perror(fn); exit(1); }
	s[n] = 0;
	fclose(f);
	return s;
}

typedef GLXContext (*CCA)(Display *, GLXFBConfig, GLXContext, Bool, const int *);

static void init_gl(void)
{
	Display *d = XOpenDisplay(0);
	if (!d) { fprintf(stderr, "no display\n"); exit(1); }
	int fbattr[] = {GLX_RENDER_TYPE, GLX_RGBA_BIT, GLX_DRAWABLE_TYPE, GLX_WINDOW_BIT,
		GLX_DOUBLEBUFFER, True, None};
	int n;
	GLXFBConfig *fbc = glXChooseFBConfig(d, DefaultScreen(d), fbattr, &n);
	XVisualInfo *vi = glXGetVisualFromFBConfig(d, fbc[0]);
	XSetWindowAttributes swa = {0};
	swa.colormap = XCreateColormap(d, RootWindow(d, vi->screen), vi->visual, AllocNone);
	Window w = XCreateWindow(d, RootWindow(d, vi->screen), 0, 0, 64, 64, 0, vi->depth,
		InputOutput, vi->visual, CWColormap, &swa);
	GLXContext ctx;
	if (core) {
		CCA cca = (CCA)glXGetProcAddressARB((const GLubyte *)"glXCreateContextAttribsARB");
		int attr[] = {GLX_CONTEXT_MAJOR_VERSION_ARB, 3, GLX_CONTEXT_MINOR_VERSION_ARB, 3,
			GLX_CONTEXT_PROFILE_MASK_ARB, GLX_CONTEXT_CORE_PROFILE_BIT_ARB,
			GLX_CONTEXT_FLAGS_ARB, GLX_CONTEXT_FORWARD_COMPATIBLE_BIT_ARB, None};
		ctx = cca(d, fbc[0], 0, True, attr);
	} else {
		ctx = glXCreateContext(d, vi, 0, True);
	}
	if (!ctx || !glXMakeCurrent(d, w, ctx)) { fprintf(stderr, "no context\n"); exit(1); }
	fprintf(stderr, "GL %s | %s | %s\n", glGetString(GL_VERSION), glGetString(GL_RENDERER),
		core ? "core" : "compat");
	if (core) {
		glGenVertexArrays(1, &vao);
		glBindVertexArray(vao);
	}
}

static void check_shader(GLuint s, const char *what)
{
	GLint ok;
	char log[8192];
	glGetShaderiv(s, GL_COMPILE_STATUS, &ok);
	glGetShaderInfoLog(s, sizeof log, 0, log);
	if (!ok || log[0]) fprintf(stderr, "%s compile %s:\n%s\n", what, ok ? "warnings" : "FAILED", log);
	if (!ok) exit(1);
}

static GLuint program(const char *fs_src)
{
	GLuint p;
	GLint ok;
	char log[8192];
	if (!core) {
		p = glCreateShaderProgramv(GL_FRAGMENT_SHADER, 1, &fs_src);
	} else {
		const char *vs_src = "#version 330\nvoid main(){gl_Position=vec4(gl_VertexID%2*4-1,gl_VertexID/2*4-1,0,1);}";
		GLuint vs = glCreateShader(GL_VERTEX_SHADER), fs = glCreateShader(GL_FRAGMENT_SHADER);
		glShaderSource(vs, 1, &vs_src, 0);
		glCompileShader(vs);
		check_shader(vs, "vertex");
		glShaderSource(fs, 1, &fs_src, 0);
		glCompileShader(fs);
		check_shader(fs, "fragment");
		p = glCreateProgram();
		glAttachShader(p, vs);
		glAttachShader(p, fs);
		glLinkProgram(p);
	}
	glGetProgramiv(p, GL_LINK_STATUS, &ok);
	glGetProgramInfoLog(p, sizeof log, 0, log);
	if (!ok || log[0]) fprintf(stderr, "program %s:\n%s\n", ok ? "log" : "FAILED", log);
	if (!ok) exit(1);
	glUseProgram(p);
	fprintf(stderr, "uniform u location: %d\n", glGetUniformLocation(p, "u"));
	return p;
}

static void draw(void)
{
	if (core) glDrawArrays(GL_TRIANGLES, 0, 3);
	else glRects(-1, -1, 1, 1);
}

static GLuint make_fbo(GLenum ifmt, int w, int h)
{
	GLuint tex, fb;
	glGenTextures(1, &tex);
	glBindTexture(GL_TEXTURE_2D, tex);
	glTexImage2D(GL_TEXTURE_2D, 0, ifmt, w, h, 0, GL_RGBA, GL_FLOAT, 0);
	glGenFramebuffers(1, &fb);
	glBindFramebuffer(GL_FRAMEBUFFER, fb);
	glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, tex, 0);
	if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE) {
		fprintf(stderr, "fbo incomplete\n");
		exit(1);
	}
	glViewport(0, 0, w, h);
	return fb;
}

static void put32(FILE *f, unsigned v) { fwrite(&v, 4, 1, f); }
static void put16(FILE *f, unsigned v) { fwrite(&v, 2, 1, f); }

static void music(const char *fs, const char *out, double seconds)
{
	program(readfile(fs));
	int rows = (int)ceil(seconds * 44100 / 2048.0);
	make_fbo(GL_RGBA32F, 1024, rows);
	draw();
	float *buf = malloc((size_t)1024 * rows * 16);
	glReadPixels(0, 0, 1024, rows, GL_RGBA, GL_FLOAT, buf);
	long ns = (long)1024 * rows * 2; // stereo frames
	double peak = 0, rms = 0;
	long nan = 0;
	for (long i = 0; i < ns * 2; i++) {
		float v = buf[i];
		if (v != v || isinf(v)) { nan++; buf[i] = 0; continue; }
		if (fabs(v) > peak) peak = fabs(v);
		rms += v * v;
	}
	fprintf(stderr, "samples %ld (%.2fs) peak %.3f rms %.4f nan/inf %ld\n", ns, ns / 44100.0, peak,
		sqrt(rms / (ns * 2)), nan);
	FILE *f = fopen(out, "wb");
	fwrite("RIFF", 4, 1, f); put32(f, 36 + ns * 8); fwrite("WAVEfmt ", 8, 1, f);
	put32(f, 16); put16(f, 3); put16(f, 2); put32(f, 44100); put32(f, 44100 * 8);
	put16(f, 8); put16(f, 32); fwrite("data", 4, 1, f); put32(f, ns * 8);
	fwrite(buf, 8, ns, f);
	fclose(f);
}

static unsigned char *render(double t, int w, int h)
{
	static unsigned char *px;
	static int ow, oh;
	if (w != ow || h != oh) {
		make_fbo(GL_RGBA8, w, h);
		px = realloc(px, (size_t)w * h * 4);
		ow = w;
		oh = h;
	}
	glUniform4f(0, (float)t, (float)w, (float)h, 0);
	draw();
	glReadPixels(0, 0, w, h, GL_RGBA, GL_UNSIGNED_BYTE, px);
	return px;
}

static void write_rgb(FILE *f, unsigned char *px, int w, int h)
{
	for (int y = h - 1; y >= 0; y--)
		for (int x = 0; x < w; x++) fwrite(px + ((size_t)y * w + x) * 4, 3, 1, f);
}

int main(int argc, char **argv)
{
	if (argc > 1 && !strcmp(argv[1], "-core")) { core = 1; argv++; argc--; }
	if (argc < 2) { fprintf(stderr, "usage: see source\n"); return 1; }
	init_gl();
	if (!strcmp(argv[1], "music") && argc == 5) {
		music(argv[2], argv[3], atof(argv[4]));
	} else if (!strcmp(argv[1], "frame") && argc == 7) {
		program(readfile(argv[2]));
		int w = atoi(argv[4]), h = atoi(argv[5]);
		unsigned char *px = render(atof(argv[3]), w, h);
		FILE *f = fopen(argv[6], "wb");
		fprintf(f, "P6\n%d %d\n255\n", w, h);
		write_rgb(f, px, w, h);
		fclose(f);
	} else if (!strcmp(argv[1], "frames") && argc == 8) {
		program(readfile(argv[2]));
		double t0 = atof(argv[3]), t1 = atof(argv[4]), fps = atof(argv[5]);
		int w = atoi(argv[6]), h = atoi(argv[7]);
		for (long i = 0;; i++) {
			double t = t0 + i / fps;
			if (t >= t1) break;
			write_rgb(stdout, render(t, w, h), w, h);
			if (i % 50 == 0) fprintf(stderr, "t=%.2f\n", t);
		}
	} else {
		fprintf(stderr, "bad args\n");
		return 1;
	}
	return 0;
}
