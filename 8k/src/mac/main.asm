; ROZMERY - 8k intro, macOS x86-64 (GLUT + OpenGL 3.2+ core + AudioQueue)
; (platform layer adapted from the 4k intro BRANA in the parent directory)
; Automatic render resolution for weak GPUs, as on Linux/Windows (a short
; offscreen speed test picks k/16 of the screen, at least KMIN/16).
; nasm -f macho64; linked with ld64.lld against a libSystem .tbd stub.
; Only dlopen/dlsym are linked; everything else comes from the name table.
BITS 64
DEFAULT REL

%define SCALE                   ; (always on in the 8k)
%include "shaders.inc"          ; synth_frag, scene_frag, SONG_SAMPLES

extern _dlopen, _dlsym
global _main

%ifidn __OUTPUT_FORMAT__, macho64
%define GOT(x) [rel x wrt ..gotpcrel]
%else                           ; ELF, for tools/macsim
%define GOT(x) [rel x wrt ..got]
%endif

ROWS    equ SONG_SAMPLES / 2048 + 1
BAND    equ (ROWS + 15) / 16    ; the music is rendered in 16 bands
%ifdef SCALE
%ifndef KMIN
KMIN    equ 11                  ; the render size never goes below 11/16 of the screen
%endif
LIMIT   equ 4608                ; k*k*(2 frames at k = 8, ms): about 36 ms per frame
%ifndef T_HEAVY
T_HEAVY equ __float32__(180.0)  ; the moment the speed is measured at (s): the end of the flight
%endif
%endif
CHUNK   equ 4096                ; stereo frames per audio buffer
SONG_MS equ SONG_SAMPLES * 10 / 441

; function table indices (byte offsets from rbx = fn + 128)
%assign i 0
%macro F 1
%1 equ i * 8 - 128
%assign i i + 1
%endmacro
F glutInit
F glutInitDisplayMode
F glutCreateWindow
F glutFullScreen
F glutSetCursor
F glutKeyboardFunc
F glutDisplayFunc
F glutIdleFunc
F glutSwapBuffers
F glutMainLoop
F glutGet
F exit
F glCreateShader
F glShaderSource
F glCompileShader
F glCreateProgram
F glAttachShader
F glLinkProgram
F glUseProgram
F glUniform4fv
F glGetUniformLocation
F glDrawArrays
F glGenVertexArrays
F glBindVertexArray
F glViewport
F glGenTextures
F glBindTexture
F glTexImage2D
F glGenFramebuffers
F glBindFramebuffer
F glFramebufferTexture2D
F glReadPixels
F glFinish
%ifdef SCALE
F glBlitFramebuffer
%endif
F AudioQueueNewOutput
F AudioQueueAllocateBuffer
F AudioQueueEnqueueBuffer
F AudioQueueStart

section .text

_main:
	push rbx
	push rbx                    ; (alignment)
	push rdi                    ; argc, glutInit wants &argc
	mov r15, rsi                ; argv
	lea rbx, [fn + 128]
	lea r12, [names]
	lea r13, [fn]
.lib:
	mov rdi, r12
	push 1
	pop rsi
	call GOT(_dlopen)
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
	call GOT(_dlsym)
	mov [r13], rax
	add r13, 8
	jmp .skip
.endlib:
	inc r12
	cmp [r12], al
	jne .lib

	mov rdi, rsp
	mov rsi, r15
	call [rbx + glutInit]
	mov edi, 0x802              ; GLUT_DOUBLE | GLUT_3_2_CORE_PROFILE
	call [rbx + glutInitDisplayMode]
	mov rdi, r12                ; points at a NUL byte: empty title
	call [rbx + glutCreateWindow]
	call [rbx + glutFullScreen]
	push 101                    ; GLUT_CURSOR_NONE
	pop rdi
	call [rbx + glutSetCursor]
	mov rdi, [rbx + exit]       ; any key: exit(key)
	call [rbx + glutKeyboardFunc]
	lea rdi, [draw]
	call [rbx + glutDisplayFunc]
	lea rdi, [draw]
	call [rbx + glutIdleFunc]
%ifdef SCALE
	mov edi, 200                ; GLUT_SCREEN_WIDTH / HEIGHT: the window is still
	call [rbx + glutGet]        ; 300 x 300 until full screen takes effect
	mov [scr], eax
	mov edi, 201
	call [rbx + glutGet]
	mov [scr + 4], eax
