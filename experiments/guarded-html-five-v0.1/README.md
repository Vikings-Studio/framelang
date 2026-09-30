# Five models, original side-by-side layout

This local Mac study uses FrameLang's trusted HTML admission path for all five
established models. The page pairs each accepted model-owned source with its
frozen historical raw reference. Earlier typed JSON studies remain accessible
in the page's collapsed archive. The typed language remains supported.

See [PROTOCOL.md](PROTOCOL.md), [summary.json](summary.json), the exact prompts,
responses, streamed OpenCode logs, rejection feedback and compile reports under
`runs/`. GLM5.3's unchanged prior source and replay evidence are in
`../guarded-html-v0.1/`; its original call is counted once, without a new call.

Costs are per video across every recorded attempt. Missing usage is unknown,
not free. A known subtotal is a lower bound when any call lacks usage. Render
compute is excluded. The two 480-second harness deadlines had only a start
event and startup MCP warnings; those logs do not establish a provider timeout
or the cause of the missing response.

## Recorded results

| Model | Attempts | Accepted attempt | Tokens | Inference USD / video |
|---|---:|---:|---:|---:|
| DeepSeek V4.1 Flash | 4 | 4 | 84,754 | $0.035904666 |
| GLM 5.2 | 2 | 2 | ≥28,645 | ≥$0.118283 |
| GLM 5.3 | 1 | 1 | 9,550 | $0.03440132 |
| MiMo V2.6 Flash | 2 | 2 | ≥21,776 | ≥$0.00573188 |
| Tencent Hy4 Preview | 5 | 5 | 65,456 | $0.093474621 |

GLM5.3 is a prior source replay, not a new inference call. DeepSeek and Hy4
include every rejected repair. GLM5.2 and MiMo have unknown first-call usage.

## What the images establish

DeepSeek adds an editor preview, waveform and export timeline. MiMo adds staged
illustrated cards and an export button. GLM5.3 uses its richer previously
reviewed source. GLM5.2 remains sparse, including brief empty transitions.
The frozen raw MiMo reference still has stronger headline hierarchy. These
results demonstrate creative freedom, not consistent aesthetic superiority.

Accepted sources pass geometry observation at all 192 frames; contrast is
sampled. Trusted HTML is not an untrusted JavaScript sandbox or a proof of
arbitrary-source determinism. Passing geometry does not certify visual quality
or continuous readability. Original raw GLM5.2/5.3 previews retain their human
repair labels. Different prompts and dates prevent a controlled cost or
quality advantage claim.

## Reproduce

Install the pinned dependencies and supply a tool-disabled OpenCode workspace
and config through `OPENCODE_SAFE_DIR` and `OPENCODE_CONFIG`. `run.mjs` takes
explicit model IDs and writes new attempt directories; existing directories
prevent accidental reruns. `repair.mjs` is the separately frozen extension for
attempts 3–4; `targeted-repair.mjs` records the precise Hy4 diagnosis for attempt 5. Do not rerun paid inference just to republish the evidence.

Run `node experiments/guarded-html-five-v0.1/summarize.mjs`, then
`node experiments/guarded-html-five-v0.1/export-site.mjs <frontend-directory>`
to regenerate site data and copy verified videos. The exporter retains every
attempt, requires checked reports and refuses missing raw references.
