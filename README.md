# FrameLang

FrameLang v0.1 is an experimental, cross-platform scene language for HyperFrames videos. The
repository contains the [reviewed RFC](spec/FRAME_LANG_V1_SPEC.md), its
[review findings](spec/REVIEW_FINDINGS.md), a deliberately
small compiler pilot, and reproducible one-shot OpenCode trials.

The pilot accepts a **subset** of `framelang/v1`: text and staged SVG/image
states, stack/split/overlay layout, hard cuts, and `replace` events. It rejects
unsupported syntax. The RFC's full geometry proof, video clips, sync anchors,
and production integration are future work. A passing pilot render is evidence
about this subset, not proof of the full language guarantee.

## Requirements

- Node.js 22 or newer
- npm 10 or newer
- FFmpeg for rendering
- A Chromium runtime supported by the pinned HyperFrames CLI

No OS-specific shell scripts, absolute paths, Homebrew requirement, or bundled
system fonts are part of the repo. The same Node commands run on macOS, Linux,
and Windows. CI runs install, compile, check, and render smoke jobs on all
three platforms; equivalent semantics are the goal, not identical native
pixels across operating systems.

## Quick start

```text
npm ci
npm test
npm run example:compile
npm run example:check
npm run example:render
```

The example outputs are written under `out/` and are ignored by Git. To compile
an arbitrary program:

```text
node src/cli.mjs compile path/to/program.json out/my-video
node src/cli.mjs check out/my-video
node src/cli.mjs render out/my-video
```

`check` must pass before `render`; the CLI records the exact compiled source
hash and check result. The pilot never silently edits or shortens essential
copy. Invalid programs return a typed error and do not create a render-ready
artifact.

## One-shot evaluation

See [the protocol](experiments/PROTOCOL.md) and the
[first pilot results](experiments/ATLAS_PILOT_RESULTS.md). Each OpenCode attempt starts from a
frozen brief and a fresh output directory. One response is scored before any
model repair. Preferred admitted videos, degraded output, typed failures,
quality-gate failures, and infrastructure failures have separate counts. The
included trial artifacts are pilot observations, not a statistical claim. A
five-model MakeMyDemo comparison is the next v0.1 experiment.

## Naming

The repository name is `framelang` under Vikings Studio. `FrameLang`
is the scene language; MakeMyDemo's existing `frame.md` is a different brand
specification and may supply tokens to a future integration.
