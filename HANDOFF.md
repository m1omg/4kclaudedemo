# BRÁNA 4K intro: handoff for local Claude Code

Written on 2026-09-30 at the end of a cloud Claude Code session. That
session had only a software renderer (Mesa llvmpipe) and virtual sound
devices, so it could not reproduce the two problems that remain: they only
show up on the owner's real hardware. This file is everything the next agent
needs to continue **on the physical machines**.

Repository: `github.com/m1omg/4kclaudedemo`, branch `main` (merge commit
`94ce63a`, PR #4). Work branch used so far: `ccr-e0f02308-ge7fge`. It has been
merged; a new branch is fine.

---

## 0. TL;DR

BRÁNA is a 4K intro (≤ 4096 bytes per executable) for Windows, Linux and
Intel macOS. Everything is computed at runtime:
- **Music:** a GLSL fragment shader renders the whole 2:26 song once on the
  GPU into a float texture, which is read back and played.
- **Visuals:** a GLSL raymarcher, evaluated for every pixel of every frame.

| Platform | File | Size | Status |
|---|---|---|---|
| Windows | `dist/brana-windows.exe` | 3183 B | Works under Wine. **Never run on real Windows.** |
| Linux | `dist/brana-linux` | 4013 B | Works on Mesa llvmpipe with bit-exact audio. **On the owner's NVIDIA PC: a steady high-pitched tone instead of music** (open issue 1). |
| macOS (Intel) | `dist/brana-macos` | 4081 B | **Confirmed on the owner's MacBook:** music plays and visuals render correctly (build before PR #4). **Only a few fps on its Intel HD Graphics** (open issue 2). PR #4 optimizations are untested there. |

Open issues, in priority order:
1. **Linux + NVIDIA RTX 3060: high-pitched tone instead of music.** The tone
   comes out of the headphones; it is not coil whine (the owner checked).
2. **macOS on Intel HD Graphics: a few fps.** PR #4 made the worst scenes
   about 2.6× cheaper, but that is not yet tested on the Mac.

**The very first thing to do on the Linux PC** takes 30 seconds and splits
issue 1 in half. Run the intro with software rendering instead of NVIDIA:

```sh
__GLX_VENDOR_LIBRARY_NAME=mesa LIBGL_ALWAYS_SOFTWARE=1 ./dist/brana-linux
```

The visuals will be slow; that is fine. What matters is the music:
- **Music plays correctly** → the NVIDIA GPU computes the music shader
  differently. Go to section 2.4, branch A.
- **Still the tone** → the problem is in the sound path. Go to branch B.

---

## 1. The owner's machines

**Linux PC.** `fastfetch` output from the owner:

| Item | Value |
|---|---|
| OS | CachyOS x86_64 (Arch based) |
| Kernel | 7.2.8-1-cachyos |
| Desktop | GNOME 50.5 on Wayland (Mutter), so the intro runs under XWayland |
| GPU | NVIDIA GeForce RTX 3060 LHR (driver unknown; presumably the NVIDIA proprietary/open kernel module) |
| CPU | Intel Core i5-11400F: 6 cores / 12 threads, **no integrated GPU** |
| RAM | 62 GiB |
| Display | MSI 27" 2560×1440 at 180 Hz (DisplayPort) |
| Audio | Headphones (type unknown: analog, USB, Bluetooth or the monitor's jack?). Sound server presumably PipeWire (CachyOS default), **not verified**. |
| Other | Shell fish, locale sk_SK.UTF-8 |

**MacBook:** Intel HD Graphics (exact model and macOS version unknown). It ran
the pre-PR #4 build (`.xz` dropper) with correct music and visuals, but at
"maybe a few fps".

---

## 2. Open issue 1: Linux on NVIDIA plays a steady high-pitched tone

### 2.1 History

1. **First build (PR #1):** the owner reported, in Slovak, "the sound on Linux
   is just whistling, and the towers blink at the beginning".
2. **PR #2** fixed:
   - the tower flicker (see section 7);
   - oscillator phases: they are now reduced to one period before `sin`/`cos`
     (the pad and lead used arguments up to about 18 000 rad, where some GPUs
     lose precision).

   Result: "still same high pitch tone on cachyos". The owner then clarified
   that the whine is in the headphones, not GPU coil whine.
3. **PR #3** added the diagnostic tool `tools/brana-diag`. The owner had not
   yet posted its output when this handoff was written.
4. **PR #4** (performance): "its the same on linux still".

So the phase fix did not help, and the cause is something else.

### 2.2 What is verified (in the cloud, Ubuntu 24.04, Mesa llvmpipe)

- **Rendering:** the GPU-rendered song equals the reference. The minified and
  source shaders give bit-identical audio (`tools/check_shaders.sh`).
- **ALSA output:** the Linux binary's output was checked two ways:
  - ALSA `file` plugin: bit-identical to the reference;
  - recorded from a PipeWire 1.0.5 null sink through `pipewire-alsa`: every
    played sample bit-identical.

  PulseAudio 16 was also fine.
- **ALSA setup** that `snd_pcm_set_params` produced there:
  "ALSA <-> PipeWire PCM I/O Plugin", FLOAT_LE, 2 ch, 44100 Hz, buffer 4410,
  period 1102.
- **Other builds:** the same shader on the macOS code path plays correct music
  on the owner's real Mac (Intel GPU, Apple OpenGL). Windows under Wine plays
  the music.

### 2.3 What is NOT known

- Whether the RTX 3060 driver computes the music shader correctly.
- What ALSA `default` is on the CachyOS machine (`pipewire-alsa`? `pulse`? a
  raw `hw` device?).
- What the tone is: its frequency, whether it changes over time, and whether
  it starts immediately.

### 2.4 Debugging plan

Every step is a simple command. Start with step 0, then follow branch A or B.

**0. Software-rendering test** (see the TL;DR). It decides between A (GPU) and
B (sound path).

**0b. The diagnostic tool.** Run it twice: once normally (NVIDIA) and once
with `__GLX_VENDOR_LIBRARY_NAME=mesa LIBGL_ALWAYS_SOFTWARE=1`.

```sh
./tools/brana-diag     # or rebuild: python3 tools/minify.py src/music.frag src/visual.frag -o src/shaders.h
                       #             gcc -O2 -o tools/brana-diag tools/diag.c -ldl -lm
```

It replays the Linux intro's startup step by step (same calls, same order,
same parameters) and prints:
- `GL_RENDERER` and the program link log;
- the texture's real internal format and bits;
- the framebuffer status and GL errors;
- a comparison of the rendered music with reference values (6 spots, plus RMS
  and zero crossings per 16 s), with the verdict `MUSIC RENDER: OK` or
  `DIFFERENT`;
- `/proc/asound/cards`, the ALSA PCM that `default` resolves to, and its
  setup.

Then it plays two 8-second clips:
- **A:** one big `snd_pcm_writei`, like the intro;
- **B:** small blocks.

It also saves the first 60 s of the rendered music to `brana-diag.wav`
(16-bit). **Listen to both WAVs** (NVIDIA and llvmpipe) with any player.

**0c. Record what the intro actually plays** and compare it with the
reference:

```sh
# make PipeWire run at 44.1 kHz so the recording can be bit-exact
pw-metadata -n settings 0 clock.force-rate 44100
parec -d @DEFAULT_MONITOR@ --format=float32le --rate=44100 --channels=2 --file-format=wav rec.wav &
./dist/brana-linux        # let it play ~30 s, press any key
kill %1
pw-metadata -n settings 0 clock.force-rate 0

# reference = the song rendered by llvmpipe
gcc -O2 -o preview tools/preview.c -lGL -lX11 -lm
__GLX_VENDOR_LIBRARY_NAME=mesa LIBGL_ALWAYS_SOFTWARE=1 ./preview music src/music.frag ref.wav 146
python3 tools/audiocmp.py ref.wav rec.wav
```

`audiocmp.py` reports one of three things:
- a bit-exact match, with or without gaps (underruns);
- "starts like the reference but differs later";
- no match. In that case it compares spectra and prints the **strongest
  frequencies**, which is the pitch of the tone.

#### Branch A: the NVIDIA render differs

1. Render the song on NVIDIA with `./preview music src/music.frag nv.wav 146`
   (no environment variables). Compare it with `python3 tools/audiocmp.py
   ref.wav nv.wav`, and plot it with `python3 tools/analyze_audio.py nv.wav`,
   which prints per-bar levels.
2. **Bisect the shader.** Edit a copy of `src/music.frag` and run each variant
   through `preview music` on NVIDIA. In `song()`, the final line is:

   ```glsl
   return tanh((m + s * (1. - kick * .7)) * smoothstep(73., 68., bars) * .8);
   ```

   - `m` is the drums, `s` the tonal instruments. Return only one of them.
   - Then return single instruments: comment out the `s += ...` lines one at
     a time (bass, pad loop, arp loop, lead loop).
   - Remove `tanh`.

   Find the smallest expression that differs between NVIDIA and llvmpipe.
   (`tools/stems.py` does something similar but is **stale**: its regexes
   predate the current mix code. Update it or bisect by hand.)
3. **Suspects** in `music.frag`, most likely first:
   - **`smoothstep` with reversed edges.** The GLSL spec says the result is
     undefined if `edge0 >= edge1`, and it is used 6×:
     - `smoothstep(.5, .45, tb)` in the kick envelope;
     - `smoothstep(73., 68., bars)` on the **whole mix**;
     - `smoothstep(.125, .11, ts)` twice;
     - `smoothstep(4.8, 4., x)`;
     - `smoothstep(d * .25, d * .25 - .04, y)`.

     It works on Mesa and Apple, but it is the one piece of undefined
     behaviour in the shader. Test it by rewriting each as
     `1. - smoothstep(e1, e0, x)`.
   - Implicit int→float conversions:
     - `float(sec & MASK) / sec` (int divisor);
     - `sign(sb & 3)` (int) multiplied into a float;
     - `pow(.45, k)` with an int `k`;
     - `freq(int + ..., t)`;
     - `step(22., bb)` with an int `bb`.
   - Integer ops: `i * 2 / 11025`, `>>`, `&`, `%`, `1 << (bar >> 2)`.
   - The uint hash `noise()`: `uint(i) * 2654435769u`, xor-shifts,
     `float(uint) / 2.1e9`.
   - The `const int D[48]` array with dynamic indices; loops with `break` and
     `continue`.
   - `tanh`: NVIDIA may use a fast approximation, but that would only add
     distortion, not a tone.
   - Precision: all times come from the integer sample index and all phases
     are reduced, so precision alone is unlikely to produce a *tone*.
4. **Check the readback, not just the shader.** The diagnostic prints the
   texture format and framebuffer status. Also try `glGetTexImage` instead of
   `glReadPixels`, and try rendering after `XMapWindow` instead of before it:
   the intro renders the music into an FBO while its window is still
   unmapped, which is legal but unusual.
5. Once found, fix it in `src/music.frag`. Keep the output of llvmpipe as
   identical as possible: run `tools/check_shaders.sh` and compare
   old and new renders with `audiocmp.py`.

#### Branch B: the render is fine but the tone comes out anyway

1. Look at the diagnostic's ALSA section: is `default` "ALSA <-> PipeWire
   PCM I/O Plugin"? Also check:
   - `pacman -Qs pipewire-alsa` (is it installed?);
   - `ls /usr/share/alsa/alsa.conf.d/`;
   - `aplay -L | head -30`;
   - `pactl info` (default sink: which device is the headphones? Bluetooth
     in HSP/HFP mode, USB, analog, or the DisplayPort audio of the monitor?).
2. Did clips A and B of the diagnostic sound like music?
   - **A tone, B music** → the single huge `snd_pcm_writei` is the problem.
     The intro would have to write in chunks (a loop in `writer:` in
     `src/linux/main.asm`; Linux has 83 bytes to spare).
   - **Both a tone** → FLOAT_LE via this ALSA path is broken. Test with
     `aplay -f FLOAT_LE -r 44100 -c 2 some_float.raw`.
3. The intro opens ALSA device `default`. The source has a test hook for
   building against another device: in `src/linux/main.asm`, `%ifdef DEVICE`.

   ```sh
   nasm -f bin -DDEVICE='"pipewire"' -I src/ src/linux/main.asm -o /tmp/brana.elf && chmod +x /tmp/brana.elf && /tmp/brana.elf
   ```

   The unpacked ELF runs directly. `tools/build_linux.sh` only adds the
   xzcat stub.
4. **Inspect the song buffer inside the real binary.**
   `nasm -f bin -DDEBUG -l /tmp/brana.lst ...` inserts an `int3` right after
   `glReadPixels`. Run the ELF under gdb, and at the trap:

   ```
   dump binary memory song.bin ADDR ADDR+51511296
   ```

   `ADDR` is the address of the `song` label from the listing (in `.bss`,
   after the code); 51511296 = 1024 × 3144 × 16. Compare the float data with
   the reference: the preview harness WAV has a 44-byte header, then the same
   float stereo samples.

When fixed: rebuild everything, check sizes, test, and commit/push/PR/merge
(section 8).

---

## 3. Open issue 2: macOS on Intel HD Graphics runs at a few fps

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
- To get numbers on the Mac, write a small GLUT harness (core profile, like
  `src/mac/main.asm`) that renders `src/visual.frag` at the screen size for a
  few seconds at given times and prints ms/frame. `tools/preview.c` is GLX
  only. Build it with `clang -framework GLUT -framework OpenGL`; OpenGL is
  deprecated but works.

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
   - Needs about 50–80 bytes per platform. macOS has 15 bytes left, so it
     needs savings first.
3. **Last resort:** a separate low-spec build.

**Tried and rejected:**
- Hit threshold `.001*t` instead of `.0005*t`: almost no fewer steps, and
  about 1 % of tunnel pixels changed.
- Hoisting the tunnel's `tan()`/`n`/`l` out of `map()`: no measurable gain;
  the compiler already hoists them.

---

## 4. Other known issues and loose ends

- **Windows was never run on real Windows**, only under Wine 9.0.
  - If `waveOutOpen` fails (no audio device), `waveOutGetPosition` never
    advances and the intro would freeze on the first frame. A timer fallback
    would fix it.
  - Under Wine with software rendering, Wine's waveOut skips about 0.65 s at
    the start. That is a Wine artifact: its mixer thread stalls while
    llvmpipe compiles the big shader.
- **Stars** are sub-pixel and twinkle a bit. Glow halos accumulate per march
  step, so they shimmer slightly when step counts change.
- **`tools/stems.py` is stale** (see 2.4 A).
- **The macOS `.lzma` dropper** is untested on a real Mac (see 3.2).
- **No error handling anywhere**, for size. A missing library crashes the
  Linux binary with a segfault. A failed shader compile gives silence (the
  fixed-function pipeline renders white, i.e. a constant 1.0 signal).
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
| `tools/check_shaders.sh` | Minified shaders must give **bit-identical** audio and frames (compat), and compile in a 3.3 core context (macOS path). |
| `tools/build_win.sh`, `build_linux.sh`, `build_mac.sh`, `xzbest.sh` | Per-platform builds. `xzbest.sh` grid-searches LZMA encoder parameters. |
| `tools/preview.c` | Dev harness: renders the music to a WAV and frames to PPM or a raw stream, through the same GL paths (compat or `-core`). |
| `tools/diag.c`, `tools/brana-diag` | Linux diagnostic (see 2.4). |
| `tools/bench.py`, `tools/flicker.py`, `tools/audiocmp.py` | GPU cost per scene, temporal flicker metric, recording-vs-reference audio comparison. |
| `tools/analyze_audio.py`, `tools/contact.py`, `tools/stems.py` | Per-bar audio levels and spectrogram, contact sheets of frames, per-instrument stems (stale). |
| `tools/macsim/` | Runs the macOS machine code on Linux: the same asm assembled as ELF, with fake GLUT, OpenGL and AudioToolbox libraries installed at the macOS framework paths (needs root for `/System`). |
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
    sub-pixel caps. Cells outside a disc are sunk 9 units below the floor.

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
| Windows | 3183 B | 913 |
| Linux | 4013 B | 83 |
| macOS | 4081 B | **15** |

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
sudo pacman -S --needed wine          # only for the Windows build (Crinkler); needs 32-bit support
```

- Crinkler 3.0: <https://github.com/runestubbe/Crinkler> (releases,
  `crinkler30b`). Set `CRINKLER=/path/to/Crinkler.exe` and `WINEPREFIX=...`
  for `tools/build_win.sh`.
- `tools/build_mac.sh` finds `ld64.lld-18` (Ubuntu) or `ld64.lld` (Arch), or
  takes `LD64=...`.
- `tools/check_shaders.sh` uses `python3`, or takes `PYTHON=...`.
- The Mac version is built on Linux (nasm + `ld64.lld` + the stub `.tbd`, no
  Apple SDK). On the Mac, just copy `dist/brana-macos` from the repo.

### 6.2 Commands

```sh
export S=$HOME/brana-scratch && mkdir -p $S                   # scratch dir used by the tools
gcc -O2 -o $S/preview tools/preview.c -lGL -lX11 -lm          # dev harness (needs a display)
MODE=VERYSLOW ORDERTRIES=5000 ./build.sh                      # everything, checks 4096 B (runs check_shaders if $S/preview exists)
python3 tools/minify.py src/music.frag src/visual.frag -o src/shaders.h && tools/build_linux.sh && tools/build_mac.sh   # without Windows
tools/check_shaders.sh                                        # minified == source, bit-exact
$S/preview music src/music.frag out.wav 146                   # render the song
$S/preview frame src/visual.frag 26 1280 720 f.ppm            # one frame at t = 26 s
python3 tools/bench.py src/visual.frag                        # GPU cost per scene
python3 tools/flicker.py src/visual.frag                      # flicker metric
python3 tools/audiocmp.py ref.wav recording.wav               # recording vs reference
```

- The reference for all audio comparisons is **Mesa llvmpipe**: prefix the
  commands with `__GLX_VENDOR_LIBRARY_NAME=mesa LIBGL_ALWAYS_SOFTWARE=1`.
- The cloud tests used Xvfb, a PipeWire null sink, `pw-record` from its
  monitor, `xdotool key Escape` and `ffmpeg -f x11grab` screenshots. On the
  real machine, `parec -d @DEFAULT_MONITOR@` records what is played.

---

## 7. History

| PR | What |
|---|---|
| #1 | The intro: GLSL music and visuals, Windows (Crinkler), Linux (hand-written ELF + xzcat/memfd stub), macOS (GLUT + AudioQueue + tar.xz dropper), `tools/macsim`, README in Slovak. |
| #2 | Oscillator phases reduced to one period. Monolith flicker fixed (no coplanar box/floor, finite monolith field). |
| #3 | `tools/brana-diag` + `tools/diag.c` (Linux diagnostic), README section "Diagnostika (Linux)". |
| #4 | Faster raymarching (analytic floor step, sky exit, no normal/AO for neon, no floor AO). macOS dropper switched to lzma-alone (−40 B). |
| (this) | `HANDOFF.md`, `CLAUDE.md`, `tools/bench.py`, `tools/flicker.py`, `tools/audiocmp.py`. Portable `check_shaders.sh` (`PYTHON`) and `build_mac.sh` (`LD64`). |

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
