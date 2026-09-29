# Richer FrameLang scene: capability and admission record

The original [five-model first-shot comparison](../makemydemo-v0.1/RESULTS.md)
and the [15-call token study](../token-efficient-v0.1/RESULTS.md) remain frozen.
This is a separate capability example. It is 11.5 seconds long, while the
original model task was eight seconds, and its visual template was authored
and reviewed after seeing the raw videos. It is therefore **not** a fair
rescore of the model arms.

## What the raw clips showed

- DeepSeek used a clear left-aligned hierarchy and yellow word emphasis.
- MiMo used oversized headlines and a script + visuals + music → MP4 chain.
- Hy4 used a restrained grid, glow, and precise public-URL/first-cut wording.

The earlier generated FrameLang programs tended toward centered text cards
with small type and long empty holds. The
[editorial program](../../examples/makemydemo-editorial/program.json) exercises
the general FrameLang fields for alignment, size, weight, word-level accent
blocks, gradients, staged SVG, typed motion, and placement relative to another
node. The responsive `chain` flow and compact video artifact fill the assembly
scene. Its [four-field recipe](../../examples/makemydemo-recipe-v2.json) reuses
the **saved** MiMo V2.6 Flash copy from the final token-study attempt; no new
model inference was run for this example. The visual design and template took
human work, which is not included in inference cost.

## Acceptance

The compiler rejected out-of-bounds and overlapping placements before output.
Text was measured against the bundled font after load, with a 22 px minimum.
The `allFrames` mode requested every 24 fps output timestamp, transition
boundaries, and media frame checks. The final local macOS run had **347 observed
samples per profile**, including all 276 requested frame timestamps, with
**zero layout findings, zero runtime warnings, and zero contrast errors** in
landscape and portrait. An intentionally impossible text box was rejected with
a specific browser error. The positive [check log](check.log),
[render log](render.log), and [negative test log](unfit-rejection.log) are saved.
There were three known nested-structure lint warnings per profile. The checker
report gates the CLI render; preview hashes and counts are in
[verification.json](verification.json). Cross-platform CI runs the same gate.

The reviewed outputs are [landscape](preview/landscape.mp4) and
[portrait](preview/portrait.mp4). They illustrate the MakeMyDemo workflow, not
actual product UI footage. They are silent motion graphics, as in the original
comparison brief; “Music” names a product assembly step, not an audio track in
these files. See the [guardrail specification](../../spec/RICHNESS_AND_GUARDRAILS.md)
for what the gate proves and its limits. Human visual review remains necessary.