%endif

	push 1
	pop rdi
	lea rsi, [vao]
	call [rbx + glGenVertexArrays]
	mov edi, [vao]
	call [rbx + glBindVertexArray]

	; the whole song in one pass into a 1024 x ROWS RGBA32F texture,
	; every texel holds two consecutive stereo samples
	push 1
	pop rdi
	lea rsi, [tex]
	call [rbx + glGenTextures]
	mov edi, 0x0DE1
	mov esi, [tex]
	call [rbx + glBindTexture]
	push 0                      ; pixels (keeps the stack aligned)
	push 0
	push 0x1406                 ; GL_FLOAT
	push 0x1908                 ; GL_RGBA
	mov edi, 0x0DE1
	xor esi, esi
	mov edx, 0x8814             ; GL_RGBA32F
%ifdef SCALE
	mov ecx, 1024               ; width: max(1024, screen width), as the
	cmp ecx, [scr]              ; render target of reduced resolutions too
	cmovb ecx, [scr]
	mov r8d, ROWS
%else
	mov ecx, 1024
	mov r8d, ROWS
%endif
	xor r9d, r9d
	call [rbx + glTexImage2D]
	add rsp, 32
	push 1
	pop rdi
	lea rsi, [fbo]
	call [rbx + glGenFramebuffers]
	mov edi, 0x8D40
	mov esi, [fbo]
	call [rbx + glBindFramebuffer]
	mov edi, 0x8D40
	mov esi, 0x8CE0
	mov edx, 0x0DE1
	mov ecx, [tex]
	xor r8d, r8d
	call [rbx + glFramebufferTexture2D]
	lea rdi, [synth_frag]
	call program
	; the music in bands of BAND rows with glFinish in between (no single long
	; draw for the GPU watchdog); gl_FragCoord is window relative
	xor r12d, r12d              ; first row of the band
.band:
	xor edi, edi
	mov esi, r12d
	mov edx, 1024
	mov ecx, BAND
	call [rbx + glViewport]
	call drawtri
	call [rbx + glFinish]
	add r12d, BAND
	cmp r12d, ROWS
	jb .band
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
	pop rax
	pop rax
%ifdef SCALE
	lea rdi, [scene_frag]
	call program
	mov edi, eax
	lea rsi, [uname]
	call [rbx + glGetUniformLocation]
	mov [loc], eax
	; the GPU's speed: 2 frames of the heaviest moment at half size, offscreen
	; (still in the framebuffer object, no vsync), after a warm-up frame
	mov byte [k], 8
	call setsize
	mov dword [uni], T_HEAVY
	call render
	call [rbx + glFinish]
	mov edi, 700                ; GLUT_ELAPSED_TIME (ms)
	call [rbx + glutGet]
	push rax
	push rax
	call render
	call render
	call [rbx + glFinish]
	mov edi, 700
	call [rbx + glutGet]
	pop rcx
	pop rcx
	sub eax, ecx                ; ms for 2 frames at a quarter of the pixels
	; the render size is k/16 of the screen: the largest k whose estimated
	; frame time fits (k*k*eax <= LIMIT), never below KMIN
	push 16
	pop rcx
.k:
	mov edx, ecx
	imul edx, ecx
	imul edx, eax
	cmp edx, LIMIT
	jbe .kset
	dec ecx
	cmp ecx, KMIN
	ja .k
.kset:
	mov [k], cl
	cmp cl, 16
	sbb eax, eax                ; scaled: draw into the framebuffer object, then
	mov ecx, eax                ; upscale (mask GL_COLOR_BUFFER_BIT); not scaled:
	and eax, [fbo]              ; draw into the window, mask 0
	mov [dfb], eax
	and ecx, 0x4000
	mov [mask], ecx
	call setsize
%else
	mov edi, 0x8D40
	xor esi, esi
	call [rbx + glBindFramebuffer]
	lea rdi, [scene_frag]
	call program
	mov edi, eax
	lea rsi, [uname]
	call [rbx + glGetUniformLocation]
	mov [loc], eax
