// macsim: fake /System/Library/Frameworks/OpenGL.framework (libGL is a
// dependency). glBlitFramebuffer reports its first source rectangle (the
// render size chosen by the intro's speed test) and is forwarded to libGL.
#define _GNU_SOURCE
#include <dlfcn.h>
#include <stdio.h>

int macsim_opengl;

void glBlitFramebuffer(int sx0, int sy0, int sx1, int sy1, int dx0, int dy0, int dx1, int dy1, unsigned mask, unsigned filter)
{
	static void (*real)(int, int, int, int, int, int, int, int, unsigned, unsigned);
	static int told;
	if (!real)
		*(void **)&real = dlsym(RTLD_NEXT, "glBlitFramebuffer");
	if (!told++)
		fprintf(stderr, "[macsim] glBlitFramebuffer: render size %dx%d -> window %dx%d, mask 0x%x\n", sx1, sy1, dx1, dy1, mask);
	real(sx0, sy0, sx1, sy1, dx0, dy0, dx1, dy1, mask, filter);
}
