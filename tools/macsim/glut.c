// macsim: fake /System/Library/Frameworks/GLUT.framework for Linux.
// Everything is forwarded to freeglut (a dependency of this library), only
// Apple's GLUT_3_2_CORE_PROFILE display mode flag is translated.
//
// Test snapshot (MACSIM_SNAP=file): the intro's elapsed time is taken from
// glutGet(GLUT_ELAPSED_TIME); the MACSIM_START-th call (default 1) is its start.
// 2 s after it, glutGet returns start + 26000, so the next frame is t = 26 s
// exactly; that frame is written to the file (RGB, bottom-up, window size)
// at glutSwapBuffers and the program exits.
#define _GNU_SOURCE
#include <GL/freeglut.h>
#include <GL/glext.h>
#include <dlfcn.h>
#include <stdio.h>
#include <stdlib.h>

void glutInitDisplayMode(unsigned int mode)
{
	void (*real)(unsigned int) = dlsym(RTLD_NEXT, "glutInitDisplayMode");
	fprintf(stderr, "[macsim] glutInitDisplayMode(0x%x)\n", mode);
	if (mode & 0x800) {
		glutInitContextVersion(3, 3);
		glutInitContextProfile(GLUT_CORE_PROFILE);
		glutInitContextFlags(GLUT_FORWARD_COMPATIBLE);
	}
	real(mode & ~0x800u);
}

static int calls, start_ms, snapping;

int glutGet(GLenum what)
{
	int (*real)(GLenum) = dlsym(RTLD_NEXT, "glutGet");
	int v = real(what);
	if (what == GLUT_ELAPSED_TIME && getenv("MACSIM_SNAP")) {
		int start_call = getenv("MACSIM_START") ? atoi(getenv("MACSIM_START")) : 1;
		if (++calls == start_call)
			start_ms = v;
		else if (calls > start_call && v - start_ms > 2000) {
			snapping = 1;
			return start_ms + 26000;
		}
	}
	return v;
}

void glutSwapBuffers(void)
{
	void (*real)(void) = dlsym(RTLD_NEXT, "glutSwapBuffers");
	if (snapping) {
		void (*bind)(GLenum, GLuint) = (void (*)(GLenum, GLuint))glutGetProcAddress("glBindFramebuffer");
		int w = glutGet(GLUT_WINDOW_WIDTH), h = glutGet(GLUT_WINDOW_HEIGHT);
		unsigned char *px = malloc((size_t)w * h * 3);
		bind(GL_READ_FRAMEBUFFER, 0);
		glReadPixels(0, 0, w, h, GL_RGB, GL_UNSIGNED_BYTE, px);
		FILE *f = fopen(getenv("MACSIM_SNAP"), "wb");
		fwrite(px, 3, (size_t)w * h, f);
		fclose(f);
		fprintf(stderr, "[macsim] wrote the frame at t = 26 s (%dx%d) to %s\n", w, h, getenv("MACSIM_SNAP"));
		exit(0);
	}
	real();
}
