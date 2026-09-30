# BRÁNA 4K intro

Read `HANDOFF.md` first: current state, the open issue (slow on Intel HD
Graphics on macOS) with its plan, architecture, build and test commands,
measurements. The Linux + NVIDIA tone is fixed (PR #6, HANDOFF section 2).

Hard rules:
- Every file in `dist/` must stay <= 4096 bytes (`./build.sh` checks it).
  Margins now: Windows 851 B, Linux 76 B, macOS 5 B.
- After every finished change: commit, push, open a PR into `main` and merge
  it yourself (the owner asked for this). Continue from the updated `main`.
- Keep `README.md` (Slovak) in sync with sizes and what was tested.
- Minified shaders must render bit-identically to the sources:
  `tools/check_shaders.sh` (needs `S` = scratch dir with the `preview` binary).
  On the owner's PC it also checks that NVIDIA compiles them: NVIDIA rejects
  some GLSL that Mesa and glslangValidator accept (HANDOFF section 2).
- The owner prefers: decimal arithmetic rules, not being presumptuous,
  software independent of the display refresh rate, simple Linux solutions.
