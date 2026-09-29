# Creative authoring v0.1 study

The original FrameLang prompt fixed a centered two-text layout. This study lets
models choose composition, text hierarchy, emphasis, paint, shapes, components,
portrait geometry and motion through `framelang/creative-v0.1`.

The original raw videos are frozen visual references. These refined prompts and
feedback retries are **not a controlled cost or first-shot comparison**. All
calls, including discarded designs and visual refinements, stay in the ledger.
Costs are per model/video study; no pair costs. OpenCode-reported USD excludes
render compute and review. Missing usage remains unknown, never zero.

## Reproduce locally

Install Node22+, FFmpeg, Chrome and OpenCode. Run `npm ci`. Configure a local
OpenCode primary agent named `oneshot` with temperature0 and permission `*` denied.
Set `OPENCODE_SAFE_DIR` and `OPENCODE_CONFIG` to its workspace and config. This
study ran locally on macOS; the compiler/browser smoke gates run on three OSes.

```sh
node experiments/creative-authoring-v0.1/measure.mjs deepseek-v4-1-flash
node experiments/creative-authoring-v0.1/repair.mjs glm-5-3 6 7 feedback.json
```

The measurement command defaults to two attempts and refuses to overwrite saved
attempts. `FRAMELANG_FIRST_ATTEMPT`, `FRAMELANG_MAX_ATTEMPTS` (1–5), and
`FRAMELANG_PROMPT` select a new range and prompt file. Repair receives the previous
JSON plus exact validation or visual feedback. It does not edit model designs.
Supported lower reasoning variants are selected from the installed catalog:
DeepSeek low, GLM5.3 low, Hy4 none; GLM5.2 and MiMo keep defaults.

JSON-only Markdown fences are removed deterministically and recorded as
formatViolation; JSON content is not hand-edited.

Each call has a local480s inference deadline. A deadline is a harness decision;
provider failure is not inferred from it. GLM5.3 attempt2 logged only step_start,
then was terminated by that deadline, with no completed usage event. Attempt3
failed locally opening OpenCode's log file; no provider event was emitted.

## Compiler and visual iterations

Saved responses exposed natural paint/portrait shorthand, source mapping errors,
font-floor inconsistencies, narrow process chips, and false maxLines failures.
Those were corrected in the language/compiler and replayed without inference.
The maxLines failure came from comparing glyph height to CSS line height; the
compiler now counts actual text-line rectangles. A browser regression proves a
valid tight single line passes and multiline content above its floor fails.

Contact-sheet review covered landscape and portrait, plus scene-cut frames. A
one-frame gap was removed by assigning every scene its full frame duration. The
compiler owns timed wrappers, so models cannot leave earlier scenes visible.

Private MakeMyDemo diagnostic data informed the failure taxonomy: text occlusion,
functional overlaps, canvas/container overflow, low contrast and stale exits.
Private footage and logs are not included in this public study. Those classes
lead to typed layering, bounds/overlap lint, measured readable fitting, source
mapped contrast feedback, final-visible essential content and gated rendering.

Final `replays/` use unedited model JSON with the latest compiler. Their selection
metadata identifies the originating attempt. Every frame is requested for
geometry checks; transition samples may add observations. Contrast has its own
sample schedule. Visual inspection supplements these measured checks.

Passing checks establishes the measured layout/timing contracts; aesthetic
parity is a visual judgment, and infrastructure availability is separate.
