# BRÁNA 4K intro: handoff for Claude Code

Started on 2026-09-30 at the end of a cloud Claude Code session, which had
only a software renderer (Mesa llvmpipe) and virtual sound devices. Updated
by a local Claude Code session on the owner's Linux PC, which fixed the
NVIDIA tone (section 2, PR #6) and the "warbling" streaks on the monoliths
(section 5.4, PR #7). The one remaining issue only shows up on the owner's
MacBook (section 3).

Repository: `github.com/m1omg/4kclaudedemo`, branch `main`. Start new work on
a new branch from the updated `main`.

---

## 0. TL;DR

BRÁNA is a 4K intro (≤ 4096 bytes per executable) for Windows, Linux and
Intel macOS. Everything is computed at runtime:
- **Music:** a GLSL fragment shader renders the whole 2:26 song once on the
  GPU into a float texture, which is read back and played.
- **Visuals:** a GLSL raymarcher, evaluated for every pixel of every frame.

| Platform | File | Size | Status |
|---|---|---|---|
| Windows | `dist/brana-windows.exe` | 3245 B | Works under Wine: 9.0 with Mesa llvmpipe; 11.18 with the NVIDIA driver renders and plays the right music. **Never run on real Windows.** |
| Linux | `dist/brana-linux` | 4020 B | **Works on the owner's NVIDIA RTX 3060 PC:** the owner heard the music (PR #6). Also works on Mesa llvmpipe. |
| macOS (Intel) | `dist/brana-macos` | 4091 B | **Confirmed on the owner's MacBook:** music plays and visuals render correctly (build before PR #4). **Only a few fps on its Intel HD Graphics** (open issue). PR #4 optimizations are untested there. |

Open issue: **macOS on Intel HD Graphics runs at a few fps** (section 3).
PR #4 made the worst scenes about 2.6× cheaper, but that is not yet tested on
the Mac.

Fixed in PR #6 (section 2): NVIDIA's compiler rejected the music shader, so
on NVIDIA GPUs the intro played a constant 1.0 signal instead of the music,
heard as a quiet high-pitched tone. **Compile every shader change on the
NVIDIA PC too** (`tools/check_shaders.sh` there): NVIDIA rejects some GLSL
that Mesa, Apple and `glslangValidator` accept.

Fixed in PR #7 (section 5.4): dark streaks that moved over the monoliths
(rays stopped inside them). **macOS now has only 5 bytes left** (5.8).

---

## 1. The owner's machines

**Linux PC.** From the owner's `fastfetch`, checked by the local session on
2026-09-30:

| Item | Value |
|---|---|
| OS | CachyOS x86_64 (Arch based) |
| Kernel | 7.2.8-1-cachyos |
| Desktop | GNOME 50.5 on Wayland (Mutter), so the intro runs under XWayland (`DISPLAY=:0`) |
| GPU | NVIDIA GeForce RTX 3060 LHR, driver 615.71.09 (open kernel module), OpenGL 4.6. Mesa 26.2.3 is installed too: llvmpipe with `__GLX_VENDOR_LIBRARY_NAME=mesa LIBGL_ALWAYS_SOFTWARE=1`. |
| CPU | Intel Core i5-11400F: 6 cores / 12 threads, **no integrated GPU** |
| RAM | 62 GiB |
| Display | MSI 27" 2560×1440 at 180 Hz (DisplayPort) |
| Audio | Logitech G535 Wireless Gaming Headset (USB), the default sink. PipeWire 1.6.9 with `pipewire-alsa` and `pipewire-pulse`: ALSA `default` is the PipeWire plugin. The graph runs at 48 kHz only (`clock.allowed-rates [ 48000 ]`), so the intro's 44.1 kHz stream is resampled. |
| Tools | gcc, clang 22.1.8, lld (`ld64.lld`), `llvm-dlltool`, glslang, xz, gdb, python with numpy and Pillow, Wine 11.18 (WoW64). **Not installed: `nasm`** (see 6.1). No passwordless sudo. |
| Other | Login shell fish, locale sk_SK.UTF-8. The agent's Bash tool runs zsh (see 6.4). |

**MacBook:** Intel HD Graphics (exact model and macOS version unknown). It ran
the pre-PR #4 build (`.xz` dropper) with correct music and visuals, but at
"maybe a few fps".

---

## 2. Fixed: Linux on NVIDIA played a steady high-pitched tone

### 2.1 History

1. **First build (PR #1):** the owner reported, in Slovak, "the sound on Linux
   is just whistling, and the towers blink at the beginning".
2. **PR #2** fixed the tower flicker and reduced oscillator phases to one
   period before `sin`/`cos`. That was not the cause (the change is harmless
   and stays). "Still same high pitch tone on cachyos"; the owner checked
   that it comes from the headphones, not from coil whine.
3. **PR #3** added `tools/brana-diag`; **PR #4** (performance): "its the same
   on linux still".
4. **PR #6** (local session on the owner's PC): the cause showed up as soon
   as `tools/preview.c` rendered the music on the NVIDIA driver. Fixed; the
   owner confirmed that the music plays.

### 2.2 Cause

NVIDIA's GLSL compiler (driver 615.71.09) rejected `src/music.frag`:

    0(48) : error C1101: ambiguous overloaded function reference "step(float, int)"

The line had `step(22., bb)` with `int bb`; it was there since the first
commit. GLSL allows the implicit int → float conversion, and Mesa, Apple and
`glslangValidator` accept it. But `step` has two overload families,
`step(genType, genType)` and `step(float, genType)`, which coincide for
scalars, and NVIDIA reports the converted call as ambiguous. The same can
happen with the other builtins that have two families: `smoothstep`,
`clamp`, `min`, `max`, `mod`, `mix`.

With no error checks (for size), the intro then did this:
- `glCreateShaderProgramv` returned a program whose link had failed;
- `glUseProgram` failed with `GL_INVALID_OPERATION`, so program 0 (the
  fixed-function pipeline) stayed current;
- `glRects` drew white into the RGBA32F texture: **every sample of the song
  was 1.0**;
- the intro played that full-scale constant signal for 2:26. The G535
  headset turned it into a quiet high-pitched whine, not silence.

The visual shader compiled, so the picture was fine. The Windows build has
the same shader, so Windows on NVIDIA most likely had the same bug (not
tested on real Windows). Apple's compiler accepts the code; the Mac played
music.

### 2.3 Fix

In `song()`, the snare roll's volume ramp is clamped instead of gated:

    before: (bb * 16 + sb - 351) / 64. * step(22., bb)
    after:  max(bb * 16 + sb - 351, 0) / 64.

The ramp is ≤ 0 whenever bb < 22, so the value is the same. On llvmpipe the
song is bit-identical to before. It is also smaller: Linux −3 B, macOS −5 B,
Windows −4 B (same toolchain).

### 2.4 Verification (on the owner's PC)

- The owner ran the old build with software rendering
  (`__GLX_VENDOR_LIBRARY_NAME=mesa LIBGL_ALWAYS_SOFTWARE=1`) and heard the
  music. So the sound path (ALSA, PipeWire, headset) was fine and the GPU was
  the difference.
- `preview music` on NVIDIA now compiles. The NVIDIA render differs from the
  llvmpipe reference by at most 0.0023 (−53 dBFS); overall SNR 66 dB. That is
  float rounding in `sin`/`exp` and cannot be heard.
- The packed `dist/brana-linux` on NVIDIA, with ALSA `default` redirected to a
  file (6.3): the 145.9 s written before the timeout are bit-exact with the
  NVIDIA `preview` render.
- The same binary played through PipeWire to the headset: the owner heard the
  music.
- `dist/brana-windows.exe` under Wine 11.18 with the NVIDIA driver and Wine's
  ALSA driver, into the same file redirect: 43.68 s captured, bit-exact with
  the NVIDIA render.
- The rebuilt `tools/brana-diag` reports `MUSIC RENDER: OK` on NVIDIA.
- `tools/check_shaders.sh` passes on NVIDIA and on llvmpipe. It now prints the
  driver's log when a render fails: on NVIDIA with the old shader it shows
  the error above.

### 2.5 Lessons

- `glslangValidator` and Mesa are not a portability check. Compile every
  shader change on NVIDIA as well: `tools/check_shaders.sh` on this PC.
- Do not pass an `int` to a builtin that takes `float`; write `float(x)` or
  restructure. Arithmetic (`+ - * /`) mixes int and float in many places in
  the shaders, and NVIDIA, Mesa and Apple all accept that.
- `tools/brana-diag` prints the program log and a verdict, so it shows such a
  failure at once.

---

## 3. Open issue: macOS on Intel HD Graphics runs at a few fps

### 3.1 What PR #4 changed (`src/visual.frag`)

The horizon scenes were by far the most expensive. Rays grazing the mirror
floor crept towards it in tiny steps (the distance to the floor is just the
ray's height), and many used the whole step budget. Then every floor pixel
also marched its reflection. Changes:

- **Analytic floor step.** A global `Q` is set to `-1/rd.y` while marching a
  downward ray, and to 1 otherwise. `map()` uses `f = p.y * Q`, the distance
  **along the ray** to the plane, so the ray reaches the floor in one step
  unless an object is closer. `Q = 1.` is restored before normals and AO.
- **Sky exit.** `map()` returns `G = 1e3` above y = 13, where nothing exists in
  any scene, so rays going up end at once.
- **Neon hits** skip the normal and ambient occlusion, which were computed
  but never used. **Floor hits** use the known normal (0, 1, 0) and no AO:
  measured invisible (mean difference ≤ 0.05 levels).

Measured on llvmpipe with `tools/bench.py`. The metric is the per-8×2-block
maximum of `map()` calls, which is what a SIMD GPU pays.

| Time in the intro | 0:12 | 0:26 | 0:40 | 1:00 | 1:28 | 1:40 | 1:56 | 2:12 | Weighted |
|---|---|---|---|---|---|---|---|---|---|
| Before PR #4 | 56.6 | 49.5 | 40.9 | 23.0 | 19.7 | 21.9 | 21.9 | 43.5 | 33.5 |
| After PR #4 | 21.5 | 21.4 | 18.7 | 21.6 | 19.6 | 20.7 | 20.7 | 19.9 | 20.6 |
| After PR #7 | 23.8 | 23.3 | 19.5 | 21.6 | 19.6 | 20.7 | 20.7 | 20.8 | 21.3 |

PR #7 (the monolith fix, section 5.4) gives a little of it back in the horizon
scenes (+4 to +11 %, whole intro +3.4 %); it is the cheapest correct variant
found.

- Frame times on llvmpipe at 480×270: horizon 27 → about 14 ms; tunnels about
  19 ms, unchanged.
- The tunnels and the core render identically. The horizon differs by < 0.6
  levels on average (glow halos around the tiles).
- The flicker metric is essentially unchanged (0.78 vs 0.76).

So the start and the end (the horizon) should now run about 2.5× faster on the
Mac, while the tunnels (0:48–1:20, 1:36–2:08) and the core (1:20–1:36) are
about as fast as before.

### 3.2 What to test on the Mac

```sh
curl -LO https://github.com/m1omg/4kclaudedemo/raw/main/dist/brana-macos
chmod +x brana-macos && ./brana-macos
```

- The dropper changed in PR #4. It now extracts a tar compressed in the
  **"lzma alone" format** (was `.xz`). The Mac's own `tar` (bsdtar)
  auto-detects both when extracting. This was verified only with bsdtar 3.7.2
  (libarchive) on Linux. If it fails with "Unrecognized archive format",
  revert `tools/build_mac.sh` to the `.xz` variant (commit `7585c85`); that
  costs about 40 bytes.
- Note which parts are choppy:
  - 0:00–0:48 horizon;
  - 0:48–1:20 tunnel 1;
  - 1:20–1:36 core;
  - 1:36–2:08 tunnel 2;
  - 2:08–2:26 outro.
- Numbers on the Mac: `tools/mac/macbench` (section 3.4).

### 3.3 If it is still choppy (the owner's preference order)

The owner said: genuine optimization first; no "dramatic" fidelity loss; a
separate low-spec version **only as a last resort**.

1. **More shader work** (measure every idea with `tools/bench.py`, and check
   the look with image diffs):
   - AO with 2–3 taps instead of 4 (−1 to −2 `map()` calls per solid hit, out
     of about 20). The look changes slightly; untested.
   - Shorter maximum ray length in the tunnels (150 → 100). The vanishing
     point is about 80 % fog anyway.
   - A smaller step budget for the reflection bounce.
   - One tower hash instead of two (`hash(id)` and `hash(id.yx)`).
   - Code size: `map()` is inlined about 9–18 times (march, 4 normal taps,
     4 AO taps, per bounce). A huge shader can spill registers or thrash the
     instruction cache on old Intel GPUs. A normal computed in a loop might
     help there; this cannot be measured on llvmpipe.
2. **Automatic resolution scaling in the same file** (a middle ground; ask the
   owner first):
   - Render into an FBO at scale s (0.5–1.0) chosen from the measured frame
     time.
   - `glBlitFramebuffer` with `GL_LINEAR` to the window.
   - Pass the scaled size in `u.yz`.
   - Full resolution on fast GPUs.
   - Needs about 50–80 bytes per platform. macOS has 5 bytes left, so it
     needs savings first.
3. **Last resort:** a separate low-spec build.

### 3.4 The weak-GPU plan (approved by the owner on 2026-10-01)

The owner's decisions:
- automatic resolution scaling: yes;
- weak GPUs must keep a REASONABLE resolution ("not 320x240"): a floor of about
  11/16 per axis, never below 5/8, chosen by the owner with `macbench look`;
- powerful hardware must NEVER get a lower resolution;
- targets: the Mac's Intel HD, Intel/AMD laptop graphics on Windows/Linux, and
  old GPUs without OpenGL 4.1;
- goal: about 30 fps;
- the owner runs Mac tools and pastes their output.

Steps (each one a PR):
0. Mac baseline: the owner sends `sw_vers`, the GPU and screen from
   `system_profiler SPDisplaysDataType`, `tar --version`, whether
   `tar t </dev/null` reads stdin, and whether the current `dist/brana-macos`
   starts at all (the lzma-alone dropper has never run on a real Mac).
1. **Done:**
   - `tools/mac/macbench`, measurements on the real GPU (PR #8);
   - `tools/mac/test.sh` (PR #9). It downloads the intro variants in
     `tools/mac/test/` (built by `tools/mac/testbuild.py`), runs each for 8 s
     and reports which ones start.
   Variants and their packed size:
   | variant | change | size |
   |---|---|---|
   | `base` | the release build | 4091 |
   | `noexp` | `ld64.lld -no_exported_symbols` | 4028 |
   | `notrail` | + tar without end-of-archive blocks | 4010 |
   | `nodic` | + no `LC_DATA_IN_CODE`, no `__got`/`__bss` headers | 3977 |
   | `nosym` | + zeroed symbol tables | 3951 |
   | `notext` | + no `__text` header | 3921 |
   | `loc0` | base, uniform location 0 | 4067 |
   | `short` | base, short framework paths | 4082 |
   | `hdr1` | base, `tail -n+3 "$0"\|tar -xf - -C/tmp;exec /tmp/a` | 4089 |
   | `hdr2` | base, `tail -n+3 "$0"\|tar x -C/tmp;/tmp/a` | 4080 |

   The first six are cumulative. The Mach-O edits are done by
   `tools/mac/machopp.py`, one option per change.
2. macOS container savings, measured by a design review (bytes):
   - tar without the end-of-archive blocks: −20;
   - `ld64.lld -no_exported_symbols`: −61;
   - post-processing the Mach-O (drop the `__got`/`__bss`/`__text` section
     headers and `LC_DATA_IN_CODE`, zero the symbol table counts): about −84;
   - uniform location 0 instead of `glGetUniformLocation`: −25;
   - short framework paths: −7;
   - dropper header `tail -n+3 "$0"|tar x -C/tmp`: −2 to −8.

   Only variants that ran on the owner's Mac go in.
3. Shader speed-ups that `macbench` shows help on the Intel GPU. Look changes
   need the owner's OK.
4. Windows only:
   - classic `glCreateShader`… path, so OpenGL 3.3 GPUs work (Mesa has
     `glCreateShaderProgramv` on every driver, so Linux does not need it);
   - music rendered in bands (the 2 s watchdog);
   - `NvOptimusEnablement` / `AmdPowerXpressRequestHighPerformance` exports;
   - `-msse2`.
5. Linux bytes: `glBindFramebufferEXT` with FBO name 1 (−14); a shared `frame`
   routine that also fixes a hidden start-up frame with an unset uniform (NaN
   rays, 120 steps per pixel); a minifier naming search; ELF header overlaps.
6. The scaling:
   - Right after the music, time 2 frames of the heaviest moment offscreen
     at half size, with `glFinish` (after one warm-up frame). This does not
     depend on vsync.
   - Pick k/16 in [floor..16] for about 33 ms, with a margin in favour of 16.
   - k < 16: render into the FBO (the re-specified music texture) and
     `glBlitFramebuffer(LINEAR)` to the window.
   - k = 16: today's direct path; the blit mask is 0.

`tools/mac/macbench` (source `tools/mac/macbench.c`, built by
`tools/mac/build.sh`; `tools/mac/variants.py` makes the shader variants from
`src/visual.frag`):
- A macOS x86-64 binary cross-compiled on Linux without the Apple SDK.
  Everything goes through dlopen/dlsym; `tools/mac/libSystem.tbd` adds
  `dyld_stub_binder` for compiled C.
- It renders offscreen into an FBO of the screen size and times with
  `glFinish`, so the refresh rate does not matter. Printed:
  - GL strings;
  - music render time, in one draw and in 8 bands, and whether the bands are
    bit-identical;
  - uniform location;
  - ms/frame of 7 shader variants at the 8 `bench.py` moments, at full and
    half size;
  - RGBA8 vs RGBA32F render target plus blit cost, and whether a
    re-specified attached texture works;
  - whether `dlopen` accepts the short framework paths.
- `./macbench look` shows 3 scenes at 16/16, 14/16, 12/16, 11/16, 10/16 of
  the screen resolution: the owner picks the floor.
- `build/mac/macbench-linux` is the same source for Linux with freeglut. On
  the RTX 3060 at 2560x1440 the current shader takes about 2 ms per frame, so
  that GPU is far from any scaling. Freeglut itself raises one
  `GL_INVALID_ENUM` at start-up in a core context.

**Tried and rejected:**
- Hit threshold `.001*t` instead of `.0005*t`: almost no fewer steps, and
  about 1 % of tunnel pixels changed.
- Hoisting the tunnel's `tan()`/`n`/`l` out of `map()`: no measurable gain;
  the compiler already hoists them.

---

## 4. Other known issues and loose ends

- **Windows was never run on real Windows**, only under Wine (9.0 with
  llvmpipe; 11.18 with the NVIDIA driver, PR #6).
  - If `waveOutOpen` fails (no audio device), `waveOutGetPosition` never
    advances and the intro would freeze on the first frame. A timer fallback
    would fix it.
  - Under Wine with software rendering, Wine's waveOut skips about 0.65 s at
    the start. That is a Wine artifact: its mixer thread stalls while
    llvmpipe compiles the big shader.
- **Stars** are sub-pixel and twinkle a bit. Glow halos accumulate per march
  step, so they shimmer slightly when step counts change.
- **`tools/stems.py` is stale**: its regexes predate the current mix code.
- **The macOS `.lzma` dropper** is untested on a real Mac (see 3.2).
- **No error handling anywhere**, for size. A missing library crashes the
  Linux binary with a segfault. A failed music shader compile gives a
  constant 1.0 signal (the fixed-function pipeline renders white), heard as a
  whine on the owner's headset (section 2).
- **Shader compilers seen so far:** Mesa (llvmpipe), NVIDIA 615 on Linux,
  Apple on the Intel Mac. AMD and Intel drivers on Windows are untested.
- **Linux requirements:** glibc, X11 or XWayland, OpenGL 4.1+ with GLSL 3.30
  in a compatibility context, `libasound.so.2`, `/usr/bin/xzcat`, kernel
  3.19+. It does not run on NixOS or musl distributions (no
  `/lib64/ld-linux-x86-64.so.2` / glibc).

---

## 5. How it works

### 5.1 The rules the owner gave (original request, in Slovak)

- Max 4096 bytes per file, including code, models, textures, synth and music.
- A single file.
- Realtime generation: no video, no prerendered or downloaded assets.
  Executable compressors like Crinkler are allowed.
- Typically 5–8 minutes at most (ours is 2:26).
- Quit at any time with a key (ESC).
- Mouse cursor hidden.
- Deterministic: the same output every run.
- Original content.

Also requested:
- A Linux version that is a plain binary running on many distributions (not
  an AppImage).
- A version for Intel macOS.

### 5.2 Files

| Path | What |
|---|---|
| `src/music.frag` | The music. `song(int i)` returns the stereo sample `i`. `main()` writes samples `2k` and `2k+1` into one RGBA texel of a 1024 × 3144 RGBA32F target. |
| `src/visual.frag` | The visuals. `uniform vec4 u` = (time in s, width, height, 0). |
| `src/linux/main.asm` | Linux: the whole ELF by hand (`nasm -f bin`). |
| `src/linux/stub.asm` | The 240-byte self-extracting ELF stub. |
| `src/mac/main.asm`, `src/mac/tbd/libSystem.tbd` | macOS layer and the stub `.tbd` used instead of the Apple SDK. |
| `src/win/main.c`, `src/win/lib/*.def/.lib` | Windows layer and import libraries (`llvm-dlltool -m i386 -k -d x.def -l x.lib`). |
| `build.sh` | Builds everything into `dist/` and checks 4096 B. Runs `tools/check_shaders.sh` if `$S/preview` exists. |
| `tools/minify.py` | GLSL minifier. Writes `src/shaders.h` (C), `src/shaders.inc` (nasm) and `src/shaders.h.*.min` (all git-ignored). |
| `tools/check_shaders.sh` | Minified shaders must give **bit-identical** audio and frames (compat), and compile in a 3.3 core context (macOS path). Uses the default GL driver, so on the NVIDIA PC it is also the NVIDIA compile check; prints the driver's log on failure. |
| `tools/build_win.sh`, `build_linux.sh`, `build_mac.sh`, `xzbest.sh` | Per-platform builds. `xzbest.sh` grid-searches LZMA encoder parameters. |
| `tools/preview.c` | Dev harness: renders the music to a WAV and frames to PPM or a raw stream, through the same GL paths (compat or `-core`). |
| `tools/mac/` | `macbench` (Mac GPU measurements), `test.sh` + `test/` + `testbuild.py` + `machopp.py` (which byte savings a real Mac accepts); section 3.4. |
| `tools/diag.c`, `tools/brana-diag` | Linux diagnostic: replays the intro's startup and prints the GL driver, the music shader's link log, whether the rendered music matches the reference, and the ALSA setup; then plays 2 × 8 s and saves `brana-diag.wav`. Embeds the minified shader: rebuild it when `music.frag` changes. |
| `tools/bench.py`, `tools/flicker.py`, `tools/inside.py`, `tools/audiocmp.py` | GPU cost per scene, temporal flicker metric, pixels whose ray ends inside a solid (must stay 0), recording-vs-reference audio comparison. |
| `tools/analyze_audio.py`, `tools/contact.py`, `tools/stems.py` | Per-bar audio levels and spectrogram, contact sheets of frames, per-instrument stems (stale). |
| `tools/macsim/` | Runs the macOS machine code on Linux: the same asm assembled as ELF (`-DFWDIR` points the name table at fake GLUT, OpenGL and AudioToolbox libraries in the build directory; no root needed). `ASM=` builds another copy of `main.asm`. The fake AudioQueue plays at real-time speed even into ALSA's null or file devices. |
| `README.md` | User documentation, **in Slovak**. Keep it in sync: size table, testing notes. |

### 5.3 Music (`src/music.frag`)

- **Song:** 120 BPM, D minor, chords Dm9 – B♭maj9 – Gm9 – A7 (2 bars each),
  73 bars = 146 s. `SONG_SAMPLES` = 6 438 600 = 73 × 88 200.
- **Timing:** everything is derived from the **integer** sample index: 16th
  step, bar, time in step, beat, chord. Local times stay exact even at the
  end of the song.
- **Arrangement:** 4-bar sections, as hex bitmasks: kick `0x1F3D0`, drop
  `0xF3C0`, hats `0x3F3FC`, bass `0x1F3FC`, arp `0x3FFFE`. The visuals use the
  kick mask too.
- **Instruments:**
  - kick with a pitch sweep;
  - hats and clap from an integer-hash noise;
  - snare roll and noise riser in the build-up;
  - crash on the drops;
  - rolling FM bass;
  - pad: 2 × 12 detuned DSF saws (discrete summation formula);
  - FM arpeggio with a dotted-eighth ping-pong echo;
  - lead: DSF saws with vibrato and echo, bars 40–64.
- **Mix:** kick sidechain, `tanh` saturation, fade out.
- **Oscillators:** `freq(note, t) = fract(8.1758 * exp2(note / 12.) * t) *
  6.2832`, a phase reduced to one period (PR #2).

### 5.4 Visuals (`src/visual.frag`)

The bar is `B = time / 2`.

| Bars | Time | Scene |
|---|---|---|
| 0–24 | 0:00–0:48 | Horizon. Stars; mirror floor; a finite field of monoliths rises in bars 8–17 with glowing caps; the gate (torus) at the origin; the camera flies through it. |
| 24–40 | 0:48–1:20 | Tunnel 1: polygon frames. Sides and colour change every 4 bars (`V`). |
| 40–48 | 1:20–1:36 | The core: 6 rotating rings. |
| 48–64 | 1:36–2:08 | Tunnel 2: segmented polygons, faster. |
| 64–73 | 2:08–2:26 | Outro: back at the horizon; the monoliths sink; fade out. |

- **Renderer:**
  - sphere tracing, max 120 steps, up to 2 bounces (floor reflection);
  - tetrahedral normal, 4-tap AO;
  - neon glow accumulated per step;
  - fog, exponential tone map, gamma, vignette, film grain.
- **Materials** (`M`): 0 floor, 1 solid, 2 neon.
- **Flicker fixes (PR #2):**
  - an unrisen monolith used to be a zero-height box lying *exactly* in the
    floor plane. The winner of `f < d` was then decided by `sqrt` rounding,
    which is exact on llvmpipe but not on GPUs; emulating GPU rounding
    confirmed the speckle. The box now reaches `h + .01`;
  - the infinite monolith field made the horizon a band of thousands of
    sub-pixel caps. Cells outside a disc are sunk below the floor (9 units
    until PR #7, now 1e3).
- **Monolith streaks (PR #7).** The owner saw a "warbling" on the columns:
  dark arcs and bands moving over their faces and tops (0:26–0:48,
  2:08–2:26). A Claude session on claude.ai found the cause with software
  rendering; the local session measured and fixed it.
  - Cause: `map()` measures only the monolith of the ray's own 7 × 7 cell.
    Horizontally that one is always the nearest, but a ray above a low or
    flat monolith could step further than a taller one in the next cell and
    stop inside it. The AO turned the depth error into dark streaks that moved
    with the camera: up to 0.9 % of the pixels of a frame.
  - Fix: `d = min(d, 6.3 - max(abs(c.x), abs(c.z)) - min(h, 0.))`. A step never
    reaches a neighbour's monolith (6.3 from the cell centre). Sunk cells
    (`-min(h, 0.)` is about 1e3 there) skip the limit: the camera is always
    inside the field, so rays pass them only on the way out.
  - `tools/inside.py` counts the pixels whose ray ends inside a solid: 0 now
    (0.12–0.58 % per frame before, at 1280 × 720).
  - Exactness: over 200 frames at 1280 × 720 of the horizon scenes, 10 pixels
    in total differ from the exact version that limits the step in every cell.
    The tunnels and the core are bit-identical to before (llvmpipe).
  - Cost: see the table in 3.1. Limiting every cell (the obvious fix) costs
    +15 % overall and up to +37 % per frame. Also skipping the limit before
    bar 8 (all monoliths still flat) would remove the extra cost at 0:12 for
    about 7 more bytes on macOS.
  - Paid for with two rewrites that render bit-identically: `rot()` without
    temporaries, and the light position `vec3(0, S < 1. ? 6.5 : 0., 0)`.

### 5.5 Linux layer (`src/linux/main.asm`, `stub.asm`)

- **Stub** (240 B): opens `/proc/self/exe` and seeks to the payload, then
  `memfd_create`.
  - The child runs `/usr/bin/xzcat` with stdin = the payload and stdout = the
    memfd.
  - The parent waits, then `execveat(memfd, "", ..., AT_EMPTY_PATH)`.
  - Nothing is written to disk.
  - The payload is lzma-alone, preset 9e, with a grid over lc/lp/pb/nice/mf.
- **ELF:** own header and dynamic section. It imports only `dlopen` and
  `dlsym` from `libdl.so.2`, with no symbol versions, so it works on old and
  new glibc. It loads `libX11.so.6`, `libGL.so.1` and `libasound.so.2`;
  `pthread_create` and `clock_gettime` come through the libasound handle.
- **Order of calls** (no error checks):
  1. `XOpenDisplay`, `glXChooseVisual({GLX_RGBA, GLX_DOUBLEBUFFER})`,
     colormap, blank pixmap cursor, `XCreateWindow` (screen size),
     `_NET_WM_STATE_FULLSCREEN`, `glXCreateContext` (legacy, so a
     compatibility profile), `glXMakeCurrent`. **The window is not mapped
     yet.**
  2. **Music:**
     - `glBindTexture(GL_TEXTURE_2D, 1)` (the name is not generated);
     - `glTexImage2D(RGBA32F, 1024, 3144)`;
     - `glGenFramebuffers`, bind, `glFramebufferTexture2D`;
     - `glViewport(1024, 3144)`;
     - `glCreateShaderProgramv(GL_FRAGMENT_SHADER)` (a fragment-only
       separable program, fixed-function vertex stage), `glUseProgram`,
       `glRects(-1,-1,1,1)`;
     - `glReadPixels(RGBA, FLOAT)` into a 51.5 MB `.bss` buffer.
  3. Bind FBO 0, set the screen viewport, compile the visual program, one
     draw, `XMapWindow`.
  4. **Audio:**
     - `snd_pcm_open("default")`;
     - `snd_pcm_set_params(FLOAT_LE, RW_INTERLEAVED, 2 ch, 44100,
       soft_resample 1, 100 ms)`;
     - `pthread_create` → **one** `snd_pcm_writei` of the whole song.
  5. **Loop:**
     - events: any key quits (`exit_group`); `ConfigureNotify` → resize and
       viewport;
     - time = `CLOCK_MONOTONIC` since the audio start;
     - `glUniform4fv` (location 0), `glRects`, `glXSwapBuffers`;
     - ends when time > song length.
- **Test hooks:** `-DDEVICE='"name"'` (ALSA device) and `-DDEBUG` (`int3`
  after `glReadPixels`).

### 5.6 macOS layer (`src/mac/main.asm`)

- **Build:** `nasm -f macho64`, then `ld64.lld` against the hand-written
  `libSystem.tbd` (`_dlopen`, `_dlsym`). Frameworks are `dlopen`ed from
  `/System/Library/Frameworks`.
- **Window:** GLUT with `GLUT_DOUBLE | GLUT_3_2_CORE_PROFILE` (0x802),
  `glutFullScreen`, `GLUT_CURSOR_NONE`. Any key quits.
- **Rendering:** core profile, so a VAO and a tiny vertex shader. The viewport
  comes from GLUT's default reshape, and the size from `glutGet`. It renders
  at the point resolution, not 4× Retina: the owner saw a correct
  full-screen image.
- **Audio:** AudioQueue, float stereo 44.1 kHz, 3 buffers × 32 KB. The
  callback copies from the song buffer.
- **Packing:** `#!/bin/sh` then `tail -c+57 "$0"|tar -xf - -C /tmp;exec /tmp/a`,
  followed by a v7 tar containing the Mach-O `a`, compressed as lzma-alone.
  A 12 KB binary is written to `/tmp/a`.

### 5.7 Windows layer (`src/win/main.c`)

- **Build:** `clang -target i686-pc-windows-msvc -Os`, then Crinkler 3.0b under
  Wine (32-bit prefix). The release builds use `/COMPMODE:VERYSLOW
  /ORDERTRIES:5000`. Crinkler 3.0 needs SSE4.2 at runtime.
- **Window and GL:** a popup window of screen size (the `"edit"` class,
  `WS_POPUP | WS_VISIBLE`), WGL legacy context, the same GL sequence as
  Linux.
- **Audio:** `waveOut` float with one buffer holding the whole song. Time =
  `waveOutGetPosition`. ESC via `GetAsyncKeyState(27)`.

### 5.8 Size budget

| Platform | Size | Left |
|---|---|---|
| Windows | 3245 B | 851 |
| Linux | 4020 B | 76 |
| macOS | 4091 B | **5** |

- The Windows size depends on the compiler: the pre-PR #6 sources give
  3183 B with Ubuntu's clang 18 (the cloud builds) and 3236 B with clang
  22.1.8 (the owner's PC). PRs #6 and #7 were built with clang 22.
- **macOS has 5 bytes left**: any change there needs savings first. Found
  but not applied: a wider LZMA search in `tools/xzbest.sh` (also `depth=16`,
  `nice=24`) saves 2 bytes on macOS.
- Shader bytes cost roughly the same on every platform (they are compressed
  inside each binary).
- `tools/build_*.sh` print the compressed parts.
- **PR #4 freed 40 bytes on macOS** by switching the dropper from `.xz` to
  lzma-alone.
- Possible further savings on macOS:
  - trimming Mach-O load commands and symbols;
  - golfing the asm or shaders.

  The tar headers (512-byte header, 1 KiB of zero trailer) compress to only
  a few bytes.

---

## 6. Building and testing on the physical machines

### 6.1 CachyOS / Arch packages

```sh
sudo pacman -S --needed base-devel nasm glslang xz clang lld llvm python-numpy python-pillow libx11 libglvnd mesa
sudo pacman -S --needed wine          # only for the Windows build (Crinkler)
```

- On the owner's PC everything except `nasm` was already installed
  (2026-09-30). Without sudo, the local session took `nasm` 3.02 from the
  CachyOS mirror
  (`https://cdn77.cachyos.org/repo/x86_64_v4/cachyos-extra-v4/nasm-3.02-1.1-x86_64_v4.pkg.tar.zst`,
  SHA-256 checked against `/var/lib/pacman/sync/cachyos-extra-v4.db`) and
  ran `usr/bin/nasm` from it. It reproduces the committed Linux and macOS
  binaries byte for byte.
- Crinkler 3.0b: <https://github.com/runestubbe/Crinkler/releases>
  (`crinkler30b.zip`). Wine 11 on Arch runs 32-bit programs in WoW64 mode,
  where `Win32/Crinkler.exe` crashes in "Estimating models for Code". Use
  `Win64/Crinkler.exe`; it writes the same kind of 32-bit exe. Set
  `CRINKLER=/path/to/Crinkler.exe` and `WINEPREFIX=...` for
  `tools/build_win.sh`. Create a separate prefix without the Mono and Gecko
  install dialogs:
  `WINEPREFIX=$S/wine WINEDLLOVERRIDES="mscoree,mshtml=" wineboot -i`.
- `tools/build_mac.sh` finds `ld64.lld-18` (Ubuntu) or `ld64.lld` (Arch), or
  takes `LD64=...`.
- `tools/check_shaders.sh` uses `python3`, or takes `PYTHON=...`.
- The Mac version is built on Linux (nasm + `ld64.lld` + the stub `.tbd`, no
  Apple SDK). On the Mac, just copy `dist/brana-macos` from the repo.

### 6.2 Commands

```sh
export S=$HOME/brana-scratch && mkdir -p $S                   # scratch dir used by the tools
gcc -O2 -o $S/preview tools/preview.c -lGL -lX11 -lm          # dev harness (needs a display)
CRINKLER=$S/crinkler30b/Win64/Crinkler.exe WINEPREFIX=$S/wine MODE=VERYSLOW ORDERTRIES=5000 ./build.sh   # everything, checks 4096 B (runs check_shaders if $S/preview exists)
python3 tools/minify.py src/music.frag src/visual.frag -o src/shaders.h && tools/build_linux.sh && tools/build_mac.sh   # without Windows
tools/check_shaders.sh                                        # minified == source, bit-exact; on the NVIDIA PC also the NVIDIA compile check
$S/preview music src/music.frag out.wav 146                   # render the song
$S/preview frame src/visual.frag 26 1280 720 f.ppm            # one frame at t = 26 s
python3 tools/bench.py src/visual.frag                        # GPU cost per scene
python3 tools/flicker.py src/visual.frag                      # flicker metric
python3 tools/inside.py src/visual.frag                       # rays ending inside a solid (must stay 0)
python3 tools/audiocmp.py ref.wav recording.wav               # recording vs reference
gcc -O2 -o tools/brana-diag tools/diag.c -ldl -lm             # after minify.py; rebuild it whenever music.frag changes
```

- The Crinkler step (`VERYSLOW`, 5000 order tries) takes about 1 minute on
  the i5-11400F.
- The reference for all audio comparisons is **Mesa llvmpipe**: prefix the
  commands with `__GLX_VENDOR_LIBRARY_NAME=mesa LIBGL_ALWAYS_SOFTWARE=1`.
  NVIDIA renders differ from it by float rounding (at most 0.0023).
- The cloud tests used Xvfb, a PipeWire null sink, `pw-record` from its
  monitor, `xdotool key Escape` and `ffmpeg -f x11grab` screenshots.

### 6.3 Testing the sound without playing it

The owner's headset is the default sink. To capture exactly what a binary
writes to ALSA, without playing it, point `ALSA_CONFIG_PATH` at a standalone
config:

```sh
printf 'pcm.!default {\n\ttype file\n\tslave.pcm { type null }\n\tfile "%s"\n\tformat "raw"\n}\n' $S/out.raw > $S/asound_file.conf
ALSA_CONFIG_PATH=$S/asound_file.conf timeout 8 ./dist/brana-linux
```

- Do **not** include `/usr/share/alsa/alsa.conf` in that config: its hooks
  load `/etc/alsa/conf.d/99-pipewire-default.conf` afterwards, which makes
  `default` PipeWire again, and the sound goes to the headset.
- `$S/out.raw` is float32 stereo, the same layout as a `preview music` WAV
  after its 44-byte header. The null device takes the data faster than real
  time.
- Windows build under Wine: switch the prefix to Wine's ALSA driver once
  (`wine reg add 'HKCU\Software\Wine\Drivers' /v Audio /d alsa /f`), then run
  `wine dist/brana-windows.exe` with the same `ALSA_CONFIG_PATH`.
- The intro still opens its full-screen window on the owner's screen (any
  key quits it). Tell the owner before running it.

### 6.4 Gotchas on this PC

- The agent's Bash tool runs zsh. `"$c:src/music.frag"` applies the zsh
  modifier `:s`; write `"${c}:src/music.frag"`. A word starting with `=` is
  expanded as a command path (`echo ====` fails).
- Every `wine` run prints harmless `MESA-EGL: warning: ... failed to create
  dri2 screen` lines: Mesa's EGL probing the NVIDIA GPU.

---

## 7. History

| PR | What |
|---|---|
| #1 | The intro: GLSL music and visuals, Windows (Crinkler), Linux (hand-written ELF + xzcat/memfd stub), macOS (GLUT + AudioQueue + tar.xz dropper), `tools/macsim`, README in Slovak. |
| #2 | Oscillator phases reduced to one period. Monolith flicker fixed (no coplanar box/floor, finite monolith field). |
| #3 | `tools/brana-diag` + `tools/diag.c` (Linux diagnostic), README section "Diagnostika (Linux)". |
| #4 | Faster raymarching (analytic floor step, sky exit, no normal/AO for neon, no floor AO). macOS dropper switched to lzma-alone (−40 B). |
| #5 | `HANDOFF.md`, `CLAUDE.md`, `tools/bench.py`, `tools/flicker.py`, `tools/audiocmp.py`. Portable `check_shaders.sh` (`PYTHON`) and `build_mac.sh` (`LD64`). |
| #6 | NVIDIA fix: `step(22., bb)` → `max(…, 0)` in `music.frag` (section 2). All three binaries and `tools/brana-diag` rebuilt (clang 22.1.8, nasm 3.02, Crinkler 3.0b Win64). `check_shaders.sh` shows the driver's log on failure. `HANDOFF.md` updated. |
| #7 | Monolith streaks fixed: the march step never reaches a neighbouring cell's monolith (section 5.4). Paid for with two bit-identical rewrites. `tools/inside.py`. |

---

## 8. Working agreements (from the owner)

- **Always push to GitHub, and merge automatically.** After each finished
  change: commit, push, open a PR into `main`, and merge it yourself. Start
  follow-up work from the updated `main`.
- **Every binary must stay ≤ 4096 bytes.** `build.sh` enforces it.
- **Keep `README.md`** (Slovak) up to date: sizes, what was tested and how.
  Be honest about what is untested.
- **The owner's preferences:**
  - follow the rules of decimal arithmetic;
  - do not be presumptuous;
  - all software must be independent of the display refresh rate (the intro
    is time-based, never frame-based);
  - for Linux help, prefer simple solutions over complicated multi-step ones.
- **Language:** the owner writes Slovak or English; the README is Slovak.
