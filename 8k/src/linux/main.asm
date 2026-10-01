; ROZMERY - 8k intro, Linux x86-64 (X11 + GLX + ALSA, glibc)
; (platform layer adapted from the 4k intro BRANA in the parent directory)
; nasm -f bin: the whole ELF is written by hand. The dynamic section only
; needs libdl.so.2 and imports dlopen/dlsym through two GLOB_DAT relocations;
; no symbol versioning, so it runs on old (libdl based) and new (glibc >= 2.34)
; glibc alike. Everything else is resolved at runtime from the name table.
BITS 64
DEFAULT REL
org 0x400000


; function table indices (byte offsets from rbx = fn + 128)
%assign i 0
%macro F 1
%1 equ i * 8 - 128
%assign i i + 1
%endmacro
F XOpenDisplay
F XCreateColormap
F XCreateWindow
F XInternAtom
F XChangeProperty
F XCreateBitmapFromData
F XCreatePixmapCursor
F XMapWindow
F XPending
F XNextEvent
F glXChooseVisual
F glXCreateContext
F glXMakeCurrent
F glXSwapBuffers
F glCreateShaderProgramv
F glUseProgram
F glUniform4fv
F glRects
F glViewport
F glBindTexture
F glTexImage2D
F glBindFramebufferEXT
F glFramebufferTexture2D
F glReadPixels
F glBlitFramebuffer
F glFinish
F snd_pcm_open
F snd_pcm_set_params
F snd_pcm_writei
F pthread_create

ehdr:
	db 0x7f, "ELF", 2, 1, 1, 0
	dq 0
	dw 2                    ; ET_EXEC
	dw 62                   ; EM_X86_64
	dd 1
	dq _start
	dq phdr - ehdr
	dq 0
	dd 0
	dw 64, 56, 3, 0, 0, 0
phdr:
	dd 3, 4                 ; PT_INTERP
	dq interp - ehdr, interp, interp, interp_end - interp, interp_end - interp, 1
	dd 1, 7                 ; PT_LOAD, RWX: file + bss
	dq 0, ehdr, ehdr, file_end - ehdr, bss_end - ehdr, 0x1000
	dd 2, 6                 ; PT_DYNAMIC
	dq dynamic - ehdr, dynamic, dynamic, dynamic_end - dynamic, dynamic_end - dynamic, 8

dynamic:
	dq 1, libdl - strtab    ; DT_NEEDED
	dq 5, strtab            ; DT_STRTAB
	dq 6, symtab            ; DT_SYMTAB
	dq 7, rela              ; DT_RELA
	dq 8, rela_end - rela   ; DT_RELASZ
	dq 9, 24                ; DT_RELAENT
	dq 0, 0                 ; DT_NULL
dynamic_end:

symtab:
	dd 0, 0, 0, 0, 0, 0
	dd dlopen_s - strtab, 0x12, 0, 0, 0, 0
	dd dlsym_s - strtab, 0x12, 0, 0, 0, 0

rela:
	dq dl_open, (1 << 32) | 6, 0    ; R_X86_64_GLOB_DAT
	dq dl_sym, (2 << 32) | 6, 0
rela_end:

dl_open: dq 0
dl_sym: dq 0

strtab:
	db 0
libdl:
	db "libdl.so.2", 0
dlopen_s:
	db "dlopen", 0
dlsym_s:
	db "dlsym", 0
interp:
	db "/lib64/ld-linux-x86-64.so.2", 0
interp_end:

_start:
	lea rbx, [fn + 128]
	lea r12, [names]
	lea r13, [fn]
.lib:
	mov rdi, r12
	push 1                      ; RTLD_LAZY
	pop rsi
	call [dl_open]
	mov r14, rax
.skip:
	mov al, [r12]
	inc r12
	test al, al
	jnz .skip
	cmp [r12], al
	je .endlib
	mov rdi, r14
	mov rsi, r12
	call [dl_sym]
	mov [r13], rax
	add r13, 8
	jmp .skip
