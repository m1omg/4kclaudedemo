# ROZMERY (8K demo) — handoff notes

Technical notes for whoever continues this demo (written for Claude Code).
The user-facing description in Slovak is in `README.md`. The 4K intro BRÁNA
in the repository root is a separate project with its own `HANDOFF.md`; this
folder reuses its platform layers and tools but does not modify any of its
files.

## 1. State

| File | Size | Tested |
|---|---|---|
| `dist/rozmery-windows.exe` | 5605 B | Wine 9.0 + Mesa llvmpipe: whole demo, visuals correct, audio sample-exact (see 6) |
| `dist/rozmery-linux` | 6406 B | Xvfb + llvmpipe + PipeWire: whole demo, audio bit-identical, ESC, k = 11 |
| `dist/rozmery-macos` | 6584 B | `../tools/macsim` (its machine code on Linux): whole demo, audio bit-identical |

- The limit is 8192 bytes per file (`build.sh` checks it). Margins: Windows
  2587 B, Linux 1786 B, macOS 1608 B.
- **Never run on real hardware** (no real GPU, no real Windows or Mac in the
  cloud environment it was made in). The owner has an NVIDIA RTX 3060 PC
  (CachyOS, 2560x1440) and an Intel MacBook with Intel HD Graphics.
- Length: 100 bars at 125 BPM = 192 s (`song.sh`: `SAMPLES = 100 * 16 * 5292`).

## 2. Layout

```
8k/
  build.sh              all three versions -> dist/, checks the 8192 B limit
  song.sh               SAMPLES (shared by build.sh and tools/check_shaders.sh)
  src/synth.frag        the music (GPU synth)
  src/scene.frag        the visuals (one raymarching fragment shader)
  src/linux/main.asm    hand-written ELF (nasm -f bin), adapted from ../src/linux
  src/mac/main.asm      Mach-O via ld64.lld, adapted from ../src/mac
  src/win/main.c        Crinkler build, adapted from ../src/win
  tools/minify.py       ../tools/minify.py + --samples, mat4x3 & co. as types
  tools/check_shaders.sh  minified == source: music bit-identical, frames
                        bit-identical (compat) and within 0.5 % (core)
  tools/build_*.sh      per platform; reuse ../src/linux/stub.asm,
                        ../src/mac/tbd/libSystem.tbd, ../src/win/lib, ../tools/xzbest.sh
  tools/stems.py        per-instrument levels and click check of the synth
  tools/bench.py        frame cost (llvmpipe ms, map() calls) at moments of the demo
```

Generated (ignored): `src/shaders.h`, `src/shaders.inc`, `src/shaders.h.*.min`, `build/`.

## 3. Timeline (bar B = time / 1.92 s)

