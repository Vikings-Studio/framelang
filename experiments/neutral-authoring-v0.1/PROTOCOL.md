# Neutral authoring pilot

Shared factual brief, duration, orientation, frozen assets, local OpenCode
configuration, per-model reasoning variant and maximum two attempts per arm.
Both arms receive every-frame geometry and sampled contrast checks. All attempts,
responses, feedback, recorded tokens and USD are retained. No human-edited
programs, no human fallback renders and no aesthetics claim from a render pass.

FrameLang retries request a bounded JSON Patch; the repaired source passes the
same compiler/lint/check gate. Raw retries return HTML. This is an intentional
production cost difference, not a different retry allowance. Per-video cost to
first accepted render sums its attempts, including failures. Research/visual
refinement costs remain separate from this bounded task, visibly retained.

Pilot only: DeepSeek V4.1 Flash and MiMo V2.6 Flash. Two-model results do not
establish a five-model or general quality/cost win. Study order alternates.

Protocol correction: the first DeepSeek FrameLang request contained an invalid
custom-keyframe example (`values` instead of `value`, plus unsupported easings).
The live prompt was corrected before subsequent FrameLang requests. Its original
request is preserved; label any induced failure as a harness/prompt defect. This
pilot is exploratory, not a clean frozen-protocol benchmark.