.endlib:
	inc r12
	cmp [r12], al
	jne .lib

	xor edi, edi
	call [rbx + XOpenDisplay]
	mov r12, rax                ; r12 = display
	mov rdi, rax
	xor esi, esi
	lea rdx, [attr]
	call [rbx + glXChooseVisual]
	mov r13, rax                ; r13 = visual info
	mov rax, [r12 + 0xe8]       ; display->screens
	mov r14, [rax + 16]         ; root window
	mov edx, [rax + 24]         ; width
	mov ecx, [rax + 28]         ; height
	call resize
	mov rdi, r12
	mov rsi, r14
	mov rdx, [r13]              ; visual
	xor ecx, ecx                ; AllocNone
	call [rbx + XCreateColormap]
	mov [swa + 96], rax         ; colormap
	mov dword [swa + 72], 0x20001 ; event mask: KeyPress | StructureNotify
	mov rdi, r12
	mov rsi, r14
	lea rdx, [zero]
	push 1
	pop rcx
	mov r8d, ecx
	call [rbx + XCreateBitmapFromData]
	push rax                    ; y hotspot (0 is fine: any value works for an empty cursor)
	push 0
	mov rdi, r12
	mov rsi, rax
	mov rdx, rax
	lea rcx, [zero]
	mov r8, rcx
	xor r9d, r9d
	call [rbx + XCreatePixmapCursor]
	pop rcx
	pop rcx
	mov [swa + 104], rax        ; cursor
	; XCreateWindow(d, root, 0, 0, w, h, 0, depth, InputOutput, visual, mask, &swa)
	lea rax, [swa]
	push rax
	push 0x6800                 ; CWColormap | CWEventMask | CWCursor
	push qword [r13]            ; visual
	push 1                      ; InputOutput
	push qword [r13 + 20]       ; depth
	push 0                      ; border
	mov rdi, r12
	mov rsi, r14
	xor edx, edx
	xor ecx, ecx
	mov r8d, [size]
	mov r9d, [size + 4]
	call [rbx + XCreateWindow]
	add rsp, 48
	mov r14, rax                ; r14 = window
	mov rdi, r12
	lea rsi, [fs_name]
	xor edx, edx
	call [rbx + XInternAtom]
	mov [atom], rax
	mov rdi, r12
	lea rsi, [state_name]
	xor edx, edx
	call [rbx + XInternAtom]
	; XChangeProperty(d, win, _NET_WM_STATE, XA_ATOM, 32, PropModeReplace, &atom, 1)
	push 1
	lea rcx, [atom]
	push rcx
	mov rdi, r12
	mov rsi, r14
	mov rdx, rax
	push 4
	pop rcx
	push 32
	pop r8
	xor r9d, r9d
	call [rbx + XChangeProperty]
	pop rcx
	pop rcx
	mov rdi, r12
	mov rsi, r13
	xor edx, edx
	push 1
	pop rcx
	call [rbx + glXCreateContext]
	mov rdi, r12
	mov rsi, r14
	mov rdx, rax
	call [rbx + glXMakeCurrent]
	push 1                      ; r13: the draw framebuffer of frame: object 1
	pop r13                     ; (music, speed test), later 0 if not scaled

	; the whole song in one pass into a 1024 x ROWS RGBA32F texture,
	; every texel holds two consecutive stereo samples
	mov edi, 0x0DE1
	push 1
	pop rsi
	call [rbx + glBindTexture]
	push 0                      ; pixels (keeps the stack aligned)
	push 0
	push 0x1406                 ; GL_FLOAT
	push 0x1908                 ; GL_RGBA
	mov edi, 0x0DE1
	xor esi, esi
	mov edx, 0x8814             ; GL_RGBA32F
	mov ecx, 1024               ; width: max(1024, window width), as the
	cmp ecx, [size]             ; render target of reduced resolutions too
	cmovb ecx, [size]
	mov r8d, ROWS
	xor r9d, r9d
	call [rbx + glTexImage2D]
	add rsp, 32
	mov edi, 0x8D40             ; GL_FRAMEBUFFER: object 1 (the EXT call creates it)
	push 1
	pop rsi
	call [rbx + glBindFramebufferEXT]
	mov edi, 0x8D40
	mov esi, 0x8CE0
	mov edx, 0x0DE1
	push 1
	pop rcx
	xor r8d, r8d
	call [rbx + glFramebufferTexture2D]
	; the music in bands of BAND rows with glFinish in between: on a weak GPU
	; one draw of all of it could hit a GPU watchdog. gl_FragCoord is window
	; relative, so the samples are the same as with one draw.
	xor ebp, ebp                ; ebp = first row of the band
	call band                   ; (band 0's viewport)
	lea rax, [synth_frag]
	call program                ; (draws band 0)
.band:
	call [rbx + glFinish]
	add ebp, BAND
	cmp ebp, ROWS
	jae .music_done
	call band
	call rects
	jmp .band
.music_done:
	lea rax, [song]
	push rax
	push rax
	xor edi, edi
	xor esi, esi
	mov edx, 1024
	mov ecx, ROWS
	mov r8d, 0x1908
	mov r9d, 0x1406
	call [rbx + glReadPixels]
%ifdef DEBUG
	int3
%endif
	pop rax
	pop rax
	; the GPU's speed: 2 frames of the heaviest moment at half size, offscreen
	; (no vsync), timed after a warm-up frame that also compiles the shader
	push 8                      ; r15 = k: the render size is k/16 of the window
	pop r15
	call rescale
	lea rax, [scene_frag]
	call program                ; (draws the warm-up frame)
	mov dword [uni], T_HEAVY
	call [rbx + glFinish]
	call now
	xchg rax, rbp
	call frame
	call frame
	call [rbx + glFinish]
	call now
	sub rax, rbp
	shr rax, 16                 ; ~65.5 us units
	; the largest k whose estimated frame time fits, never below KMIN
	push 16
	pop r15
.k:
	mov edx, r15d
	imul edx, edx
	imul edx, eax               ; (fits in 32 bits even for a very slow GPU)
	cmp edx, LIMIT
	jbe .kset
	dec r15d
	cmp r15d, KMIN
	ja .k
.kset:
	cmp r15d, 16
	setb r13b                   ; r13 = 1: render into framebuffer object 1 and upscale
	call rescale
%ifdef SHOWK                    ; (testing: print k to stderr)
	mov eax, r15d
	mov cl, 10
	div cl
	add ax, "00"
	mov [kmsg + 2], ax
	push 1                      ; write(2, kmsg, 5)
	pop rax
	push 2
	pop rdi
	lea rsi, [kmsg]
	push 5
	pop rdx
	syscall
%endif
	mov rdi, r12
	mov rsi, r14
	call [rbx + XMapWindow]

	lea rdi, [pcm]
	lea rsi, [device]
	xor edx, edx
	xor ecx, ecx
	call [rbx + snd_pcm_open]
	push 100000                 ; latency in us
	push 100000
	mov rdi, [pcm]
	push 14                     ; SND_PCM_FORMAT_FLOAT_LE
	pop rsi
	push 3                      ; SND_PCM_ACCESS_RW_INTERLEAVED
	pop rdx
	push 2
	pop rcx
	mov r8d, 44100
	push 1                      ; soft resample
	pop r9
	call [rbx + snd_pcm_set_params]
	pop rax
	pop rax
	lea rdi, [thread]
	xor esi, esi
	lea rdx, [writer]
	xor ecx, ecx
	call [rbx + pthread_create]
	call now
	xchg rax, rbp               ; rbp = start of the music

.frame:
	mov rdi, r12
	call [rbx + XPending]
	test eax, eax
	jz .draw
	mov rdi, r12
	lea rsi, [event]
	call [rbx + XNextEvent]
	mov eax, [event]
	cmp al, 2                   ; KeyPress
	je quit
	cmp al, 22                  ; ConfigureNotify
	jne .frame
	mov edx, [event + 56]
	mov ecx, [event + 60]
	call resize
	jmp .frame
.draw:
	call now
	sub rax, rbp
	cvtsi2ss xmm0, rax
	mulss xmm0, [nsec]
	movss [uni], xmm0
	comiss xmm0, [song_len]
	ja quit
%ifdef SNAP                     ; (testing: after 2 s, write the frame at t = 26
	comiss xmm0, [snap_after]   ; to snap.rgb and quit)
	jb .nosnap
	mov dword [uni], __float32__(26.0)
	call frame
	call blit
	mov edi, 0x8CA8             ; GL_READ_FRAMEBUFFER: the window
	xor esi, esi
	call [rbx + glBindFramebufferEXT]
	lea rax, [song]
	push rax
	push rax
	xor edi, edi
	xor esi, esi
	mov edx, [size]
	mov ecx, [size + 4]
	mov r8d, 0x1907             ; GL_RGB
	mov r9d, 0x1401             ; GL_UNSIGNED_BYTE
	call [rbx + glReadPixels]
	pop rax
	pop rax
	mov eax, 2                  ; open("snap.rgb", O_WRONLY | O_CREAT | O_TRUNC, 0644)
	lea rdi, [snapname]
	mov esi, 0x241
	mov edx, 420
	syscall
	mov edi, eax
	lea rsi, [song]
	mov eax, [size]
	imul eax, [size + 4]
	imul edx, eax, 3
	mov eax, 1                  ; write
	syscall
	jmp quit
.nosnap:
%endif
	call frame
	call blit
	mov rdi, r12
	mov rsi, r14
	call [rbx + glXSwapBuffers]
	jmp .frame

quit:
	push 231                    ; exit_group
	pop rax
	xor edi, edi
	syscall

; scaled: edx, ecx = the render size, window size * k / 16
scaled:
	mov edx, [size]
	imul edx, r15d
	shr edx, 4
	mov ecx, [size + 4]
	imul ecx, r15d
	shr ecx, 4
	ret

; resize(edx = width, ecx = height): remember the window size, then rescale.
; (Also called once before the GL context exists: k = 0 then, and GL calls
; without a context do nothing.)
resize:
	mov [size], edx
	mov [size + 4], ecx
; rescale: the render size -> the uniform u.yz and the viewport
rescale:
	call scaled
	cvtsi2ss xmm0, edx
	movss [uni + 4], xmm0
	cvtsi2ss xmm0, ecx
	movss [uni + 8], xmm0
; viewport(edx = width, ecx = height)
viewport:
	xor edi, edi
	xor esi, esi
	jmp [rbx + glViewport]

; band: viewport = rows ebp .. ebp + BAND of the music
band:
	xor edi, edi
	mov esi, ebp
	mov edx, 1024
	mov ecx, BAND
	jmp [rbx + glViewport]

; program(rax = fragment source): compile, link and bind
program:
	push rax                    ; &source on the stack (also aligns it)
	mov edi, 0x8B30             ; GL_FRAGMENT_SHADER
	push 1
	pop rsi
	mov rdx, rsp
	call [rbx + glCreateShaderProgramv]
	mov edi, eax
	call [rbx + glUseProgram]
	pop rax
; frame: draw into framebuffer r13 (1, or 0 = the window): upload the uniform
; u (location 0), draw the full-screen rectangle (after program: the music
; program has no u, which just raises a GL error)
frame:
	push rax                    ; (alignment)
	mov edi, 0x8CA9             ; GL_DRAW_FRAMEBUFFER
	mov esi, r13d
	call [rbx + glBindFramebufferEXT]
	xor edi, edi
	push 1
	pop rsi
	lea rdx, [uni]
	call [rbx + glUniform4fv]
	pop rax
rects:
	push -1
	pop rdi
	mov esi, edi
	push 1
	pop rdx
	mov ecx, edx
	jmp [rbx + glRects]

; blit: upscale the image rendered into framebuffer object 1 to the window.
; Not scaled (r13 = 0): the frame went straight to the window and the mask is
; 0, nothing is copied (also fine with driver-forced antialiasing).
blit:
	push rax                    ; (alignment)
	mov edi, 0x8CA9             ; GL_DRAW_FRAMEBUFFER: the window
	xor esi, esi
	call [rbx + glBindFramebufferEXT]
	push 0x2601                 ; GL_LINEAR
	mov eax, r13d
	shl eax, 14                 ; GL_COLOR_BUFFER_BIT or 0
	push rax
	push qword [size + 4]       ; (only the low 32 bits are read)
	push qword [size]
	call scaled
	xor edi, edi
	xor esi, esi
	xor r8d, r8d
	xor r9d, r9d
	call [rbx + glBlitFramebuffer]
	add rsp, 40
	ret

; now: rax = monotonic time in ns (the clock_gettime system call)
now:
	push 1                      ; CLOCK_MONOTONIC
	pop rdi
	lea rsi, [tn]
	mov eax, 228                ; clock_gettime
	syscall
	imul rax, [rsi], 1000000000
	add rax, [rsi + 8]
	ret

; audio thread: one blocking write of the whole song
writer:
	lea rax, [fn + 128]
	mov rdi, [pcm]
	lea rsi, [song]
	mov edx, SONG_SAMPLES
	jmp [rax + snd_pcm_writei]

%include "shaders.inc"          ; synth_frag, scene_frag, SONG_SAMPLES
ROWS    equ SONG_SAMPLES / 2048 + 1
BAND    equ (ROWS + 15) / 16    ; the music is rendered in 16 bands
%ifndef KMIN
KMIN    equ 11                  ; the render size never goes below 11/16 of the window
%endif
LIMIT   equ 70312               ; k*k*(2 frames at k = 8, ns >> 16): about 36 ms per frame
%ifndef T_HEAVY
T_HEAVY equ __float32__(180.0)  ; the moment the speed is measured at (s): the end of the flight
%endif

attr:   dd 4, 5, 0              ; GLX_RGBA, GLX_DOUBLEBUFFER
nsec:   dd 1.0e-9
song_len: dd SONG_SECONDS
%ifdef DEVICE                   ; (testing: play to another ALSA device)
device: db DEVICE, 0
%else
device: db "default", 0
%endif
fs_name: db "_NET_WM_STATE_FULLSCREEN", 0
state_name: db "_NET_WM_STATE", 0
%ifdef SHOWK
kmsg:   db "k=..", 10
%endif
%ifdef SNAP
snap_after: dd 2.0
snapname: db "snap.rgb", 0
%endif
names:
	db "libX11.so.6", 0
	db "XOpenDisplay", 0, "XCreateColormap", 0, "XCreateWindow", 0, "XInternAtom", 0, "XChangeProperty", 0
	db "XCreateBitmapFromData", 0, "XCreatePixmapCursor", 0, "XMapWindow", 0, "XPending", 0, "XNextEvent", 0, 0
	db "libGL.so.1", 0
	db "glXChooseVisual", 0, "glXCreateContext", 0, "glXMakeCurrent", 0, "glXSwapBuffers", 0
	db "glCreateShaderProgramv", 0, "glUseProgram", 0, "glUniform4fv", 0, "glRects", 0, "glViewport", 0
	db "glBindTexture", 0, "glTexImage2D", 0, "glBindFramebufferEXT", 0
	db "glFramebufferTexture2D", 0, "glReadPixels", 0, "glBlitFramebuffer", 0, "glFinish", 0, 0
	db "libasound.so.2", 0
	db "snd_pcm_open", 0, "snd_pcm_set_params", 0, "snd_pcm_writei", 0, "pthread_create", 0, 0
zero:   db 0                    ; also terminates the name table

file_end:

absolute file_end
alignb 16
fn:     resq 32
swa:    resb 112                ; XSetWindowAttributes
event:  resb 192                ; XEvent
tn:     resq 2
pcm:    resq 1
thread: resq 1
atom:   resq 1
uni:    resd 4
size:   resd 2
alignb 16
song:   resb ROWS * 1024 * 16
bss_end:
