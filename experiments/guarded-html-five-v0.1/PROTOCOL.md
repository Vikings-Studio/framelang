# Five-model FrameLang HTML authoring

Models: DeepSeek V4.1 Flash, GLM5.2, GLM5.3, MiMo V2.6 Flash and Tencent Hy4 Preview.
No Longcat. All inference runs locally on Mac through the tool-disabled OpenCode
oneshot agent. The common brief is 8 seconds, 1920x1080, 24fps with local Inter/GSAP.
Models own HTML/CSS/SVG/motion. Source is never hand-edited or converted to JSON.

DeepSeek and GLM5.3 use supported low reasoning; Hy4 uses none; GLM5.2 and MiMo
use their configured defaults. At most 2 generation attempts per remaining model,
including retries for missing responses. An accepted render ends that model's
run. The 480 second harness deadline is recorded as such; unknown usage/cost stays
unknown. Event and stderr logs stream to disk for inspection.

GLM5.3 reuses its already-generated fresh HTML-authoring source and its original
$0.03440132/9550tokens/one model call, saving an unnecessary repeat call. Its
initial regex-harness rejection and unchanged-source replay remain labelled in
that study. This study does not erase or rebill it.

FrameLang's actual parser admits packaged resources, seals source/assets/runtime
inputs, checks geometry at all 192 frames and gates export. Contrast is sampled.
Rejected outputs receive concise source diagnostics; every attempt is preserved
and counted in per-video inference USD. Render compute is excluded. Trusted
HTML is not an untrusted sandbox or an arbitrary-JavaScript determinism proof.

The page keeps five with/without side-by-side cards and per-video stats. The raw
references are frozen historical outputs, with existing human-repair labels.
Different prompts/study dates mean this is a visual comparison, not a controlled
cost advantage claim. Prior typed-format results remain archived separately.

## Repair extension

DeepSeek's initial 2 attempts failed real checks (layout-property motion, then
clipped decorative shapes/contrast). Two additional feedback-driven repairs
were authorized by the ongoing retry task and recorded as attempts 3–4. Attempt3
then exposed a brief button-label occlusion/crossfade; attempt4 passed every
frame. Its per-video cost includes all 4 calls. The initial and repair runner
hashes are preserved separately. No failure is retroactively erased.

Hy4 received the same separately frozen repair extension after attempt 2
exposed a moving URL bar outside its safe container and a closing caption
outside its text box. Its original failures and every repair are retained.

## Targeted Hy4 repair

After attempts 3–4 retained the negative horizontal entrance of `#s2-url`,
`targeted-repair.mjs` records attempt 5 with a precise diagnosis: its `x:-40`
transform moves required content left of the `.safe` parent, so reducing width
cannot resolve the violation. The model must remove or reverse that entrance;
no human edits or functional-content exemptions are applied.