%endif

	lea rax, [queue]
	push rax
	push rax
	lea rdi, [asbd]
	lea rsi, [feed]
	xor edx, edx
	xor ecx, ecx
	xor r8d, r8d
	xor r9d, r9d
	call [rbx + AudioQueueNewOutput]
	pop rax
	pop rax
	push 3
	pop r12
.buf:
	mov rdi, [queue]
	mov esi, CHUNK * 8
	lea rdx, [abuf]
	call [rbx + AudioQueueAllocateBuffer]
	mov rsi, [queue]
	mov rdx, [abuf]
	call feed
	dec r12d
	jnz .buf
	mov rdi, [queue]
	xor esi, esi
	call [rbx + AudioQueueStart]
	mov edi, 700                ; GLUT_ELAPSED_TIME
	call [rbx + glutGet]
	mov [start], eax
	call [rbx + glutMainLoop]

; program(rdi = fragment source) -> eax = linked and bound program
program:
	push r12
	push r13
	push r14
	mov r13, rdi
	call [rbx + glCreateProgram]
	mov r12d, eax
	lea r14, [vertex]
	mov edi, 0x8B31             ; GL_VERTEX_SHADER
	call shader
	mov r14, r13
	mov edi, 0x8B30             ; GL_FRAGMENT_SHADER
	call shader
	mov edi, r12d
	call [rbx + glLinkProgram]
	mov edi, r12d
	call [rbx + glUseProgram]
	mov eax, r12d
	pop r14
	pop r13
	pop r12
	ret

; shader(edi = type, r14 = source, r12d = program)
shader:
	push r13
	push rax                    ; (alignment)
	push r14                    ; &source lives on the stack
	call [rbx + glCreateShader]
	mov r13d, eax
	mov edi, eax
	push 1
	pop rsi
	mov rdx, rsp
	xor ecx, ecx
	call [rbx + glShaderSource]
	mov edi, r13d
	call [rbx + glCompileShader]
	mov edi, r12d
	mov esi, r13d
	call [rbx + glAttachShader]
	pop r14
	pop rax
	pop r13
	ret

drawtri:
	push 4                      ; GL_TRIANGLES
	pop rdi
	xor esi, esi
	push 3
	pop rdx
	jmp [rbx + glDrawArrays]

; GLUT display callback
draw:
	push rbx
	lea rbx, [fn + 128]
	mov edi, 700
	call [rbx + glutGet]
	sub eax, [start]
	cmp eax, SONG_MS
	jle .run
	xor edi, edi
	call [rbx + exit]
.run:
%ifdef SCALE
	cvtsi2ss xmm0, eax
	mulss xmm0, [msec]
	movss [uni], xmm0
	mov edi, 0x8CA9             ; GL_DRAW_FRAMEBUFFER: the object (scaled) or the window
	mov esi, [dfb]
	call [rbx + glBindFramebuffer]
	call render
	mov edi, 0x8CA9
	xor esi, esi
	call [rbx + glBindFramebuffer]
	push 0x2601                 ; GL_LINEAR
	push qword [mask]           ; (only the low 32 bits are read)
	push qword [scr + 4]
	push qword [scr]
	xor edi, edi
	xor esi, esi
	mov edx, [ssz]
	mov ecx, [ssz + 4]
	xor r8d, r8d
	xor r9d, r9d
	call [rbx + glBlitFramebuffer]
	add rsp, 32
	call [rbx + glutSwapBuffers]
	pop rbx
	ret

; setsize: render size = screen size * k / 16 -> ssz and u.yz
setsize:
	movzx eax, byte [k]
	mov edx, [scr]
	imul edx, eax
	shr edx, 4
	mov ecx, [scr + 4]
	imul ecx, eax
	shr ecx, 4
	mov [ssz], edx
	mov [ssz + 4], ecx
	cvtsi2ss xmm0, edx
	movss [uni + 4], xmm0
	cvtsi2ss xmm0, ecx
	movss [uni + 8], xmm0
	ret

