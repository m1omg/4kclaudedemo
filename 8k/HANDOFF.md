# ROZMERY (8K demo) — handoff notes

Technical notes for whoever continues this demo (written for Claude Code).
The user-facing description in Slovak is in `README.md`. The 4K intro BRÁNA
in the repository root is a separate project with its own `HANDOFF.md`; this
folder reuses its platform layers and tools but does not modify any of its
files.

## 1. State

| File | Size | Tested |
|---|---|---|
| `dist/rozmery-windows.exe` | 6498 B | Wine 9.0 + Mesa llvmpipe: whole demo, visuals correct, 32 of 33 checked audio windows sample-exact, the other one holds a skip of Wine's (see 6) |
| `dist/rozmery-linux` | 7413 B | Xvfb + llvmpipe + PipeWire: whole demo, audio bit-identical over the whole song, ESC, k = 11; forced full size: frames = the preview's with u.w = 1 (see 6) |
| `dist/rozmery-macos` | 7573 B | `../tools/macsim` (its machine code on Linux): whole demo, audio bit-identical over the whole song |

- The limit is 8192 bytes per file (`build.sh` checks it). Margins: Windows
  1694 B, Linux 779 B, macOS 619 B.
- **Never run on real hardware** (no real GPU, no real Windows or Mac in the
  cloud environment it was made in). The owner has an NVIDIA RTX 3060 PC
  (CachyOS, 2560x1440) and an Intel MacBook with Intel HD Graphics.
- Length: 104 bars at 125 BPM = 199.68 s (`song.sh`: `SAMPLES = 104 * 16 * 5292`).
- History: PR #12 was the first version. The owner then asked for a smoother
  building -> 4D transition (the music "had a jarring sound there": the song
  played backwards 16x), synthwave music ("more varied, more lively"), a zoom
  into the same Mandelbulb (the old dive cut to a different view, it looked
  like a second bulb) and a faster, closer, longer landscape flight; and
  reported a "weird rendering quirk on the building, on its base too" (see 4).
- Then the owner, after running it on the RTX PC ("absolutely amazing"):
  the flight over the Mandelbulb was bland, "it flies a straight line
  forward" while the beautiful formations stayed at the sides; it should show
  the hills and valleys. The flight now winds through them (4.3).
- Then: "on powerful machines, can the resolution of the building part be
  higher?" Fast GPUs already rendered at the native resolution (k = 16, e.g.
  the RTX 3060 at 2560x1440); now they also supersample the building part
  (4.4).

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
                        bit-identical (compat); core within 2 % (see 6)
  tools/build_*.sh      per platform; reuse ../src/linux/stub.asm,
                        ../src/mac/tbd/libSystem.tbd, ../src/win/lib, ../tools/xzbest.sh
  tools/stems.py        per-instrument levels and click check of the synth
  tools/bench.py        frame cost (llvmpipe ms, map() calls) at moments of the demo
  tools/flypath.py      the flight: clearance and turn rates; `design` recomputes its route (4.3)
