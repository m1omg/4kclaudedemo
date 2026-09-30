# BRÁNA 4K intro

Read `HANDOFF.md` first: current state, the two open issues (Linux + NVIDIA
plays a tone instead of music; slow on Intel HD Graphics on macOS) with
debugging plans, architecture, build and test commands, measurements.

Hard rules:
- Every file in `dist/` must stay <= 4096 bytes (`./build.sh` checks it).
  Margins now: Windows 913 B, Linux 83 B, macOS 15 B.
- After every finished change: commit, push, open a PR into `main` and merge
  it yourself (the owner asked for this). Continue from the updated `main`.
- Keep `README.md` (Slovak) in sync with sizes and what was tested.
- Minified shaders must render bit-identically to the sources:
  `tools/check_shaders.sh` (needs `S` = scratch dir with the `preview` binary).
- The owner prefers: decimal arithmetic rules, not being presumptuous,
  software independent of the display refresh rate, simple Linux solutions.