; render: viewport (GLUT's reshape callback resets it) = render size, upload
; u, draw
render:
	push rax                    ; (alignment)
	xor edi, edi
	xor esi, esi
	mov edx, [ssz]
	mov ecx, [ssz + 4]
	call [rbx + glViewport]
	mov edi, [loc]
	push 1
	pop rsi
	lea rdx, [uni]
	call [rbx + glUniform4fv]
	pop rax
	jmp drawtri
%else
	cvtsi2ss xmm0, eax
	mulss xmm0, [msec]
	movss [uni], xmm0
	mov edi, 102                ; GLUT_WINDOW_WIDTH (GLUT's default reshape
	call [rbx + glutGet]        ; callback keeps the viewport in sync)
	cvtsi2ss xmm0, eax
	movss [uni + 4], xmm0
	mov edi, 103                ; GLUT_WINDOW_HEIGHT
	call [rbx + glutGet]
	cvtsi2ss xmm0, eax
	movss [uni + 8], xmm0
	mov edi, [loc]
	push 1
	pop rsi
	lea rdx, [uni]
	call [rbx + glUniform4fv]
	call drawtri
	call [rbx + glutSwapBuffers]
	pop rbx
	ret
%endif

; AudioQueue output callback (user, queue, buffer)
feed:
	push rbx
	push rsi
	mov rbx, rdx
	mov rdi, [rdx + 8]          ; mAudioData
	mov eax, [pos]
	lea rsi, [song]
	add rsi, rax
	add dword [pos], CHUNK * 8
	mov ecx, CHUNK * 8
	mov [rdx + 16], ecx         ; mAudioDataByteSize
	rep movsb
	pop rdi
	mov rsi, rbx
	xor edx, edx
	xor ecx, ecx
	lea rax, [fn + 128]
	pop rbx
	jmp [rax + AudioQueueEnqueueBuffer]

align 8
asbd:   dq 44100.0              ; AudioStreamBasicDescription: float, packed,
	dd 0x6c70636d, 9, 8, 1, 8, 2, 32, 0 ; 8 bytes/frame, 2 channels, 32 bits
msec:   dd 0.001
uname:  db "u", 0
vertex:
	db "#version 330", 10, "void main(){gl_Position=vec4(gl_VertexID%2*4-1,gl_VertexID/2*4-1,0,1);}", 0

%ifdef FWDIR                    ; tools/macsim: fake frameworks in another directory
%define FW(x) FWDIR, x, ".framework/Versions/A/", x, 0
%else
%define FW(x) "/System/Library/Frameworks/", x, ".framework/Versions/A/", x, 0
%endif
names:
	db FW("GLUT")
	db "glutInit", 0, "glutInitDisplayMode", 0, "glutCreateWindow", 0, "glutFullScreen", 0
	db "glutSetCursor", 0, "glutKeyboardFunc", 0, "glutDisplayFunc", 0, "glutIdleFunc", 0
	db "glutSwapBuffers", 0, "glutMainLoop", 0, "glutGet", 0, "exit", 0, 0
	db FW("OpenGL")
	db "glCreateShader", 0, "glShaderSource", 0, "glCompileShader", 0, "glCreateProgram", 0
	db "glAttachShader", 0, "glLinkProgram", 0, "glUseProgram", 0, "glUniform4fv", 0
	db "glGetUniformLocation", 0, "glDrawArrays", 0, "glGenVertexArrays", 0, "glBindVertexArray", 0
	db "glViewport", 0, "glGenTextures", 0, "glBindTexture", 0, "glTexImage2D", 0
	db "glGenFramebuffers", 0, "glBindFramebuffer", 0, "glFramebufferTexture2D", 0, "glReadPixels", 0
	db "glFinish", 0
%ifdef SCALE
	db "glBlitFramebuffer", 0
%endif
	db 0
	db FW("AudioToolbox")
	db "AudioQueueNewOutput", 0, "AudioQueueAllocateBuffer", 0, "AudioQueueEnqueueBuffer", 0
	db "AudioQueueStart", 0, 0, 0

section .bss
alignb 8
fn:     resq 40
queue:  resq 1
abuf:   resq 1
uni:    resd 4
vao:    resd 1
tex:    resd 1
fbo:    resd 1
loc:    resd 1
start:  resd 1
%ifdef SCALE
scr:    resd 2                  ; screen size
ssz:    resd 2                  ; render size
k:      resd 1
dfb:    resd 1                  ; draw framebuffer of the frames
mask:   resd 2                  ; blit mask (+ padding: pushed as a qword)
%endif
pos:    resd 1
alignb 16
song:   resb ROWS * 1024 * 16 + CHUNK * 64