```

Generated (ignored): `src/shaders.h`, `src/shaders.inc`, `src/shaders.h.*.min`, `build/`.

## 3. Timeline (bar B = time / 1.92 s)

| Bars | Visuals | Music |
|---|---|---|
| 0–6 | blueprint on the plaza: grid, outline drawn around; plinth 4–5.5 | pad, sparse random arpeggio notes (2–6), riser into 6 |
| 6–30 | columns rise one floor per 4 bars from bar 5; slabs slide out of the core; mullions, then glass; stairs one step per beat from bar 6; parapet 26, plant room 28, mast 29.5 | F – G6 – Em7 – Am7 (2 bars each). 6: kick, 8th octave bass, 8th hats, a bell per stair step climbing each flight (pentatonic). 14: gated snare, 16th hats, 16th arpeggio. 22: the hook. Tom fills at 21, 29 |
| 30–34 | dusk (`N`), room lights 31–34, the frame glows in 33–34.5 | breakdown: pad, long bass notes, sparse arpeggio |
| 34–36.5 | the building takes itself apart: its clock `T` runs back, eased (`34 - 31 smoothstep(34, 36.5, B)`) | the pad swells (x3) and breaks off at 36.5 (60 ms), a noise whoosh with the rewind's speed, the arpeggio runs backwards |
| 36.5–38 | the frame collapses: depth, height, width (half a bar each) | three deep hits at 37, 37.5, 38 (70, 55, 40 Hz), on E7sus4 |
| 38–46 | point -> line -> square -> cube -> tesseract (`A` extrusions, 1 bar each, every 2 bars); one camera move from the dusk shot | A minor: Am9 – Fmaj7#11 – Dm9 – E7sus4. Arpeggio with 2, 4, 8, 16 notes per bar = vertex count; half time from 42; snare roll and riser 44–46 |
| 46–54 | 4D rotation (XW from 46, ZW from 50) | the drop: full groove, rolling 16th bass |
| 54–62 | hyperplane w = W sweeps: glass slices | the second melody; tom fills 53, 61 |
| 62–64 | tesseract collapses to a point | snare roll and riser; a beat of silence (63.75–64, 20 ms fades) |
| 63.5–70 | Mandelbulb born at the point, 1 iteration per beat (`I`); dawn; it breathes (`H`, 66–70); the ground fades into the sky (66–70) | boom + crash at 64; one note per iteration; half time from 66 |
| 70–78 | the orbit dives into the same bulb, crests the ridge at the causeway's east end (~77) | build-up: 4otf from 74, snare roll and riser 76–78 |
| 78–95 | the flight, low and banking into the turns (4.3): off the causeway (78–80), south into a forest of buds (81–86), towers against the sun (86–88), down a valley (88–91), up the wall of a giant formation (91.5–93.5) and over its colourful top (93.5–96) | the hook twice (78, 86; the second time doubled an octave up, over rolling 16th bass); tom fills 85, 93 |
| 95–100 | climb back out to the orbit, the view turns from ahead to the centre, the sun back to its presentation angle | the groove continues to 98 |
| 100–104 | the whole bulb; fade (101–104) | outro on Cmaj7, fade |

## 4. Visuals (`src/scene.frag`)

- The uniform `u` = (time in s, render width, render height, `u.w`): `u.w` = 1
  when the platform layer renders at full size (k = 16), which lets the
  shader supersample (4.4); 0 otherwise and during the speed test.
- Globals: `B` bar; `T` the building's clock (rewinds 34–36.5, then 3; from
  63 it runs on so the blueprint grid fades); `N` night; `M`/`E` material and
  glow of the last `map()`; `Q` analytic ground step (1/-rd.y while marching
  primary rays, 1 otherwise); `Z` the view's scale (1; 0.0068 in the flight:
  fog, shadow and AO distances and the normal's epsilon scale with it); `L`
  sun; `U` camera up (in the flight the surface's radial direction, tilted
  into the turns); tesseract: `A` extrusions, `F` axis fade-in, `R` 4D
  rotation, `P[16]` projected vertices, `V[16]` vertex weights, `W` slicing
  hyperplane (99 = none); bulb: `I` iterations, `H` phase, `G` orbit trap.
- Materials: 0 ground, 1 concrete, 2 steel, 3 glass, 4 bulb, 9 = only the
  building's bounding box (no soft-shadow penumbra from it).
- `building()` writes the global `D`/`M`/`E` (no return value).

### 4.1 The building's rendering quirk (fixed in this round)

The owner saw "a weird rendering quirk on the building, on its base too".
Found by rendering at 1280x720 and against reference versions:

1. **Soft shadows ran out of steps.** The first version cut the shadow loop
   from 40 to 24 steps (for the bulb's speed). Shadow rays crossing the
   building's thin parts (mullions, steps) need more: light streaks and
   "ghost" outlines of the stairs in its shadow on the plaza. A reference
   with 600 small steps showed 40 steps are as good as more; now
   `i < (B < 62. ? 40 : 24)`.
2. **The distance estimate overshot** (checked against an exact version that
   evaluates every column, slab, facade floor and stair step):
   - the bounding box (early out) did not cover the plinth's west edge
     (x = -8, box from -7.5): speckles all over the west facade and base in
     the low shot (bars 22–30). Box now `(.75, 13, 0) +- (8.75, 13.5, 6.5)`;
   - only the nearest slab level was evaluated (by `round`): above a slab
     whose upper neighbour is missing or still growing, rays skipped it. Now
     the two levels around the point (`floor` and `floor + 1`);
   - the stairs evaluated one flight and the two steps nearest in z: wrong at
     the landings and below the flights (a hard-edged notch in the stairs'
     shadow on the plaza). Now the two nearest flights and, in each, the two
     steps nearest along the slope (projection on the flight's line).
   Remaining differences to the exact version: a few pixels of glow/AO next
   to rising columns (<= 0.13 %), invisible.
3. The plinth is now 1 unit wider on the east, so the first stair flight
   stands on it.

### 4.2 The building -> 4D transition

`T` eases back (34–36.5), the frame collapses in half-bar steps ending at a
point exactly at 38, and the camera is one expression for 30–46: an orbit
around `C` whose angle runs on (`2.29 + .04 (B - 30)`), radius and height
blended from the dusk shot to the tesseract's orbit with `smoothstep(36, 40)`.
Cuts remain at 46 and 54 (on the drops).

### 4.3 The Mandelbulb and the flight

- Mandelbulb: power 8, trig form, bounding sphere 1.2 (early out beyond 1.5),
  scale 5 around `C`. Palette `.5 + .5 cos(2π (.9 g.w + .5 g.y + (.1,.3,.5)))`.
  It has 7-fold symmetry around y and a mirror symmetry.
- Maps of the surface radius over directions (Python, float64 DE identical
  to the shader) found, along the equator at longitude -0.65 .. -1.15, a
  "causeway" whose crest (max over latitudes pi/2 +- 0.006) fits
  `r = 0.8792 - 0.1057 (phi + 0.898)^2` within +0.0008, with ridges (r
  0.93–0.94) at both ends. The dive lands on its east end; the flight leaves it.
- Camera (`camera()`, `B > 62.`), in bulb units around `C`, as latitude,
  longitude and radius `s`:
  - The dive (62–78): longitude `ph` (0.1 rad/bar in the orbit, 0.0306 at 78,
    blended with the integral of a smoothstep so speed and position stay
    smooth), latitude 1.39 -> pi/2, radius = crest (or 0.955 over the ridge)
    + height (log-blend 2.38 -> 0.006 over 70–78). The view goes from the
    centre to "ahead and 7° down" (a mix of points), `U` from world up to the
    radial direction.
  - The flight (78–95): `fly(t)`, Catmull-Rom through `K[25]` (latitude,
    longitude, radius for the bars 77–101; `t` clamped to 78–99.9, after that
    the longitude runs on at -0.03/bar). `K` 77 and 78 lie on the dive's path
    (position continuous at 78, velocity nearly), 79–96 come from the route
    design, 97–101 are extrapolated (the climb-out has taken over by then).
  - The view: `w` = the route 0.35 bar ahead minus the route here (both on
    the spline, not the camera) minus 0.0015 radially, its vertical part
    damped to 30 % (pitch -15..+36° instead of the route's raw slopes);
    blended from the dive's view over 78–79 (`e`). After 78 the target is a
    mix of directions (ahead -> the centre), before it a mix of points.
  - Banking: `U` = radial + right * (the lateral part of the route's second
    difference over +-1 bar) * 30, faded in over 78–79; |bank| up to ~19°.
  - The climb-out (`c = smoothstep(95, 100)`): latitude -> 1.39, radius
    log-blended (the height above 0.8) to 3.345, the view to the centre, `U`
    to world up, the sun back to its presentation angle (in the flight it is
    low ahead, from -2° to ~19° above the local horizon).
- The route (`ROUTE` in `tools/flypath.py`; `python3 tools/flypath.py design`
  recomputes `K` in ~45 s and prints it for the shader): waypoints (bar,
  latitude, longitude) chosen by eye on a relief map (latitude 1.54–1.80,
  longitude -1.26..-0.64): south off the causeway into a forest of buds (the
  most striking formations, backlit by the low sun), a valley at latitude
  ~1.69 and a giant formation at longitude ~-1.2. Heights: for each point of
  the route the highest surface within 4 map cells (+-0.0048 rad), a running
  maximum from 0.5 bar back to 1.5 bars ahead (the camera starts climbing
  before a rise and does not drop into every gap), a 1.3-bar moving average
  (never below the running maximum), + 0.0035.
- Pitfalls met on the way (`tools/flypath.py` prints the turn rates):
  - the second difference over +-0.1 bar flicked the roll at every control
    point (Catmull-Rom's curvature jumps at the knots; up to 190°/bar); over
    +-1 bar it is smooth;
  - at 78 the clamped spline (`fly(B - 1)` = `fly(78)`) and the switch from
    the dive's view gave a 5° jump of the view and an 18° roll jolt: hence `e`;
  - looking at the route from the rising camera turned the view straight
    down while `U` still pointed up from the surface: the image spun
    (650°/bar) at ~96.5; hence the look-ahead along the route and the mix of
    directions;
  - `normalize(cross(w, v))` must never get a zero vector (a NaN poisons `U`
    even when mixed in with weight 0): `fly()` keeps moving after 99.9, so
    the look-ahead never collapses onto the camera's own point.
- `tools/flypath.py` mirrors the camera (it reads `K` from the shader) and
  prints the distance to the surface and the turn rates: closest 0.00147
  bulb units at bar 80.1; the view and `U` turn at most 45°/bar (bar 91.8,
  the pull-up out of the valley). **Run it after any change to the path.**
- `Z` is 1 in the orbit, log-blended to 0.0068 over the dive and back over
  95–100. Rays stop at `600 Z` (beyond only haze: -9 % frame time, same
  image; `400 Z` would save only another 2.5 % of the flight's `map()`
  calls). The sky uses `dot(rd, U)` (the local horizon).
- The ground fades into the sky over 66–70 (and is gone from 70).

### 4.4 Supersampling on fast GPUs

- When the speed test picks full size (k = 16), the platform layers set
  `u.w = 1` (Windows `uni[3] = !rfb`, Linux/macOS a store after the k loop).
  For `B < 46` the shader then runs its per-ray code 4 times per pixel, at
  the rotated-grid offsets (.125, .375), (.375, -.125), (-.125, -.375),
  (-.375, .125) pixels, and averages the final colours (after the tone map,
  gamma and vignette), like rendering at 2x and scaling down. With 1 sample
  the jitter is 0 and the frames are bit-identical to the previous version.
- The range ends on the camera cut at bar 46 (the drop), where the switch
  cannot be seen: the building, its disassembly and the tesseract's birth.
- Cost: 4 samples cost 2.7–3.5x one (sky pixels are cheap). On llvmpipe at
  480x270 (in one session: the container's speed changes after a restart)
  the supersampled frames take 29–73 ms in the building and up to 134 ms
  around the dusk and the tesseract's birth (bars 34–44), the heaviest
  flight frame 167 ms. If GPUs have similar ratios (not measured), any GPU
  that gets k = 16 (the flight fits the 36 ms target at full size) also runs
  the supersampled frames within it, and the slowest moment of the demo stays
  the flight: on the RTX 3060 at 2560x1440 ~12 ms at most for the building
  part, against ~15.5 ms for the flight (estimates, see 7).
- Possible extension: the tesseract part (46–62) has thin glowing edges too;
  supersampled it would cost up to ~0.9x the heaviest flight frame (the
  slices, 54–62). The switch could then sit at the beat of silence before the
  bulb (63.75–64). The bulb part would be too slow.
- Why not a 2x framebuffer object and a downscaling blit: the window's
  framebuffer may be multisampled when a driver forces antialiasing, and a
  blit into it fails (the existing upscale for k < 16 has that risk); this
  way the frame goes straight to the window as before.

## 5. Music (`src/synth.frag`)

- `song(i)`: integer sample index; 16th = 5292 samples, bar = 84672.
  Sections: bit k of a mask = bars 4k − 2 .. 4k + 1 (`sec = bar + 2 >> 2`).
  Chords per 2-bar unit `u = bar + 2 >> 1`: `chord(u)` (A minor for bars
  38–63, Cmaj7 from 98).
- Data `D[99]`: 9 chords (4 notes), 9 bass roots, the hook (26 notes, from
  45) and the second melody (28, from 71), notes as `(pitch − 60) * 8 +
  eighths − 1` (pitch 60 = a rest).
- Masks: half time `0x60800`, groove (snare 2&4, 16th hats) `0x1F0F0F0`,
  four on the floor `0x1F8F0FC`, 8th hats `0xE080C`, bass on `0x3FEF9FC`,
  rolling 16th bass `0xC0F000`, 8th bass `0x13808FC`, arpeggio on `0x7FFFFF2`,
  sparse arpeggio `0x6060102`.
- Instruments: kick (sine with pitch drop), gated-reverb snare (white +
  sample-held noise, a body at 185 Hz, gate at 0.3 s), hats, crash, Simmons
  toms (falling run of 16ths, panned), risers/snare rolls, saw + sub bass,
  12-voice detuned pad, stair bells (FM), arpeggio (DSF saw pluck, ping-pong
  echo), lead (two detuned saws + vibrato, echo). Everything tonal is ducked
  by the kick (sidechain).
- The arpeggio's echo taps take the bar/section of their own note (else an
  echo changes pitch or length mid-note at a section boundary: clicks).
- Levels (A-weighted RMS per section, `tools/stems.py`): kick .035, snare
  .025, hats .023, bass .02, pad .017–.022, arp .012, lead .040–.052; whole
  mix .017 (outro) … .078 (the second flight pass).
- Verified from dry renders: both melodies note by note; the arpeggio's note
  counts per bar in 38–46 (2, 4, 8, 16) and 64–66 (4).
- `tools/stems.py` flags "clicks" in the arpeggio and the lead: false
  positives (bright saws have large second differences); the waveforms at
  the flagged positions are clean note onsets.

## 6. Testing (commands)

```sh
export S=/scratch                     # with $S/preview (gcc -O2 -o $S/preview ../tools/preview.c -lGL -lX11 -lm)
tools/check_shaders.sh                # also run by build.sh
python3 tools/stems.py src/synth.frag
python3 tools/bench.py src/scene.frag
python3 tools/flypath.py
```

- Platform runs were done with Xvfb `:99` (1280x720), PipeWire with a null
  sink (`pw-record --target nullsink -P '{ stream.capture.sink = true }'`),
  `pipewire-pulse` for Wine, and `../tools/macsim` built against `8k/src`
  (`nasm -f elf64 ... -I 8k/src/ 8k/src/mac/main.asm`). Test builds:
  `NASMFLAGS=-DSHOWK` prints the chosen render size k.
- Captured audio vs `preview music` of the minified synth: Linux and macsim
  bit-identical over the whole song. (The capture can lose a block under
  load: one Linux run lacked 2048 samples at 3.2 s, exact on both sides; the
  re-run was bit-identical over the whole song.) Wine (`LP_NUM_THREADS=2`): 32 of 33
  checked 2-s windows sample-exact; the 33rd holds a 128-sample skip (exact
  on both sides of it). The capture has gaps and skips: Wine's audio
  underruns while llvmpipe takes the CPUs. After a container restart the
  first Wine run updates `~/.wine` and starts ~60 s late.
- The supersampled path is not covered by `check_shaders.sh`:
  `../tools/preview.c` always passes `u.w = 0`. To render with `u.w = 1`,
  build a copy with `getenv("UW") ? atof(getenv("UW")) : 0` as the 4th
  argument of its `glUniform4f`, then `UW=1 $S/preview_uw frame ...`. With it,
  the minified shader renders bit-identically to the source in both modes.
- To run the platform layers at full size here (llvmpipe always picks 11),
  patch a copy: Linux `LIMIT equ 0x7fffffff`, macOS the same, Windows
  `#define LIMIT 1e9` (`KMIN=16` does not work: the k loop then ends at 15).
  With `-DSNAP` (Linux, Windows) the frame at 26 s is written to `snap.rgb`:
  both equal `UW=1` preview frames exactly. macsim with a copy of
  `../tools/macsim/gl.c` that logs `glUniform4fv` showed `u.w = 1` at full
  size.
