// macsim: fake /System/Library/Frameworks/GLUT.framework for Linux.
// Everything is forwarded to freeglut (a dependency of this library), only
// Apple's GLUT_3_2_CORE_PROFILE display mode flag is translated.
#define _GNU_SOURCE
#include <GL/freeglut.h>
#include <dlfcn.h>
#include <stdio.h>

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