| Bars | Visuals | Music |
|---|---|---|
| 0–6 | blueprint on the plaza: grid, outline drawn around | pad (G6, Em7, Am7), sparse random bell notes |
| 4–31 | plinth; columns rise one floor per 4 bars from bar 5; slabs slide out of the core; mullions, then glass; stairs one step per beat from bar 6; parapet 26, plant room 28, mast 29.5 | kick from 6, hats 10, clap 14; offbeat bass; C major Fmaj7–G6–Em7–Am7 (2 bars each); marimba note per beat climbing the stairs (pentatonic, 16 steps per flight); 16th bells from 14 |
| 30–35 | dusk (`N`), room lights 31–34 | breakdown: pad, sparse bells |
| 33–34 | the building's frame (cuboid) glows in | |
| 34–36 | the building unbuilds: its clock `T` runs back 16x (34 -> 3) | **the song itself backwards, 16x** (sample index remapped; volume .2) |
| 36–38 | frame collapses: depth, height, width (2/3 bar each) | three falling tones; A minor begins (Am9–Fmaj7#11–Dm9–E7sus4) |
| 38–46 | point -> line -> square -> cube -> tesseract (`A` extrusions, 1 bar each, every 2 bars) | bell arpeggio with 1, 2, 4, 8, 16 notes per bar = vertex count; rolling 16th bass from 38; snare roll 44–46 |
| 42– | 3D tumble (YZ); XW from 46, ZW from 50 | drop at 46: full groove |
| 54–62 | hyperplane w = W sweeps (W = -9 cos(...)): glass slices | |
| 62–64 | tesseract collapses to a point | noise riser, silence on the last beat |
| 63.5–65 | Mandelbulb born at the point, 1 iteration per beat (`I`), grid fades | boom + crash at 64; bells one per beat = the iterations |
| 63–71 | dawn (`N` back to .4) | C major theme returns |
| 70– | ground gone (bulb floats in the sky) | half-time kick, melody from 70 (8 bars, 3.5 times) |
| 70–78 | the bulb "breathes" (phase `H`) | roll 76–78 |
| 78–97 | dive to a peak on the crown, `Z` = exp(-.43 (B - 78)) | drop at 78 |
| 97–100 | camera holds, fade to black | fade out |

## 4. Visuals (`src/scene.frag`)

- Globals: `B` bar; `T` the building's clock (rewinds 34–36, then 3; from 63
  it runs on so the blueprint grid fades); `N` night; `M`/`E` material and
  glow of the last `map()`; `Q` analytic ground step (1/-rd.y while marching
  primary rays, 1 otherwise); `Z` view scale (1, shrinks in the dive); `L` sun;
  `U` camera up (the bulb's normal in the dive); tesseract: `A` extrusions,
  `F` axis fade-in, `R` 4D rotation, `P[16]` projected vertices, `V[16]`
  vertex weights, `W` slicing hyperplane (99 = none); bulb: `I` iterations,
  `H` phase, `G` orbit trap.
- Materials: 0 ground, 1 concrete, 2 steel, 3 glass, 4 bulb, 9 = only the
  building's bounding box (no soft-shadow penumbra from it).
- `building()` writes the global `D`/`M`/`E` (no return value): an earlier
  bug returned min(D, bbox) but `map()` used `D` and rays skipped the building.
- Tesseract: vertices `v = R * (±A)`, projected `C + v.xyz * 14.4 / (14.4 - v.w)`.
  Copies along a collapsed axis fade in with `F = smoothstep(0, .5, A)`, so
  coincident elements never double. Edges/vertices: angular distance from the
  ray to the segment -> glow; faces: ray–quad test (projected faces are
  planar). The slice is the intersection of 4 slabs in 4D restricted to the
  ray: exact entry/exit, colours of the cells hit, edges where two cells are
  close. Axis colours in `const mat4x3 X` (column k = axis k).
- Mandelbulb: power 8, trig form, bounding sphere 1.2 (early out beyond 1.5),
  scale 5 around `C`. Palette `.5 + .5 cos(2π (.9 g.w + .5 g.y + (.1,.3,.5)))`.
  The dive target is a peak found numerically (radius map over directions,
  local maxima): bulb space `(-.081, .997, .46)`, normal `(0, .915, .403)`,
  view along the slope `(0, -.403, .915)`. Camera clearance DE/height stays
  > .5 until bar 97 and drops to ~0 after (the point is known to 3 decimals),
  hence `Z` stops at bar 97. Shadows, AO, normal epsilon and fog scale with `Z`.
- Ideas not done: stars in the night sky; the 400·Z ray cutoff was measured
  as useless (rays hit terrain first).

## 5. Music (`src/synth.frag`)

- `song(i)`: integer sample index; 16th = 5292 samples, bar = 84672.
  Sections: bit k of a mask = bars 4k − 2 .. 4k + 1 (`sec = bar + 2 >> 2`).
  Chords per 2-bar unit `u = bar + 2 >> 1`: `chord(u)` (A minor for bars 36–63).
- Data `D[65]`: two progressions (4 x 4 notes each), 8 bass roots, 25 melody
  notes `(pitch − 60) * 8 + eighths − 1`.
- Levels (A-weighted RMS per section, `tools/stems.py`): kick .035, hats .02,
  clap .019, bass .011 (rolling .03), pad .025, arp .022–.027, melody .042–.047,
  marimba .016; whole mix .03 (intro) … .074 (finale).
- The melody was verified note by note from the stem; the arpeggio's note
  counts per bar in 36–48 were verified (1, 2, 4, 8, 16).

## 6. Testing (commands)

```sh
export S=/scratch                     # with $S/preview (gcc -O2 -o $S/preview ../tools/preview.c -lGL -lX11 -lm)
tools/check_shaders.sh                # also run by build.sh
python3 tools/stems.py src/synth.frag
python3 tools/bench.py src/scene.frag
```

- Platform runs were done with Xvfb `:99` (1280x720), PipeWire with a null
  sink (`pw-record --target nullsink -P '{ stream.capture.sink = true }'`),
  `pipewire-pulse` for Wine, and `../tools/macsim` built against `8k/src`
  (`nasm -f elf64 ... -I 8k/src/ 8k/src/mac/main.asm`). Test builds:
  `NASMFLAGS=-DSHOWK` prints the chosen render size k.
- Captured audio vs `preview music` of the minified synth: Linux and macsim
  bit-identical except one lost 1024-sample period in the capture. Wine: every
  checked window sample-exact, but the capture drifts and has gaps — llvmpipe
  takes all 4 CPUs and Wine's audio underruns (fewer with `LP_NUM_THREADS=2`).
- Bug found by the platform run (fixed): in the Linux asm, `band:` was placed
  between `rescale:` and `viewport:`, so `rescale` fell through into the
  music band's viewport — every frame was black and the speed test chose
  k = 16. Keep fall-through chains intact when inserting routines.

## 7. Performance

llvmpipe, 480x270, ms per frame (`tools/bench.py`):

| B | 3 | 10 | 20 | 28 | 36 | 42 | 50 | 58 | 66 | 74 | 84 | 88 | 92 | 97 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ms | 10 | 17 | 23 | 18 | 30 | 32 | 34 | 46 | 30 | 25 | 45 | 45 | 71 | ~135 |

- The end of the dive is the heaviest moment: `T_HEAVY` = 187 s in all three
  platform layers (the speed test renders 2 half-size frames there; `KMIN`
  11, `LIMIT` ~36 ms as in the 4K).
- Calibration from the 4K (its HANDOFF): ~17 ms here ≈ 2 ms on the RTX 3060
  at 2560x1440, so the heaviest 8K frame should be ~16–20 ms there. Intel HD
  will run at k = 11 and still be slow at the end of the dive.
- Done for speed: 24 shadow steps (was 40), 8 bulb iterations (was 9) — 29 %
  less at the end, visually the same.