- `check_shaders.sh`: in the flight, the core context's frames differ from
  the compat ones along thin colour boundaries of the fractal (the last bit
  of float precision moves them): at most 0.04 % of the pixels at 160x90 over
  24 moments of the current flight (`TIMES="146 149.8 150.7 ..."`; the
  previous flight: 1.2 %). The threshold is 2 %. If `python3` has no numpy,
  set `PYTHON` (e.g. `PYTHON=python3.12`).
- Bug found by an earlier platform run (fixed): in the Linux asm, `band:` was
  placed between `rescale:` and `viewport:`, so `rescale` fell through into
  the music band's viewport. Keep fall-through chains intact.

## 7. Performance

llvmpipe, 480x270, ms per frame (as `tools/bench.py` measures; bulb section):

| B | 66 | 72 | 74 | 76 | 78 | 82 | 86 | 88 | 90 | 91.3 | 92 | 94 | 96 | 98 | 101 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ms | 16 | 41 | 77 | 87 | 104 | 75 | 81 | 98 | 113 | 132 | 96 | 77 | 40 | 34 | 14 |

- The heaviest moment is the valley in the flight (bars 91–91.5, where its
  walls fill the view; found with a sweep of the `map()` calls per pixel over
  bars 62–104, every 0.5 bar and 0.1 around the peak): `T_HEAVY` = 175.3 s
  (bar 91.3) in all three platform layers (the speed test renders 2
  half-size frames there; `KMIN` 11, `LIMIT` ~36 ms as in the 4K). The
  previous flight's heaviest frame was 116 ms (bar 94, 180 s).
- Calibration from the 4K (its HANDOFF): ~17 ms here ≈ 2 ms on the RTX 3060
  at 2560x1440, so the heaviest frame should be ~15.5 ms there. Intel HD will
  run at k = 11 and be slow in the flight.
- The building's shadows are back to 40 steps (see 4.1): +7 % frame time on
  the building's frames compared with 24 (they were 10–23 ms here).
