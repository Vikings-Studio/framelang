# FrameLang

FrameLang v0.1 is an experimental, cross-platform scene language for HyperFrames videos. The
repository contains the [reviewed RFC](spec/FRAME_LANG_V1_SPEC.md), its
[review findings](spec/REVIEW_FINDINGS.md), a deliberately
small compiler pilot, and reproducible one-shot OpenCode trials.

The pilot accepts a **subset** of `framelang/v1`: text and staged SVG/image
states, stack/split/overlay layout, hard cuts, and `replace` events. The
[rich process subset](spec/V0_1_RICH_SUBSET.md) adds typed color emphasis,
display typography, left alignment, process flows, decoration, and bounded
entrance presets. The [expressive core](spec/V0_1_EXPRESSIVE_CORE.md) adds
typed gradients, positioned canvas layouts, local SVG assets, text styling,
and bounded keyframe tweens. The later
[richness and guardrails](spec/RICHNESS_AND_GUARDRAILS.md) update adds model-chosen
accent blocks, anchored relative placement, a responsive process chain,
measured canvas text fitting, and an opt-in every-rendered-frame check. It rejects
unsupported syntax. The RFC's full geometry proof, video clips, sync anchors,
and production integration are future work. A passing pilot render is evidence
about this subset, not proof of the full language guarantee.

The [model-expression audit](spec/MODEL_EXPRESSION_V0_1.md) compares the saved
raw model clips with typed FrameLang controls for layered transparent gradients,
type spacing, rules and outlines, and multi-point keyframe motion. The
[example program](examples/makemydemo-editorial/model-options.json) exercises
those choices in both output profiles.

For routine generation, a [versioned compact recipe](spec/V0_1_RECIPES.md)
can expand into a reviewed cinematic or editorial scene. The model writes three lead lines
instead of repeating layouts, hashes, assets, and animation boilerplate.

## Preserve model-owned visuals

[Trusted HyperFrames admission](spec/TRUSTED_HYPERFRAMES.md) accepts existing
HTML/CSS/SVG/GSAP compositions unchanged, then gates export on every-frame
geometry checks and sealed source/assets. It avoids schema conversion inference.
This experimental path runs trusted JavaScript; it does not have the typed
language's deterministic constraints or provide an untrusted-code sandbox.

The [neutral authoring pilot](experiments/neutral-authoring-v0.2/RESULTS.md)
records failures and per-video costs. The typed format has **not demonstrated a
general creativity or cost advantage** over raw models.

## Creative model authoring

Use [creative v0.1](spec/V0_1_CREATIVE_AUTHORING.md) for model-chosen composition,
typography, emphasis, gradients, shapes, relative placement and animation.
It omits compiler-owned hashes, states and event boilerplate, enables every-frame
geometry checks, and reports repairs in the model's authored node coordinates.
The [five-model creative study](experiments/creative-authoring-v0.1/README.md)
includes actual landscape/portrait videos, all attempts, token usage and costs.

```text
npm run creative:compile
npm run creative:check
npm run creative:render
```

## Requirements

- Node.js 22 or newer
- npm 10 or newer
- FFmpeg for rendering
- A Chromium runtime supported by the pinned HyperFrames CLI

Runtime commands have no OS-specific shell scripts, fixed absolute paths or
Homebrew requirement; fonts are staged from verified local assets. The same Node commands run on macOS, Linux,
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
npm run rich:compile
npm run rich:check
npm run rich:render
npm run cinematic:compile
npm run cinematic:check
npm run cinematic:render
npm run recipe:compile
npm run recipe:check
npm run recipe:render
npm run recipe:v2:compile
npm run recipe:v2:check
npm run recipe:v2:render
npm run options:compile
npm run options:check
npm run options:render
npm run verify:unfit-rejection
```

The example outputs are written under `out/` and are ignored by Git. To compile
an arbitrary program:

```text
node src/cli.mjs compile path/to/program.json out/my-video
node src/cli.mjs check out/my-video
node src/cli.mjs render out/my-video
```

For an LLM revision loop, run static lint before compiling:

```text
node src/cli.mjs lint path/to/program.json
```

`lint` prints one JSON object to stdout and exits with code 1 when it finds an
error. Canvas overlap findings identify the scene, profile, two node IDs,
source locations, rectangles, intersection, and a repair hint. Pass that JSON
back to the model as feedback, have it revise the authored FrameLang file, and
run lint again. `check` then writes `out/my-video/feedback.json` with compact
browser findings grouped across frames. Pass that file back for a further
revision if the check fails. The model never needs the full HyperFrames log or
generated HTML. A recipe can be linted too; its visual template is fixed, so
layout repairs require editing the full scene template. Neither lint nor check
silently changes the authored layout.

`check` must pass before `render`; the CLI records the exact compiled source
hash and check result. The pilot never silently edits or shortens essential
copy. Invalid programs return a typed error and do not create a render-ready
artifact.

## One-shot evaluation

See [the protocol](experiments/PROTOCOL.md), the
[first pilot results](experiments/ATLAS_PILOT_RESULTS.md), and the
[MakeMyDemo five-model comparison](experiments/makemydemo-v0.1/RESULTS.md). Each OpenCode attempt starts from a
frozen brief and a fresh output directory. One response is scored before any
model repair. Preferred admitted videos, degraded output, typed failures,
quality-gate failures, and infrastructure failures have separate counts. The
included trial artifacts are pilot observations, not a statistical claim. The
MakeMyDemo comparison records raw responses, check and render logs, token counts,
and the admitted videos. GLM 5.3 is open-weight under its own custom license;
the other four selected releases have MIT or Apache-2.0 weight licenses.

The later [token-efficient recipe trial](experiments/token-efficient-v0.1/RESULTS.md)
records 15 local model calls, including rejected attempts, a matched
full-scene serialization comparison, and a reviewed four-field MiMo example.
It keeps model inference cost separate from rendering and human review.

## Naming

The repository name is `framelang` under Vikings Studio. `FrameLang`
is the scene language; MakeMyDemo's existing `frame.md` is a different brand
specification and may supply tokens to a future integration.

## Model-owned creative authoring

Use [`framelang/creative-v0.1`](spec/V0_1_CREATIVE_AUTHORING.md) when models should choose composition, typography, backgrounds and motion. It removes internal-state boilerplate while keeping the compiler lint and per-frame render gate. Original comparison trials and designer-authored recipes remain separate evidence.
