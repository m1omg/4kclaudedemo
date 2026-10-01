# ROZMERY (8K demo) — handoff notes

Technical notes for whoever continues this demo (written for Claude Code).
The user-facing description in Slovak is in `README.md`. The 4K intro BRÁNA
in the repository root is a separate project with its own `HANDOFF.md`; this
folder reuses its platform layers and tools but does not modify any of its
files.

## 1. State

| File | Size | Tested |
|---|---|---|
| `dist/rozmery-windows.exe` | 6103 B | Wine 9.0 + Mesa llvmpipe: whole demo, visuals correct, every checked audio window sample-exact (see 6) |
| `dist/rozmery-linux` | 6968 B | Xvfb + llvmpipe + PipeWire: whole demo, audio bit-identical over the whole song, ESC, k = 11 |
| `dist/rozmery-macos` | 7120 B | `../tools/macsim` (its machine code on Linux): whole demo, audio bit-identical over the whole song |

- The limit is 8192 bytes per file (`build.sh` checks it). Margins: Windows
  2089 B, Linux 1224 B, macOS 1072 B.
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
  tools/flypath.py      the camera's clearance over the Mandelbulb (see 4.3)
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
| 78–94 | low flight along the causeway toward the rising sun; weaving (4 bars) with banking; the height sinks from 0.006 to 0.0015 bulb units, so it gets faster | the hook twice (78, 86; the second time doubled an octave up, over rolling 16th bass); tom fills 85, 93 |
| 94–100 | pull-up over the west ridge, back out to the orbit, the sun back to its presentation angle | the groove continues to 98 |
| 100–104 | the whole bulb; fade (101–104) | outro on Cmaj7, fade |

## 4. Visuals (`src/scene.frag`)

- Globals: `B` bar; `T` the building's clock (rewinds 34–36.5, then 3; from
  63 it runs on so the blueprint grid fades); `N` night; `M`/`E` material and
  glow of the last `map()`; `Q` analytic ground step (1/-rd.y while marching
  primary rays, 1 otherwise); `Z` the view's scale (1; in the flight the
  camera's height above the causeway / 2, in world units / 10); `L` sun; `U`
  camera up (the surface's radial direction in the flight); tesseract: `A`
  extrusions, `F` axis fade-in, `R` 4D rotation, `P[16]` projected vertices,
  `V[16]` vertex weights, `W` slicing hyperplane (99 = none); bulb: `I`
  iterations, `H` phase, `G` orbit trap.
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
- The flight region was found with maps of the surface radius over
  directions (Python, float64 DE identical to the shader): along the equator,
  longitude -0.65 .. -1.15, a "causeway" whose crest (max over latitudes
  pi/2 +- 0.006) fits `r = 0.8792 - 0.1057 (phi + 0.898)^2` within +0.0008,
  with ridges (r 0.93–0.94) at both ends and a trench before the west one.
  Flying west there heads toward the sun.
- Camera (`camera()`, `B > 62.`), in bulb units around `C`: longitude `ph`
  (0.1 rad/bar in the orbit, 0.0306 in the flight, blended with the integral
  of a smoothstep so speed and position stay smooth), latitude `th` (1.39 ->
  pi/2, weaving +-0.004 with a 4-bar period), radius = crest (or 0.955 over
  the ridges) + height `h` (log-blend 2.38 -> 0.006 over 70–78, then x0.25
  by bar 94; back to 2.4 over 93–100). The view goes from the centre to
  "ahead and 7° down", `U` from world up to the radial direction (with a
  banking term), the sun from 34° ahead of the orbit (16° up) to low in the
  west (rising from -2° to ~17° over the flight).
- `tools/flypath.py` mirrors this path and prints the camera's distance to
  the surface: closest 0.00066 bulb units at bar 92.7. **Run it after any
  change to the path.**
- `Z` = height above the crest / 2: fog, shadows, AO, the normal's epsilon
  scale with it. Rays stop at `600 Z` (beyond only haze: -9 % frame time, same
  image). The sky uses `dot(rd, U)` (the local horizon).
- The ground fades into the sky over 66–70 (and is gone from 70).

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
  bit-identical over the whole song. Wine: all 33 checked 2-s windows
  sample-exact; the capture has gaps (Wine's audio underruns while llvmpipe
  takes the CPUs; fewer with `LP_NUM_THREADS=2`).
- `check_shaders.sh`: in the flight, the core context's frames differ from
  the compat ones along thin colour boundaries of the fractal (the last bit
  of float precision moves them): 1.2 % of the pixels at 160x90, 0.3 % at
  640x360. The threshold is 2 %.
- Bug found by an earlier platform run (fixed): in the Linux asm, `band:` was
  placed between `rescale:` and `viewport:`, so `rescale` fell through into
  the music band's viewport. Keep fall-through chains intact.

## 7. Performance

llvmpipe, 480x270, ms per frame (`tools/bench.py`; bulb section):

| B | 66 | 72 | 74 | 76 | 78 | 82 | 86 | 90 | 92 | 94 | 96 | 98 | 101 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ms | 16 | 39 | 76 | 87 | 94 | 103 | 95 | 89 | 106 | 116 | 77 | 52 | 14 |

- The heaviest moment is the end of the flight (179–181 s): `T_HEAVY` = 180 s
  in all three platform layers (the speed test renders 2 half-size frames
  there; `KMIN` 11, `LIMIT` ~36 ms as in the 4K).
- Calibration from the 4K (its HANDOFF): ~17 ms here ≈ 2 ms on the RTX 3060
  at 2560x1440, so the heaviest frame should be ~14 ms there. Intel HD will
  run at k = 11 and be slow in the flight.
- The building's shadows are back to 40 steps (see 4.1): +7 % frame time on
  the building's frames compared with 24 (they were 10–23 ms here).
