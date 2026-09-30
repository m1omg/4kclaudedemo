; Self-extracting ELF stub for the Linux version.
; Feeds the lzma payload appended to this file to /usr/bin/xzcat, catches the
; output in a memfd and executes it - nothing is written to the file system.
;   fd = open("/proc/self/exe"); lseek(fd, payload); m = memfd_create()
;   child:  stdin = fd, stdout = m, exec xzcat
;   parent: wait, execveat(m, "", argv, envp, AT_EMPTY_PATH)
; The kernel starts us with all general purpose registers zeroed, which the
; code relies on. The program header overlaps the end of the ELF header.
BITS 64
BASE equ 0x400000
org BASE

ehdr:
	db 0x7f, "ELF", 2, 1, 1, 0      ; (only the magic is checked)
	dq 0
	dw 2                            ; ET_EXEC
	dw 62                           ; EM_X86_64
	dd 1
	dq _start
	dq phdr - ehdr
	dq 0
phdr:
	dd 1                            ; e_flags = p_type: PT_LOAD
	dw 5                            ; e_ehsize and e_phentsize
	dw 56                           ; = p_flags: R+X
	dw 1                            ; e_phnum and e_sh*
	dw 0, 0, 0                      ; = p_offset: 1
	dq BASE + 1                     ; p_vaddr (file offset 1 -> BASE + 1)
	dq 0                            ; p_paddr
	dq file_end - ehdr - 1          ; p_filesz
	dq file_end - ehdr - 1          ; p_memsz
	dq 0x1000                       ; p_align

_start:
	mov edi, self
	mov al, 2                       ; open(self, O_RDONLY)
	syscall
	xchg eax, ebx                   ; ebx = fd
	mov edi, ebx
	mov esi, file_end - ehdr
	mov al, 8                       ; lseek(fd, payload, SEEK_SET)
	syscall
	push rsp                        ; any string will do as the memfd name
	pop rdi
	xor esi, esi
	mov eax, 319                    ; memfd_create
	syscall
	xchg eax, ebp                   ; ebp = memfd
	mov al, 57                      ; fork
	syscall
	test eax, eax
	jnz .parent
	mov edi, ebx
	mov al, 33                      ; dup2(fd, 0): stdin = payload
	syscall
	mov edi, ebp
	inc esi
	mov al, 33                      ; dup2(memfd, 1): stdout = memfd
	syscall
	mov edi, xzcat
	push rdx                        ; argv = {"/usr/bin/xzcat", NULL}, envp = NULL
	push rdi
	mov rsi, rsp
	mov al, 59                      ; execve
	syscall
.parent:
	xchg eax, edi                   ; wait4(child, 0, 0, 0)
	push 61
	pop rax
	syscall
	mov edi, ebp
	lea rdx, [rsp + 8]              ; argv
	mov eax, [rsp]                  ; argc
	lea r10, [rdx + rax * 8 + 8]    ; envp
	lea rsi, [r10 - 8]              ; "" (the NULL ending argv)
	bts r8d, 12                     ; AT_EMPTY_PATH
	mov eax, 322                    ; execveat
	syscall

self:   db "/proc/self/exe", 0
xzcat:  db "/usr/bin/xzcat", 0
file_end:
