; Self-extracting ELF stub for the Linux version.
; Feeds the lzma payload appended to this file to /usr/bin/xzcat, catches the
; output in a memfd and executes it - nothing is written to the file system.
;   fd = open("/proc/self/exe"); lseek(fd, payload); m = memfd_create()
;   child:  stdin = fd, stdout = m, exec xzcat
;   parent: wait, execveat(m, "", argv, envp, AT_EMPTY_PATH)
BITS 64
org 0x400000

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
	dw 64, 56, 1, 0, 0, 0
phdr:
	dd 1, 5                 ; PT_LOAD, R+X
	dq 0, ehdr, ehdr, file_end - ehdr, file_end - ehdr, 0x1000

_start:
	mov edi, self
	xor esi, esi            ; O_RDONLY
	push 2                  ; open
	pop rax
	syscall
	xchg eax, ebx           ; ebx = fd
	mov edi, ebx
	mov esi, file_end - ehdr
	xor edx, edx            ; SEEK_SET
	push 8                  ; lseek
	pop rax
	syscall
	mov edi, xzcat + 14     ; any string will do as the memfd name
	xor esi, esi
	mov eax, 319            ; memfd_create
	syscall
	xchg eax, ebp           ; ebp = memfd
	push 57                 ; fork
	pop rax
	syscall
	test eax, eax
	jnz .parent
	mov edi, ebx
	xor esi, esi
	call dup2               ; stdin = our file at the payload
	mov edi, ebp
	push 1
	pop rsi
	call dup2               ; stdout = memfd
	mov edi, xzcat
	push rdx                ; argv = {"/usr/bin/xzcat", NULL}, envp = NULL
	push rdi
	mov rsi, rsp
	xor edx, edx
	push 59                 ; execve
	pop rax
	syscall
.parent:
	or edi, -1
	xor esi, esi
	xor edx, edx
	xor r10d, r10d
	push 61                 ; wait4(-1, 0, 0, 0)
	pop rax
	syscall
	mov edi, ebp
	mov esi, xzcat + 14     ; ""
	lea rdx, [rsp + 8]      ; argv
	mov eax, [rsp]          ; argc
	lea r10, [rdx + rax * 8 + 8] ; envp
	mov r8d, 0x1000         ; AT_EMPTY_PATH
	mov eax, 322            ; execveat
	syscall
	push 60                 ; exit (only reached on failure)
	pop rax
	syscall

dup2:
	push 33
	pop rax
	syscall
	ret

self:   db "/proc/self/exe", 0
xzcat:  db "/usr/bin/xzcat", 0
file_end:
